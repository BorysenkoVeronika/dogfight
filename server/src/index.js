import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { getReplayPath, getReplaySize } from './replay.js';
import { closeEventLog } from './event-log.js';
import { createWebSocketServer } from './ws.js';
import { RoomManager } from './room-manager.js';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createServer } from 'node:http';

const roomManager = new RoomManager();

roomManager.create('Training Room', 'room-1');
roomManager.create('Alternative Room', 'room-2');

const distPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../client/dist'
);

const mimeTypes = {
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

async function readBody(req, maxBytes = 1024) {
    let size = 0;
    const chunks = [];

    for await (const chunk of req) {
        size += chunk.length;

        if (size > maxBytes) {
            const error = new Error('Request body too large');
            error.statusCode = 413;
            throw error;
        }

        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString('utf8');
}

async function serveStatic(req, res) {
    let pathname;

    try {
        const rawPath = req.url.split('?')[0];
        pathname = decodeURIComponent(rawPath);

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
        res.writeHead(error.code === 'ENOENT' ? 404 : 500);
        res.end(error.code === 'ENOENT' ? 'Not Found' : 'Internal Server Error');
    }
}

const server = createServer(async (req, res) => {

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


    if (req.method === 'GET' && req.url.startsWith('/api/replays/')) {
        const id = req.url.slice('/api/replays/'.length).split('?')[0];

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
                res.destroy(error);
                return;
            }

            const status = error.code === 'ENOENT' ? 404 : 400;

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
            const data = JSON.parse(body);

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
            const status = error.statusCode ?? 400;

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
});

const wss = createWebSocketServer(server, roomManager);

server.listen(config.port, config.host, () => {
    console.log(`Server running at http://${config.host}:${config.port}`);
});

let shuttingDown = false;

function shutdown(signal) {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`Received ${signal}. Shutting down...`);

    for (const socket of wss.clients) {
        socket.terminate();
    }

    wss.close((wsError) => {
        if (wsError) {
            console.error('Error closing WebSocket server:', wsError);
            process.exitCode = 1;
        }

        server.close(async (httpError) => {
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
        });

        server.closeIdleConnections();
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));