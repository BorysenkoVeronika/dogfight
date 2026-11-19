import type {Entity} from './entity.ts';

export function wrap<T extends Entity>(entity: T, width: number, height: number): T {
    entity.pos.setInPlace(
        ((entity.pos.x % width) + width) % width,
        ((entity.pos.y % height) + height) % height
    );

    return entity;
}