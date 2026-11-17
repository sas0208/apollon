import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { mkdir,readdir,stat,rename,rm } from 'node:fs/promises';
import { WorkPause,workPaused } from './work-pause.js';
import { atomicJson,readJson,idFor,fail } from './util.js';

const signature=item=>`v2:${item.size}:${Math.round(item.mtime)}`;
const dimensions={interval:10,width:320,height:180,columns:10,rows:10};
export function trickplayArgs(input,output,duration){
  return ['-nostdin','-hide_banner','-loglevel','error','-threads','1','-filter_threads','1','-skip_frame','nokey','-i',input,'-an','-sn','-dn',
    '-vf',`fps=1/10:start_time=0,tpad=stop_mode=clone:stop_duration=${duration+10},trim=end_frame=${Math.ceil(duration/10)},scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2,tile=10x10`,
    '-frames:v',String(Math.ceil(Math.ceil(duration/10)/100)),'-q:v','5','-threads','1','-start_number','0','-y',output];
}
function lowPriorityRun(command,args,timeout,signal){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{windowsHide:true,stdio:['ignore','ignore','pipe'],signal});let stderr='',error;
    try{os.setPriority(child.pid,os.constants.priority.PRIORITY_BELOW_NORMAL);}catch{}
    const timer=setTimeout(()=>{error=new Error('Tempo esaurito per le anteprime.');child.kill();},timeout);
    child.stderr.on('data',b=>{if(stderr.length<3000)stderr+=b;});
    child.on('error',e=>{error=e;});child.on('close',code=>{clearTimeout(timer);code===0&&!error?resolve():reject(error||new Error(stderr||'Anteprime non disponibili.'));});
  });
}
// Un solo lavoro, preemptibile; un indice è pubblicato soltanto dopo tutti i fogli.
export class Trickplay {
  constructor(config,library,tools={}){
    this.config=config;this.library=library;this.run=tools.run||lowPriorityRun;this.dir=path.join(config.dataDir,'trickplay');this.pause=new WorkPause(config);
    this.ready=new Map();this.failed=new Map();this.queue=new Map();this.sequence=0;this.closed=false;this.task=null;this.working=null;
  }
  async init(){
    await mkdir(this.dir,{recursive:true});
    for(const name of await readdir(this.dir))if(/^[a-f0-9]{24}-index.json$/.test(name)){
      const meta=await readJson(path.join(this.dir,name),null),id=name.slice(0,24);
      if(!meta?.signature||!(/^[a-f0-9]{24}$/.test(meta.version))||!Number.isSafeInteger(meta.frames)||meta.frames<1||meta.frames>8640||meta.sheets!==Math.ceil(meta.frames/100))continue;
      const present=await Promise.all(Array.from({length:meta.sheets},(_,n)=>stat(path.join(this.dir,`${id}-${meta.version}`,`${n}.jpg`)).then(s=>s.isFile()&&s.size>0,()=>false)));
      if(present.every(Boolean))this.ready.set(id,meta);
    }
    this.library.trickplay=this;return this;
  }
  valid(id){const raw=this.library.items.find(i=>i.id===id),meta=this.ready.get(id);return raw&&meta?.signature===signature(raw)?meta:null;}
  index(id,priority=0,{cachedOnly=false}={}){this.library.get(id);const meta=this.valid(id);if(!meta){if(!cachedOnly)this.enqueue([id],priority);return {ready:false,...dimensions,frames:0,sheets:0};}return {ready:true,...dimensions,frames:meta.frames,sheets:meta.sheets,version:meta.version};}
  sheet(id,n){const meta=this.valid(id);if(!meta||!Number.isSafeInteger(n)||n<0||n>=meta.sheets)throw fail(404,'Anteprima non ancora disponibile.');return path.join(this.dir,`${id}-${meta.version}`,`${n}.jpg`);}
  enqueue(ids,priority=3){
    if(this.closed)return;const level=Math.max(0,Math.min(3,Number(priority)||0));
    for(const id of ids){const item=this.library.items.find(i=>i.id===id);if(!item||!(item.duration>0)||item.duration>86400||this.valid(id)||this.failed.get(id)===signature(item)||id===this.working)continue;
      const old=this.queue.get(id);if(!old||level<old.priority)this.queue.set(id,{id,priority:level,sequence:old?.sequence??this.sequence++});
    }
    if(!this.task&&this.queue.size)this.task=Promise.resolve().then(()=>this.work()).finally(()=>{this.task=null;if(!this.closed&&this.queue.size)this.enqueue([]);});
  }
  noteActivity(){this.library.skips?.noteActivity();this.controller?.abort();}
  busy(){return !!(this.library.skips?.playbackBusy()||this.library.versions?.working);}
  async sleep(ms){if(this.closed)return;await new Promise(resolve=>{this.wake=()=>{clearTimeout(this.timer);this.wake=null;resolve();};this.timer=setTimeout(this.wake,ms);});}
  async work(){
    while(!this.closed&&this.queue.size){
      await this.pause.wait();while(!this.closed&&this.busy())await this.sleep(this.config.trickplayPollMs??2000);await this.pause.wait();if(this.closed)break;
      const job=[...this.queue.values()].sort((a,b)=>a.priority-b.priority||a.sequence-b.sequence)[0];this.queue.delete(job.id);
      const item=this.library.items.find(i=>i.id===job.id);if(!item||this.valid(job.id))continue;
      const attempt=signature(item);this.working=job.id;this.controller=new AbortController();const controller=this.controller;
      const monitor=setInterval(()=>{if(this.busy())controller.abort();else workPaused(this.config).then(paused=>{if(paused)controller.abort();}).catch(()=>{});},this.config.trickplayMonitorMs??500);
      try{await this.make(item,controller.signal);}catch{if(!this.closed){if(controller.signal.aborted)this.queue.set(job.id,job);else this.failed.set(job.id,attempt);}}
      finally{clearInterval(monitor);this.working=null;this.controller=null;}
      if(this.queue.size)await this.sleep(this.config.trickplayDelayMs??3000);
    }
  }
  async make(item,signal){
    const sig=signature(item),version=idFor(sig),stem=`${item.id}-${version}`,temporary=path.join(this.dir,`${stem}.tmp`),target=path.join(this.dir,stem);
    await rm(temporary,{recursive:true,force:true});await mkdir(temporary,{recursive:true});
    try{
      const input=await this.library.fileFor(item.id);signal.throwIfAborted();
      await this.run('ffmpeg',trickplayArgs(input,path.join(temporary,'%d.jpg'),item.duration),30*60*1000,signal);signal.throwIfAborted();
      const frames=Math.ceil(item.duration/10),sheets=Math.ceil(frames/100);
      for(let i=0;i<sheets;i++)if(!(await stat(path.join(temporary,`${i}.jpg`))).size)throw new Error('Foglio vuoto.');
      const current=this.library.items.find(i=>i.id===item.id);if(!current||signature(current)!==sig)throw new Error('Video cambiato.');
      // Stesso originale: il contenuto è immutabile. Un eventuale lavoro interrotto non diventa visibile.
      await rm(target,{recursive:true,force:true});await rename(temporary,target);
      const meta={signature:sig,version,frames,sheets};await atomicJson(path.join(this.dir,`${item.id}-index.json`),meta);this.ready.set(item.id,meta);
    }finally{await rm(temporary,{recursive:true,force:true}).catch(()=>{});}
  }
  async wait(){while(this.task)await this.task;}
  async close(){this.closed=true;this.queue.clear();this.pause.close();this.controller?.abort();this.wake?.();await this.task;}
}
