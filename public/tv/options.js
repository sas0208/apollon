import { request } from './api.js';
import { continueEntries, resumePoint } from '../video-logic.js';
export function openOptions(c,title,more=false) {
  if(!title)return;
  const d=c.data,latest=()=>d.titles.find(t=>t.key===title.key)||title;
  const update=async fn=>{await fn();await d.refresh();await c.refreshScreen();};
  const listAction=()=>update(async()=>{const on=await d.listed(latest());c.notify(on?'Aggiunto alla tua lista':'Tolto dalla tua lista');});
  const watchedAction=()=>update(async()=>{const on=!latest().watched;await d.watched(latest(),on);c.notify(on?'Segnato come visto':'Tolto dai visti');});
  const light=async()=>{await request('/api/versions',{ids:(title.episodes||[title.item]).map(i=>i.id)},'POST');c.notify('Versione leggera richiesta. Sarà pronta appena possibile.');};
  const choices=more?[
    {id:'watched',label:title.watched?'Segna non visto':'Segna visto',action:watchedAction},
    {id:'restart',label:'Ricomincia dall’inizio',action:()=>c.play(title,(title.episodes||[title.item])[0],0)},
    {id:'light',label:'Prepara versione leggera (480p)',action:light},
    {id:'rating',label:'Dai un voto',action:()=>c.openModal('Il tuo voto',[1,2,3,4,5].map(n=>({id:`vote-${n}`,label:'★'.repeat(n)+'☆'.repeat(5-n),action:async()=>{await request('/api/ratings',{profile:d.profile,key:title.key,value:n});await d.refreshRatings();c.notify('Voto salvato');c.screen?.refreshRating?.();}})))}
  ]:[
    {id:'open',label:'Apri',action:()=>c.navigate('title',{id:title.key})},
    {id:'play',label:c.playLabel(title),action:()=>c.play(title)},
    {id:'list',label:d.list.some(i=>i.key===title.key)?'Togli dalla mia lista':'La mia lista',action:listAction},
    {id:'watched',label:title.watched?'Segna non visto':'Segna visto',action:watchedAction},
    {id:'hide',label:'Nascondi da Continua a guardare',action:()=>update(async()=>{const entry=continueEntries(d.titles,d.items,d.progress).find(e=>e.title.key===title.key);const item=entry?.hideId||resumePoint(title,d.items,d.progress).item.id;await d.saveProgress(item,{hidden:true});c.notify('Nascosto da Continua a guardare');})}
  ];
  c.openModal(title.title,choices);
}
