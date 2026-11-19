export type LoopStats={stepsPerSecond:number;framesPerSecond:number;lastFrameDuration:number};
export type LoopConfig={step?:number;simulate:(dt:number)=>void;render:(alpha:number,stats:LoopStats)=>void};
export function createLoop({step=1/60,simulate,render}:LoopConfig){
 let running=false;
 let animationId:number|null=null;
 let previousTime=0,accumulator=0,simulationSteps=0,renderFrames=0,lastFrameDuration=0;
 let statsElapsed=0,stepsPerSecond=0,framesPerSecond=0;
 function frame(now:number):void{
  if(!running)return;
  const frameTime=(now-previousTime)/1000;previousTime=now;
  accumulator+=Math.min(frameTime,0.25);
  while(accumulator>=step){simulate(step);accumulator-=step;simulationSteps++;}
  const alpha=accumulator/step;
  renderFrames++;lastFrameDuration=frameTime*1000;
  statsElapsed+=frameTime;
  if(statsElapsed>=1){stepsPerSecond=simulationSteps/statsElapsed;framesPerSecond=renderFrames/statsElapsed;simulationSteps=0;renderFrames=0;statsElapsed=0;}
  render(alpha,{stepsPerSecond,framesPerSecond,lastFrameDuration});
  animationId=requestAnimationFrame(frame);
 }
 function start():void{if(running)return;running=true;previousTime=performance.now();accumulator=0;animationId=requestAnimationFrame(frame);}
 function stop():void{if(!running)return;running=false;if(animationId!==null)cancelAnimationFrame(animationId);animationId=null;}
 return {start,stop};
}
