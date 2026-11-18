import { Room } from './room.js';
import { randomUUID } from 'node:crypto';

export class RoomManager {
    #rooms = new Map();

    create(name, id = `room-${randomUUID()}`) {
        const room = new Room(id, name);

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