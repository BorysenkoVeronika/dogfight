
export function createConnection() {
    const handlers = new Map();
    const queue = [];

    let socket = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let shouldReconnect = true;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;

    function dispatch(data) {
        const callbacks = handlers.get(data.type) ?? [];

        for (const callback of callbacks) {
            callback(data);
        }
    }

    function send(data) {
        const message = JSON.stringify({ v: 0, ...data });

        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(message);
        } else if (shouldReconnect) {
            queue.push(message);
        }
    }

    function connect() {
        if (!shouldReconnect) return;

        if (
            socket?.readyState === WebSocket.OPEN ||
            socket?.readyState === WebSocket.CONNECTING
        ) {
            return;
        }

        socket = new WebSocket(url);

        socket.onopen = () => {
            reconnectAttempts = 0;
            clearTimeout(reconnectTimer);

            dispatch({ type: 'open' });

            while (
                queue.length > 0 &&
                socket.readyState === WebSocket.OPEN
            ) {
                socket.send(queue.shift());
            }
        };

        socket.onmessage = event => {
            try {
                dispatch(JSON.parse(event.data));
            } catch (error) {
                console.error('Invalid WebSocket message:', error);
            }
        };

        socket.onerror = error => {
            console.error('WebSocket error:', error);
        };

        socket.onclose = event => {
            dispatch({ type: 'close', code: event.code });

            if (!shouldReconnect) return;

            // Do not retry protocol or policy violations.
            if ([1007, 1008, 1009].includes(event.code)) {
                shouldReconnect = false;
                dispatch({ type: 'failed', code: event.code });
                return;
            }

            const delay = Math.min(
                1000 * 2 ** reconnectAttempts,
                30000
            );

            reconnectAttempts++;

            reconnectTimer = setTimeout(connect, delay);
        };
    }

    function on(type, callback) {
        if (!handlers.has(type)) {
            handlers.set(type, new Set());
        }

        handlers.get(type).add(callback);

        return () => handlers.get(type)?.delete(callback);
    }

    function disconnect() {
        shouldReconnect = false;
        clearTimeout(reconnectTimer);
        queue.length = 0;

        if (
            socket?.readyState === WebSocket.OPEN ||
            socket?.readyState === WebSocket.CONNECTING
        ) {
            socket.close(1000, 'Client disconnected');
        }
    }

    return { connect, disconnect, send, on };
}
