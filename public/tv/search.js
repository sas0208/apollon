import { FocusModel } from './focus.js';
import { el,card,icon } from './ui.js';
import { searchTitles } from '../video-logic.js';
import { createKeyboard } from './keyboard.js';
export function search(c,params,state){
 const root=el('section','search-screen',el('h1','','Cerca la tua prossima storia'));const query=el('div','search-query',icon('search'),el('span'));const resultsHost=el('div','search-results');const summary=el('h2','search-summary');root.append(query,summary,resultsHost);
 let text=state?.query||'',zone=state?.zone||'keyboard',results=[];const focus=new FocusModel();
 function setRows(){results=text.trim()?searchTitles(c.data.titles,text):c.data.titles;const columns=zone==='results'?4:2;const rows=[];for(let i=0;i<results.length;i+=columns)rows.push({id:`results:${i/columns}`,items:results.slice(i,i+columns).map(t=>t.key)});focus.setRows(rows);}
 function enterResults(){if(!results.length)return;zone='results';const id=focus.current.item;setRows();const row=focus.rows.find(r=>r.items.includes(id));if(row)focus.select(row.id,id);paint();}
 const keyboard=createKeyboard(c,{value:text,state:state?.keyboard,onChange:value=>{text=value;setRows();paint();},onDone:enterResults,onRight:enterResults});root.append(keyboard.root);setRows();focus.restore(state?.results);
 function paint(){
   keyboard.setActive(zone==='keyboard');root.classList.toggle('in-results',zone==='results');query.lastChild.textContent=text||'Titoli, generi, episodi';query.classList.toggle('empty',!text);summary.textContent=text.trim()?`${results.length} ${results.length===1?'risultato':'risultati'}`:'Da scoprire';
   resultsHost.replaceChildren();const current=focus.current,cols=zone==='results'?4:2,start=zone==='results'?current.r:0;
   if(!results.length)resultsHost.append(el('p','empty-message','Nessun titolo trovato. Prova con un’altra parola.'));
   for(let r=start;r<Math.min(focus.rows.length,start+2);r++)for(let col=0;col<focus.rows[r].items.length;col++){const key=focus.rows[r].items[col],t=results.find(t=>t.key===key),node=card(t,zone==='results'&&key===current.item,c.data.progress);node.style.left=`${col*408}px`;node.style.top=`${(r-start)*360+12}px`;resultsHost.append(node);}
   if(zone==='results')c.reportFocus(current,root);
 }
 paint();c.mount(root);return {root,paint,snapshot:()=>({query:text,zone,keyboard:keyboard.snapshot(),results:focus.snapshot()}),
 key(key){if(zone==='keyboard'){keyboard.key(key);return;}if(key==='left'&&focus.current.c===0){zone='keyboard';setRows();paint();return;}focus.move(key);paint();},
 activate(){if(zone==='keyboard')return keyboard.activate();const t=results.find(t=>t.key===focus.current.item);if(t?.remoteDown)return c.notify('Il fisso è spento. Accendilo per aprire questo titolo.');if(t)c.navigate('title',{id:t.key});},
 longOK(){if(zone==='results')c.options(results.find(t=>t.key===focus.current.item));},
 back(){if(zone==='results'){zone='keyboard';setRows();paint();return true;}return false;}
 };
}
