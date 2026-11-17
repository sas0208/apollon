import { FocusModel } from './focus.js';
import { el,button,icon,setActive } from './ui.js';
import { createKeyboard } from './keyboard.js';
import { request } from './api.js';
export function profiles(c,params,state){
 const d=c.data,root=el('section','profiles-screen');let mode='profiles',editor=null,choices=[],loading=false,disposed=false,editingId=d.profile;
 const focus=new FocusModel();
 function avatar(person){if(person.avatar){const image=el('img');image.src=person.avatar;image.alt='';return image;}return el('div','avatar-initial',icon('moon'),el('strong','',person.name.slice(0,1).toLocaleUpperCase('it')));}
 function rows(){focus.setRows([{id:'profiles',items:d.profiles.map(p=>p.id)},{id:'actions',items:['add',...(d.profile?['avatar','rename']:[])]}]);}
 rows();focus.restore(state);if(d.profile)focus.select('profiles',d.profile);
 function paint(){
   if(disposed)return;root.replaceChildren();
   if(mode==='editor'){
     const field=el('div','profile-name',editor.value||'Il tuo nome');root.append(el('h1','',editingId?'Cambia nome':'Come ti chiami?'),field,editor.root);editor.paint();return;
   }
   if(mode==='avatars'){
     root.append(el('h1','','Scegli la tua immagine'),el('p','profiles-note',loading?'Carico le immagini…':'Un volto per le tue storie'));
     const pf=avatarFocus.current;const grid=el('div','avatar-grid');const start=Math.max(0,pf.r-1);
     for(let r=start;r<Math.min(avatarFocus.rows.length,start+3);r++)for(let col=0;col<avatarFocus.rows[r].items.length;col++){
       const id=avatarFocus.rows[r].items[col],choice=choices.find(v=>v.id===id);const person={name:d.person?.name||'A',avatar:choice?.url};const n=el('div','avatar-choice',avatar(person),el('span','',choice?.name||'Iniziale'));n.dataset.id=id;n.style.transform=`translate3d(${col*280}px,${(r-start)*260}px,0)`;grid.append(n);
     }
     root.append(grid);if(!loading&&choices.length===1)root.append(el('p','avatar-empty','Non ci sono altre immagini disponibili.'));setActive(grid,pf.item);c.reportFocus(pf,root);return;
   }
   rows();root.append(el('h1','','Chi guarda?'),el('p','profiles-note','Le tue storie, al punto in cui le hai lasciate'));
   const f=focus.current,idx=f.row==='profiles'?f.c:Math.max(0,d.profiles.findIndex(p=>p.id===d.profile));const row=el('div','profiles-row');row.style.left=`${Math.max(240,(1920-Math.min(5,d.profiles.length)*280+64)/2)}px`;const offset=Math.max(0,idx-2);
   for(let i=Math.max(0,offset-1);i<Math.min(d.profiles.length,offset+6);i++){const p=d.profiles[i];const n=el('div','profile-card',avatar(p),el('strong','',p.name));n.dataset.id=p.id;n.setAttribute('role','button');n.setAttribute('aria-label',p.name);n.style.transform=`translate3d(${(i-offset)*280}px,0,0)`;row.append(n);}
   const actions=el('div','profile-actions',button('Aggiungi profilo','add',false,'plus'),...(d.profile?[button('Cambia avatar','avatar'),button('Cambia nome','rename')]:[]));root.append(row,actions);setActive(root,f.item);c.reportFocus(f,root);
   if(!d.profiles.length)root.append(el('p','profiles-empty','Crea il primo profilo per iniziare.'));
 }
 function edit(id){mode='editor';editingId=id;const person=d.profiles.find(p=>p.id===id);editor=createKeyboard(c,{value:person?.name||'',maxLength:35,onLeft:()=>{},onChange:paint,onDone:async value=>{
   const name=value.trim();if(!name){c.notify('Scrivi un nome prima di continuare.');return;}
   if(id){const updated=await request('/api/profiles/name',{id,name});Object.assign(person,updated);mode='profiles';paint();c.rail.render();}
   else{const person=await request('/api/profiles',{name},'POST');d.profiles.push(person);await select(person.id);}
 }});paint();}
 async function select(id){await d.selectProfile(id);c.applyPreferences();await c.navigate('home',{},true);d.primePreviews();}
 const avatarFocus=new FocusModel();
 function openAvatars(){mode='avatars';loading=true;choices=[{id:'initial',name:'Iniziale',url:null}];avatarFocus.setRows([{id:'avatars:0',items:['initial']}]);paint();request('/api/avatar-choices').then(values=>{
   if(disposed||mode!=='avatars')return;choices.push(...values.map((v,i)=>({...v,id:`avatar:${i}`})));const rows=[];for(let i=0;i<choices.length;i+=5)rows.push({id:`avatars:${i/5}`,items:choices.slice(i,i+5).map(v=>v.id)});avatarFocus.setRows(rows);loading=false;paint();
 }).catch(()=>{loading=false;if(mode==='avatars')paint();});}
 paint();c.mount(root);return {root,paint,snapshot:()=>focus.snapshot(),
 key(key){if(mode==='editor'){editor.key(key);return;}if(mode==='avatars'){avatarFocus.move(key);paint();return;}focus.move(key);paint();},
 async activate(){if(mode==='editor')return editor.activate();if(mode==='avatars'){const choice=choices.find(v=>v.id===avatarFocus.current.item);const updated=await request('/api/profiles/avatar',{id:d.profile,avatar:choice.url});Object.assign(d.person,updated);mode='profiles';paint();c.rail.render();return;}
   const f=focus.current;if(f.row==='profiles')await select(f.item);else if(f.item==='add')edit(null);else if(f.item==='rename')edit(d.profile);else openAvatars();
 },
 longOK(){if(mode==='profiles'&&focus.current.row==='profiles'){const id=focus.current.item;c.openModal(d.profiles.find(p=>p.id===id).name,[{id:'select',label:'Guarda con questo profilo',action:()=>select(id)},{id:'rename',label:'Cambia nome',action:()=>edit(id)}]);}},
 back(){if(mode!=='profiles'){mode='profiles';paint();return true;}if(!d.profile){c.exitPrompt();return true;}return false;},dispose(){disposed=true;}
 };
}
