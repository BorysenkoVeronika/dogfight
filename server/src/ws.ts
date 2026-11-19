import { WebSocketServer } from 'ws';
import type {WebSocket} from 'ws';
import type {Server} from 'node:http';
import {randomUUID} from 'node:crypto';
import {parseClientMessage} from '@dogfight/shared/protocol';
import type {ClientMessage} from '@dogfight/shared/protocol';
import type {Snapshot} from '@dogfight/shared/types';
import {decodeInput} from '@dogfight/shared/codec/binary';
import {jsonCodec,binaryCodec} from '@dogfight/shared/codec/index';
import type {Room,Player} from './room.ts';
import type {RoomManager} from './room-manager.ts';

const PROTOCOL_VERSION=0;
const MAX_BUFFERED_BYTES=64*1024;
const MAX_PLAYERS_PER_ROOM=8;
type NetworkConfig={latency:number;jitter:number;drop:number};
type Session={player:Player|null;room:Room|null;codec:'json'|'binary';networkConfig:NetworkConfig;networkTimers:Set<ReturnType<typeof setTimeout>>;tokens:number;inputTokens:number;lastRefill:number;missedPongs:number;joinTimeout:ReturnType<typeof setTimeout>};
export function createWebSocketServer(server:Server,roomManager:RoomManager):WebSocketServer {
 const wss=new WebSocketServer({server,path:'/ws',maxPayload:4096});
 const states=new WeakMap<WebSocket,Session>();
 function send(socket:WebSocket,payload:string|ArrayBuffer,critical=false):void{
  if(socket.readyState!==1)return;
  if(socket.bufferedAmount>MAX_BUFFERED_BYTES){if(critical)socket.close(1008,'Slow client');return;}
  socket.send(payload);
 }
 function network(socket:WebSocket,action:()=>void):void{
  const state=states.get(socket);if(!state)return;
  const {latency,jitter,drop}=state.networkConfig;
  if(Math.random()*100<drop)return;
  const delay=Math.max(0,latency+(Math.random()*2-1)*jitter);
  const timer=setTimeout(()=>{state.networkTimers.delete(timer);if(socket.readyState===1)action();},delay);
  state.networkTimers.add(timer);
 }
 function broadcastRoster(room:Room):void{
  const payload=JSON.stringify({v:PROTOCOL_VERSION,type:'roster',players:[...room.players.values()]});
  for(const socket of wss.clients)if(states.get(socket)?.room===room)send(socket,payload,true);
 }
 roomManager.onSnapshot=(room,snapshot)=>{
  for(const socket of wss.clients){
   const state=states.get(socket);
   if(!state || state.room!==room || !state.player || socket.readyState!==1)continue;
   const message:Snapshot={...snapshot,playerId:state.player.id,lastProcessedSeq:snapshot.lastProcessedSeq[state.player.id]??-1};
   const codec=state.codec==='binary'?binaryCodec:jsonCodec;
   const payload=codec.encode(message);
   network(socket,()=>send(socket,payload));
  }
 };
 wss.on('connection',(socket,request)=>{
  const session:Session={player:null,room:null,codec:new URL(request.url??'/', 'http://localhost').searchParams.get('codec')==='json'?'json':'binary',networkConfig:{latency:0,jitter:0,drop:0},networkTimers:new Set(),tokens:10,inputTokens:40,lastRefill:performance.now(),missedPongs:0,joinTimeout:setTimeout(()=>{if(!session.room)socket.close(1008,'Join timeout');},5000)};
  states.set(socket,session);
  function consumeToken(input:boolean):boolean{
   const now=performance.now();const elapsed=(now-session.lastRefill)/1000;session.lastRefill=now;
   session.tokens=Math.min(10,session.tokens+elapsed*10);
   session.inputTokens=Math.min(40,session.inputTokens+elapsed*40);
   if(input){if(session.inputTokens<1)return false;session.inputTokens--;}
   else{if(session.tokens<1)return false;session.tokens--;}
   return true;
  }
  socket.on('pong',()=>{session.missedPongs=0;});
  socket.on('error',error=>console.error('WebSocket error:',error));
  socket.on('message',(raw,isBinary)=>{
   let candidate:unknown;
   try{
    if(isBinary){if(session.codec!=='binary')throw new Error('Unexpected binary packet');candidate={v:0,...decodeInput(raw)};}
    else candidate=JSON.parse(raw.toString());
   }catch(error){console.warn('Malformed websocket payload',error);socket.close(isBinary?1008:1007,'Invalid message');return;}
   const parsed=parseClientMessage(candidate);
   if(!parsed.ok){console.warn('Invalid message:',parsed.error);socket.close(1008,'Invalid message');return;}
   const data:ClientMessage=parsed.value;
   if(!consumeToken(data.type==='input')){socket.close(1008,'Rate limit exceeded');return;}
   switch(data.type){
    case 'join':{
     if(session.room){socket.close(1008,'Already joined');return;}
     const room=roomManager.get(data.roomId);
     if(!room){socket.close(1008,'Room not found');return;}
     if(room.players.size>=MAX_PLAYERS_PER_ROOM){socket.close(1008,'Room full');return;}
     const player={id:randomUUID(),name:data.playerName.trim()};
     session.room=room;session.player=player;
     room.join(player);roomManager.getMatch(room.id)?.addPlayer(player);
     clearTimeout(session.joinTimeout);broadcastRoster(room);return;
    }
    case 'networkConfig':{
     if(!session.room){socket.close(1008,'Join required');return;}
     session.networkConfig={latency:data.latency,jitter:data.jitter,drop:data.drop};return;
    }
    case 'ping':{
     if(!session.room){socket.close(1008,'Join required');return;}
     network(socket,()=>network(socket,()=>send(socket,JSON.stringify({v:0,type:'pong',sentAt:data.sentAt}))));return;
    }
    case 'input':{
     if(!session.room||!session.player){socket.close(1008,'Join required');return;}
     const roomId=session.room.id,playerId=session.player.id;
     network(socket,()=>roomManager.getMatch(roomId)?.receiveInput(playerId,data));return;
    }
    case 'chat':{
     if(!session.room||!session.player){socket.close(1008,'Join required');return;}
     const room=session.room, player=session.player, message=data.message.trim();
     room.chat(player.id,message);
     const payload=JSON.stringify({v:0,type:'chat',playerId:player.id,playerName:player.name,message});
     for(const client of wss.clients)if(states.get(client)?.room===room)send(client,payload);
     return;
    }
    default:return assertNever(data);
   }
  });
  socket.on('close',()=>{
   clearTimeout(session.joinTimeout);
   for(const timer of session.networkTimers)clearTimeout(timer);
   session.networkTimers.clear();
   if(session.room&&session.player){
    const room=session.room,player=session.player;
    roomManager.getMatch(room.id)?.removePlayer(player.id);
    room.leave(player.id);broadcastRoster(room);
    session.room=null;session.player=null;
   }
  });
 });
 const heartbeat=setInterval(()=>{
  for(const socket of wss.clients){
   const state=states.get(socket);
   if(!state || socket.readyState!==1)continue;
   if(state.missedPongs>=2){socket.terminate();continue;}
   state.missedPongs++;socket.ping();
  }
 },15000);
 wss.on('close',()=>clearInterval(heartbeat));
 return wss;
}
function assertNever(value:never):never{throw new Error(`Unexpected message: ${JSON.stringify(value)}`);}
