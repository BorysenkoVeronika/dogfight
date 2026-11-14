import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Ship extends Entity {
    constructor(x = 400, y = 250) {
        super({
            pos: new Vector2(x, y),
            vel: new Vector2(),
            angle: 0,
            radius: 12,
            kind: 'ship',
        });

        this.thrust = false;
    }

    update(dt, input) {
        const rotationSpeed = 3;
        const acceleration = 200;
        const drag = 0.99;
        const maxSpeed = 300;

        if (input.isDown('ArrowLeft')) {
            this.angle -= rotationSpeed * dt;
        }

        if (input.isDown('ArrowRight')) {
            this.angle += rotationSpeed * dt;
        }

        this.thrust = input.isDown('ArrowUp');

        if (this.thrust) {
            const direction = Vector2.fromAngle(this.angle);
            this.vel = this.vel.add(direction.scale(acceleration * dt));
        }

        this.vel = this.vel.scale(Math.pow(drag, dt * 60));

        const speed = this.vel.length();

        if (speed > maxSpeed) {
            this.vel = this.vel.normalize().scale(maxSpeed);
        }

        super.update(dt);
    }
}