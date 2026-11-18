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
                error: status === 413 ? 'Request body too large' : 'Invalid JSON',
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
        socket.close(1001, 'Server shutting down');
    }

    wss.close((wsError) => {
        if (wsError) {
            console.error('Error closing WebSocket server:', wsError);
            process.exitCode = 1;
        }

        server.close((httpError) => {
            if (httpError) {
                console.error('Error closing HTTP server:', httpError);
                process.exitCode = 1;
            } else {
                console.log('Server closed successfully.');
            }

            if (!wsError && !httpError) {
                process.exitCode = 0;
            }
        });

        server.closeIdleConnections();
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));