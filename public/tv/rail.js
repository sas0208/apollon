import { FocusModel } from './focus.js';
import { el,icon,setActive } from './ui.js';
export function createRail(c) {
  const node=document.getElementById('rail'); const entries=[['search','Cerca'],['home','Home'],['anime','Anime'],['film','Film'],['series','Serie TV'],['new','Novità'],['list','La mia lista'],['music','Musica'],['profile','Profilo'],['settings','Impostazioni']];
  const focus=new FocusModel([{id:'rail',items:entries.map(e=>e[0])}]); let expanded=false;
  function render() {
    node.replaceChildren(el('div','rail-brand',icon('moon'),el('span','','Apollon')));
    for(const [id,label]of entries) { let image=icon(id);if(id==='profile'&&c.data.person?.avatar){image=el('img','rail-avatar');image.src=c.data.person.avatar;image.alt='';}const entry=el('div',`rail-item rail-${id}`,image,el('span','',id==='profile'?c.data.person?.name||label:label));entry.dataset.id=id;entry.setAttribute('role','button');entry.setAttribute('aria-label',label); if(id===c.section)entry.classList.add('current');node.append(entry); }
    setActive(node,expanded?focus.current.item:'');node.classList.toggle('expanded',expanded);document.getElementById('rail-shade').classList.toggle('visible',expanded);
  }
  const api={get expanded(){return expanded;},render,
    open(){ expanded=true;focus.select('rail',c.section||'home');render();c.reportFocus(focus.current,node); },
    close(){expanded=false;render();c.screen?.paint?.();},
    key(key){if(key==='right'){api.close();return;}if(key==='back'){if(c.router.current?.name==='home')c.exitPrompt();else api.close();return;}if(key==='up'||key==='down'){const n=focus.current.c+(key==='down'?1:-1);focus.select('rail',entries[Math.max(0,Math.min(entries.length-1,n))][0]);render();c.reportFocus(focus.current,node);}},
    activate(){const id=focus.current.item;api.close();if(id==='music'){location.href='/?tv=0#music';return;}if(id==='home')c.navigate('home',{},true);else if(['film','series','anime','new','list'].includes(id))c.navigate('browse',{page:id},true);else c.navigate(id==='profile'?'profiles':id,{},true);}
  };render();return api;
}
