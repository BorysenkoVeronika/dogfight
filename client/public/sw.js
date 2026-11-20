const CACHE='dogfight-shell-v1';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/manifest.webmanifest'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin||new URL(req.url).pathname.startsWith('/api/')||new URL(req.url).pathname==='/health'||new URL(req.url).pathname==='/ready'||new URL(req.url).pathname==='/metrics')return;
 event.respondWith(fetch(req).catch(()=>caches.match(req)));
});
