import type {GameInput} from '@dogfight/shared/types';
import type {Ship} from '@dogfight/shared/sim/ship';
/** Server AI follows the same GameInput contract as a connected human. */
export interface PlayerInput { nextInput(ship: Ship, others: readonly Ship[], tick: number): GameInput; }
export class Bot implements PlayerInput {
  constructor(readonly id: string) {}
  nextInput(ship: Ship, others: readonly Ship[], tick: number): GameInput {
    const target = others.find(other => other.id !== ship.id && other.alive);
    if (!target) return {seq:tick,tick,thrust:true,turn:0,fire:tick%8===0};
    const dx=target.pos.x-ship.pos.x,dy=target.pos.y-ship.pos.y;
    const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-ship.angle),Math.cos(Math.atan2(dy,dx)-ship.angle));
    const dist=Math.hypot(dx,dy);
    const evade=dist<65;
    return {seq:tick,tick,thrust:evade||dist>95,turn:delta>0.08?1:delta< -0.08?-1:0,fire:!evade&&Math.abs(delta)<0.35};
  }
}
