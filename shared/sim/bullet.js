import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

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

    static fromSnapshot(s) {
        const bullet = new Bullet(new Vector2(s.x, s.y), new Vector2(s.vx, s.vy));
        bullet.pos = new Vector2(s.x, s.y);
        bullet.id = s.id;
        bullet.angle = s.angle;
        bullet.ownerId = s.ownerId;
        bullet.shotSeq = s.shotSeq;
        return bullet;
    }

    update(dt) {
        super.update(dt);

        this.ttl -= dt;

        if (this.ttl <= 0) {
            this.alive = false;
        }
    }
}
