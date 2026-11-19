/** Warmed microbenchmark, prints median/p95/p99: objects/shapes vs typed arrays. */
const N=100_000;
const points=Array.from({length:N},(_,i)=>({x:i,y:i}));
const unstable=points.map((p,i)=>i%10===0?{...p,z:i}:p);
const x=new Float32Array(N);for(let i=0;i<N;i++)x[i]=i;
function percentile(xs:number[],q:number){const arr=[...xs].sort((a,b)=>a-b);return arr[Math.min(arr.length-1,Math.ceil(q*arr.length)-1)]??0;}
function run(label:string,fn:()=>number){
 for(let j=0;j<30;j++)fn();
 const times:number[]=[];
 for(let j=0;j<100;j++){const s=performance.now();fn();times.push(performance.now()-s);}
 console.log(label,{median:percentile(times,.5),p95:percentile(times,.95),p99:percentile(times,.99)});
}
run('same shape',()=>{let s=0;for(const p of points)s+=p.x;return s;});
run('mixed shapes',()=>{let s=0;for(const p of unstable)s+=p.x;return s;});
run('Float32Array',()=>{let s=0;for(const p of x)s+=p;return s;});
