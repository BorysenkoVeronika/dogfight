import type {Entity} from './entity.ts';

export function circleCircle(a: Entity, b: Entity): boolean {
    const dx = a.pos.x - b.pos.x;
    const dy = a.pos.y - b.pos.y;
    const radius = a.radius + b.radius;

    return dx * dx + dy * dy <= radius * radius;
}

export function detectCollisions(world: Iterable<Entity>): Array<[Entity, Entity]> {
    const entities = [...world];
    const collisions: Array<[Entity, Entity]> = [];

    for (let i = 0; i < entities.length; i++) {
        const a = entities[i];

        if (!a?.alive) continue;

        for (let j = i + 1; j < entities.length; j++) {
            const b = entities[j];

            if (!b?.alive) continue;

            if (circleCircle(a, b)) {
                collisions.push([a, b]);
            }
        }
    }

    return collisions;
}
