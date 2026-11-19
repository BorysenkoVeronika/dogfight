import type {EntityKind, KeyInput, EntityId} from '../types.ts';
import {entityId} from '../types.ts';
import { Vector2 } from './vector.ts';

export class Entity {
    static #id = 0;
    id: EntityId;
    pos: Vector2;
    /** Last position retained for swept bullet collision checks. */
    previousPos: Vector2;
    vel: Vector2;
    angle: number;
    radius: number;
    alive: boolean;
    kind: EntityKind;
    ownerId?: string;
    shotSeq?: number;
    homing?: {targetId: EntityId;turnRate:number};

    constructor({
        pos = new Vector2(),
        vel = new Vector2(),
        angle = 0,
        radius = 0,
        kind = 'entity'
    }: {pos?: Vector2;vel?: Vector2;angle?: number;radius?: number;kind?: EntityKind} = {}) {
        this.id = entityId(++Entity.#id);
        this.pos = pos;
        this.previousPos = new Vector2(pos.x, pos.y);
        this.vel = vel;
        this.angle = angle;
        this.radius = radius;
        this.alive = true;
        this.kind = kind;
    }

    update(dt: number, _input?: KeyInput): void {
        void _input;
        this.previousPos.setInPlace(this.pos.x,this.pos.y);
        this.pos.addScaledInPlace(this.vel.x, this.vel.y, dt);
    }
}