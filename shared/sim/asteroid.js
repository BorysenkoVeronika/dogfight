import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Asteroid extends Entity {

    #hp = 2;

    constructor(pos, vel, radius, width, height) {
        super({
            pos,
            vel,
            radius,
            kind: 'asteroid',
        });

        this.width = width;
        this.height = height;
    }

    static fromSnapshot(s) {
        const asteroid = new Asteroid(new Vector2(s.x, s.y), new Vector2(s.vx, s.vy), s.radius, 800, 500);
        asteroid.id = s.id;
        asteroid.angle = s.angle;
        return asteroid;
    }

    update(dt) {
        super.update(dt);

        let { x, y } = this.pos;
        let vx = this.vel.x;
        let vy = this.vel.y;

        if (x - this.radius < 0) {
            x = this.radius;
            vx = Math.abs(vx);
        } else if (x + this.radius > this.width) {
            x = this.width - this.radius;
            vx = -Math.abs(vx);
        }

        if (y - this.radius < 0) {
            y = this.radius;
            vy = Math.abs(vy);
        } else if (y + this.radius > this.height) {
            y = this.height - this.radius;
            vy = -Math.abs(vy);
        }

        this.pos = new Vector2(x, y);
        this.vel = new Vector2(vx, vy);
    }

    get hp() {
    return this.#hp;
    }
    
    takeDamage(amount) {
        this.#hp = Math.max(0, this.#hp - amount);
    
        if (this.#hp === 0) {
            this.alive = false;
        }
    }
}
