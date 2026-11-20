import {config} from './config.ts';
import { Asteroid } from '@dogfight/shared/sim/asteroid';
import { Vector2 } from '@dogfight/shared/sim/vector';
import { Pickup } from '@dogfight/shared/sim/pickup';
import { World } from '@dogfight/shared/sim/world';
import { Ship } from '@dogfight/shared/sim/ship';
import { wrap } from '@dogfight/shared/sim/arena';
import { inputAdapter } from '@dogfight/shared/sim/input';
import {isGameInput} from '@dogfight/shared/protocol';
import type {GameEvent,GameInput,EntitySnapshot,Tick} from '@dogfight/shared/types';
import {tickId} from '@dogfight/shared/types';
import type {Room,Player} from './room.ts';
import { Bot } from './bot.ts';
import { randomUUID } from 'node:crypto';

const RATE=30;
const STEP_MS=1000/RATE;
const NEUTRAL:GameInput={seq:-1,tick:0,thrust:false,turn:0,fire:false};
type PlayerState={ship:Ship;input:GameInput;lastProcessedSeq:number;respawn:number|null};
type MatchSnapshot={type:'snapshot';tick:number;seed:number;entities:EntitySnapshot[];events:GameEvent[];score:number;lastProcessedSeq:Record<string,number>};

export class Match {
 readonly seed:number;
 readonly world:World;
 readonly players=new Map<string,PlayerState>();
 readonly bots=new Map<string,Bot>();
 tickNumber:Tick=tickId(0);
 running=false;
 timer:ReturnType<typeof setTimeout>|null=null;
 nextTick=0;
 lastTickDuration=0;
 lastTickJitter=0;
 tickSamples:number[]=[];
 pendingEvents:GameEvent[]=[];
 constructor(readonly room:Room,readonly onSnapshot:(room:Room,snapshot:MatchSnapshot)=>void,seed:number=12345){
  this.seed=seed;this.world=new World(seed);
  this.world.events.subscribe(event=>this.pendingEvents.push(event));
  this.world.spawn(new Asteroid(new Vector2(200,150),new Vector2(60,40),25,800,500));
  this.world.spawn(new Pickup(300,200,'shield'));
  this.world.spawn(new Pickup(500,350,'rapid-fire'));
 }
 addPlayer(player:Player):Ship{
  const index=this.players.size;
  const ship=this.world.spawn(new Ship(320+(index%4)*52,220+Math.floor(index/4)*52));
  ship.ownerId=player.id;
  const asteroid=[...this.world.ofKind('asteroid')][0];
  if(asteroid && !asteroid.homing)asteroid.homing={targetId:ship.id,turnRate:1.5};
  this.players.set(player.id,{ship,input:{...NEUTRAL},lastProcessedSeq:-1,respawn:null});
  return ship;
 }
 addBots(count:number):number {
  if(!Number.isInteger(count)||count<1||count>8)throw new RangeError('Bot count must be between 1 and 8');
  if(this.room.players.size+count>config.maxPlayersPerRoom)throw new RangeError('Room capacity exceeded');
  for(let i=0;i<count;i++){
   const player={id:`bot-${randomUUID()}`,name:`Bot ${this.bots.size+1}`};
   this.room.join(player);this.addPlayer(player);this.bots.set(player.id,new Bot(player.id));
  }
  return this.bots.size;
 }
 removePlayer(id:string):void{this.bots.delete(id);const state=this.players.get(id);if(!state)return;this.world.despawn(state.ship.id);this.players.delete(id);}
 receiveInput(id:string,data:unknown):boolean{
  if(!isGameInput(data))return false;
  const state=this.players.get(id);
  if(!state || data.seq<=state.input.seq)return false;
  state.input={...data};return true;
 }
 start():void{if(this.running)return;this.running=true;this.nextTick=performance.now()+STEP_MS;this.schedule();}
 stop():void{this.running=false;if(this.timer)clearTimeout(this.timer);this.timer=null;}
 schedule():void{if(!this.running)return;this.timer=setTimeout(()=>this.tick(),Math.max(0,this.nextTick-performance.now()));}
 tick():void{
  if(!this.running)return;
  const start=performance.now();this.lastTickJitter=start-this.nextTick;this.tickNumber=tickId(this.tickNumber+1);
  const inputs=new Map<number,ReturnType<typeof inputAdapter>>();
  for(const [id,state] of this.players){
   if(!state.ship.alive){
    state.respawn??=this.tickNumber+RATE*2;
    if(this.tickNumber>=state.respawn){state.ship=this.world.spawn(new Ship(320,250));state.ship.ownerId=id;state.respawn=null;}
    else continue;
   }
   const bot=this.bots.get(id);
   if(bot){const all=[...this.world.ofKind('ship')].filter((e):e is Ship=>e instanceof Ship);state.input=bot.nextInput(state.ship,all,this.tickNumber);}
   const input=state.input;
   inputs.set(state.ship.id,inputAdapter(input));
   if(input.fire)state.ship.fire(this.world,input.seq,id);
   state.lastProcessedSeq=input.seq;
  }
  this.world.step(1/RATE,inputs);
  for(const ship of this.world.ofKind('ship'))wrap(ship,800,500);
  const entities:EntitySnapshot[]=[...this.world].map(e=>{
   const base={id:e.id,x:e.pos.x,y:e.pos.y,vx:e.vel.x,vy:e.vel.y,angle:e.angle,radius:e.radius};
   switch(e.kind){
    case 'ship':return {...base,kind:'ship',...(e.ownerId&&{ownerId:e.ownerId})};
    case 'bullet':return {...base,kind:'bullet',...(e.ownerId&&{ownerId:e.ownerId}),...(e.shotSeq!==undefined&&{shotSeq:e.shotSeq})};
    case 'asteroid':return {...base,kind:'asteroid'};
    case 'explosion':return {...base,kind:'explosion'};
    case 'entity':throw new TypeError('Cannot snapshot an abstract entity');
    case 'pickup':{
     if(!(e instanceof Pickup))throw new TypeError('Pickup kind without Pickup class');
     return {...base,kind:'pickup',pickupType:e.type};
    }
    default:return assertNever(e.kind);
   }
  });
  const snapshot:MatchSnapshot={type:'snapshot',tick:this.tickNumber,seed:this.seed,entities,events:this.pendingEvents.splice(0),score:this.world.score,
   lastProcessedSeq:Object.fromEntries([...this.players].map(([id,state])=>[id,state.lastProcessedSeq]))};
  this.onSnapshot(this.room,snapshot);
  this.lastTickDuration=performance.now()-start;
  this.tickSamples.push(this.lastTickDuration);if(this.tickSamples.length>1800)this.tickSamples.shift();
  this.nextTick+=STEP_MS;
  if(this.nextTick<performance.now()-STEP_MS*3)this.nextTick=performance.now()+STEP_MS;
  this.schedule();
 }
 getStats(){const sorted=[...this.tickSamples].sort((a,b)=>a-b);const p99=sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.99)-1)]:0;return {tick:this.tickNumber,tickRate:RATE,tickDurationMs:this.lastTickDuration,tickJitterMs:this.lastTickJitter,tickP99Ms:p99};}
}
function assertNever(value:never):never{throw new TypeError(`Unexpected entity kind ${String(value)}`);}
export type {MatchSnapshot};
