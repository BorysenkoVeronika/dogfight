import {describe,it,expect} from 'vitest';
import fc from 'fast-check';
import {encodeInput,decodeInput,encodeSnapshot,decodeSnapshot} from '../codec/binary.ts';
import {parseClientMessage} from '../protocol.ts';
import {Ship} from '../sim/ship.ts';
import {inputAdapter} from '../sim/input.ts';
import {wrap} from '../sim/arena.ts';
import type {Snapshot} from '../types.ts';
const inputArb=fc.record({seq:fc.integer({min:0,max:2**32-1}),tick:fc.integer({min:0,max:2**32-1}),thrust:fc.boolean(),turn:fc.constantFrom(-1,0,1),fire:fc.boolean()});
const snap=(x:number,y:number):Snapshot=>({type:'snapshot',tick:0,lastProcessedSeq:-1,playerId:'test',seed:1,events:[],entities:[{id:1,kind:'ship',x,y,vx:0,vy:0,angle:0,radius:12}]});
describe('five required fast-check properties',()=>{
  it('binary input encode/decode round trip',()=>fc.assert(fc.property(inputArb,x=>{
    const output=decodeInput(encodeInput(x));
    expect(output).toEqual({type:'input',...x});
  }),{numRuns:1000}));
  it('binary input size exact and snapshot length consistent',()=>fc.assert(fc.property(inputArb,fc.integer({min:0,max:799}),fc.integer({min:0,max:499}),(i,x,y)=>{
    expect(encodeInput(i).byteLength).toBe(16);
    const snapshot=snap(x,y),bytes=encodeSnapshot(snapshot);
    expect(bytes.byteLength).toBe(18+4+28); // 4 UTF-8 bytes in "test", one entity
    expect(decodeSnapshot(bytes).entities).toHaveLength(1);
  }),{numRuns:500}));
  it('garbage binary inputs either decode safely or throw a typed Error',()=>fc.assert(fc.property(fc.uint8Array({maxLength:200}),garbage=>{
    try {decodeInput(garbage); } catch(error) {expect(error).toBeInstanceOf(Error);}
    try {decodeSnapshot(garbage);} catch(error){expect(error).toBeInstanceOf(Error);}
  }),{numRuns:1000}));
  it('ship stays in the arena for 1000 random steps',()=>fc.assert(fc.property(fc.array(fc.record({thrust:fc.boolean(),turn:fc.constantFrom(-1,0,1)}),{minLength:1000,maxLength:1000}),commands=>{
    const ship=new Ship(400,250);
    for(const input of commands){ship.update(1/30,inputAdapter(input));wrap(ship,800,500);expect(ship.pos.x).toBeGreaterThanOrEqual(0);expect(ship.pos.x).toBeLessThan(800);expect(ship.pos.y).toBeGreaterThanOrEqual(0);expect(ship.pos.y).toBeLessThan(500);}
  }),{numRuns:15}));
  it('parser accepts valid messages and rejects a mutated extra field',()=>fc.assert(fc.property(inputArb,input=>{
    const valid={v:0,type:'input',...input};
    expect(parseClientMessage(valid).ok).toBe(true);
    expect(parseClientMessage({...valid,unexpected:'mutation'}).ok).toBe(false);
  }),{numRuns:1000}));
});
