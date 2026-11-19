import { EventEmitter } from 'node:events';
export type Player = Readonly<{id:string;name:string}>;
export type RoomEvents = {
 join:[player:Player];
 leave:[player:Player];
 chat:[data:{player:Player;message:string}];
 empty:[];
};
export class Room extends EventEmitter<RoomEvents> {
 readonly players = new Map<string,Player>();
 constructor(readonly id:string,readonly name:string){super();}
 join(player:Player):void{this.players.set(player.id,player);this.emit('join',player);}
 leave(playerId:string):void{
  const player=this.players.get(playerId);
  if(!player)return;
  this.players.delete(playerId);this.emit('leave',player);
  if(this.players.size===0)this.emit('empty');
 }
 chat(playerId:string,message:string):void{const player=this.players.get(playerId);if(player)this.emit('chat',{player,message});}
}
