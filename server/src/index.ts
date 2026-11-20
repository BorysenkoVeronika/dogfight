import type {IncomingMessage, ServerResponse} from 'node:http';
import {CreateRoomRequestSchema} from '@dogfight/shared/protocol';
import {logger,metrics} from './observability.ts';
import {buildVersion} from './version.ts';
import { performance as nodePerformance } from 'node:perf_hooks';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { getReplayPath, getReplaySize } from './replay.ts';
import { closeEventLog } from './event-log.ts';
import { createWebSocketServer } from './ws.ts';
import { RoomManager } from './room-manager.ts';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.ts';
import { createServer } from 'node:http';

const roomManager = new RoomManager();

roomManager.create('Training Room', 'room-1');
roomManager.create('Alternative Room', 'room-2');

const distPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../client/dist'
);

const mimeTypes: Record<string,string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
};

async function readBody(req: IncomingMessage, maxBytes: number = 1024): Promise<string> {
    let size = 0;
    const chunks: Buffer[] = [];

    for await (const rawChunk of req) {
        const chunk: Buffer = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk as Uint8Array);
        size += chunk.length;

        if (size > maxBytes) {
            const error = Object.assign(new Error('Request body too large'), {statusCode:413});
            throw error;
        }

        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let pathname;

    try {
        const rawPath = (req.url ?? '/').split('?')[0];
        pathname = decodeURIComponent(rawPath ?? '/');

        if (pathname.split(/[\\/]/).includes('..')) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }
    } catch {
        res.writeHead(400);
        res.end('Invalid URL');
        return;
    }

    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = resolve(distPath, `.${requestedPath}`);

    if (filePath !== distPath && !filePath.startsWith(distPath + sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    try {
        const content = await readFile(filePath);
        const contentType = mimeTypes[extname(filePath)] ?? 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (error) {
        res.writeHead((error instanceof Error && 'code' in error ? error.code : undefined) === 'ENOENT' ? 404 : 500);
        res.end((error instanceof Error && 'code' in error ? error.code : undefined) === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
    }
}

const server = createServer((req, res) => {
  void (async () => {

    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({status:'ok',version:buildVersion}));return;
    }
    if (req.method === 'GET' && req.url === '/ready') {
        res.writeHead(shuttingDown?503:200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify({status:shuttingDown?'shutting_down':'ready',version:buildVersion}));return;
    }
    if (req.method === 'GET' && req.url === '/metrics') {
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify(metrics(roomManager)));return;
    }
    if(shuttingDown){res.writeHead(503);res.end('Server shutting down');return;}

    const botRoute = /^\/api\/rooms\/([a-zA-Z0-9_-]+)\/bots$/.exec(req.url ?? '');
    if (config.nodeEnv !== 'production' && req.method === 'POST' && botRoute) {
        try {
            const room = roomManager.get(botRoute[1] ?? '');
            const match = room && roomManager.getMatch(room.id);
            if (!match) { res.writeHead(404);res.end('Room not found');return; }
            const raw:unknown = JSON.parse(await readBody(req));
            const count:unknown = raw && typeof raw === 'object' && 'count' in raw ? raw.count : undefined;
            if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 8) { res.writeHead(400);res.end('Invalid bot count');return; }
            const bots = match.addBots(count);
            roomManager.onRosterChanged?.(room);
            res.writeHead(201, {'Content-Type':'application/json'});
            res.end(JSON.stringify({bots}));
        } catch (error) {
            const status=error instanceof SyntaxError||error instanceof RangeError?400:500;
            res.writeHead(status,{'Content-Type':'application/json'});
            res.end(JSON.stringify({error:status===400?'Invalid bot request':'Internal server error'}));
        }
        return;
    }
    if (req.method === 'GET' && req.url === '/api/stats') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
        });

        res.end(JSON.stringify({
            matches: roomManager.getStats(),
            eventLoopUtilization: nodePerformance.eventLoopUtilization().utilization,
            rssBytes: process.memoryUsage().rss,
        }));

        return;
    }

    if (config.nodeEnv !== 'production' && req.method === 'GET' && req.url === '/api/slow') {
        const start = performance.now();

        while (performance.now() - start < 300) {
            // Deliberately block the event loop for 300 ms.
        }

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
        });

        res.end(JSON.stringify({
            message: 'Blocking operation completed',
            durationMs: Math.round(performance.now() - start),
        }));

        return;
    }


    if (req.method === 'GET' && req.url?.startsWith('/api/replays/')) {
        const id = req.url.slice('/api/replays/'.length).split('?')[0] ?? ''; 

        try {
            const filePath = getReplayPath(id);
            const size = await getReplaySize(id);

            res.writeHead(200, {
                'Content-Type': 'application/x-ndjson; charset=utf-8',
                'Content-Length': size,
                'Cache-Control': 'no-store',
            });

            await pipeline(createReadStream(filePath), res);
        } catch (error) {
            if (res.headersSent) {
                res.destroy(error instanceof Error ? error : new Error(String(error)));
                return;
            }

            const status = (error instanceof Error && 'code' in error ? error.code : undefined) === 'ENOENT' ? 404 : 400;

            res.writeHead(status, {
                'Content-Type': 'application/json; charset=utf-8',
            });

            res.end(JSON.stringify({
                error: status === 404 ? 'Replay not found' : 'Invalid replay',
            }));
        }

        return;
    }


    if (req.method === 'GET' && req.url === '/api/rooms') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
        });

        res.end(JSON.stringify(roomManager.list()));
        return;
    }

    if (req.method === 'POST' && req.url === '/api/rooms') {
        try {
            const body = await readBody(req);
            const decoded:unknown = JSON.parse(body);
            const parsed=CreateRoomRequestSchema.safeParse(decoded);
            if(!parsed.success){res.writeHead(400,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'Invalid room name'}));return;}
            const data=parsed.data;

            if (
                typeof data.name !== 'string' ||
                data.name.trim().length < 3 ||
                data.name.trim().length > 50
            ) {
                res.writeHead(400, {
                    'Content-Type': 'application/json; charset=utf-8',
                });

                res.end(JSON.stringify({ error: 'Invalid room name' }));
                return;
            }

            const room = roomManager.create(data.name.trim());

            res.writeHead(201, {
                'Content-Type': 'application/json; charset=utf-8',
            });

            res.end(JSON.stringify({
                id: room.id,
                name: room.name,
            }));
        } catch (error) {
            const maybeStatus = error instanceof Error && 'statusCode' in error ? error.statusCode : undefined;
            const status = typeof maybeStatus === 'number' ? maybeStatus : 400;

            res.writeHead(status, {
                'Content-Type': 'application/json; charset=utf-8',
            });

            res.end(JSON.stringify({
                error: status === 503
                    ? 'Room limit reached'
                    : status === 413
                        ? 'Request body too large'
                        : 'Invalid JSON',
            }));
        }

        return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
        await serveStatic(req, res);
        return;
    }

    res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8',
    });

    res.end(JSON.stringify({ error: 'Not Found' }));
  })().catch((error:unknown) => {
    logger.error({event:'http.failed',error:error instanceof Error?error.stack:String(error)});
    if (!res.headersSent) res.writeHead(500);
    if (!res.writableEnded) res.end('Internal Server Error');
  });
});

const wss = createWebSocketServer(server, roomManager);

server.listen(config.port, config.host, () => {
    logger.info({event:'server.listening',host:config.host,port:config.port,version:buildVersion});
});

let shuttingDown = false;
let shutdownTimer:ReturnType<typeof setTimeout>|null=null;
async function finishShutdown():Promise<void> {
 try {await closeEventLog();logger.info({event:'server.logs_flushed'});}
 catch(error){logger.error({event:'server.log_flush_failed',error:error instanceof Error?error.stack:String(error)});process.exitCode=1;}
 if(shutdownTimer)clearTimeout(shutdownTimer);
 logger.info({event:'server.stopped'});
}
function shutdown(signal:string):void {
 if(shuttingDown)return;
 shuttingDown=true;
 logger.info({event:'server.shutdown',signal});
 roomManager.stopAll();
 shutdownTimer=setTimeout(()=>{logger.error({event:'server.shutdown_timeout'});process.exit(1);},9000);
 shutdownTimer.unref();
 for(const socket of wss.clients){
  if(socket.readyState===1){
   try {socket.send(JSON.stringify({v:0,type:'shutdown',message:'Server restarting. Reconnecting to lobby...'}));}
   catch(error){logger.warn({event:'server.notify_failed',error:String(error)});}
   socket.close(1001,'Server restarting');
  } else socket.terminate();
 }
 const terminateTimer=setTimeout(()=>{for(const socket of wss.clients)socket.terminate();},2000);
 terminateTimer.unref();
 wss.close((wsError?:Error)=>{
  if(wsError){logger.error({event:'ws.close_failed',error:wsError.stack});process.exitCode=1;}
  server.close(httpError=>{
   if(httpError){logger.error({event:'http.close_failed',error:httpError.stack});process.exitCode=1;}
   void finishShutdown().catch(error=>{logger.error({event:'shutdown.failed',error:String(error)});process.exitCode=1;});
  });
  server.closeIdleConnections();
 });
}
process.on('SIGINT',()=>shutdown('SIGINT'));
process.on('SIGTERM',()=>shutdown('SIGTERM'));
function fatal(event:string,error:unknown):void {
 logger.fatal({event,error:error instanceof Error?error.stack:String(error)});
 process.exit(1);
}
process.on('uncaughtException',error=>fatal('process.uncaught_exception',error));
process.on('unhandledRejection',error=>fatal('process.unhandled_rejection',error));
