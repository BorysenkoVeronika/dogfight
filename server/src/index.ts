import type {IncomingMessage, ServerResponse} from 'node:http';
import {CreateRoomRequestSchema} from '@dogfight/shared/protocol';
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

    const botRoute = /^\/api\/rooms\/([a-zA-Z0-9_-]+)\/bots$/.exec(req.url ?? '');
    if (req.method === 'POST' && botRoute) {
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

    if (req.method === 'GET' && req.url === '/api/slow') {
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


    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
        });

        res.end(JSON.stringify({ status: 'ok' }));
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
    console.error('HTTP request failed:', error);
    if (!res.headersSent) res.writeHead(500);
    if (!res.writableEnded) res.end('Internal Server Error');
  });
});

const wss = createWebSocketServer(server, roomManager);

server.listen(config.port, config.host, () => {
    console.log(`Server running at http://${config.host}:${config.port}`);
});

let shuttingDown = false;

function shutdown(signal: string): void {
    if (shuttingDown) return;

    shuttingDown = true;

    roomManager.stopAll();

    console.log(`Received ${signal}. Shutting down...`);

    for (const socket of wss.clients) {
        socket.terminate();
    }

    wss.close((wsError?: Error) => {
        if (wsError) {
            console.error('Error closing WebSocket server:', wsError);
            process.exitCode = 1;
        }

        server.close((httpError) => {
          void (async () => {
            if (httpError) {
                console.error('Error closing HTTP server:', httpError);
                process.exitCode = 1;
            }

            try {
                await closeEventLog();
                console.log('Event log closed successfully.');
            } catch (error) {
                console.error('Error closing event log:', error);
                process.exitCode = 1;
            }

            if (!httpError && !wsError) {
                console.log('Server closed successfully.');
            }
          })().catch((error:unknown) => { console.error('Server cleanup failed:',error); process.exitCode=1; });
        });

        server.closeIdleConnections();
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));