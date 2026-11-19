import type {Entity} from './entity.ts';
import { Vector2 } from './vector.ts';

export function wrap<T extends Entity>(entity: T, width: number, height: number): T {
    entity.pos = new Vector2(
        ((entity.pos.x % width) + width) % width,
        ((entity.pos.y % height) + height) % height
    );

    return entity;
}