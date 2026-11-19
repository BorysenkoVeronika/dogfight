import { Match } from './match.js';
import { Room } from './room.js';
import { randomUUID } from 'node:crypto';
import { logRoomEvents } from './event-log.js';

const MAX_ROOMS = 10;

export class RoomManager {
    #rooms = new Map();

    #matches = new Map();

    create(name, id = `room-${randomUUID()}`) {

        if (this.#rooms.size >= MAX_ROOMS) {
            const error = new Error('Room limit reached');
            error.statusCode = 503;
            throw error;
        }

        const room = new Room(id, name);

        logRoomEvents(room);

        this.#rooms.set(room.id, room);

        const match = new Match(room, (room, snapshot) => {
            this.onSnapshot?.(room, snapshot);
        });

        this.#matches.set(room.id, match);
        match.start();

        room.on('empty', () => {
            match.stop();
            this.#matches.delete(room.id);
            this.#rooms.delete(room.id);
        });

        return room;
    }

    get(id) {
        return this.#rooms.get(id);
    }

    delete(id) {
        const match = this.#matches.get(id);

        if (match) {
            match.stop();
            this.#matches.delete(id);
        }

        return this.#rooms.delete(id);
    }

    list() {
        return [...this.#rooms.values()].map(({ id, name }) => ({
            id,
            name,
        }));
    }

    getMatch(roomId) {
        return this.#matches.get(roomId);
    }

    getStats() {
        return [...this.#matches.entries()].map(([roomId, match]) => ({
            roomId,
            ...match.getStats(),
        }));
    }

    stopAll() {
        for (const match of this.#matches.values()) {
            match.stop();
        }
    }
}