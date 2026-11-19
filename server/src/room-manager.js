import { Room } from './room.js';
import { randomUUID } from 'node:crypto';
import { logRoomEvents } from './event-log.js';

const MAX_ROOMS = 10;

export class RoomManager {
    #rooms = new Map();

    create(name, id = `room-${randomUUID()}`) {

        if (this.#rooms.size >= MAX_ROOMS) {
            const error = new Error('Room limit reached');
            error.statusCode = 503;
            throw error;
        }

        const room = new Room(id, name);

        logRoomEvents(room);

        this.#rooms.set(room.id, room);

        room.on('empty', () => {
            this.#rooms.delete(room.id);
        });

        return room;
    }

    get(id) {
        return this.#rooms.get(id);
    }

    delete(id) {
        return this.#rooms.delete(id);
    }

    list() {
        return [...this.#rooms.values()].map(({ id, name }) => ({
            id,
            name,
        }));
    }
}