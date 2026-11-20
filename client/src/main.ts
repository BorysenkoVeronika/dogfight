import './style.css';
import {gameEvents} from './events.ts';
import manifest from './assets/manifest.json';
import {loadAll} from './assets/loader.ts';
import type {LoadedAssets} from './assets/loader.ts';
import {createLoop} from './loop.ts';
import {createInput} from './input.ts';
import {createCanvas} from './render/canvas.ts';
import {createAudio} from './audio.ts';
import {Lobby} from './lobby.ts';
import {createLobbyUI,createMatchUI} from './lobby-ui.ts';
import {createConnection} from './connection.ts';
import type {Connection} from './connection.ts';
import type {RoomInfo} from '@dogfight/shared/protocol';
import {createNetcode} from './netcode.ts';
import {collectFrame,frameReport,downloadFrameSamples} from './frame-samples.ts';
import {compareReplayWorker} from './worker-benchmark.ts';
import {drawShip,drawStars,drawHud,drawBullet,drawAsteroid,drawPickup} from './render/draw.ts';

const app=document.querySelector('#app');
if(!app)throw new Error('Missing #app root');
app.innerHTML=`
  <main>
    <h1>Dogfight <small id="build-version"></small></h1>
    <section id="lobby"></section>
    <section id="match-ui" hidden></section>
    <div id="loading-controls" hidden>
      <p id="loading-status">Preparing assets...</p>
      <button id="cancel-button">Cancel Loading</button>
      <button id="retry-button" hidden>Retry</button>
    </div>
    <canvas id="game" hidden></canvas>
  </main>`;

const buildLabel=document.querySelector('#build-version');
if(buildLabel)buildLabel.textContent=`v${(import.meta as ImportMeta & {env:{VITE_BUILD_SHA?:string}}).env.VITE_BUILD_SHA ?? 'development'}`;
if('serviceWorker' in navigator)window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{});});

function required<T extends HTMLElement>(selector:string,ctor:new()=>T):T{
 const element=document.querySelector(selector);
 if(!(element instanceof ctor))throw new Error(`Missing UI element ${selector}`);
 return element;
}
const canvas=required('#game',HTMLCanvasElement);
const {ctx,resize}=createCanvas(canvas);
const audio=createAudio();
const lobbyElement=required('#lobby',HTMLElement);
const matchElement=required('#match-ui',HTMLElement);
const loadingControls=required('#loading-controls',HTMLElement);
const loadingStatus=required('#loading-status',HTMLElement);
const retryButton=required('#retry-button',HTMLButtonElement);
const cancelButton=required('#cancel-button',HTMLButtonElement);
const lobby=new Lobby();
type SelectedRoom=RoomInfo & {arena:{width:number;height:number}};
let selectedRoom:SelectedRoom|null=null;
let connection:Connection|null=null;
let loadingController:AbortController|null=null;

createLobbyUI(lobby,lobbyElement,({playerName,room})=>{
 lobby.stop();lobbyElement.hidden=true;matchElement.hidden=false;canvas.hidden=false;
 selectedRoom={...room,arena:{width:800,height:500}};
 canvas.style.aspectRatio='800 / 500';resize();
 const conn=createConnection();connection=conn;
 createMatchUI(matchElement,conn);
 conn.on('open',()=>{conn.send({type:'join',roomId:room.id,playerName});});
 conn.on('shutdown',({message})=>{const status=matchElement.querySelector('#connection-status');if(status)status.textContent=message;});
 conn.on('close',({code})=>{if(code===1001){const status=matchElement.querySelector('#connection-status');if(status)status.textContent='Server restarting. Reconnecting to lobby...';window.setTimeout(()=>window.location.reload(),1800);}});
 conn.on('failed',()=>{
  const status=matchElement.querySelector('#connection-status');
  if(status)status.textContent='Unable to join room. Please reload and try again.';
 });
 conn.connect();loadingControls.hidden=false;
 void loadGame(selectedRoom);
});
window.addEventListener('beforeunload',()=>connection?.disconnect());
lobby.start();

function drawLoadingScreen(progress:number):void{
 const width=canvas.clientWidth,height=canvas.clientHeight;
 ctx.clearRect(0,0,width,height);
 ctx.fillStyle='#252525';ctx.fillRect(0,0,width,height);
 ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='20px Arial';
 ctx.fillText('Loading Dogfight...',width/2,height/2-35);
 const barWidth=Math.min(320,width-48),barHeight=14,x=(width-barWidth)/2,y=height/2;
 ctx.fillStyle='#555555';ctx.fillRect(x,y,barWidth,barHeight);
 ctx.fillStyle='#3498db';ctx.fillRect(x,y,barWidth*progress,barHeight);
 ctx.font='14px Arial';ctx.fillStyle='#ffffff';ctx.fillText(`${Math.round(progress*100)}%`,width/2,y+35);
}

function requireConnection():Connection {
 if(!connection)throw new Error('Cannot start without a connection');
 return connection;
}
function startGame(assets:LoadedAssets):void{
 const conn=requireConnection();
 loadingControls.hidden=true;
 const input=createInput(window);
 window.addEventListener('keydown',audio.unlock);
 window.addEventListener('click',audio.unlock);
 const net=createNetcode();
 if((import.meta as ImportMeta & {env:{DEV:boolean}}).env.DEV)Object.assign(window,{dogfightDebug:{entities:()=>net.render(performance.now(),1/60),playerId:()=>net.playerId}});
 const panel=document.createElement('section');panel.className='network-panel';
 panel.innerHTML=`
  <fieldset><legend>Network simulation</legend>
    <label>Latency (ms) <input id="net-latency" type="number" min="0" max="1000" value="0"></label>
    <label>Jitter (ms) <input id="net-jitter" type="number" min="0" max="500" value="0"></label>
    <label>Drop (%) <input id="net-drop" type="number" min="0" max="100" value="0"></label>
    <label>Interpolation (ms) <input id="net-interpolation" type="number" min="0" max="300" value="100"></label>
    <label><input id="net-prediction" type="checkbox" checked> Client prediction</label>
    <label><input id="net-break" type="checkbox"> Break determinism (M2 demonstration)</label>
  </fieldset><pre id="netgraph"></pre>`;
 matchElement.append(panel);
 function control(id:string):HTMLInputElement{
  const element=panel.querySelector(`#${id}`);
  if(!(element instanceof HTMLInputElement))throw new Error(`Missing network control ${id}`);
  return element;
 }
 const latency=control('net-latency'),jitter=control('net-jitter'),drop=control('net-drop');
 const interpolation=control('net-interpolation'),prediction=control('net-prediction'),breakDeterminism=control('net-break');
 const netgraph=panel.querySelector('#netgraph');if(!(netgraph instanceof HTMLElement))throw new Error('Missing netgraph');
 function configureNetwork():void{
  conn.send({type:'networkConfig',latency:Number(latency.value),jitter:Number(jitter.value),drop:Number(drop.value)});
 }
 for(const control of [latency,jitter,drop])control.addEventListener('change',configureNetwork);
 interpolation.addEventListener('input',()=>net.setInterpolationDelay(Number(interpolation.value)));
 prediction.addEventListener('change',()=>net.setPrediction(prediction.checked));
 breakDeterminism.addEventListener('change',()=>net.setDeterminismBroken(breakDeterminism.checked));
 conn.on('open',configureNetwork);
 let lastPingAt=0,rtt=0,lastTrafficAt=performance.now(),lastTraffic=conn.traffic(),downKib=0,upKib=0;
 conn.on('pong',msg=>{rtt=performance.now()-msg.sentAt;});
 conn.on('snapshot',snapshot=>{
  if(!net.onSnapshot(snapshot))return;
  for(const event of snapshot.events){
   switch(event.type){
    case 'fired':gameEvents.emit('fired',null);break;
    case 'hit':gameEvents.emit('hit',null);break;
    case 'exploded':gameEvents.emit('exploded',null);break;
    case 'scoreChanged':gameEvents.emit('scoreChanged',event.detail);break;
    default:assertNever(event);
   }
  }
 });
 // Profiling controls are only for lab measurements, not game networking.
 Object.assign(window,{dogfightProfile:{frameReport,downloadFrameSamples},dogfightWorkerBenchmark:compareReplayWorker});
 const loop=createLoop({
  step:1/30,
  simulate(){
   performance.mark('simulate:start');
   const now=performance.now();
   if(now-lastPingAt>=1000){lastPingAt=now;conn.send({type:'ping',sentAt:now});}
   if(net.playerId){
    const turn=input.isDown('ArrowRight')?1:input.isDown('ArrowLeft')?-1:0;
    conn.send({type:'input',...net.step({thrust:input.isDown('ArrowUp'),turn,fire:input.isDown('Space')},now)});
   }
   input.endFrame();
   performance.mark('simulate:end');performance.measure('simulate','simulate:start','simulate:end');
  },
  render(_alpha,stats){
   collectFrame(stats.lastFrameDuration);
   performance.mark('render:start');
   const width=canvas.clientWidth,height=canvas.clientHeight,now=performance.now();
   ctx.clearRect(0,0,width,height);drawStars(ctx,width,height);
   for(const entity of net.render(now,Math.max(0.001,stats.lastFrameDuration/1000))){
    const object={...entity,pos:{x:entity.x,y:entity.y}};
    switch(entity.kind){
     case 'ship':drawShip(ctx,entity,assets.sprites.game);break;
     case 'bullet':drawBullet(ctx,object,assets.sprites.game);break;
     case 'asteroid':drawAsteroid(ctx,object,assets.sprites.game);break;
     case 'pickup':drawPickup(ctx,{...object,type:entity.pickupType});break;
     case 'explosion':break; // particles are visual-only; not reconstructed from snapshots
     default:assertNever(entity);
    }
   }
   const metrics=net.metrics(now);drawHud(ctx,stats,metrics.score);
   if(now-lastTrafficAt>=1000){
    const traffic=conn.traffic(),seconds=(now-lastTrafficAt)/1000;
    downKib=(traffic.receivedBytes-lastTraffic.receivedBytes)/1024/seconds;
    upKib=(traffic.sentBytes-lastTraffic.sentBytes)/1024/seconds;
    lastTraffic=traffic;lastTrafficAt=now;
   }
   netgraph.textContent=[
    `Codec: ${conn.traffic().codec}`,
    `RTT: ${rtt.toFixed(1)} ms`,
    `Snapshot age: ${metrics.snapshotAge.toFixed(1)} ms`,
    `Down: ${downKib.toFixed(2)} KiB/s | Up: ${upKib.toFixed(2)} KiB/s`,
    `Pending inputs: ${metrics.pending}`,
    `Reconciliation correction: ${metrics.correction.toFixed(2)} px`,
    `Interpolation delay: ${metrics.interpolationDelay} ms`,
    `Server tick: ${metrics.serverTick}`,
   ].join('\n');
   performance.mark('render:end');performance.measure('render','render:start','render:end');
  },
 });
 loop.start();
}

async function loadGame(room:SelectedRoom):Promise<void>{
 retryButton.hidden=true;cancelButton.hidden=false;loadingStatus.textContent='Loading resources...';
 const controller=new AbortController();loadingController=controller;drawLoadingScreen(0);
 try{
  const assetManifest={...manifest,arena:new URL('./assets/arena.json',import.meta.url).href};
  const assets=await loadAll(assetManifest,{
   ctx:audio.ctx,signal:controller.signal,
   onProgress(progress,completed,total){drawLoadingScreen(progress);loadingStatus.textContent=`Loading resources: ${completed}/${total}`;}
  });
  assets.arena=room.arena;audio.setSounds(assets.sounds);
  cancelButton.hidden=true;loadingController=null;startGame(assets);
 }catch(error:unknown){
  controller.abort();if(loadingController===controller)loadingController=null;
  console.error('Error loading resources:',error);cancelButton.hidden=true;
  loadingStatus.textContent=error instanceof Error&&error.name==='AbortError'?'Loading canceled.':'Failed to load assets. Please try again.';
  retryButton.hidden=false;
 }
}
cancelButton.addEventListener('click',()=>{loadingStatus.textContent='Canceling loading...';loadingController?.abort();});
retryButton.addEventListener('click',()=>{if(selectedRoom)void loadGame(selectedRoom);});
function assertNever(value:never):never{throw new Error(`Unexpected entity/event ${JSON.stringify(value)}`);}
