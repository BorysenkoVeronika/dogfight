import {gameEvents} from './events.ts';
export function createAudio(){
 const ctx=new AudioContext();let sounds:Record<string,AudioBuffer>={};
 function setSounds(loaded:Record<string,AudioBuffer>):void{sounds=loaded;}
 function unlock():void{if(ctx.state==='suspended')void ctx.resume();}
 function play(name:string):void{
  const buffer=sounds[name];if(!buffer||ctx.state!=='running')return;
  const source=ctx.createBufferSource();source.buffer=buffer;source.connect(ctx.destination);source.start();
 }
 gameEvents.on('fired',()=>play('shoot'));
 gameEvents.on('hit',()=>play('hit'));
 gameEvents.on('exploded',()=>play('explosion'));
 return {ctx,setSounds,unlock,play};
}
