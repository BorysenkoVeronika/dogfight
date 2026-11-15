
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Explosion extends Entity {
    constructor(pos, count = 20) {
        super({
            pos,
            radius: 0,
            kind: 'explosion',
        });

        this.particles = Array.from({ length: count }, () => {
            const angle = Math.random() * Math.PI * 2;
            const speed = 50 + Math.random() * 150;
            const ttl = 0.3 + Math.random() * 0.7;

            return {
                pos: new Vector2(pos.x, pos.y),
                vel: Vector2.fromAngle(angle).scale(speed),
                ttl,
                maxTtl: ttl,
            };
        });
    }

    update(dt) {
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
