import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { validateMessage, PROTOCOL_VERSION } from './protocol.js';
import { decodeInput, encodeSnapshot } from '@dogfight/shared/codec/binary';
import { validateInput } from '@dogfight/shared/protocol/messages';

const MAX_BUFFERED_BYTES = 64 * 1024;
const MAX_PLAYERS_PER_ROOM = 8;

export function createWebSocketServer(server, roomManager) {
    const wss = new WebSocketServer({server, path: '/ws', maxPayload: 4096});
    function send(socket, payload, critical = false) {
        if (socket.readyState !== 1) return;
        if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
            if (critical) socket.close(1008, 'Slow client');
            return;
        }
        socket.send(payload);
    }
    function network(socket, action) {
        const {latency, jitter, drop} = socket.networkConfig;
        if (Math.random() * 100 < drop) return;
        const delay = Math.max(0, latency + (Math.random() * 2 - 1) * jitter);
        const timer = setTimeout(() => {
            socket.networkTimers.delete(timer);
            if (socket.readyState === 1) action();
        }, delay);
        socket.networkTimers.add(timer);
    }
    function broadcastRoster(room) {
        const payload = JSON.stringify({v: PROTOCOL_VERSION, type: 'roster', players: [...room.players.values()]});
        for (const client of wss.clients) if (client.room === room) send(client, payload, true);
    }
    roomManager.onSnapshot = (room, snapshot) => {
        for (const client of wss.clients) {
            if (client.room !== room || !client.player || client.readyState !== 1) continue;
            const msg = {
                ...snapshot, playerId: client.player.id,
                lastProcessedSeq: snapshot.lastProcessedSeq[client.player.id] ?? -1,
            };
            const payload = client.codec === 'binary' ? encodeSnapshot(msg) : JSON.stringify({v: PROTOCOL_VERSION, ...msg});
            network(client, () => send(client, payload));
        }
    };

    wss.on('connection', (socket, request) => {
        socket.room = null;
        socket.player = null;
        socket.networkConfig = {latency: 0, jitter: 0, drop: 0};
        socket.networkTimers = new Set();
        socket.codec = new URL(request.url, 'http://localhost').searchParams.get('codec') === 'json' ? 'json' : 'binary';
        let tokens = 10, inputTokens = 40;
        let lastRefill = performance.now();
        function consumeToken(input) {
            const now = performance.now();
            const elapsed = (now - lastRefill) / 1000;
            lastRefill = now;
            tokens = Math.min(10, tokens + elapsed * 10);
            inputTokens = Math.min(40, inputTokens + elapsed * 40);
            if (input) { if (inputTokens < 1) return false; inputTokens--; }
            else { if (tokens < 1) return false; tokens--; }
            return true;
        }
        socket.missedPongs = 0;
        socket.on('pong', () => socket.missedPongs = 0);
        socket.on('error', e => console.error('WebSocket error:', e));
        const joinTimeout = setTimeout(() => { if (!socket.room) socket.close(1008, 'Join timeout'); }, 5000);
        socket.on('message', (raw, isBinary) => {
            let data;
            try {
                if (isBinary) {
                    if (socket.codec !== 'binary') throw new Error('Binary disabled');
                    data = decodeInput(raw);
                    if (!validateInput(data)) throw new Error('Invalid input');
                } else {
                    data = JSON.parse(raw.toString());
                    if (!validateMessage(data)) throw new Error('Invalid message');
                }
            } catch (e) { socket.close(isBinary ? 1008 : 1007, 'Invalid message'); return; }
            if (!consumeToken(data.type === 'input')) { socket.close(1008, 'Rate limit exceeded'); return; }

            if (data.type === 'networkConfig') {
                if (!socket.room) { socket.close(1008, 'Join required'); return; }
                socket.networkConfig = {latency: data.latency, jitter: data.jitter, drop: data.drop};
                return;
            }
            if (data.type === 'join') {
                if (socket.room) { socket.close(1008, 'Already joined'); return; }
                const room = roomManager.get(data.roomId);
                if (!room) { socket.close(1008, 'Room not found'); return; }
                if (room.players.size >= MAX_PLAYERS_PER_ROOM) { socket.close(1008, 'Room full'); return; }
                const player = {id: randomUUID(), name: data.playerName.trim()};
                socket.room = room; socket.player = player;
                room.join(player);
                roomManager.getMatch(room.id).addPlayer(player);
                clearTimeout(joinTimeout);
                broadcastRoster(room);
                return;
            }
            if (!socket.room) { socket.close(1008, 'Join required'); return; }
            if (data.type === 'ping') {
                network(socket, () => network(socket, () => send(socket, JSON.stringify({v: PROTOCOL_VERSION, type: 'pong', sentAt: data.sentAt}))));
                return;
            }
            if (data.type === 'input') {
                const playerId = socket.player.id;
                const roomId = socket.room.id;
                network(socket, () => roomManager.getMatch(roomId)?.receiveInput(playerId, data));
                return;
            }
            if (data.type === 'chat') {
                const message = data.message.trim();
                socket.room.chat(socket.player.id, message);
                const payload = JSON.stringify({v: PROTOCOL_VERSION, type: 'chat', playerId: socket.player.id, playerName: socket.player.name, message});
                for (const client of wss.clients) if (client.room === socket.room) send(client, payload);
            }
        });
        socket.on('close', () => {
            clearTimeout(joinTimeout);
            for (const timer of socket.networkTimers) clearTimeout(timer);
            socket.networkTimers.clear();
            if (!socket.room || !socket.player) return;
            const room = socket.room;
            roomManager.getMatch(room.id)?.removePlayer(socket.player.id);
            room.leave(socket.player.id);
            broadcastRoster(room);
            socket.room = null; socket.player = null;
        });
    });
    const heartbeat = setInterval(() => {
        for (const socket of wss.clients) {
            if (socket.readyState !== 1) continue;
            if (socket.missedPongs >= 2) { socket.terminate(); continue; }
            socket.missedPongs++;
            socket.ping();
        }
    }, 15000);
    wss.on('close', () => clearInterval(heartbeat));
    return wss;
}
