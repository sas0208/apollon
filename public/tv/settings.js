import { FocusModel } from './focus.js';
import { el,button,setActive } from './ui.js';
export function settings(c,params,state){
 const d=c.data,root=el('section','settings-screen',el('h1','','Impostazioni'));
 const categories=[['quality','Qualità del video'],['autoSkip','Salti automatici'],['autoNext','Prossimo episodio'],['audio','Lingua audio'],['subs','Sottotitoli'],['motion','Movimento ridotto'],['pc','Versione PC'],['info','Informazioni']];
 const focus=new FocusModel([{id:'categories',items:categories.map(v=>v[0])}]);focus.restore(state);let category=state?.category||'quality';
 const descriptions={quality:'Scegli come guardare i video. La versione leggera usa meno dati quando è pronta.',autoSkip:'Salta sigle, riassunti e anteprime quando i tempi sono disponibili.',autoNext:'Inizia il prossimo episodio dopo il conto alla rovescia.',audio:'La lingua preferita viene scelta quando è disponibile nel video.',subs:'Sottotitoli leggibili da lontano, nella lingua che preferisci.',motion:'Riduci i movimenti delle schermate e delle card.',pc:'Apri l’interfaccia completa di Apollon.',info:'Tutte le tue storie, nella rete di casa.'};
 const languages=[['ita','Italiano'],['jpn','Giapponese'],['eng','Inglese'],['fra','Francese'],['deu','Tedesco'],['spa','Spagnolo']];
 function values(){if(category==='quality')return [['auto','Automatica'],['original','Originale'],['480','Versione leggera (480p)']];if(['autoSkip','autoNext','motion'].includes(category))return [['on','Attivato'],['off','Disattivato']];if(category==='audio')return languages;if(category==='subs')return [['off','Nessuno'],...languages];if(category==='pc')return [['open','Apri versione PC']];return [['about','Apollon TV']];}
 function chosen(){if(category==='quality')return d.preferenceValue('quality','auto');if(category==='autoSkip')return d.person?.autoSkip===true?'on':'off';if(category==='autoNext')return d.person?.autoNext!==false?'on':'off';if(category==='motion')return d.preferenceValue('tv-motion',false)?'on':'off';if(category==='audio')return d.preferenceValue('video-audio','ita');if(category==='subs')return d.preferenceValue('video-subs','off');return category==='pc'?'open':'about';}
 function paint(){
   if(focus.current.row==='categories')category=focus.current.item;
   const options=values();focus.setRows([{id:'categories',items:categories.map(v=>v[0])},{id:'values',items:options.map(v=>v[0])}]);
   root.querySelector('.settings-menu')?.remove();root.querySelector('.settings-detail')?.remove();
   const menu=el('div','settings-menu',...categories.map(([id,label])=>button(label,id)));setActive(menu,focus.current.row==='categories'?category:'');menu.querySelector(`[data-id="${category}"]`)?.classList.add('chosen');
   const detail=el('div','settings-detail',el('h2','',categories.find(v=>v[0]===category)[1]),el('p','',descriptions[category]));
   for(const [id,label]of options){const b=button(`${id===chosen()?'✓ ':''}${label}`,id);detail.append(b);}setActive(detail,focus.current.row==='values'?focus.current.item:'');
   if(category==='info')detail.append(el('p','settings-about','Apollon TV · Per il tuo televisore\nCatalogo, profili e avanzamenti condivisi con Apollon.'));
   root.append(menu,detail);c.reportFocus(focus.current,root);
 }
 function enter(){focus.select('values',chosen());paint();}
 paint();c.mount(root);return {root,paint,snapshot:()=>({...focus.snapshot(),category}),
 key(key){if(key==='right'&&focus.current.row==='categories'){enter();return;}if(key==='left'){if(focus.current.row==='values'){focus.select('categories',category);paint();}else c.rail.open();return;}if(key==='up'||key==='down'){focus.move(key==='up'?'left':'right');paint();}},
 async activate(){if(focus.current.row==='categories'){enter();return;}const value=focus.current.item;
   if(category==='quality')d.setPreference('quality',value);if(category==='autoSkip'||category==='autoNext')await d.preference({[category]:value==='on'});if(category==='audio')d.setPreference('video-audio',value);if(category==='subs')d.setPreference('video-subs',value);if(category==='motion'){d.setPreference('tv-motion',value==='on');c.applyPreferences();}if(category==='pc'){location.href='/?tv=0&apollonIntro=done';return;}paint();
 },back(){if(focus.current.row==='values'){focus.select('categories',category);paint();return true;}return false;}
 };
}
