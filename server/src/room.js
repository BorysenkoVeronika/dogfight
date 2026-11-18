import { EventEmitter } from 'node:events';

export class Room extends EventEmitter {
    constructor(id, name) {
        super();

        this.id = id;
        this.name = name;
        this.players = new Map();
    }

    join(player) {
        this.players.set(player.id, player);
        this.emit('join', player);
    }

    leave(playerId) {
        const player = this.players.get(playerId);

        if (!player) return;

        this.players.delete(playerId);
        this.emit('leave', player);

        if (this.players.size === 0) {
            this.emit('empty');
        }
    }

    chat(playerId, message) {
        const player = this.players.get(playerId);

        if (!player) return;

        this.emit('chat', { player, message });
    }
}