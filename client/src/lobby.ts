import {RoomListSchema,RoomInfoSchema} from '@dogfight/shared/protocol';
import type {RoomInfo} from '@dogfight/shared/protocol';

export async function fetchRooms(signal?:AbortSignal):Promise<RoomInfo[]> {
 const response=await fetch('/api/rooms',{signal});
 if(!response.ok)throw new Error(`Failed to fetch rooms: ${response.status}`);
 const data:unknown=await response.json();
 const parsed=RoomListSchema.safeParse(data);
 if(!parsed.success)throw new Error('Invalid rooms response');
 return parsed.data;
}
export class Lobby extends EventTarget {
 readonly interval:number;
 readonly timeout:number;
 rooms:RoomInfo[]=[];
 controller:AbortController|null=null;
 timer:ReturnType<typeof setInterval>|null=null;
 constructor({interval=5000,timeout=5000}:{interval?:number;timeout?:number}={}){
  super();this.interval=interval;this.timeout=timeout;
 }
 async refresh():Promise<void>{
  this.controller?.abort();
  const controller=new AbortController();this.controller=controller;
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(this.timeout)]);
  try{
   const rooms=await fetchRooms(signal);
   if(!signal.aborted){this.rooms=rooms;this.dispatchEvent(new CustomEvent<RoomInfo[]>('roomsChanged',{detail:rooms}));}
  }catch(error:unknown){if(!controller.signal.aborted)console.error('Failed to refresh rooms:',error);}
 }
 async createRoom(name:string):Promise<RoomInfo>{
  const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
  if(!response.ok)throw new Error(`Failed to create room: ${response.status}`);
  const data:unknown=await response.json();
  const parsed=RoomInfoSchema.safeParse(data);
  if(!parsed.success)throw new Error('Invalid create-room response');
  await this.refresh();return parsed.data;
 }
 join(roomId:string):RoomInfo{
  const room=this.rooms.find(room=>room.id===roomId);
  if(!room)throw new Error('Room not found');
  this.dispatchEvent(new CustomEvent<RoomInfo>('joined',{detail:room}));
  return room;
 }
 start():void{if(this.timer!==null)return;void this.refresh();this.timer=setInterval(()=>void this.refresh(),this.interval);}
 stop():void{if(this.timer!==null)clearInterval(this.timer);this.timer=null;this.controller?.abort();this.controller=null;}
}
