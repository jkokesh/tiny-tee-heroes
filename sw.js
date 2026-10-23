// Tiny Tee Heroes service worker.
// Page (index.html / any navigation, incl. ?room= invite links): NETWORK-FIRST, so every new deploy is picked up; cached copy only when offline/slow.
// Audio: cache-first (separate cache keyed by an audio content hash, so changed audio is re-fetched). Icons/manifest: stale-while-revalidate.
const V='tth-64ec611c85',AUDIO='tth-audio-7d57f220';
const CORE=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==AUDIO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function pageNetworkFirst(req){
  const cached=()=>caches.match('index.html',{ignoreSearch:true}).then(r=>r||caches.match('./',{ignoreSearch:true}));
  const net=fetch(req,{cache:'no-store'}).then(r=>{if(r&&r.ok){const cp=r.clone();caches.open(V).then(c=>c.put('index.html',cp));}return r;});
  // the network wins whenever it answers; the cached game is only used offline, or if the network takes > 8 s
  const slow=new Promise(res=>setTimeout(res,8000)).then(cached);
  try{const r=await Promise.race([net,slow.then(c=>c||net)]);return r;}
  catch(e){const c=await cached();return c||Response.error();}}
async function audio(req){
  const url=req.url.split('#')[0].split('?')[0];const c=await caches.open(AUDIO);let full=await c.match(url);
  if(!full){try{const r=await fetch(url,{cache:'no-cache'});if(r.ok&&r.status===200){await c.put(url,r.clone());full=r;}else return r;}catch(e){return fetch(req);}}
  const range=req.headers.get('range');if(!range)return full.clone();
  // media elements (Safari!) need proper 206 range responses
  const buf=await full.clone().arrayBuffer();const m=/bytes=(\d*)-(\d*)/.exec(range);const size=buf.byteLength;
  let s=m&&m[1]?+m[1]:0,en=m&&m[2]?+m[2]:size-1;if(m&&!m[1]&&m[2]){s=size-+m[2];en=size-1;}en=Math.min(en,size-1);
  return new Response(buf.slice(s,en+1),{status:206,statusText:'Partial Content',headers:{'Content-Type':full.headers.get('Content-Type')||'audio/mpeg','Content-Range':`bytes ${s}-${en}/${size}`,'Content-Length':String(en-s+1),'Accept-Ranges':'bytes'}});}
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==location.origin)return;
  const scope=new URL(self.registration.scope).pathname;const p=u.pathname;
  if(req.mode==='navigate'||p===scope||p.endsWith('/index.html')){e.respondWith(pageNetworkFirst(req));return;}
  if(p.includes('/audio/')&&p.endsWith('.mp3')){e.respondWith(audio(req));return;}
  if(p.endsWith('sw.js'))return;
  e.respondWith(caches.open(V).then(c=>c.match(req,{ignoreSearch:true}).then(hit=>{const net=fetch(req).then(r=>{if(r.ok)c.put(req,r.clone());return r;}).catch(()=>hit);return hit||net;})));});
