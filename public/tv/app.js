import { TVData } from './api.js';
import { Router } from './router.js';
import { FocusModel, acceptRepeat } from './focus.js';
import { el, button, setActive } from './ui.js';
import { home } from './home.js';
import { browse } from './browse.js';
import { resumePoint, playLabel } from '../video-logic.js';
import { createRail } from './rail.js';
import { title } from './title.js';
import { openOptions } from './options.js';
import { player } from './player.js';
import { search } from './search.js';
import { profiles } from './profiles.js';
import { settings } from './settings.js';

const data=new TVData(),router=new Router(),host=document.getElementById('screen'),modalHost=document.getElementById('modal-root');
let toastTimer,modal=null,heldOK=false,longOK=false,okTimer,last=null,busy=false;
const factories={home,browse,title,player,search,profiles,settings};
const sectionStates=new Map();
const stateKey=entry=>`${entry.owner||''}|${entry.name}|${entry.params.page||''}|${entry.params.category||''}`;
const c={data,router,screen:null,section:'home',
  mount(node){node.classList.add('screen-enter');host.replaceChildren(node);host.dataset.ready='true';host.dataset.screen=router.current?.name||'home';},
  reportFocus(f,root){host.dataset.focus=f.item;host.dataset.row=f.row;root?.setAttribute('data-focus',f.item);},
  notify(message){const n=document.getElementById('toast');n.textContent=message;n.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('visible'),3500);},
  async refreshScreen(){router.current.state=c.screen?.snapshot?.();await render();},
  applyPreferences(){document.getElementById('tv-stage').classList.toggle('reduce-motion',data.preferenceValue('tv-motion',false));},
  playLabel:t=>playLabel(t,resumePoint(t,data.items,data.progress)),
  async navigate(name,params={},replace=false){
    if(!factories[name])return c.notify('Non riesco ad aprire questa schermata. Torna alla home e riprova.');
    c.closeModal();c.rail?.close();
    let entry;
    if(replace){if(router.current)router.current.state=c.screen?.snapshot?.();for(const old of router.stack)sectionStates.set(stateKey(old),old.state);entry=router.replace(name,params);entry.owner=data.profile;entry.state=sectionStates.get(stateKey(entry))||null;}
    else {entry=router.push(name,params,c.screen?.snapshot?.());entry.owner=data.profile;}
    await render();
  },
  async back(){if(modal){c.closeModal();return;}if(c.rail.expanded){c.rail.key('back');return;}if(c.screen?.back){if(await c.screen.back())return;}if(router.stack.length>1){await data.refresh().catch(()=>c.notify('La connessione è interrotta. Riprova tra poco.'));router.back();await render();}else if(router.current?.name!=='home')await c.navigate('home',{},true);else c.rail.open();},
  async play(t,item,position){const point=resumePoint(t,data.items,data.progress),target=item||point.item;if(t.remoteDown||target?.remoteDown)return c.notify('Il fisso è spento. Riprova quando è acceso.');if(router.current?.name!=='title'||router.current.params.id!==t.key)await c.navigate('title',{id:t.key});return c.navigate('player',{title:t.key,id:target.id,position:position??(item?0:point.position)});},
  options(t){openOptions(c,t);},
  openModal(title,choices,{initial,subtitle=''}={}){
    c.closeModal();const root=el('div','modal-shade',el('section','tv-modal',el('h2','',title),subtitle?el('p','',subtitle):null)); const list=el('div','modal-choices');root.firstChild.append(list);
    for(const o of choices)list.append(button(o.label,o.id,!!o.primary));
    const focus=new FocusModel([{id:'modal',items:choices.map(o=>o.id)}]);if(initial)focus.select('modal',initial);
    const paint=()=>{setActive(list,focus.current.item);c.reportFocus(focus.current,root);};
    modal={key(key){if(key==='back'){c.closeModal();return;}if(['up','down','left','right'].includes(key)){const delta=key==='up'||key==='left'?-1:1;focus.select('modal',choices[Math.max(0,Math.min(choices.length-1,focus.current.c+delta))].id);paint();}},activate(){const choice=choices.find(o=>o.id===focus.current.item);c.closeModal();return choice.action?.();}};
    modalHost.append(root);paint();
  },
  closeModal(){modal=null;modalHost.replaceChildren();c.screen?.paint?.();},
  exitPrompt(){c.openModal('Uscire da Apollon?',[{id:'stay',label:'Resta',action:()=>c.rail.close()},{id:'exit',label:'Esci',action:()=>{try{globalThis.tizen.application.getCurrentApplication().exit();}catch{c.rail.close();c.notify('Puoi chiudere questa finestra.');}}}],{initial:'stay'});},
  async action(fn){if(busy)return;busy=true;try{await fn?.();}catch(e){c.notify(/fetch|network|load|timeout/i.test(e.message)?'La connessione è interrotta. Riprova tra poco.':e.message);}finally{busy=false;}}
};
async function render(){c.screen?.dispose?.();const section=router.stack.find(e=>['home','browse','search','profiles','settings'].includes(e.name))||router.current;c.section=section.name==='browse'?section.params.page:section.name==='profiles'?'profile':section.name;c.rail.render();c.screen=factories[router.current.name](c,router.current.params,router.current.state);}
c.rail=createRail(c);
const keys={37:'left',38:'up',39:'right',40:'down',13:'ok',10009:'back',27:'back',8:'back',10252:'toggle',415:'play',19:'pause',417:'forward',412:'rewind'};
const named={ArrowLeft:'left',ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',Enter:'ok',Escape:'back',Backspace:'back',MediaPlayPause:'toggle',MediaPlay:'play',MediaPause:'pause',MediaFastForward:'forward',MediaRewind:'rewind'};
document.addEventListener('keydown',e=>{
  const key=keys[e.keyCode]||named[e.key];if(!key){if(e.key==='Tab')e.preventDefault();return;}e.preventDefault();
  if(c.screen?.directKeys&&!modal&&!c.rail.expanded){c.action(()=>c.screen.key(key,e));return;}
  if(key==='ok'){if(!heldOK){heldOK=true;longOK=false;okTimer=setTimeout(()=>{longOK=true;if(!modal&&!c.rail.expanded)c.screen?.longOK?.();},650);}return;}
  if(key==='back'){if(!e.repeat)c.action(()=>c.back());return;}
  const now=performance.now();if(!acceptRepeat(key,now,last,e.repeat))return;last={key,at:now};
  if(modal)modal.key(key);else if(c.rail.expanded)c.rail.key(key);else c.action(()=>c.screen?.key?.(key,e));
});
document.addEventListener('keyup',e=>{const key=keys[e.keyCode]||named[e.key];if(!key)return;e.preventDefault();if(c.screen?.directKeys&&!modal&&!c.rail.expanded){c.screen.keyup?.(key,e);return;}if(key==='ok'){clearTimeout(okTimer);const activate=heldOK&&!longOK;heldOK=false;if(activate)c.action(()=>modal?modal.activate():c.rail.expanded?c.rail.activate():c.screen?.activate?.());}last=null;});
window.addEventListener('blur',()=>{heldOK=false;clearTimeout(okTimer);last=null;c.screen?.releaseKeys?.();});
function resize(){const scale=Math.min(innerWidth/1920,innerHeight/1080);document.getElementById('tv-stage').style.transform=`scale(${scale})`;}
window.addEventListener('resize',resize);resize();
try{const input=globalThis.tizen?.tvinputdevice;for(const name of ['MediaPlayPause','MediaPlay','MediaPause','MediaFastForward','MediaRewind'])try{input?.registerKey(name);}catch{}}catch{}
async function start(){try{await data.load();c.applyPreferences();router.replace(data.profile?'home':'profiles').owner=data.profile;await render();if(data.profile)data.primePreviews();}catch{c.mount(el('section','error-screen',el('h1','','La raccolta non è raggiungibile'),el('p','','Controlla che Apollon sia accesa e premi OK per riprovare.'),button('Riprova','retry',true)));c.screen={activate:start,key(){}};}}
start();
