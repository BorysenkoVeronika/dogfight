import type {GameEvents,GameEvent} from '../types.ts';
export function createSimulationEvents(){
 const listeners=new Set<(event:GameEvent)=>void>();
 return {
  subscribe(listener:(event:GameEvent)=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};},
  emit<K extends keyof GameEvents>(type:K,detail:GameEvents[K]):void{
   let event:GameEvent;
   switch(type){
    case 'fired':event={type:'fired',detail:null};break;
    case 'hit':event={type:'hit',detail:null};break;
    case 'exploded':event={type:'exploded',detail:null};break;
    case 'scoreChanged':{
     if(typeof detail!=='number')throw new TypeError('Score must be numeric');
     event={type:'scoreChanged',detail};break;
    }
    default:throw new TypeError('Unknown game event');
   }
   for(const listener of listeners)listener(event);
  }
 };
}
