import { encodeInput, decodeSnapshot } from '@dogfight/shared/codec/binary';

export function createConnection() {
    const handlers = new Map();
    let socket = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let shouldReconnect = true;
    const codec = new URLSearchParams(location.search).get('codec') === 'json' ? 'json' : 'binary';
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${scheme}//${location.host}/ws?codec=${codec}`;
    let sentBytes = 0, receivedBytes = 0;

    function dispatch(data) {
        for (const callback of handlers.get(data.type) ?? []) callback(data);
    }
    function send(data) {
        if (socket?.readyState !== WebSocket.OPEN) return false;
        const payload = data.type === 'input' && codec === 'binary'
            ? encodeInput(data)
            : JSON.stringify({v: 0, ...data});
        socket.send(payload);
        sentBytes += typeof payload === 'string' ? new TextEncoder().encode(payload).length : payload.byteLength;
        return true;
    }
    function connect() {
        if (!shouldReconnect || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
        socket = new WebSocket(url);
        socket.binaryType = 'arraybuffer';
        socket.onopen = () => {
            reconnectAttempts = 0;
            clearTimeout(reconnectTimer);
            dispatch({type: 'open'});
        };
        socket.onmessage = event => {
            try {
                const bytes = typeof event.data === 'string' ? new TextEncoder().encode(event.data).length : event.data.byteLength;
                receivedBytes += bytes;
                const data = typeof event.data === 'string' ? JSON.parse(event.data) : decodeSnapshot(event.data);
                dispatch(data);
            } catch (error) { console.error('Invalid server message:', error); }
        };
        socket.onerror = error => console.error('WebSocket error:', error);
        socket.onclose = event => {
            dispatch({type: 'close', code: event.code});
            if (!shouldReconnect) return;
            if ([1007, 1008, 1009].includes(event.code)) {
                shouldReconnect = false;
                dispatch({type: 'failed', code: event.code});
                return;
            }
            const delay = Math.min(1000 * 2 ** reconnectAttempts++, 30000);
            reconnectTimer = setTimeout(connect, delay);
        };
    }
    function on(type, callback) {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type).add(callback);
        return () => handlers.get(type)?.delete(callback);
    }
    function disconnect() {
        shouldReconnect = false;
        clearTimeout(reconnectTimer);
        if (socket && socket.readyState <= WebSocket.OPEN) socket.close(1000, 'Client disconnected');
    }
    function traffic() { return {sentBytes, receivedBytes, codec}; }
    return {connect, disconnect, send, on, traffic};
}
