import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile,stat,unlink } from 'node:fs/promises';
import { fixture } from './helpers.js';
import { Trickplay,trickplayArgs } from '../lib/trickplay.js';
import { probe,run } from '../lib/media.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const fakeRun=async(command,args)=>{await writeFile(args.at(-1).replace('%d','0'),'jpeg-di-prova');};
async function sample(f,name='Anteprime (2026).mp4'){const i=await f.video(name);Object.assign(f.app.library.items.find(x=>x.id===i.id),{duration:25});return f.app.library.get(i.id);}
test('trickplay: keyframe soltanto, pochi thread, fogli 10x10 e campionamento temporale',()=>{
 const args=trickplayArgs('input','%d.jpg',1440);assert(args.includes('nokey'));assert(args.includes('tile=10x10')||args.some(s=>s.includes('tile=10x10')));assert(args.some(s=>s.includes('fps=1/10')));assert.equal(args[args.indexOf('-threads')+1],'1');assert.equal(args[args.indexOf('-an')],'-an');
});
test('trickplay: indice, fogli, HEAD, firma, cache e convalida dei percorsi',async t=>{
 const f=await fixture({trickplayTools:{run:fakeRun},trickplayDelayMs:0});t.after(()=>f.close());const item=await sample(f);
 let r=await f.request(`/media/${item.id}/trickplay`);assert.equal(r.status,202);assert.equal((await r.json()).ready,false);await f.app.trickplay.wait();
 const index=await(await f.request(`/media/${item.id}/trickplay`)).json();assert.equal(index.frames,3);assert.equal(index.sheets,1);assert.equal(index.width,320);assert.equal(index.height,180);assert(!JSON.stringify(index).includes(f.dir));
 assert.equal((await f.request(`/media/${item.id}/trickplay/0.jpg`)).status,200);assert.equal((await f.request(`/media/${item.id}/trickplay/0.jpg`,{method:'HEAD'})).status,200);
 for(const suffix of ['1.jpg','-1.jpg','x.jpg','0.png','999999.jpg'])assert.equal((await f.request(`/media/${item.id}/trickplay/${suffix}`)).status,404);
 f.app.library.items.find(i=>i.id===item.id).mtime++;assert.equal(f.app.trickplay.index(item.id).ready,false);await f.app.trickplay.wait();assert(f.app.trickplay.index(item.id).ready);
});
test('trickplay: priorità corrente/successivo/continua/resto e nessun duplicato',async t=>{
 const order=[];const f=await fixture({trickplayTools:{run:async(c,args)=>{order.push(path.basename(path.dirname(args.at(-1))).slice(0,24));await fakeRun(c,args);}},trickplayDelayMs:0});t.after(()=>f.close());
 const items=[];for(const n of ['A','B','C','D'])items.push(await sample(f,`${n}.mp4`));
 f.app.trickplay.enqueue(items.map(i=>i.id),3);f.app.trickplay.enqueue([items[2].id],0);f.app.trickplay.enqueue([items[3].id],1);f.app.trickplay.enqueue([items[1].id],2);await f.app.trickplay.wait();
 assert.deepEqual(order,[items[2].id,items[3].id,items[1].id,items[0].id]);
});
test('trickplay: playback interrompe il processo e riparte dopo la pausa senza lavori paralleli',async t=>{
 let calls=0,active=0,max=0;
 const f=await fixture({skipPlaybackWindowMs:45,trickplayPollMs:5,trickplayDelayMs:0,trickplayTools:{run:async(c,args,timeout,signal)=>{
   calls++;active++;max=Math.max(max,active);try{await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,60);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Interrotto'));},{once:true});});await fakeRun(c,args);}finally{active--;}
 }}});t.after(()=>f.close());const item=await sample(f);f.app.trickplay.enqueue([item.id]);while(!active)await delay(2);f.app.trickplay.noteActivity();await f.app.trickplay.wait();assert(calls>=2);assert.equal(max,1);assert(f.app.trickplay.index(item.id).ready);
});
test('trickplay: il lucchetto di lavoro ferma anche una richiesta prioritaria',async t=>{
 let calls=0;const f=await fixture({trickplayTools:{run:async(...args)=>{calls++;await fakeRun(...args);}},trickplayPollMs:5});t.after(()=>f.close());
 const lock=path.join(f.dir,'pausa.json');f.app.config.pauseLockFile=lock;await writeFile(lock,JSON.stringify({pid:process.pid}));const item=await sample(f);f.app.trickplay.enqueue([item.id],0);await delay(30);assert.equal(calls,0);await unlink(lock);f.app.trickplay.pause.wake?.();await f.app.trickplay.wait();assert.equal(calls,1);
});
test('trickplay: ffmpeg reale sui video demo produce fogli JPEG 3200x1800',async t=>{
 const f=await fixture({trickplayDelayMs:0});t.after(()=>f.close());const item=await sample(f);
 // Usa un file demo presente, mai un video personale.
 const {readdir}=await import('node:fs/promises');const base=path.resolve('demo-data/Anime/Hoshizora Express/Stagione 1');const name=(await readdir(base)).find(n=>n.endsWith('.mp4'));assert(name);const raw=f.app.library.items.find(i=>i.id===item.id);raw.duration=25;const original=f.app.library.fileFor.bind(f.app.library);f.app.library.fileFor=async id=>id===item.id?path.join(base,name):original(id);
 f.app.trickplay.enqueue([item.id]);await f.app.trickplay.wait();assert(f.app.trickplay.index(item.id).ready);const file=f.app.trickplay.sheet(item.id,0);const info=await probe(file);assert.equal(info.streams[0].width,3200);assert.equal(info.streams[0].height,1800);assert((await stat(file)).size>100);
 const last=await run('ffmpeg',['-v','error','-threads','1','-i',file,'-vf','crop=320:180:640:0','-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],20000,undefined,'binary');assert(last.some(b=>b>50),'Ultimo fotogramma indicizzato realmente presente, non una cella nera');
});
test('trickplay: indice e fogli dal fisso, priorità tradotte e attività propagata',async t=>{
 const source=await fixture({trickplayTools:{run:fakeRun},trickplayDelayMs:0});const item=await sample(source);
 const proxy=await fixture({remoteVideoSources:[{nome:'fisso',url:source.url}]});t.after(async()=>{await proxy.close();await source.close();});
 const far=(await(await proxy.request('/api/library')).json()).items.find(i=>i.remote);
 assert(far);const scheduled=await proxy.request('/api/tv/trickplay',{method:'POST',data:{current:far.id,continuing:[far.id],rest:[far.id]}});assert.equal(scheduled.status,202);await source.app.trickplay.wait();
 const index=await(await proxy.request(`/media/${far.id}/trickplay?playing=1`)).json();assert.equal(index.ready,true);assert(source.app.skips.playbackBusy());
 const sheet=await proxy.request(`/media/${far.id}/trickplay/0.jpg`);assert.equal(sheet.status,200);assert.equal(await sheet.text(),'jpeg-di-prova');assert.equal(proxy.app.trickplay.ready.size,0);
});
test('trickplay: payload errati e originali assenti non lanciano lavori',async t=>{
 const f=await fixture({trickplayTools:{run:fakeRun}});t.after(()=>f.close());
 for(const data of [{continuing:'non-array'},{rest:[null]},{current:42},{rest:Array(401).fill('a').map((v,i)=>String(i))}])assert.equal((await f.request('/api/tv/trickplay',{method:'POST',data})).status,400);
 assert.equal((await f.request(`/media/${'f'.repeat(24)}/trickplay`)).status,404);assert.equal(f.app.trickplay.queue.size,0);
});
test('trickplay: cache riutilizzata al riavvio e foglio mancante rigenerato',async t=>{
 const f=await fixture({trickplayTools:{run:fakeRun},trickplayDelayMs:0});t.after(()=>f.close());const item=await sample(f);f.app.trickplay.enqueue([item.id]);await f.app.trickplay.wait();
 const cached=await new Trickplay(f.app.config,f.app.library,{run:fakeRun}).init();t.after(()=>cached.close());assert(cached.index(item.id).ready);
 await unlink(cached.sheet(item.id,0));const recovered=await new Trickplay(f.app.config,f.app.library,{run:fakeRun}).init();t.after(()=>recovered.close());assert.equal(recovered.index(item.id).ready,false);await recovered.wait();assert(recovered.index(item.id).ready);
});
