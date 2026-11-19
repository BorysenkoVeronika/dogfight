import type {Entity} from './entity.ts';

export function circleCircle(a: Entity, b: Entity): boolean {
    const dx = a.pos.x - b.pos.x;
    const dy = a.pos.y - b.pos.y;
    const radius = a.radius + b.radius;

    return dx * dx + dy * dy <= radius * radius;
}

/** Swept circle-vs-circle for a fast bullet crossing a target between fixed ticks. */
export function sweptBulletCollision(a: Entity, b: Entity): boolean {
    const bullet=a.kind==='bullet'?a:b.kind==='bullet'?b:null;
    const target=bullet===a?b:a;
    if(!bullet || !['ship','asteroid'].includes(target.kind))return false;
    const sx=bullet.previousPos.x,sy=bullet.previousPos.y;
    const dx=bullet.pos.x-sx,dy=bullet.pos.y-sy;
    const lengthSq=dx*dx+dy*dy;
    if(lengthSq===0)return circleCircle(bullet,target);
    const t=Math.max(0,Math.min(1,((target.pos.x-sx)*dx+(target.pos.y-sy)*dy)/lengthSq));
    const x=sx+dx*t-target.pos.x,y=sy+dy*t-target.pos.y;
    const radius=bullet.radius+target.radius;
    return x*x+y*y<=radius*radius;
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

            if (circleCircle(a, b) || sweptBulletCollision(a,b)) {
                collisions.push([a, b]);
            }
        }
    }

    return collisions;
}
