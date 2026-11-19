import {encodeInput,decodeSnapshot} from '@dogfight/shared/codec/binary';
import {parseServerMessage} from '@dogfight/shared/protocol';
import type {ClientMessage,ServerMessage} from '@dogfight/shared/protocol';

type ClientRequest=ClientMessage extends infer M ? M extends {v:0} ? Omit<M,'v'> : never : never;
type ConnectionEvents={
 open:{type:'open'};
 close:{type:'close';code:number};
 failed:{type:'failed';code:number};
 roster:Extract<ServerMessage,{type:'roster'}>;
 chat:Extract<ServerMessage,{type:'chat'}>;
 pong:Extract<ServerMessage,{type:'pong'}>;
 snapshot:Extract<ServerMessage,{type:'snapshot'}>;
};
type ConnectionEventName=keyof ConnectionEvents;
export type Connection={
 connect():void;disconnect():void;send(data:ClientRequest):boolean;
 on<K extends ConnectionEventName>(type:K,callback:(data:ConnectionEvents[K])=>void):()=>void;
 traffic():{sentBytes:number;receivedBytes:number;codec:'json'|'binary'};
};
export function createConnection():Connection{
 const handlers=new Map<ConnectionEventName,Set<(data:never)=>void>>();
 let socket:WebSocket|null=null;
 let reconnectAttempts=0;
 let reconnectTimer:ReturnType<typeof setTimeout>|null=null;
 let shouldReconnect=true;
 const codec:'json'|'binary'=new URLSearchParams(location.search).get('codec')==='json'?'json':'binary';
 const scheme=location.protocol==='https:'?'wss:':'ws:';
 const url=`${scheme}//${location.host}/ws?codec=${codec}`;
 let sentBytes=0,receivedBytes=0;
 function dispatch<K extends ConnectionEventName>(type:K,data:ConnectionEvents[K]):void{
  for(const callback of handlers.get(type)??[])Reflect.apply(callback,undefined,[data]);
 }
 function send(data:ClientRequest):boolean{
  if(!socket||socket.readyState!==WebSocket.OPEN)return false;
  const payload=data.type==='input'&&codec==='binary'?encodeInput(data):JSON.stringify({v:0,...data});
  socket.send(payload);
  sentBytes+=typeof payload==='string'?new TextEncoder().encode(payload).length:payload.byteLength;
  return true;
 }
 function connect():void{
  if(!shouldReconnect||socket?.readyState===WebSocket.OPEN||socket?.readyState===WebSocket.CONNECTING)return;
  socket=new WebSocket(url);socket.binaryType='arraybuffer';
  socket.onopen=()=>{reconnectAttempts=0;if(reconnectTimer)clearTimeout(reconnectTimer);dispatch('open',{type:'open'});};
  socket.onmessage=event=>{
   try{
    performance.mark('decode:start');
    receivedBytes+=typeof event.data==='string'?new TextEncoder().encode(event.data).length:
     event.data instanceof ArrayBuffer?event.data.byteLength:0;
    let candidate:unknown;
    if(typeof event.data==='string')candidate=JSON.parse(event.data);
    else if(event.data instanceof ArrayBuffer)candidate={v:0,...decodeSnapshot(event.data)};
    else throw new Error('Unexpected WebSocket payload');
    performance.mark('decode:end');performance.measure('decode','decode:start','decode:end');
    const parsed=parseServerMessage(candidate);
    if(!parsed.ok)throw new Error(parsed.error);
    const data=parsed.value;
    switch(data.type){
     case 'roster':dispatch('roster',data);break;
     case 'chat':dispatch('chat',data);break;
     case 'pong':dispatch('pong',data);break;
     case 'snapshot':dispatch('snapshot',data);break;
     default:assertNever(data);
    }
   }catch(error:unknown){console.error('Invalid server message:',error);}
  };
  socket.onerror=error=>console.error('WebSocket error:',error);
  socket.onclose=event=>{
   dispatch('close',{type:'close',code:event.code});
   if(!shouldReconnect)return;
   if([1007,1008,1009].includes(event.code)){
    shouldReconnect=false;dispatch('failed',{type:'failed',code:event.code});return;
   }
   const delay=Math.min(1000*2**reconnectAttempts++,30000);
   reconnectTimer=setTimeout(connect,delay);
  };
 }
 function on<K extends ConnectionEventName>(type:K,callback:(data:ConnectionEvents[K])=>void):()=>void{
  const set=handlers.get(type)??new Set<(data:never)=>void>();set.add(callback);handlers.set(type,set);
  return ()=>{set.delete(callback);};
 }
 function disconnect():void{
  shouldReconnect=false;if(reconnectTimer)clearTimeout(reconnectTimer);
  if(socket&&socket.readyState<=WebSocket.OPEN)socket.close(1000,'Client disconnected');
 }
 function traffic(){return {sentBytes,receivedBytes,codec};}
 return {connect,disconnect,send,on,traffic};
}
function assertNever(value:never):never{throw new Error(`Unknown server message ${JSON.stringify(value)}`);}
