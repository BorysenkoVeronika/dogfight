export type Manifest={sprites:Record<string,string>;sounds:Record<string,string>;arena?:string};
export type LoadedAssets={sprites:Record<string,HTMLImageElement>;sounds:Record<string,AudioBuffer>;arena:unknown};
type LoadOptions={ctx:AudioContext;onProgress?:(progress:number,completed:number,total:number)=>void;signal?:AbortSignal;concurrent?:boolean};
type RetryOptions={attempts?:number;baseMs?:number;signal?:AbortSignal};
type LoadResult={category:'sprites';name:string;value:HTMLImageElement} | {category:'sounds';name:string;value:AudioBuffer} | {category:'arena';name:string;value:unknown};
function createAbortError():DOMException{return new DOMException('The operation was aborted','AbortError');}
function abortReason(signal?:AbortSignal):Error{return signal?.reason instanceof Error ? signal.reason : createAbortError();}
function checkAbort(signal?:AbortSignal):void{if(signal?.aborted)throw signal.reason??createAbortError();}
function delay(ms:number,signal?:AbortSignal):Promise<void>{
 return new Promise<void>((resolve,reject)=>{
  checkAbort(signal);
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',onAbort);resolve();},ms);
  function onAbort(){clearTimeout(timer);reject(abortReason(signal));}
  signal?.addEventListener('abort',onAbort,{once:true});
 });
}
export async function withRetry<T>(fn:(signal?:AbortSignal)=>Promise<T>,{attempts=3,baseMs=300,signal}:RetryOptions={}):Promise<T>{
 for(let attempt=0;attempt<attempts;attempt++){
  checkAbort(signal);
  try{return await fn(signal);}
  catch(error:unknown){
   if(signal?.aborted||(error instanceof Error && error.name==='AbortError'))throw error;
   const status=error instanceof Error && 'status' in error ? error.status : undefined;
   if(typeof status==='number'&&status>=400&&status<500)throw error;
   if(attempt===attempts-1)throw error;
   const backoff=baseMs*2**attempt;
   await delay(backoff+Math.random()*backoff*0.25,signal);
  }
 }
 throw new Error('No attempts configured');
}
export async function fetchJson(url:string,signal?:AbortSignal):Promise<unknown>{
 const response=await fetch(url,{signal});
 if(!response.ok)throw Object.assign(new Error(`Failed to load ${url}: ${response.status}`),{status:response.status});
 return response.json();
}
export function loadJson(url:string,signal?:AbortSignal):Promise<unknown>{return fetchJson(url,signal);}
export function loadImage(url:string,signal?:AbortSignal):Promise<HTMLImageElement>{
 checkAbort(signal);
 const image=new Image();
 return new Promise<HTMLImageElement>((resolve,reject)=>{
  function cleanup(){image.onload=null;image.onerror=null;signal?.removeEventListener('abort',onAbort);}
  function onAbort(){cleanup();image.src='';reject(abortReason(signal));}
  image.onload=()=>{cleanup();resolve(image);};
  image.onerror=()=>{cleanup();reject(new Error(`Failed to load image ${url}`));};
  signal?.addEventListener('abort',onAbort,{once:true});
  if(signal?.aborted){onAbort();return;}
  image.src=url;
 });
}
export async function loadAudio(ctx:AudioContext,url:string,signal?:AbortSignal):Promise<AudioBuffer>{
 const response=await fetch(url,{signal});
 if(!response.ok)throw Object.assign(new Error(`Failed to load audio ${url}: ${response.status}`),{status:response.status});
 const buffer=await response.arrayBuffer();checkAbort(signal);
 return ctx.decodeAudioData(buffer);
}
export async function loadAll(manifest:Manifest,{ctx,onProgress=()=>{},signal,concurrent=true}:LoadOptions):Promise<LoadedAssets>{
 const tasks:Array<()=>Promise<LoadResult>>=[];
 for(const [name,url] of Object.entries(manifest.sprites??{}))tasks.push(async()=>({category:'sprites',name,value:await withRetry(()=>loadImage(url,signal),{signal})}));
 for(const [name,url] of Object.entries(manifest.sounds??{}))tasks.push(async()=>({category:'sounds',name,value:await withRetry(()=>loadAudio(ctx,url,signal),{signal})}));
 if(manifest.arena)tasks.push(async()=>({category:'arena',name:'arena',value:await withRetry(()=>loadJson(manifest.arena!,signal),{signal})}));
 const total=tasks.length;let completed=0;
 onProgress(0,0,total);
 async function loadTask(task:()=>Promise<LoadResult>){
  const result=await task();completed++;onProgress(completed/total,completed,total);return result;
 }
 const results:LoadResult[]=[];
 if(concurrent)results.push(...await Promise.all(tasks.map(loadTask)));
 else for(const task of tasks)results.push(await loadTask(task));
 const assets:LoadedAssets={sprites:{},sounds:{},arena:null};
 for(const result of results){
  switch(result.category){
   case 'sprites':assets.sprites[result.name]=result.value;break;
   case 'sounds':assets.sounds[result.name]=result.value;break;
   case 'arena':assets.arena=result.value;break;
   default:assertNever(result);
  }
 }
 return assets;
}
function assertNever(value:never):never{throw new Error(`Unknown asset type ${JSON.stringify(value)}`);}
