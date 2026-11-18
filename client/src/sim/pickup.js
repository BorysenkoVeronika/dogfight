
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';

export class Pickup extends Entity {
    constructor(x, y, type = 'shield') {
        super({
            pos: new Vector2(x, y),
            vel: new Vector2(),
            radius: 12,
            kind: 'pickup',
        });

        this.type = type;
    }
}
