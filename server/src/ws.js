import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { validateMessage, PROTOCOL_VERSION } from './protocol.js';

const MESSAGE_RATE = 10;
const MESSAGE_BURST = 10;
const MAX_PLAYERS_PER_ROOM = 8;
const MAX_BUFFERED_BYTES = 64 * 1024;

export function createWebSocketServer(server, roomManager) {
    const wss = new WebSocketServer({
        server,
        path: '/ws',
        maxPayload: 4096,
    });

    function sendToClient(socket, message, critical = false) {
        if (socket.readyState !== 1) return;

        if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
            if (critical) {
                console.warn('WebSocket closed: slow client');
                socket.close(1008, 'Slow client');
            }

            return;
        }

        socket.send(message);
    }

    function broadcastRoster(room) {
        const players = [...room.players.values()];

        const message = JSON.stringify({
            v: PROTOCOL_VERSION,
            type: 'roster',
            players,
        });

        for (const client of wss.clients) {
            if (client.room === room && client.readyState === 1) {
                sendToClient(client, message, true);
            }
        }
    }

    wss.on('connection', (socket) => {
        socket.player = null;
        socket.room = null;

        let tokens = MESSAGE_BURST;
        let lastRefill = performance.now();

        function consumeToken() {
            const now = performance.now();
            const elapsed = (now - lastRefill) / 1000;

            tokens = Math.min(
                MESSAGE_BURST,
                tokens + elapsed * MESSAGE_RATE
            );

            lastRefill = now;

            if (tokens < 1) return false;

            tokens--;
            return true;
        }

        socket.missedPongs = 0;

        socket.on('pong', () => {
            socket.missedPongs = 0;
        });

        socket.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        const joinTimeout = setTimeout(() => {
            if (!socket.room) {
                console.warn('WebSocket closed: join timeout');
                socket.close(1008, 'Join timeout');
            }
        }, 5000);

        socket.on('message', (raw) => {
            if (!consumeToken()) {
                console.warn('WebSocket closed: rate limit exceeded');
                socket.close(1008, 'Rate limit exceeded');
                return;
            }

            let data;

            if (raw.length > 4096) {
                console.warn('WebSocket closed: message too large');
                socket.close(1009, 'Message too large');
                return;
            }

            try {
                data = JSON.parse(raw.toString());
            } catch {
                console.warn('WebSocket closed: invalid JSON');
                socket.close(1007, 'Invalid JSON');
                return;
            }

            if (!validateMessage(data)) {
                console.warn('WebSocket closed: invalid message');
                socket.close(1008, 'Invalid message');
                return;
            }

            if (data.type === 'join') {
                if (socket.room) {
                    console.warn('WebSocket closed: duplicate join');
                    socket.close(1008, 'Already joined');
                    return;
                }

                const room = roomManager.get(data.roomId);

                if (!room) {
                    console.warn('WebSocket closed: room not found');
                    socket.close(1008, 'Room not found');
                    return;
                }

                if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
                    console.warn('WebSocket closed: room full');
                    socket.close(1008, 'Room full');
                    return;
                }

                const player = {
                    id: randomUUID(),
                    name: data.playerName.trim(),
                };

                socket.player = player;
                socket.room = room;

                room.join(player);
                clearTimeout(joinTimeout);
                broadcastRoster(room);

                console.log(`${player.name} joined ${room.name}`);
                return;
            }

            if (!socket.room) {
                console.warn('WebSocket closed: message before join');
                socket.close(1008, 'Join required');
                return;
            }

            if (data.type === 'chat') {

                const message = data.message.trim();

                socket.room.chat(socket.player.id, message);

                const payload = JSON.stringify({
                    v: PROTOCOL_VERSION,
                    type: 'chat',
                    playerId: socket.player.id,
                    playerName: socket.player.name,
                    message,
                });

                for (const client of wss.clients) {
                    if (
                        client.room === socket.room &&
                        client.readyState === 1
                    ) {
                        sendToClient(client, payload);
                    }
                }
            }
        });

        socket.on('close', () => {
            clearTimeout(joinTimeout);

            if (socket.room && socket.player) {
                const room = socket.room;

                room.leave(socket.player.id);
                broadcastRoster(room);

                console.log(`${socket.player.name} left ${room.name}`);

                socket.player = null;
                socket.room = null;
            }
        });
    });

    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            if (socket.readyState !== 1) continue;

            if (socket.missedPongs >= 2) {
                console.warn('WebSocket terminated: missed two pongs');
                socket.terminate();
                continue;
            }

            socket.missedPongs++;
            socket.ping();
        }
    }, 15000);

    wss.on('close', () => {
        clearInterval(heartbeat);
    });

    return wss;
}