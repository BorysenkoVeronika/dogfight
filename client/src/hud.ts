import { gameEvents } from './events.ts';
export function createHud(){
 let score=0;
 gameEvents.on('scoreChanged',value=>{score=value;});
 return {get score(){return score;}};
}
