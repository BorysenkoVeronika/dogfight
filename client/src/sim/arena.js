import { Vector2 } from './vector.js';

export function wrap(entity, width, height) {
    entity.pos = new Vector2(
        ((entity.pos.x % width) + width) % width,
        ((entity.pos.y % height) + height) % height
    );

    return entity;
}