import {entityId} from '../types.ts';
import type {ExplosionSnapshot} from '../types.ts';

import { Entity } from './entity.ts';
import { Vector2 } from './vector.ts';
import { mulberry32 } from './random.ts';

export class Explosion extends Entity {
    particles: Array<{pos:Vector2;vel:Vector2;ttl:number;maxTtl:number}>;
    constructor(pos: Vector2, count: number = 20, random: () => number = mulberry32(12345)) {
        super({
            pos,
            radius: 0,
            kind: 'explosion',
        });

        this.particles = Array.from({ length: count }, () => {
            const angle = random() * Math.PI * 2;
            const speed = 50 + random() * 150;
            const ttl = 0.3 + random() * 0.7;

            return {
                pos: new Vector2(pos.x, pos.y),
                vel: Vector2.fromAngle(angle).scale(speed),
                ttl,
                maxTtl: ttl,
            };
        });
    }

    static fromSnapshot(s: ExplosionSnapshot): Explosion {
        const explosion = new Explosion(new Vector2(s.x, s.y), 0);
        explosion.id = entityId(s.id);
        return explosion;
    }

    update(dt: number): void {
        for (const particle of this.particles) {
            particle.pos = particle.pos.add(particle.vel.scale(dt));
            particle.ttl -= dt;
        }

        this.particles = this.particles.filter(
            particle => particle.ttl > 0
        );

        if (this.particles.length === 0) {
            this.alive = false;
        }
    }
}
