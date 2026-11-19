import { Match } from './match.ts';
import type {MatchSnapshot} from './match.ts';
import { Room } from './room.ts';
import { randomUUID } from 'node:crypto';
import { logRoomEvents } from './event-log.ts';

const MAX_ROOMS=10;
export class RoomManager {
 #rooms=new Map<string,Room>();
 #matches=new Map<string,Match>();
 onSnapshot?: (room:Room,snapshot:MatchSnapshot)=>void;
 onRosterChanged?: (room:Room)=>void;
 create(name:string,id:string=`room-${randomUUID()}`):Room{
  if(this.#rooms.size>=MAX_ROOMS){const error=new Error('Room limit reached');Object.assign(error,{statusCode:503});throw error;}
  const room=new Room(id,name);
  logRoomEvents(room);
  this.#rooms.set(room.id,room);
  const match=new Match(room,(current,snapshot)=>this.onSnapshot?.(current,snapshot));
  this.#matches.set(room.id,match);match.start();
  room.on('empty',()=>{match.stop();this.#matches.delete(room.id);this.#rooms.delete(room.id);});
  return room;
 }
 get(id:string):Room|undefined{return this.#rooms.get(id);}
 delete(id:string):boolean{this.#matches.get(id)?.stop();this.#matches.delete(id);return this.#rooms.delete(id);}
 list(){return [...this.#rooms.values()].map(({id,name})=>({id,name}));}
 getMatch(id:string):Match|undefined{return this.#matches.get(id);}
 getStats(){return [...this.#matches.entries()].map(([roomId,match])=>({roomId,...match.getStats()}));}
 stopAll():void{for(const match of this.#matches.values())match.stop();}
}
