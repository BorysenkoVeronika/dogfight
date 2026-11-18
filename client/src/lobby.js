export async function fetchRooms(signal) {
    const response = await fetch('/api/rooms', { signal });

    if (!response.ok) {
        throw new Error(`Failed to fetch rooms: ${response.status}`);
    }

    return response.json();
}

export class Lobby extends EventTarget {
    constructor({ interval = 5000, timeout = 5000 } = {}) {
        super();

        this.interval = interval;
        this.timeout = timeout;
        this.rooms = [];
        this.controller = null;
        this.timer = null;
    }

    async refresh() {
        this.controller?.abort();

        const controller = new AbortController();
        this.controller = controller;

        const signal = AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(this.timeout)
        ]);

        try {
            const rooms = await fetchRooms(signal);

            if (!signal.aborted) {
                this.rooms = rooms;

                this.dispatchEvent(
                    new CustomEvent('roomsChanged', { detail: rooms })
                );
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error('Failed to refresh rooms:', error);
            }
        }
    }

    async createRoom(name) {
        const response = await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        if (!response.ok) {
            throw new Error(`Failed to create room: ${response.status}`);
        }

        const room = await response.json();
        await this.refresh();

        return room;
    }

    join(roomId) {
        const room = this.rooms.find(room => room.id === roomId);

        if (!room) {
            throw new Error('Room not found');
        }

        this.dispatchEvent(
            new CustomEvent('joined', { detail: room })
        );

        return room;
    }

    start() {
        if (this.timer !== null) return;

        this.refresh();
        this.timer = setInterval(() => this.refresh(), this.interval);
    }

    stop() {
        clearInterval(this.timer);
        this.timer = null;

        this.controller?.abort();
        this.controller = null;
    }
}
