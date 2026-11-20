/** Headless WebSocket load ramp. Run while backend is listening on port 3000. */
import { WebSocket, type RawData } from 'ws';
import {encodeInput} from '@dogfight/shared/codec/binary';
import {writeFile} from 'node:fs/promises';
const base=process.env.LOAD_URL??'http://127.0.0.1:3000';
const runMs=Number(process.env.LOAD_DURATION_MS??'10000');
const origin=process.env.LOAD_ORIGIN??new URL(base).origin;
const rows:Record<string,string|number>[]=[];
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
async function createRooms(n:number):Promise<string[]> {
 const existing=await fetch(base+'/api/rooms').then(r=>r.json()) as {id:string}[];
 const rooms=existing.map(r=>r.id);
 while(rooms.length<Math.min(10,Math.ceil(n/8))){
  const response=await fetch(base+'/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:`Load Room ${rooms.length}`})});
  if(!response.ok)break;
  rooms.push(((await response.json()) as {id:string}).id);
 }
 return rooms;
}
async function scenario(n:number):Promise<void>{
 const rooms=await createRooms(n),sockets:WebSocket[]=[],timers:ReturnType<typeof setInterval>[]=[];
 let accepted=0,refused=0,bytes=0;
 for(let i=0;i<n;i++){
  const room=rooms[Math.floor(i/8)];if(!room){refused++;continue;}
  const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws?codec=binary',{origin});sockets.push(socket);
  socket.on('message',(msg:RawData)=>{bytes+=msg.length;});
  socket.on('error',()=>{});
  await new Promise<void>(resolve=>{
   let settled=false;const done=()=>{if(!settled){settled=true;resolve();}};
   socket.once('open',()=>{
    socket.send(JSON.stringify({v:0,type:'join',roomId:room,playerName:`Load ${i}`}));
    accepted++;
    let seq=0;
    const timer=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send(encodeInput({seq:++seq,tick:seq,thrust:true,turn:seq%30<15?1:-1,fire:seq%6===0}));},1000/30);
    timers.push(timer);done();
   });socket.once('error',()=>{refused++;done();});socket.once('close',done);
   setTimeout(done,2500);
  });
 }
 await sleep(runMs);
 const resp=await fetch(base+'/api/stats').then(r=>r.json()) as {rssBytes:number;eventLoopUtilization:number;matches:{tickP99Ms:number}[]};
 const p99=Math.max(0,...resp.matches.map(m=>m.tickP99Ms));
 rows.push({requested:n,connectionsOpened:accepted,unconnected:refused,rooms:rooms.length,tickP99Ms:p99,eventLoopUtilization:resp.eventLoopUtilization,rssMiB:resp.rssBytes/1048576,receivedBytesPerSecond:bytes/(runMs/1000)});
 for(const t of timers)clearInterval(t);
 for(const socket of sockets)socket.terminate();await sleep(200);
 console.log(rows.at(-1));
}
for(const n of [8,32,64,128])await scenario(n);
const keys=Object.keys(rows[0]??{});
await writeFile('load-results.csv',[keys.join(','),...rows.map(r=>keys.map(k=>r[k]).join(','))].join('\n'));
console.log('Saved load-results.csv');
