import {describe,it,expect,vi} from 'vitest';
import {Heartbeat} from '../src/heartbeat.ts';
describe('heartbeat policy',()=>{
 it('terminates after two missed pongs using fake timers',()=>{
  vi.useFakeTimers();try{
   const heartbeat=new Heartbeat(),close=vi.fn();
   const timer=setInterval(()=>{if(!heartbeat.ping())close();},15000);
   vi.advanceTimersByTime(45000);
   expect(close).toHaveBeenCalledTimes(1);clearInterval(timer);
  }finally{vi.useRealTimers();}
 });
 it('pong resets the missed counter',()=>{
  const h=new Heartbeat();h.ping();h.pong();expect(h.missedPongs).toBe(0);expect(h.ping()).toBe(true);
 });
});
