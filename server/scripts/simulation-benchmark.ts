/** Fixed-step ship hot-path benchmark: repeat before/after, report median/p95/p99. */
import {Ship} from '../../shared/sim/ship.ts';
import {inputAdapter} from '../../shared/sim/input.ts';
const input=inputAdapter({thrust:true,turn:1});
const iterations=100_000;
const run=()=>{const ship=new Ship(400,250);for(let i=0;i<iterations;i++)ship.update(1/30,input);return ship.pos.x;};
for(let k=0;k<8;k++)run();
const times:number[]=[];
for(let k=0;k<24;k++){const start=performance.now();run();times.push(performance.now()-start);}
times.sort((a,b)=>a-b);
const quantile=(p:number)=>times[Math.min(times.length-1,Math.ceil(p*times.length)-1)]!;
console.log(JSON.stringify({iterations,runs:times.length,medianMs:quantile(.5),p95Ms:quantile(.95),p99Ms:quantile(.99)},null,2));
