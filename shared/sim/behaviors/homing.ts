import type {Entity} from '../entity.ts';

export function updateHoming(entity: Entity, target: Entity | undefined, dt: number): void {
    if (!target || !target.alive) return;

    const direction = target.pos.sub(entity.pos);

    if (direction.length() === 0) return;

    const speed = entity.vel.length();

    if (speed === 0) return;

    const currentAngle = Math.atan2(entity.vel.y, entity.vel.x);
    const targetAngle = Math.atan2(direction.y, direction.x);

    const difference = Math.atan2(
        Math.sin(targetAngle - currentAngle),
        Math.cos(targetAngle - currentAngle)
    );

    const maxTurn = entity.homing!.turnRate * dt;

    const turn = Math.max(
        -maxTurn,
        Math.min(maxTurn, difference)
    );

    entity.vel = entity.vel.rotate(turn);
}
