import { FocusModel } from './focus.js';
import { el,button,setActive } from './ui.js';
export function keyboardRows(){const chars=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];const rows=[];for(let i=0;i<chars.length;i+=6)rows.push({id:`keys:${i/6}`,items:chars.slice(i,i+6).map(ch=>`key:${ch}`)});rows.push({id:'editing',items:['space','delete','clear','done']});return rows;}
export function editText(value,id,maxLength=80){if(id==='delete')return [...value].slice(0,-1).join('');if(id==='clear')return '';if(id==='done')return value;return [...value+(id==='space'?' ':id.slice(4).toLocaleLowerCase('it'))].slice(0,maxLength).join('');}
export function createKeyboard(c,{value='',onChange,onDone,onRight,onLeft,maxLength=80,state}={}){
 const root=el('div','tv-keyboard');const rows=keyboardRows(),focus=new FocusModel(rows);focus.restore(state);let text=value,active=true;
 const labels={space:'Spazio',delete:'Cancella',clear:'Svuota',done:'Fine'};
 for(const row of rows){const node=el('div',`keyboard-row${row.id==='editing'?' editing-row':''}`);for(const id of row.items)node.append(button(labels[id]||id.slice(4),id));root.append(node);}
 function paint(){setActive(root,active?focus.current.item:'');if(active)c.reportFocus(focus.current,root);}
 const api={root,focus,get value(){return text;},snapshot:()=>focus.snapshot(),setActive(on){active=on;paint();},paint,
  key(key){if(key==='right'&&focus.current.c===rows[focus.current.r].items.length-1&&onRight){onRight();return;}if(['left','right','up','down'].includes(key)){if(focus.move(key)==='rail'){if(onLeft)onLeft();else if(c.data.profile)c.rail?.open();}paint();}},
  activate(){const id=focus.current.item;if(id==='done'){return onDone?.(text);}text=editText(text,id,maxLength);onChange?.(text);paint();}
 };paint();return api;
}
