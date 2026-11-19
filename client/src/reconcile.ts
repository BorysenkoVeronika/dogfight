import { Ship } from '@dogfight/shared/sim/ship';
import { wrap } from '@dogfight/shared/sim/arena';
import { inputAdapter } from '@dogfight/shared/sim/input';
import type {GameInput,ShipSnapshot} from '@dogfight/shared/types';
/** Pure with respect to inputs; returned ship and pending queue are fresh copies. */
export function reconcileShip(authoritative:ShipSnapshot, queued: readonly GameInput[], acknowledged:number, width=800,height=500) {
  const pending=queued.filter(input=>input.seq>acknowledged);
  const ship=Ship.fromSnapshot(authoritative);
  for(const input of pending) {ship.update(1/30,inputAdapter(input));wrap(ship,width,height);}
  return {ship,pending};
}
