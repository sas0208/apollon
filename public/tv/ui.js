import { FocusModel } from './focus.js';
import { metaParts, episodeCode, remainingText, artworkSources, kindLabel } from '../video-logic.js';
export function el(tag, cls = '', ...children) { const node = document.createElement(tag); node.className = cls; for (const child of children.flat()) if (child !== null && child !== undefined) node.append(child.nodeType ? child : document.createTextNode(String(child))); return node; }
export function icon(name) {
  const paths = { search:'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0', home:'M3 11l9-8 9 8v10h-6v-7H9v7H3z', series:'M3 7h18v14H3z M7 3h10', film:'M3 4h18v17H3z M7 4v17 M17 4v17 M3 9h4 M3 16h4 M17 9h4 M17 16h4', anime:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z', new:'M12 3v18 M3 12h18 M5 5l14 14 M19 5L5 19', list:'M5 3h14v19l-7-5-7 5z', music:'M9 18V5l12-2v12 M9 5l12-2 M9 18c0 4-7 4-7 0s7-4 7 0 M21 15c0 4-7 4-7 0s7-4 7 0', profile:'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10 M3 23v-3c0-7 18-7 18 0v3', settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 4 4 1 2 5-2 5-4 1-1 4H9l-1-4-4-1-2-5 2-5 4-1z', play:'M7 3l14 9-14 9z', pause:'M7 3v18 M17 3v18', moon:'M20 13A9 9 0 1 1 10 2a8 8 0 0 0 10 11', back:'M15 4l-8 8 8 8', next:'M4 4l12 8-12 8z M20 4v16', subtitles:'M2 4h20v16H2z M5 12h5 M14 12h5 M5 16h5 M14 16h5', episodes:'M3 4h18v7H3z M3 15h18v7H3z', plus:'M12 3v18 M3 12h18', check:'M3 12l6 6L21 5' };
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true'); const path = document.createElementNS(svg.namespaceURI,'path'); path.setAttribute('d',paths[name] || paths.moon); svg.append(path); return svg;
}
export function button(label, id, primary = false, glyph) { const node=el('div',`tv-button${primary?' primary':''}`,glyph?icon(glyph):null,el('span','',label)); node.dataset.id=id; node.setAttribute('role','button'); node.setAttribute('aria-label',label); return node; }
export function imageUrl(item, kind = 'backdrop', size = 1280) { if (!item?.images?.[kind] && !(kind === 'thumb' && item?.image)) return ''; return `/media/${item.id}/${kind}?s=${size}&v=${encodeURIComponent(item.images?.v||0)}`; }
export function artwork(item,kind='thumb',size=640,title={}) { const sources=artworkSources(title,item,kind,size); const image=el('img');let at=0;image.src=sources[at];image.alt='';image.draggable=false;image.addEventListener('error',()=>{if(at<sources.length-1)image.src=sources[++at];});return image; }
// 13/11: un titolo intero (Titoli simili, Cerca) mostra la copertina larga della serie, mai il fotogramma di un
// episodio con i sottotitoli; il fotogramma resta per gli episodi e per «Continua a guardare».
export function cardArtKind(entry,{poster=false,active=false}={}) {
  const continuing=entry.title?.key&&('position' in entry || entry.next);
  if(poster)return active?(continuing?'thumb':'backdrop'):'poster';
  return !entry.title?.key&&entry.kind?'backdrop':'thumb';
}
export function card(entry, active, progress = {}, {poster=false,rank=0}={}) {
  const title=entry.title?.key?entry.title:entry; const item=entry.item || title.art || title.item;
  const p=progress[item.id] || {}; const node=el('div',`tv-card${active?' is-active':''}${title.remoteDown?' offline':''}${poster?' poster-card':''}${poster&&active?' expanded-card':''}`);
  node.dataset.id=title.key; node.setAttribute('role','button'); node.setAttribute('aria-label',`${rank?rank+'. ':''}${title.title}`);
  const continuing=entry.title?.key&&('position' in entry || entry.next);
  const kind=cardArtKind(entry,{poster,active});
  const art=el('div','card-art',artwork(item,kind,active?960:480,title));
  if(poster){
    // 8/11: le locandine hanno già il titolo disegnato (anche quella generata): il nome sopra solo sulla card
    // allargata, e mai sopra la copertina generata, che lo ha già.
    const name=el('span','card-name',title.title);name.hidden=!active;if(active)art.append(name);
    const shown=art.firstChild;const check=()=>{if(String(shown.currentSrc||shown.src).startsWith('data:'))name.hidden=true;};check();shown.addEventListener('load',check);
    if(active&&title.art?.images?.logo){const logo=el('img','card-logo');logo.src=`/media/${title.art.id}/logo?s=480&v=${encodeURIComponent(title.art.images.lv||title.art.images.v||0)}`;logo.alt=title.title;logo.addEventListener('load',()=>name.hidden=true,{once:true});logo.addEventListener('error',()=>logo.remove(),{once:true});art.append(logo);}
  }
  if(rank){const number=el('span',`rank-number${rank===10?' double':''}`,rank);number.setAttribute('aria-hidden','true');node.append(number);}
  if(title.remoteDown)art.append(el('span','offline-label','Fisso spento'));
  const share=p.watched?1:(p.position||0)/(p.duration||item.duration||1);
  if(share>0){const bar=el('div','card-progress',el('i'));bar.firstChild.style.transform=`scaleX(${Math.min(1,share)})`;art.append(bar);}
  node.append(art,el('div','card-caption',el('strong','',title.title),el('span','',continuing?[episodeCode(item).replace(':',' '),remainingText(entry.position,entry.duration)].filter(Boolean).join(' · '):metaParts(title).join(' · '))));
  return node;
}
// Stessa altezza per poster e 16:9. Solo le posizioni si muovono, mai width/height in transizione.
export function railLayout(count,index,active=true,ranked=false) {
  const height=330,poster=220,wide=height*16/9,space=24,numberWidth=ranked?140:0;
  let x=0;const cards=Array.from({length:count},(_,i)=>{const width=active&&i===index?wide:poster;const card={left:x+numberWidth,width};x+=numberWidth+width+space;return card;});
  const offset=Math.min(cards[index]?.left-numberWidth||0,Math.max(0,x-space-1680));
  const visible=cards.map((c,i)=>({c,i})).filter(({c})=>c.left+c.width>=offset-260&&c.left-numberWidth<=offset+1740).map(({i})=>i);
  return {height,numberWidth,cards,offset,visible};
}
function rowDetails(entry) {
  const t=entry.title?.key?entry.title:entry;const item=entry.item||t.item;
  const meta=[kindLabel(t),...metaParts(t)].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
  const continuing=entry.title?.key&&('position' in entry||entry.next);
  return el('div','row-details',el('h3','',t.title),el('p','row-meta',continuing?[episodeCode(item).replace(':',' '),item.title].filter(Boolean).join(' · '):meta),
    continuing?el('p','row-remaining',remainingText(entry.position,entry.duration)):el('p','row-description',t.description||'La trama non è ancora disponibile.'));
}
export function setActive(root,id) { for(const n of root.querySelectorAll('[data-id]')) { const on=n.dataset.id===id; n.classList.toggle('is-active',on); n.setAttribute('aria-selected',String(on)); } }
export function hero(title,data) {
  const node=el('div','hero'); const art=el('div','hero-art'),second=el('div','hero-art');second.style.opacity='0';const info=el('div','hero-info'); node.append(art,second,el('div','hero-fade'),info);
  let current='',active=art,revision=0;
  function update(t) {
    if(!t || current===t.key) return;const first=!current;current=t.key;
    const mine=++revision,next=first?art:active===art?second:art;
    next.replaceChildren(artwork(t.art,'backdrop',1280,t));next.style.opacity='.82';
    if(!first)active.style.opacity='0';active=next;
    info.replaceChildren(el('div','brand-word',icon('moon'),'Apollon'),el('h1','',t.title),el('p','hero-meta',[kindLabel(t),...metaParts(t)].filter((v,i,a)=>a.indexOf(v)===i).concat(t.badges||[]).join(' · ')),el('p','hero-description',t.description||'La tua prossima storia comincia qui.'));
    if(t.art?.images?.logo) { const logo=el('img','title-logo'); logo.src=`/media/${t.art.id}/logo?s=640&v=${encodeURIComponent(t.art.images.lv||t.art.images.v||0)}`;logo.alt=t.title;logo.addEventListener('error',()=>logo.replaceWith(el('h1','',t.title)),{once:true});info.querySelector('h1').replaceWith(logo); }
  }
  update(title); return {node,update};
}

// Solo la riga attiva e la vicina, solo le card vicine: nessuno scroll nativo.
export function catalogView(c,{rows,featured,state,grid=false,heading='',actions=true,categories=[],page='home'}) {
  const root=el('section',`catalog-screen${grid?' grid-screen':''}`); const visual=hero(featured,c.data); root.append(visual.node);
  if(heading) root.append(el('h2','section-heading',heading));
  const controls=el('div','hero-actions');
  if(actions && featured) controls.append(button(c.playLabel(featured),'play',true,'play'),button('Altre info','info',false));
  root.append(controls);const pills=el('div','category-pills');const pillTrack=el('div','category-track');pills.append(pillTrack);
  for(const g of categories)pillTrack.append(button(g.name,g.id));root.append(pills);
  const viewport=el('div','rows-viewport'); root.append(viewport);
  if(!rows.length)root.append(el('div','catalog-empty',el('h2','',heading==='La mia lista'?'La tua lista è ancora vuota':heading?`Non ci sono titoli in ${heading}`:'La tua raccolta è ancora vuota'),el('p','',heading==='La mia lista'?'Apri un titolo e scegli La mia lista per ritrovarlo qui.':'Aggiungi film e serie da Apollon sul computer.')));
  const focus=new FocusModel([...(actions&&featured?[{id:'hero',items:['play','info']}]:[]),...(categories.length?[{id:'categories',items:categories.map(g=>g.id)}]:[]),...rows.map(r=>({id:r.id,items:r.entries.map(e=>(e.title?.key?e.title:e).key)}))]); focus.restore(state);
  let timer, disposed=false;
  // 8/11 (richiesta: «mezzo secondo per spostarsi»): le card già costruite si riusano, così la TV non ricrea e non ridecodifica
  // le immagini a ogni tasto; cambia solo la posizione. Chiave = riga, posizione, stato allargato.
  const cards=new Map();
  function selected() { const row=rows.find(r=>r.id===focus.current.row); const entry=row?.entries.find(e=>(e.title?.key?e.title:e).key===focus.current.item); return entry?.title?.key?entry.title:entry||featured; }
  function paint() {
    const current=focus.current, activeRow=rows.findIndex(r=>r.id===current.row); const at=Math.max(0,activeRow);setActive(pills,current.row==='categories'?current.item:'');if(current.row==='categories'||!pillTrack.dataset.placed){const pill=pillTrack.children[current.row==='categories'?current.c:0];const pillOffset=pill?Math.min(pill.offsetLeft,Math.max(0,pillTrack.scrollWidth-1680)):0;pillTrack.style.transform=`translate3d(${-pillOffset}px,0,0)`;pillTrack.dataset.placed='1';}
    setActive(controls,current.row==='hero'?current.item:''); root.classList.toggle('on-rows',activeRow>=0);root.classList.toggle('on-categories',current.row==='categories');
    viewport.replaceChildren();
    for(let r=at;r<Math.min(rows.length,at+2);r++) {
      const row=rows[r], remembered=focus.memory[row.id], idx=Math.max(0,row.entries.findIndex(e=>(e.title?.key?e.title:e).key===remembered));
      const isActive=r===activeRow;const ranked=row.shape==='ranking';
      const section=el('section',`tv-row${isActive?' active-row':''}${ranked?' ranking-row':''}`);section.dataset.row=row.id;section.style.transform=`translate3d(0,${(r-at)*640}px,0)`;
      section.append(el('h2','row-heading',row.title));const track=el('div','card-track');
      const layout=railLayout(row.entries.length,idx,isActive,ranked);track.style.transform=`translate3d(${-layout.offset}px,0,0)`;
      for(const j of layout.visible){const geometry=layout.cards[j];const wide=isActive&&j===idx,cardKey=`${row.id}|${j}|${wide?1:0}`;let node=cards.get(cardKey);if(!node){if(cards.size>600)cards.clear();node=card(row.entries[j],wide,c.data.progress,{poster:true,rank:ranked?j+1:0});cards.set(cardKey,node);}node.style.left=`${geometry.left}px`;node.style.width=`${geometry.width}px`;track.append(node);}
      if(isActive)section.append(rowDetails(row.entries[idx]));
      section.append(track); viewport.append(section);
    }
    if(current.row==='hero')visual.update(featured);
    c.reportFocus(current,root); return current;
  }
  paint(); c.mount(root);
  return {root,focus,snapshot:()=>focus.snapshot(),selected,paint,
    key(key) { if(['left','right','up','down'].includes(key)) { if((key==='left'&&!focus.rows.length)||focus.move(key)==='rail')c.rail.open(); else paint(); return true; } return false; },
    activate() { if(focus.current.row==='categories')return c.navigate('browse',{page,category:focus.current.item});const t=selected(); if(!t)return; if(t.remoteDown)return c.notify('Il fisso è spento. Riprova quando è acceso.'); if(focus.current.row==='hero'&&focus.current.item==='play')return c.play(t); return c.navigate('title',{id:t.key}); },
    longOK() { if(!['hero','categories'].includes(focus.current.row))c.options(selected()); },
    dispose(){disposed=true;clearTimeout(timer);}
  };
}
