import { Vector2 } from './vector.js';

export class Entity {
    static #id = 0;

    constructor({
        pos = new Vector2(),
        vel = new Vector2(),
        angle = 0,
        radius = 0,
        kind = 'entity'
    } = {}) {
        this.id = ++Entity.#id;
        this.pos = pos;
        this.vel = vel;
        this.angle = angle;
        this.radius = radius;
        this.alive = true;
        this.kind = kind;
    }

    update(dt) {
        this.pos = this.pos.add(this.vel.scale(dt));
    }
}