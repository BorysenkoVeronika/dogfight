import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import { Bullet } from './bullet.js';

export class Ship extends Entity {

    #hp = 3;
    #damageCooldown = 0;

    constructor(x = 400, y = 250) {
        super({
            pos: new Vector2(x, y),
            vel: new Vector2(),
            angle: 0,
            radius: 12,
            kind: 'ship',
        });

        this.thrust = false;
        this.shieldTime = 0;
        this.rapidFireTime = 0;
        this.fireCooldown = 0;
    }

    update(dt, input) {
        const rotationSpeed = 3;
        const acceleration = 200;
        const drag = 0.99;
        const maxSpeed = 300;

        if (this.#damageCooldown > 0) {
            this.#damageCooldown -= dt;
        }

        if (this.shieldTime > 0) {
            this.shieldTime -= dt;
        }

        if (this.rapidFireTime > 0) {
            this.rapidFireTime -= dt;
        }

        if (this.fireCooldown > 0) {
            this.fireCooldown -= dt;
        }

        if (input.isDown('ArrowLeft')) {
            this.angle -= rotationSpeed * dt;
        }

        if (input.isDown('ArrowRight')) {
            this.angle += rotationSpeed * dt;
        }

        this.angle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));

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

    static fromSnapshot(data) {
        const ship = new Ship(data.x, data.y);
        ship.id = data.id;
        ship.pos = new Vector2(data.x, data.y);
        ship.vel = new Vector2(data.vx, data.vy);
        ship.angle = data.angle;
        ship.radius = data.radius;
        return ship;
    }

    get hp() {
        return this.#hp;
    }

    takeDamage(amount) {

        if (this.shieldTime > 0) return;

        if (this.#damageCooldown > 0) return;

        this.#hp = Math.max(0, this.#hp - amount);
        this.#damageCooldown = 1;

        if (this.#hp === 0) {
            this.alive = false;
        }
    }

    applyPickup(type) {
        if (type === 'shield') {
            this.shieldTime = 5;
        }

        if (type === 'rapid-fire') {
            this.rapidFireTime = 5;
        }
    }

    fire(world, shotSeq = -1, ownerId = '') {
        if (this.fireCooldown > 0) return;

        const direction = Vector2.fromAngle(this.angle);
        const bulletPosition = this.pos.add(
            direction.scale(this.radius + 3)
        );

        const bulletVelocity = this.vel.add(
            direction.scale(500)
        );

        const bullet = new Bullet(bulletPosition, bulletVelocity);

        bullet.shotSeq = shotSeq;
        bullet.ownerId = ownerId;
        world.spawn(bullet);
        world.events.emit('fired');

        this.fireCooldown = this.rapidFireTime > 0 ? 0.12 : 0.3;
    }
}