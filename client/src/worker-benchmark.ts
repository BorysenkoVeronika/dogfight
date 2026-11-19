/** Run from DevTools with `await window.dogfightWorkerBenchmark()` after joining a game. */
export async function compareReplayWorker(bytes = 4 * 1024 * 1024) {
  const line = new TextEncoder().encode('{"type":"chat","message":"x"}\n');
  const buffer = new ArrayBuffer(Math.ceil(bytes/line.length)*line.length);
  const target = new Uint8Array(buffer);
  for(let i=0;i<target.length;i+=line.length)target.set(line,i);
  const clone = buffer.slice(0);
  const start = performance.now();
  const main = new TextDecoder().decode(clone).split('\n').filter(Boolean).map(x => JSON.parse(x) as unknown).length;
  const mainMs = performance.now()-start;
  const worker=new Worker(new URL('./replay-worker.ts',import.meta.url),{type:'module'});
  const workerStart=performance.now();
  try {
    const result = await new Promise<{count:number;workerMs:number}>((resolve,reject)=>{
      worker.onmessage=(e:MessageEvent<unknown>)=>{
        const data=e.data;
        if(typeof data!=='object'||data===null){reject(new Error('Invalid worker response'));return;}
        if('error' in data){reject(new Error(String(data.error)));return;}
        if('count' in data && 'workerMs' in data && typeof data.count==='number' && typeof data.workerMs==='number'){
          resolve({count:data.count,workerMs:data.workerMs});return;
        }
        reject(new Error('Invalid worker result'));
      };
      worker.onerror=e=>reject(new Error(e.message));
      worker.postMessage(buffer,[buffer]);
    });
    return {records:main,mainMs,workerMs:result.workerMs,transferTotalMs:performance.now()-workerStart,detachedBytes:buffer.byteLength};
  } finally {worker.terminate();}
}
