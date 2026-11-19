import {describe,it,expect,vi} from 'vitest';
import {createLoop} from '../src/loop.ts';
describe('fixed accumulator with fake animation frames',()=>{
 it('fixed step count is deterministic under frame pacing',()=>{
  vi.useFakeTimers();let time=0;
  vi.stubGlobal('performance',{now:()=>time});
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>setTimeout(()=>{time+=16.667;callback(time);},16));
  vi.stubGlobal('cancelAnimationFrame',(handle:number)=>clearTimeout(handle));
  try {
   const simulate=vi.fn(),render=vi.fn();
   const loop=createLoop({step:1/60,simulate,render});
   loop.start();vi.advanceTimersByTime(160);
   expect(simulate.mock.calls.length).toBeGreaterThanOrEqual(8);
   expect(render.mock.calls.length).toBeGreaterThanOrEqual(8);
   loop.stop();const count=simulate.mock.calls.length;
   vi.advanceTimersByTime(100);expect(simulate).toHaveBeenCalledTimes(count);
  } finally {vi.unstubAllGlobals();vi.useRealTimers();}
 });
});
