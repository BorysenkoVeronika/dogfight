import { Entity } from './entity.js';

export class Bullet extends Entity {
    constructor(pos, vel, ttl = 2) {
        super({
            pos,
            vel,
            radius: 3,
            kind: 'bullet',
        });

        this.ttl = ttl;
    }

    update(dt) {
        super.update(dt);

        this.ttl -= dt;

        if (this.ttl <= 0) {
            this.alive = false;
        }
    }
}
