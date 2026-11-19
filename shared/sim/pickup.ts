import {entityId} from '../types.ts';
import type {PickupType, PickupSnapshot} from '../types.ts';

import { Entity } from './entity.ts';
import { Vector2 } from './vector.ts';

export class Pickup extends Entity {
    type: PickupType;
    static fromSnapshot(s: PickupSnapshot): Pickup {
        const pickup = new Pickup(s.x, s.y, s.pickupType);
        pickup.id = entityId(s.id);
        return pickup;
    }

    constructor(x: number, y: number, type: PickupType = 'shield') {
        super({
            pos: new Vector2(x, y),
            vel: new Vector2(),
            radius: 12,
            kind: 'pickup',
        });

        this.type = type;
    }
}
