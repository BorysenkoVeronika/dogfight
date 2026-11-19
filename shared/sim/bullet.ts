import {entityId} from '../types.ts';
import type {BulletSnapshot} from '../types.ts';
import { Entity } from './entity.ts';
import { Vector2 } from './vector.ts';

export class Bullet extends Entity {
    ttl: number;
    constructor(pos: Vector2, vel: Vector2, ttl: number = 2) {
        super({
            pos,
            vel,
            radius: 3,
            kind: 'bullet',
        });

        this.ttl = ttl;
    }

    static fromSnapshot(s: BulletSnapshot): Bullet {
        const bullet = new Bullet(new Vector2(s.x, s.y), new Vector2(s.vx, s.vy));
        bullet.pos = new Vector2(s.x, s.y);
        bullet.id = entityId(s.id);
        bullet.angle = s.angle;
        bullet.ownerId = s.ownerId;
        bullet.shotSeq = s.shotSeq;
        return bullet;
    }

    update(dt: number): void {
        super.update(dt);

        this.ttl -= dt;

        if (this.ttl <= 0) {
            this.alive = false;
        }
    }
}
