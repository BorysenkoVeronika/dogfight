import {Ship} from '@dogfight/shared/sim/ship';
import {reconcileShip} from './reconcile.ts';
import {inputAdapter} from '@dogfight/shared/sim/input';
import {wrap} from '@dogfight/shared/sim/arena';
import {Vector2} from '@dogfight/shared/sim/vector';
import type {Snapshot,GameInput,InputState,EntitySnapshot,BulletSnapshot,Seq,Tick} from '@dogfight/shared/types';
import {sequenceId,tickId} from '@dogfight/shared/types';

const STEP=1/30;
const ARENA={width:800,height:500};
const angleBlend=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
type Visual={x:number;y:number;angle:number};
type HistorySnapshot=Snapshot & {receivedAt:number};
type PredictedBullet=Omit<BulletSnapshot,'x'|'y'> & {x:number;y:number;bornAt:number};
type Correction={tick:number;pixels:number};

export function createNetcode(){
 let playerId:string|null=null;
 let ownId:number|null=null;
 let predicted:Ship|null=null;
 let visual:Visual|null=null;
 let seq:Seq=sequenceId(0),clientTick:Tick=tickId(0);
 let acknowledged=-1,correction=0;
 let inputQueue:GameInput[]=[];
 const history:HistorySnapshot[]=[];
 let lastArrival=0,previousTick=-1,serverTick=0;
 let interpolationDelay=100,predictionEnabled=true,determinismBroken=false;
 let predictedBullets:PredictedBullet[]=[];
 let localFireCooldown=0,score=0,seed=12345;
 const correctionHistory:Correction[]=[];
 function makeShip(e:Extract<EntitySnapshot,{kind:'ship'}>):Ship{return Ship.fromSnapshot(e);}
 function apply(ship:Ship,input:InputState):void{
  ship.update(STEP,inputAdapter(input));wrap(ship,ARENA.width,ARENA.height);
  // Intentional divergence, only for the M2 demonstration.
  if(determinismBroken)ship.pos=new Vector2(ship.pos.x+Math.random()*0.5,ship.pos.y);
 }
 function onSnapshot(snapshot:Snapshot,arrival:number=performance.now()):boolean{
  performance.mark('reconcile:start');
  if(snapshot.tick<=previousTick)return false;
  previousTick=snapshot.tick;serverTick=snapshot.tick;lastArrival=arrival;
  playerId=snapshot.playerId;seed=snapshot.seed??seed;score=snapshot.score??score;
  for(const event of snapshot.events??[])if(event.type==='scoreChanged')score=event.detail;
  history.push({...snapshot,receivedAt:arrival});if(history.length>90)history.shift();
  const own=snapshot.entities.find((e):e is Extract<EntitySnapshot,{kind:'ship'}>=>e.kind==='ship'&&e.ownerId===playerId);
  if(!own){predicted=null;visual=null;ownId=null;inputQueue.length=0;return true;}
  if(ownId!==own.id){
   ownId=own.id;inputQueue.length=0;predictedBullets.length=0;
   predicted=makeShip(own);visual={x:own.x,y:own.y,angle:own.angle};
  }
  const before=predicted?{x:predicted.pos.x,y:predicted.pos.y}:{x:own.x,y:own.y};
  acknowledged=Math.max(acknowledged,snapshot.lastProcessedSeq);
  const reconciled=reconcileShip(own,inputQueue,acknowledged);
  inputQueue=reconciled.pending;
  predicted=predictionEnabled?reconciled.ship:makeShip(own);
  if(determinismBroken&&predictionEnabled)predicted.pos=new Vector2(predicted.pos.x+Math.random()*.5,predicted.pos.y);
  correction=Math.hypot(predicted.pos.x-before.x,predicted.pos.y-before.y);
  correctionHistory.push({tick:snapshot.tick,pixels:correction});if(correctionHistory.length>1000)correctionHistory.shift();
  performance.mark('reconcile:end');performance.measure('reconcile','reconcile:start','reconcile:end');
  return true;
 }
 function step(input:Required<InputState>,now:number):GameInput{
  seq=sequenceId(seq+1);clientTick=tickId(clientTick+1);
  const item:GameInput={...input,seq,tick:clientTick};
  inputQueue.push(item);if(inputQueue.length>240)inputQueue.shift();
  if(predictionEnabled&&predicted)apply(predicted,item);
  localFireCooldown=Math.max(0,localFireCooldown-STEP);
  if(predictionEnabled&&input.fire&&predicted&&localFireCooldown<=0){
   const dir=Vector2.fromAngle(predicted.angle);
   const pos=predicted.pos.add(dir.scale(predicted.radius+3));
   const vel=predicted.vel.add(dir.scale(500));
   predictedBullets.push({id:-Number(seq),ownerId:playerId??undefined,shotSeq:seq,kind:'bullet',x:pos.x,y:pos.y,vx:vel.x,vy:vel.y,angle:predicted.angle,radius:3,bornAt:now});
   localFireCooldown=0.3;
  }
  for(const bullet of predictedBullets){
   bullet.x+=bullet.vx*STEP;bullet.y+=bullet.vy*STEP;
  }
  predictedBullets=predictedBullets.filter(b=>now-b.bornAt<450);
  return item;
 }
 function render(now:number,dt:number):EntitySnapshot[]{
  const latest=history.at(-1),first=history[0];
  if(!latest||!first)return [];
  const estimatedTick=latest.tick+Math.max(0,(now-latest.receivedAt)/(1000/30));
  const targetTick=estimatedTick-interpolationDelay/(1000/30);
  let left:HistorySnapshot=first,right:HistorySnapshot=latest;
  for(let i=0;i<history.length-1;i++){
   const a=history[i],b=history[i+1];
   if(!a||!b)continue;
   if(a.tick<=targetTick&&b.tick>=targetTick){left=a;right=b;break;}
   if(a.tick<=targetTick)left=a;
  }
  if(targetTick>=right.tick)left=right;
  if(targetTick<=first.tick){right=first;left=first;}
  const t=left.tick===right.tick?0:Math.min(1,Math.max(0,(targetTick-left.tick)/(right.tick-left.tick)));
  const old=new Map(left.entities.map(e=>[e.id,e]));
  const entities:EntitySnapshot[]=[];
  for(const fresh of right.entities){
   const previous=old.get(fresh.id);
   const entity=previous?{...fresh,x:lerp(previous.x,fresh.x,t),y:lerp(previous.y,fresh.y,t),angle:angleBlend(previous.angle,fresh.angle,t)}:{...fresh};
   if(fresh.kind!=='ship'||fresh.ownerId!==playerId)entities.push(entity);
  }
  const authoritativeOwn=latest.entities.find(e=>e.id===ownId);
  const desired=predictionEnabled&&predicted?{x:predicted.pos.x,y:predicted.pos.y,angle:predicted.angle}:authoritativeOwn;
  if(desired&&authoritativeOwn){
   if(!visual)visual={x:desired.x,y:desired.y,angle:desired.angle};
   const blend=Math.min(1,dt/0.1);
   visual.x=lerp(visual.x,desired.x,blend);visual.y=lerp(visual.y,desired.y,blend);
   visual.angle=angleBlend(visual.angle,desired.angle,blend);
   entities.push({...authoritativeOwn,...visual});
  }
  const authoritativeBullets=latest.entities.filter((e):e is Extract<EntitySnapshot,{kind:'bullet'}>=>e.kind==='bullet'&&e.ownerId===playerId);
  for(const bullet of predictedBullets){
   const matching=authoritativeBullets.some(e=>e.shotSeq===bullet.shotSeq||Math.hypot(e.x-bullet.x,e.y-bullet.y)<35);
   if(!matching)entities.push(bullet);
  }
  return entities;
 }
 function metrics(now:number){return {pending:inputQueue.length,correction,snapshotAge:lastArrival?now-lastArrival:0,serverTick,interpolationDelay,score};}
 return {step,onSnapshot,render,metrics,correctionHistory,
  get playerId(){return playerId;},
  setInterpolationDelay(value:number){interpolationDelay=Math.max(0,Math.min(300,value));},
  setPrediction(enabled:boolean){predictionEnabled=enabled;},
  setDeterminismBroken(enabled:boolean){determinismBroken=enabled;},
 };
}
