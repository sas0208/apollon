import { FocusModel } from './focus.js';
import { el,hero,button,card,setActive } from './ui.js';
import { resumePoint,similarTitles,durationText,episodeCode } from '../video-logic.js';
import { request } from './api.js';
import { openOptions } from './options.js';
import { nextEpisode } from './playback.js';

export function title(c,{id},state) {
  const d=c.data;let t=d.titles.find(t=>t.key===id),disposed=false;
  if(!t) { c.mount(el('section','error-screen',el('h1','','Titolo non disponibile'),el('p','','Premi Indietro per tornare alla raccolta.')));return {key(){}}; }
  const point=resumePoint(t,d.items,d.progress);let season=state?.season??point.item.season??1;
  const episodeBySeason={...state?.episodeBySeason}; if(!episodeBySeason[season])episodeBySeason[season]=point.item.id;
  const root=el('section','title-screen');root.append(hero(t,d).node);const rating=el('div','title-rating','☆ ☆ ☆ ☆ ☆');root.append(rating);let shelfTop=644;
  const actions=el('div','title-actions');const shelves=el('div','title-shelves');root.append(actions,shelves);
  const focus=new FocusModel();let episodes=[],similars=[],actionIds=[];
  function rows() {
    t=d.titles.find(i=>i.key===id)||t;
    actionIds=['play',...(t.episodes?['episodes']:[]),'list','more'];episodes=(t.episodes||[]).filter(i=>i.season===season);similars=similarTitles(t,d.titles);
    focus.setRows([{id:'actions',items:actionIds},...(t.episodes?[{id:'seasons',items:t.seasons.map(s=>`season:${s}`)},{id:'episodes',items:episodes.map(i=>i.id)}]:[]),...(similars.length?[{id:'similar',items:similars.map(i=>i.key)}]:[])]);
  }
  rows();focus.restore(state?.focus); if(!state)focus.memory.episodes=point.item.id;
  function cards(entries,activeId,ep=false) {
    const track=el('div','card-track');const idx=Math.max(0,entries.findIndex(i=>(ep?i.id:i.key)===activeId));const offset=Math.min(idx*408,Math.max(0,entries.length*408-1784));track.style.transform=`translate3d(${-offset}px,0,0)`;
    for(let i=Math.max(0,Math.floor(offset/408)-1);i<Math.min(entries.length,Math.ceil(offset/408)+6);i++) {
      const e=entries[i];const entry=ep?{key:e.id,title:`${e.episode}. ${e.title}`,item:e,art:e,genres:[],duration:e.duration,badges:[]}:e;
      const node=card(entry,(ep?e.id:e.key)===activeId,d.progress);node.style.left=`${i*408}px`;
      if(ep){node.classList.add('episode-card');node.querySelector('.card-caption span').textContent=`${episodeCode(e)} · ${durationText(e.duration)}${d.progress[e.id]?.watched?' · Visto':''}`;}
      track.append(node);
    }return track;
  }
  function paint() {
    rows();const f=focus.current;
    if(f.row==='seasons') {const selected=Number(f.item.split(':')[1]);if(selected!==season){episodeBySeason[season]=focus.memory.episodes;season=selected;rows();focus.memory.episodes=episodeBySeason[season]||episodes[0]?.id;}}
    actions.replaceChildren(button(c.playLabel(t),'play',true,'play'),...(t.episodes?[button('Episodi','episodes',false,'episodes')]:[]),button(d.list.some(i=>i.key===t.key)?'Nella mia lista':'La mia lista','list',false,'list'),button('Altro','more',false));
    setActive(actions,f.row==='actions'?f.item:'');shelves.replaceChildren();
    root.classList.toggle('details-deep',f.row!=='actions');
    let shift=0;
    if(t.episodes){
      const seasons=el('div','season-row');for(const s of t.seasons)seasons.append(button(s===0?'Speciali':`Stagione ${s}`,`season:${s}`,false));setActive(seasons,f.row==='seasons'?f.item:'');seasons.querySelector(`[data-id="season:${season}"]`)?.classList.add('chosen');
      shelves.append(seasons);const ep=el('section','title-episodes',el('h2','row-heading',`Stagione ${season} · Episodi`),cards(episodes,f.row==='episodes'?f.item:'',true));shelves.append(ep);
      if(f.row==='seasons'||f.row==='episodes')shift=500-shelfTop;
    }
    if(similars.length){const similar=el('section',`title-similar${t.episodes?' after-episodes':''}`,el('h2','row-heading','Titoli simili'),cards(similars,f.row==='similar'?f.item:''));shelves.append(similar);if(f.row==='similar')shift=620-shelfTop-(t.episodes?532:0);}
    shelves.style.transform=`translate3d(0,${shift}px,0)`;c.reportFocus(f,root);
  }
  async function refreshRating(){const value=await request(`/api/ratings?profile=${encodeURIComponent(d.profile)}&key=${encodeURIComponent(t.key)}`).catch(()=>null);if(disposed||!value)return;rating.textContent=value.count?`★ ${Number(value.average||value.mean||0).toFixed(1)} · ${value.count} voti`:'Nessun voto · Dai il primo da Altro';}
  function layoutIntro(){if(disposed)return;const box=root.getBoundingClientRect(),scale=box.width/1920||1;const bottom=(root.querySelector('.hero-description').getBoundingClientRect().bottom-box.top)/scale+(root.classList.contains('details-deep')?30:0);const ratingTop=Math.max(464,bottom+24),actionsTop=Math.max(520,ratingTop+56);rating.style.top=`${ratingTop}px`;actions.style.top=`${actionsTop}px`;shelfTop=actionsTop+124;shelves.style.top=`${shelfTop}px`;paint();}
  const controller={root,focus,paint,refreshRating,snapshot:()=>({focus:focus.snapshot(),season,episodeBySeason}),
    key(key){if(['left','right','up','down'].includes(key)){if(focus.move(key)==='rail')c.rail.open();else paint();return true;}},
    async activate(){const f=focus.current;if(f.row==='actions'){if(f.item==='play')c.play(t);if(f.item==='episodes'){focus.select('episodes',episodeBySeason[season]||point.item.id);paint();}if(f.item==='list'){await d.listed(t);paint();}if(f.item==='more')openOptions(c,t,true);}else if(f.row==='seasons'){focus.select('episodes',episodeBySeason[season]||episodes[0]?.id);paint();}else if(f.row==='episodes'){const ep=episodes.find(i=>i.id===f.item);if(ep.remoteDown)return c.notify('Il fisso è spento.');c.play(t,ep,d.progress[ep.id]?.position||0);}else if(f.row==='similar')c.navigate('title',{id:f.item});},
    longOK(){const selected=focus.current.row==='similar'?similars.find(i=>i.key===focus.current.item):t;c.options(selected);},
    dispose(){disposed=true;}
  };
  c.mount(root);layoutIntro();root.querySelector('.title-logo')?.addEventListener('load',layoutIntro);root.querySelector('.title-logo')?.addEventListener('error',layoutIntro);document.fonts?.ready.then(layoutIntro);refreshRating();d.primePreviews(point.item.id,nextEpisode(d.items,point.item)?.id);return controller;
}
