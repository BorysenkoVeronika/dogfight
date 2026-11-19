import {describe,it,expect} from 'vitest';
import {reconcileShip} from '../src/reconcile.ts';
import type {ShipSnapshot} from '@dogfight/shared/types';
const authoritative:ShipSnapshot={id:1,kind:'ship',x:400,y:250,vx:0,vy:0,angle:0,radius:12,ownerId:'alice'};
describe('pure snapshot reconciliation',()=>{
 it('no queued input preserves authoritative state',()=>{
  const result=reconcileShip(authoritative,[],0);expect(result.ship.pos.x).toBe(400);expect(result.pending).toHaveLength(0);
 });
 it('drops acknowledged inputs',()=>{
  const inputs=[0,1,2].map(seq=>({seq,tick:seq,turn:0 as const,thrust:true,fire:false}));
  const result=reconcileShip(authoritative,inputs,1);expect(result.pending.map(x=>x.seq)).toEqual([2]);expect(result.ship.pos.x).toBeGreaterThan(400);
 });
 it('does not mutate the original input buffer',()=>{
  const inputs=[{seq:1,tick:1,turn:0 as const,thrust:true,fire:false}];
  reconcileShip(authoritative,inputs,0);expect(inputs).toHaveLength(1);expect(inputs[0]?.seq).toBe(1);
 });
});
