import {describe,expect,it} from 'vitest';
import {World} from '../sim/world.ts';
import {Ship} from '../sim/ship.ts';
import {Asteroid} from '../sim/asteroid.ts';
import {Bullet} from '../sim/bullet.ts';
import {Pickup} from '../sim/pickup.ts';
import {Vector2} from '../sim/vector.ts';
import {inputAdapter} from '../sim/input.ts';
import {encodeInput,decodeInput,encodeSnapshot,decodeSnapshot} from '../codec/binary.ts';
import {isEntitySnapshot,isSnapshot,isGameInput,parseClientMessage,parseServerMessage} from '../protocol.ts';
import type {Snapshot} from '../types.ts';
const empty=inputAdapter({thrust:false,turn:0});
const base={id:1,x:25,y:40,vx:0,vy:0,angle:0,radius:10};
const snapshot:Snapshot={type:'snapshot',tick:3,lastProcessedSeq:2,playerId:'p',seed:44,events:[],entities:[]};

describe('world interactions',()=>{
 it('supports get, ofKind, iteration, deferred despawn and sweeping',()=>{
   const world=new World();const ship=world.spawn(new Ship(100,100));const bullet=world.spawn(new Bullet(new Vector2(200,200),new Vector2()));
   expect(world.get(ship.id)).toBe(ship);expect([...world]).toHaveLength(2);
   expect([...world.ofKind('ship')]).toEqual([ship]);
   world.despawn(bullet.id);expect(world.get(bullet.id)?.alive).toBe(false);
   world.step(0,new Map());expect(world.get(bullet.id)).toBeUndefined();
   world.despawn(bullet.id);expect([...world]).toHaveLength(1);
 });
 it('moves ships with direct input or input map and skips missing map entries',()=>{
   const world=new World(),ship=world.spawn(new Ship(100,100));
   world.step(0.1,inputAdapter({thrust:true,turn:0}));expect(ship.pos.x).toBeGreaterThan(100);
   const x=ship.pos.x;world.step(0.1,new Map());expect(ship.pos.x).toBe(x);
   world.step(0.1,new Map([[ship.id,empty]]));expect(ship.pos.x).toBeGreaterThan(x);
 });
 it('resolves ship collision with asteroid but respects damage cooldown',()=>{
   const world=new World(),ship=world.spawn(new Ship(200,200));
   world.spawn(new Asteroid(new Vector2(200,200),new Vector2(),12,800,500));
   world.step(0,new Map());expect(ship.hp).toBe(2);
   world.step(0,new Map());expect(ship.hp).toBe(2);
 });
 it('ship collects rapid-fire pickup with either collision order',()=>{
   const world=new World(),pickup=world.spawn(new Pickup(100,100,'rapid-fire'));
   const ship=world.spawn(new Ship(100,100));
   world.step(0,new Map());expect(ship.rapidFireTime).toBe(5);
   expect(world.get(pickup.id)).toBeUndefined();
 });
 it('destroys asteroid with two bullets and updates score and events',()=>{
   const world=new World();const events:string[]=[];world.events.subscribe(e=>events.push(e.type));
   const rock=world.spawn(new Asteroid(new Vector2(50,50),new Vector2(),12,800,500));
   world.spawn(new Bullet(new Vector2(50,50),new Vector2()));world.step(0,new Map());
   expect(rock.hp).toBe(1);
   world.spawn(new Bullet(new Vector2(50,50),new Vector2()));world.step(0,new Map());
   expect(world.get(rock.id)).toBeUndefined();expect(world.score).toBe(10);
   expect(events).toContain('scoreChanged');
 });
 it('destroys unshielded ship on third bullet after cooldown and spawns explosion',()=>{
   const world=new World(),ship=world.spawn(new Ship(400,250));
   const events:string[]=[];world.events.subscribe(e=>events.push(e.type));
   for(let i=0;i<3;i++){
     world.spawn(new Bullet(new Vector2(ship.pos.x,ship.pos.y),new Vector2()));
     world.step(0,new Map());
     if(i<2)ship.update(1.01,empty);
   }
   expect(ship.alive).toBe(false);expect([...world.ofKind('explosion')]).toHaveLength(1);
   expect(events).toContain('exploded');
 });
 it('deep clones incoming snapshots',()=>{
   const source={nested:{value:1}};const copy=World.fromSnapshot(source);
   copy.nested.value=2;expect(source.nested.value).toBe(1);
 });
});

describe('binary codec edge cases',()=>{
 it('encodes and decodes all entity kinds and event kinds',()=>{
   const full:Snapshot={...snapshot,entities:[
     {...base,kind:'ship',ownerId:'a'},
     {...base,id:2,kind:'bullet',ownerId:'b',shotSeq:5},
     {...base,id:3,kind:'asteroid'},
     {...base,id:4,kind:'pickup',pickupType:'shield'},
     {...base,id:5,kind:'pickup',pickupType:'rapid-fire'},
     {...base,id:6,kind:'explosion'},
   ],events:[{type:'fired',detail:null},{type:'hit',detail:null},{type:'exploded',detail:null},{type:'scoreChanged',detail:42}]};
   const decoded=decodeSnapshot(encodeSnapshot(full));
   expect(decoded.entities).toEqual(full.entities);
   expect(decoded.events).toEqual(full.events);
 });
 it('supports default player, seed, event list and optional fields',()=>{
   const minimal={...snapshot,playerId:'',entities:[{...base,kind:'bullet' as const}]};
   const decoded=decodeSnapshot(encodeSnapshot(minimal));
   expect(decoded.playerId).toBe('');expect(decoded.entities[0]?.kind).toBe('bullet');
   expect(decoded.events).toEqual([]);
 });
 it('rejects non-integer and out-of-range entity identifiers',()=>{
   for(const id of [-1,65536,1.5])expect(()=>encodeSnapshot({...snapshot,entities:[{...base,id,kind:'ship'}]})).toThrow(RangeError);
 });
 it('rejects oversized player IDs, owner IDs, entity count and event count',()=>{
   expect(()=>encodeSnapshot({...snapshot,playerId:'x'.repeat(256)})).toThrow(RangeError);
   expect(()=>encodeSnapshot({...snapshot,entities:[{...base,kind:'bullet',ownerId:'x'.repeat(256)}]})).toThrow(RangeError);
   expect(()=>encodeSnapshot({...snapshot,events:Array.from({length:256},()=>({type:'hit' as const,detail:null}))})).toThrow(RangeError);
   expect(()=>encodeSnapshot({...snapshot,entities:Array.from({length:65536},(_,id)=>({...base,id,kind:'ship' as const}))})).toThrow(RangeError);
 });
 it('rejects malformed input header, fields and reserved bytes',()=>{
   const good=encodeInput({seq:1,tick:2,thrust:true,turn:0,fire:false});
   expect(decodeInput(new Uint8Array(good))).toMatchObject({seq:1,tick:2});
   for(const [index,value] of [[0,9],[1,9],[10,0xff],[11,3],[12,1]] as const){
     const bad=good.slice(0);new DataView(bad).setUint8(index,value);
     expect(()=>decodeInput(bad)).toThrow();
   }
   expect(()=>decodeInput(new Uint8Array(5))).toThrow();
 });
 it('rejects invalid snapshot headers, truncated and trailing data',()=>{
   const good=encodeSnapshot({...snapshot,entities:[{...base,kind:'ship'}]});
   expect(()=>decodeSnapshot(good.slice(0,5))).toThrow();
   expect(()=>decodeSnapshot(good.slice(0,-1))).toThrow();
   const wrong=good.slice(0);new DataView(wrong).setUint8(1,99);
   expect(()=>decodeSnapshot(wrong)).toThrow();
   const trailing=new Uint8Array(good.byteLength+1);trailing.set(new Uint8Array(good));
   expect(()=>decodeSnapshot(trailing)).toThrow();
 });
 it('rejects invalid entity kind, pickup code and non-finite values',()=>{
   const good=encodeSnapshot({...snapshot,playerId:'',entities:[{...base,kind:'ship'}]});
   const kind=good.slice(0);new DataView(kind).setUint8(20,99);
   expect(()=>decodeSnapshot(kind)).toThrow();
   const invalidPickup=good.slice(0);new DataView(invalidPickup).setUint8(40,1);
   expect(()=>decodeSnapshot(invalidPickup)).toThrow();
   const nan=good.slice(0);new DataView(nan).setFloat32(21,NaN,true);
   expect(()=>decodeSnapshot(nan)).toThrow();
 });
 it('rejects invalid event kinds and non-finite event values',()=>{
   const good=encodeSnapshot({...snapshot,playerId:'',events:[{type:'scoreChanged',detail:3}]});
   const code=good.slice(0);new DataView(code).setUint8(18,99);
   expect(()=>decodeSnapshot(code)).toThrow();
   const nonfinite=good.slice(0);new DataView(nonfinite).setFloat32(19,Infinity,true);
   expect(()=>decodeSnapshot(nonfinite)).toThrow();
 });
});

describe('protocol guards',()=>{
 it('validates legitimate entity snapshots and rejects unknown kinds',()=>{
   expect(isEntitySnapshot({...base,kind:'ship'})).toBe(true);
   expect(isEntitySnapshot({...base,kind:'wrong'})).toBe(false);
 });
 it('validates snapshots and rejects arbitrary payloads',()=>{
   expect(isSnapshot(snapshot)).toBe(true);
   expect(isSnapshot(null)).toBe(false);
 });
 it('validates inputs and rejects incorrect turn',()=>{
   expect(isGameInput({seq:1,tick:1,thrust:false,turn:0,fire:false})).toBe(true);
   expect(isGameInput({seq:1,tick:1,thrust:false,turn:5,fire:false})).toBe(false);
 });
 it('parses messages and surfaces failures without throwing',()=>{
   expect(parseClientMessage({v:0,type:'input',seq:1,tick:1,thrust:false,turn:0,fire:false}).ok).toBe(true);
   expect(parseClientMessage({v:0,type:'unknown'}).ok).toBe(false);
   expect(parseServerMessage({v:0,type:'roster',players:[]}).ok).toBe(true);
   expect(parseServerMessage({v:0,type:'unknown'}).ok).toBe(false);
 });
});
