import { FocusModel,acceptRepeat } from './focus.js';
import { el,button,icon,artwork,setActive } from './ui.js';
import { createScrub } from './scrub.js';
import { nextEpisode,backLayer,nextPrompt } from './playback.js';
import { previewFrame } from './preview.js';
import { playbackAction } from '../logic.js';
import { episodeCode,languageName,chooseQuality,mediaUrl,durationText } from '../video-logic.js';
import { request } from './api.js';

const TEXT_CODECS=new Set(['subrip','srt','ass','ssa','mov_text','webvtt','text']);
const fmt=seconds=>{const n=Math.max(0,Math.floor(seconds||0));return `${n>=3600?Math.floor(n/3600)+':':''}${n>=3600?String(Math.floor(n/60)%60).padStart(2,'0'):Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
export function player(c,params) {
  const d=c.data,profile=d.profile;let item=d.items.find(i=>i.id===params.id),title=d.titles.find(t=>t.key===params.title);
  let disposed=false,switching=false,generation=0,overlay=true,panel=null,scrub=null,scrubKey='',wasPlaying=false,preview=null,idleAt=performance.now(),lastSaved=0,stay=false,nextElapsed=0,nextVisible=false,skip=null,ignored=new Set(),quality='original',panelSeason=item?.season||1;
  const root=el('section','player-screen'),video=el('video');video.id='tv-video';video.preload='auto';video.playsInline=true;video.controls=false;
  const layer=el('div','player-overlay visible'),heading=el('div','player-heading'),bottom=el('div','player-bottom');
  const timeline=el('div','player-timeline');timeline.dataset.id='timeline';timeline.setAttribute('role','slider');timeline.setAttribute('aria-label','Posizione nel video');
  const bar=el('div','timeline-bar',el('i')),cursor=el('i','timeline-cursor');timeline.append(bar,cursor);
  const times=el('div','player-times',el('span','','0:00'),el('span','','0:00'));const controls=el('div','player-controls');bottom.append(timeline,times,controls);layer.append(heading,bottom);
  const previewBox=el('div','seek-preview',el('div','seek-image'),el('strong','','0:00'),el('span','','OK per andare qui · Indietro annulla'));previewBox.hidden=true;
  const context=el('div','player-context');context.hidden=true;const panels=el('div','player-panels');const fade=el('div','episode-fade');
  root.append(video,layer,previewBox,context,panels,fade);c.mount(root);
  const focus=new FocusModel();
  let lastMove=null,lastControls='',lastHeading='',lastPanel='',lastContext='',lastPreviewPoll=0,lastLibraryPoll=0,libraryPollBusy=false,requestedPosition=0;
  const duration=()=>Number.isFinite(video.duration)?video.duration:item?.duration||0;
  const prefs=()=>({autoSkip:d.person?.autoSkip===true,autoNext:d.person?.autoNext!==false});
  function commands(){return ['toggle','back10','forward10',...(nextEpisode(d.items,item)?['next']:[]),...(item?.series?['episodes']:[]),'languages','settings'];}
  function resetFocus(){focus.setRows([{id:'timeline',items:['timeline']},{id:'controls',items:commands()}]);focus.select('controls','toggle');}
  function wake(){overlay=true;idleAt=performance.now();paint();}
  function hide(){overlay=false;paint();}
  async function save(watched){if(!item||switching||video.readyState<1||!Number.isFinite(video.currentTime)||!(duration()>0))return;const id=item.id,position=video.currentTime,total=duration();lastSaved=performance.now();await d.saveProgress(id,{position,duration:total,...(watched===undefined?{}:{watched})},profile);}
  function saveQuiet(){save().catch(()=>c.notify('Avanzamento non salvato. Controlla la connessione.'));}
  function subtitles(){return [...(item.subtitles||[]).map((s,i)=>({id:String(i),language:s.language||'it',label:s.title||languageName(s.language),src:`/media/${item.id}/subtitle/${i}`})),...(item.streams||[]).filter(s=>s.type==='subtitle'&&TEXT_CODECS.has(s.codec)).map(s=>({id:`s${s.index}`,language:s.language,label:s.title||languageName(s.language),src:`/media/${item.id}/subtitle/s${s.index}`}))];}
  function applyLanguages(){
    const sub=d.preferenceValue('video-subs','off'),audio=d.preferenceValue('video-audio','ita');
    Array.from(video.textTracks).forEach(track=>{track.mode=sub!=='off'&&(track.language===sub||languageName(track.language)===languageName(sub))?'showing':'disabled';});
    const native=video.audioTracks;if(native?.length){const streams=(item.streams||[]).filter(s=>s.type==='audio');const n=streams.findIndex(s=>s.language===audio||languageName(s.language)===languageName(audio));if(n>=0)Array.from(native).forEach((track,i)=>{track.enabled=i===n;});}
  }
  async function loadItem(next,position=0){
    if(!next||next.remoteDown){c.notify('Il fisso è spento. Torna alla raccolta e riprova.');return;}
    const mine=++generation;switching=true;requestedPosition=position;video.pause();cancelScrub(false);panel=null;panels.replaceChildren();item=next;panelSeason=item.season||1;stay=false;nextElapsed=0;nextVisible=false;skip=null;ignored=new Set();preview=null;
    root.dataset.item=item.id;root.dataset.seeking='false';fade.classList.add('visible');
    quality=chooseQuality(d.preferenceValue('quality','auto'),item,{host:location.hostname,effectiveType:navigator.connection?.effectiveType,downlink:navigator.connection?.downlink,saveData:navigator.connection?.saveData});
    video.replaceChildren();for(const s of subtitles()){const track=el('track');track.kind='subtitles';track.label=s.label;track.srclang=s.language;track.src=s.src;video.append(track);}
    video.onloadedmetadata=()=>{if(disposed||mine!==generation)return;video.currentTime=Math.min(Math.max(0,position),Math.max(0,duration()-.1));switching=false;applyLanguages();fade.classList.remove('visible');wake();video.play().catch(()=>{overlay=true;paint();});saveQuiet();};
    video.src=mediaUrl(item,quality);video.load();resetFocus();wake();
    d.primePreviews(item.id,nextEpisode(d.items,item)?.id);pollPreview();
  }
  function pollPreview(){const mine=generation,id=item.id;lastPreviewPoll=performance.now();request(`/media/${id}/trickplay?priority=0${!video.paused?'&playing=1':''}`).then(v=>{if(mine===generation&&v.frames)preview=v;}).catch(()=>{});}
  async function changeItem(next,complete=false){if(!next)return;await save(complete?true:undefined).catch(()=>c.notify('Avanzamento non salvato. Controlla la connessione.'));await loadItem(next,complete||d.progress[next.id]?.watched?0:d.progress[next.id]?.position||0);}
  async function refreshPlayingItem(){if(libraryPollBusy)return;const mine=generation;libraryPollBusy=true;lastLibraryPoll=performance.now();try{await d.reloadLibrary();if(!disposed&&mine===generation){const fresh=d.items.find(i=>i.id===item.id);if(fresh)Object.assign(item,fresh);title=d.titles.find(t=>t.key===params.title)||title;lastPanel='';paint();}}catch{}finally{libraryPollBusy=false;}}
  function toggle(){if(video.paused)video.play().catch(showError);else video.pause();wake();}
  function jump(seconds){if(duration()>0)video.currentTime=Math.max(0,Math.min(duration(),video.currentTime+seconds));wake();}
  function startScrub(sign,key){
    if(switching||!(duration()>0))return;
    if(!scrub){wasPlaying=!video.paused;scrub=createScrub({position:video.currentTime,duration:duration()});video.pause();context.hidden=true;root.dataset.seeking='true';}
    scrubKey=key;scrub.press(sign,performance.now());overlay=true;paint();
  }
  function cancelScrub(resume=true){if(!scrub)return;scrub.cancel();scrub=null;previewBox.hidden=true;root.dataset.seeking='false';if(resume&&wasPlaying)video.play().catch(()=>{});idleAt=performance.now();paint();}
  function confirmScrub(){if(!scrub)return;const at=scrub.confirm();scrub=null;previewBox.hidden=true;root.dataset.seeking='false';if(at!==null)video.currentTime=at;if(wasPlaying)video.play().catch(()=>{});idleAt=performance.now();paint();}
  function paintPreview(){
    previewBox.hidden=!scrub;if(!scrub)return;const at=scrub.position;const frame=previewFrame(preview,at);const image=previewBox.querySelector('.seek-image');image.hidden=!frame;
    if(frame){image.style.backgroundImage=`url("/media/${item.id}/trickplay/${frame.sheet}.jpg?v=${preview.version||0}")`;image.style.backgroundPosition=`-${frame.x}px -${frame.y}px`;}
    previewBox.querySelector('strong').textContent=fmt(at);previewBox.style.left=`${Math.max(150,Math.min(1450,120+(duration()?at/duration():0)*1680-160))}px`;previewBox.dataset.position=at.toFixed(2);
  }
  function paint(){
    if(disposed||!item)return;layer.classList.toggle('visible',overlay||!!scrub||!!panel);root.classList.toggle('panel-open',!!panel);
    if(lastHeading!==item.id){heading.replaceChildren(el('h1','',item.series||item.title),el('p','',item.series?`${episodeCode(item)} · ${item.title}`:''));lastHeading=item.id;}
    const position=scrub?scrub.position:video.currentTime,total=duration(),share=total?position/total:0;
    bar.firstChild.style.transform=`scaleX(${share})`;cursor.style.transform=`translate3d(${share*1680}px,0,0)`;timeline.classList.toggle('is-active',focus.current.row==='timeline'&&overlay&&!panel);
    timeline.setAttribute('aria-valuenow',String(Math.round(position)));timeline.setAttribute('aria-valuemax',String(total));
    times.firstChild.textContent=fmt(position);times.lastChild.textContent=`−${fmt(total-position)}`;
    const labels={toggle:video.paused?'Riproduci':'Pausa',back10:'−10 secondi',forward10:'+10 secondi',next:'Prossimo',episodes:'Episodi',languages:'Audio e sottotitoli',settings:'Impostazioni'};
    const glyphs={toggle:video.paused?'play':'pause',next:'next',episodes:'episodes',languages:'subtitles',settings:'settings'};
    const signature=JSON.stringify([item.id,video.paused,focus.current,!!panel,!!scrub]);
    if(signature!==lastControls){controls.replaceChildren(...commands().map(id=>button(labels[id],id,false,glyphs[id])));setActive(controls,focus.current.row==='controls'&&!panel&&!scrub?focus.current.item:'');lastControls=signature;}
    paintPreview();if(panel){const ps=JSON.stringify([panel.type,panel.focus.current,quality,prefs(),d.preferenceValue('video-subs'),d.preferenceValue('video-audio')]);if(ps!==lastPanel){paintPanel();lastPanel=ps;}}else lastPanel='';c.reportFocus(panel?panel.focus.current:scrub?{row:'scrub',item:'cursor'}:!overlay&&context.hidden?{row:'video',item:'video'}:!overlay?{row:'context',item:nextVisible?'next':'skip'}:focus.current,root);
  }
  function contextPaint(delta){
    if(switching||scrub||disposed)return;
    const next=nextEpisode(d.items,item),total=duration();
    const action=playbackAction(item,video.currentTime,total,!!next,prefs());skip=action&&!ignored.has(action.kind)?action:null;
    if(skip?.automatic&&!video.paused){ignored.add(skip.kind);if(skip.next&&prefs().autoNext){changeItem(next,true).catch(showError);return;}if(!skip.next){video.currentTime=skip.target;return;}}
    nextVisible=nextPrompt(item,total,video.currentTime,!!next)&&!stay&&prefs().autoNext;
    if(nextVisible&&!video.paused)nextElapsed+=delta;
    if(!nextVisible)nextElapsed=0;
    context.hidden=!!panel||!!scrub||(!nextVisible&&!skip);context.classList.toggle('is-active',!overlay);
    const cs=nextVisible?`next:${next.id}:${Math.floor(nextElapsed/1000)}`:skip?.kind||'';
    if(cs!==lastContext){if(nextVisible){context.replaceChildren(artwork(next),el('div','',el('span','','Prossimo episodio'),el('strong','',`${episodeCode(next)} · ${next.title}`),el('p','',`Tra ${Math.max(0,10-Math.floor(nextElapsed/1000))} secondi · OK per iniziare`)));context.classList.add('next-card');}else if(skip){context.classList.remove('next-card');context.replaceChildren(el('strong','',skip.label),el('span','','Premi OK'));}else context.replaceChildren();lastContext=cs;}
    if(nextVisible&&nextElapsed>=10000){stay=true;changeItem(next,true).catch(showError);}
  }
  function panelRows(){
    if(panel.type==='languages'){
      const audio=(item.streams||[]).filter(s=>s.type==='audio');panel.audio=audio.length?audio:[{language:'und'}];panel.subs=subtitles();
      return [{id:'audio',items:panel.audio.map((s,i)=>`audio:${i}`)},{id:'subs',items:['subs:off',...panel.subs.map((s,i)=>`subs:${i}`)]}];
    }
    if(panel.type==='episodes'){panel.episodes=(title?.episodes||[]).filter(i=>i.season===panelSeason);return [{id:'seasons',items:(title?.seasons||[]).map(s=>`season:${s}`)},{id:'episodes',items:panel.episodes.map(i=>i.id)}];}
    return [{id:'quality',items:['auto','original','480','prepare','autoSkip','autoNext']}];
  }
  function openPanel(type){panel={type,focus:new FocusModel()};panel.focus.setRows(panelRows());if(type==='episodes'){panel.focus.memory.seasons=`season:${panelSeason}`;panel.focus.select('episodes',item.id);}overlay=true;paint();if(type==='settings')refreshPlayingItem();}
  function closePanel(){panel=null;panels.replaceChildren();wake();}
  function paintPanel(){
    if(!panel)return;const {type,focus:pf}=panel;
    if(type==='episodes'&&pf.current.row==='seasons'){const season=Number(pf.current.item.split(':')[1]);if(season!==panelSeason){panelSeason=season;pf.setRows(panelRows());}}
    panels.replaceChildren();const content=el('section',`player-panel ${type}-panel`,el('h2','',type==='languages'?'Audio e sottotitoli':type==='episodes'?'Scegli un episodio':'Impostazioni'));panels.append(content);
    if(type==='languages'){
      const columns=el('div','language-columns');const native=video.audioTracks;
      for(const [col,heading]of [['audio','Audio'],['subs','Sottotitoli']]){
        const node=el('div','language-column',el('h3','',heading));
        const choices=col==='audio'?panel.audio.map((s,i)=>({id:`audio:${i}`,label:languageName(s.language),selected:native?.length?native[i]?.enabled:i===0,disabled:i>0&&!(native?.length>i)})):[{id:'subs:off',label:'Nessuno',selected:Array.from(video.textTracks).every(t=>t.mode!=='showing')},...panel.subs.map((s,i)=>({id:`subs:${i}`,label:languageName(s.language),selected:video.textTracks[i]?.mode==='showing'}))];
        const current=pf.current.row===col?pf.current.c:0;const start=Math.max(0,current-4);
        for(const choice of choices.slice(start,start+7)){const b=button(`${choice.selected?'✓ ':''}${choice.label}`,choice.id);if(choice.disabled){b.classList.add('unavailable');b.append(el('small','','Solo la prima lingua è disponibile'));}node.append(b);}columns.append(node);
      }content.append(columns);setActive(content,pf.current.item);
    }else if(type==='episodes'){
      const seasons=el('div','season-row',...(title.seasons||[]).map(s=>button(s===0?'Speciali':`Stagione ${s}`,`season:${s}`)));content.append(seasons);
      const current=pf.current.row==='episodes'?pf.current.c:Math.max(0,panel.episodes.findIndex(i=>i.id===item.id));const track=el('div','panel-episodes-track');
      for(let i=Math.max(0,current-1);i<Math.min(panel.episodes.length,current+5);i++){const ep=panel.episodes[i];const node=el('div','panel-episode',artwork(ep),el('strong','',`${ep.episode}. ${ep.title}`),el('span','',durationText(ep.duration)));node.dataset.id=ep.id;node.style.transform=`translate3d(${(i-current)*408}px,0,0)`;track.append(node);}content.append(track);setActive(content,pf.current.item);
    }else {
      const options=[['auto','Automatica'],['original','Originale'],['480',`Versione leggera (480p)${item.light?'':' · non ancora pronta'}`],['prepare','Prepara versione leggera'],['autoSkip',`Salta da solo sigle e riassunti sicuri: ${prefs().autoSkip?'sì':'no'}`],['autoNext',`Prossimo episodio automatico: ${prefs().autoNext?'sì':'no'}`]];
      for(const [id,label]of options){content.append(button(`${d.preferenceValue('quality','auto')===id?'✓ ':''}${label}`,id));}setActive(content,pf.current.item);
    }
    content.append(el('p','panel-hint','Indietro per chiudere'));
  }
  async function panelActivate(){
    const f=panel.focus.current;
    if(panel.type==='languages'){
      if(f.row==='audio'){const index=Number(f.item.split(':')[1]);const native=video.audioTracks;if(index>0&&!(native?.length>index)){c.notify('Questo audio non è disponibile sul lettore attuale.');return;}if(native?.length)Array.from(native).forEach((t,i)=>{t.enabled=i===index;});d.setPreference('video-audio',panel.audio[index].language);}
      else {const selected=f.item==='subs:off'?-1:Number(f.item.split(':')[1]);Array.from(video.textTracks).forEach((t,i)=>{t.mode=i===selected?'showing':'disabled';});d.setPreference('video-subs',selected<0?'off':panel.subs[selected].language);}
      paint();
    }else if(panel.type==='episodes'){if(f.row==='seasons'){panel.focus.select('episodes',panel.episodes[0]?.id);paint();}else{const ep=panel.episodes.find(i=>i.id===f.item);closePanel();await changeItem(ep);}}
    else if(f.item==='prepare'){await request('/api/versions',{ids:[item.id]},'POST');c.notify('Versione leggera richiesta');}
    else if(f.item==='autoSkip'||f.item==='autoNext'){await d.preference({[f.item]:!prefs()[f.item]});paint();}
    else{if(f.item==='480'&&!item.light){c.notify('Prepara prima la versione leggera con la voce qui sotto.');return;}const position=video.currentTime;await save();d.setPreference('quality',f.item);closePanel();await loadItem(item,position);}
  }
  function panelKey(key){
    const f=panel.focus;
    if(key==='ok')return panelActivate();
    if(!['left','right','up','down'].includes(key))return;
    if(panel.type==='languages'){
      if(key==='left'||key==='right')f.select(key==='right'?'subs':'audio');else f.move(key==='down'?'right':'left');
    }else if(panel.type==='settings')f.move(key==='down'?'right':key==='up'?'left':key);
    else f.move(key);
    paint();
  }
  function showError(){if(disposed)return;fade.classList.remove('visible');switching=false;c.openModal('La riproduzione si è interrotta',[{id:'retry',label:'Riprova',action:()=>loadItem(item,video.readyState>=1?video.currentTime:requestedPosition)},{id:'back',label:'Torna indietro',action:async()=>{overlay=false;panel=null;await c.back();}}],{subtitle:'Controlla che il computer con questo video sia acceso e collegato.'});}
  video.addEventListener('error',showError);video.addEventListener('pause',()=>{if(!switching&&!disposed){saveQuiet();paint();}});video.addEventListener('play',()=>{idleAt=performance.now();paint();});video.addEventListener('loadeddata',applyLanguages);
  video.addEventListener('ended',()=>{if(disposed||switching)return;const next=nextEpisode(d.items,item);if(next&&prefs().autoNext){changeItem(next,true).catch(showError);}else{save(true).catch(()=>c.notify('Avanzamento non salvato.')).then(()=>{overlay=false;panel=null;return c.back();});}});
  let lastPulse=performance.now();const pulse=setInterval(()=>{
    if(disposed)return;const now=performance.now(),delta=now-lastPulse;lastPulse=now;
    if(scrub){scrub.tick(now);if(scrub.due(now))confirmScrub();}
    if(!panel&&!scrub&&!video.paused&&now-idleAt>=4000)overlay=false;
    if(!video.paused&&!switching&&now-lastSaved>=10000)saveQuiet();
    if(!switching&&now-lastPreviewPoll>=10000)pollPreview();
    if(panel?.type==='settings'&&now-lastLibraryPoll>=5000)refreshPlayingItem();
    contextPaint(delta);paint();
  },50);
  const controller={directKeys:true,root,paint,snapshot:()=>({}),
    async key(key,e={}){
      if(key==='back'){if(!e.repeat)await c.back();return;}
      const seeking=['forward','rewind'].includes(key)||(['left','right'].includes(key)&&!panel&&(!overlay||scrub||focus.current.row==='timeline'));
      if(['up','down','left','right'].includes(key)&&!seeking){const now=performance.now();if(!acceptRepeat(key,now,lastMove,e.repeat))return;lastMove={key,at:now};}
      if(panel)return panelKey(key);
      // 12/11: pausa/riproduci dal telecomando lascia sempre il comando attivo su Riproduci/Pausa (prima restava l'ultimo usato, per esempio +10).
      if(['toggle','play','pause'].includes(key)){if(e.repeat)return;focus.select('controls','toggle');if(key==='play')video.play().catch(showError);else if(key==='pause')video.pause();else toggle();wake();return;}
      if(key==='forward'||key==='rewind'||((key==='left'||key==='right')&&(!overlay||scrub||focus.current.row==='timeline'))){startScrub(key==='left'||key==='rewind'?-1:1,key);return;}
      if(scrub){if(key==='ok'&&!e.repeat)confirmScrub();return;}
      if(key==='ok'){
        if(e.repeat)return;
        if(!overlay&&(nextVisible||skip)){if(nextVisible)await changeItem(nextEpisode(d.items,item),true);else if(skip.next)await changeItem(nextEpisode(d.items,item),true);else{ignored.add(skip.kind);video.currentTime=skip.target;context.hidden=true;}return;}
        if(!overlay){focus.select('controls','toggle');toggle();return;}
        const id=focus.current.item;if(id==='toggle')toggle();else if(id==='back10')jump(-10);else if(id==='forward10')jump(10);else if(id==='next')await changeItem(nextEpisode(d.items,item),true);else if(id==='episodes')openPanel('episodes');else if(id==='languages')openPanel('languages');else if(id==='settings')openPanel('settings');return;
      }
      if(['up','down','left','right'].includes(key)){if(!overlay){resetFocus();wake();return;}if(focus.move(key)==='rail')focus.select('controls','toggle');wake();}
    },
    keyup(key){if(scrub&&key===scrubKey)scrub.release(performance.now());},
    releaseKeys(){if(scrub)scrub.release(performance.now());},
    async back(){const layer=backLayer({panel:!!panel,scrub:!!scrub,overlay});if(layer==='panel'){closePanel();return true;}if(layer==='scrub'){cancelScrub();return true;}if(layer==='overlay'){hide();return true;}if(nextVisible||skip){stay=true;if(skip)ignored.add(skip.kind);context.hidden=true;skip=null;nextVisible=false;return true;}await save().catch(()=>c.notify('Avanzamento non salvato. Controlla la connessione.'));video.pause();return false;},
    dispose(){disposed=true;generation++;clearInterval(pulse);video.pause();video.removeAttribute('src');video.load();}
  };
  if(item)loadItem(item,params.position||0).catch(showError);else showError();return controller;
}
