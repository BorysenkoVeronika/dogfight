
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import { mulberry32 } from './random.js';

export class Explosion extends Entity {
    constructor(pos, count = 20, random = mulberry32(12345)) {
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

    static fromSnapshot(s) {
        const explosion = new Explosion(new Vector2(s.x, s.y), 0);
        explosion.id = s.id;
        return explosion;
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
