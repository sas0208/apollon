import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTitles,buildRows} from '../public/video-logic.js';
const DAY=86400000,now=100*DAY;
const episode=(id,series,added,episode=1)=>({id,series,root:'Anime',title:`Episodio ${episode}`,season:1,episode,added,genres:['Action','Fantasy'],onlineScore:8});
const key=e=>(e.title?.key?e.title:e).key;
test('Giro 2 punto 7: DBS con episodi appena arrivati non apre tutte le righe della Home',()=>{
 const items=[episode('d1','Stellar Sentinels',10*DAY),episode('d2','Stellar Sentinels',now,2),
   ...Array.from({length:3},(_,i)=>episode(`new${i}`,`Storia ${i}`,now,2)),
   ...Array.from({length:18},(_,i)=>({...episode(`a${i}`,`Storia ${i}`,(20+i)*DAY),onlineScore:9-i/10}))];
 const progress={d1:{watched:true,updated:now-200},d2:{position:60,duration:1200,updated:now-100}};
 const titles=buildTitles(items,progress);const rows=buildRows(titles,items,progress,[],{now,tv:true});
 const heads=rows.map(r=>key(r.entries[0]));assert.equal(new Set(heads).size,heads.length);
 const recent=rows.find(r=>r.id==='recenti'),next=rows.find(r=>r.id==='nuovi-episodi');assert(recent&&next);
 assert(!recent.entries.some(e=>key(e)==='s:Anime/Stellar Sentinels'));assert(next.entries.some(e=>key(e)==='s:Anime/Stellar Sentinels'));assert.notEqual(key(next.entries[0]),'s:Anime/Stellar Sentinels');
});
test('Giro 2 punto 7: generi ordinati per non visti e valutazione, indipendenti dagli ultimi episodi',()=>{
 const items=[{...episode('best','Migliore',DAY),onlineScore:9},{...episode('recent','Recente',now),onlineScore:5},
   {...episode('seen','Visto',now-1),onlineScore:10}];
 const progress={seen:{watched:true,updated:now}};const titles=buildTitles(items,progress);
 const genre=()=>buildRows(titles,items,progress,[],{now,tv:true,page:'anime'}).find(r=>r.id==='genere-anime-azione');
 assert.deepEqual(genre().entries.map(t=>t.title),['Migliore','Recente','Visto']);
 titles.find(t=>t.title==='Recente').added=now*2;assert.equal(genre().entries[0].title,'Migliore');
});
test('Giro 2 punto 7: catalogo piccolo non ripete capofila né perde Continua e ordine Top 10',()=>{
 const items=[episode('a','Unica',DAY)];const progress={a:{position:60,duration:1000,updated:now}};const titles=buildTitles(items,progress);
 const rows=buildRows(titles,items,progress,[],{now,tv:true});assert.equal(rows.length,1);assert.equal(rows[0].id,'top10');
 assert.equal(rows[0].entries[0].position,60);assert.equal(rows[0].entries[0].item.id,'a');
 const many=buildTitles(Array.from({length:15},(_,i)=>({...episode(`n${i}`,`N${i}`,now-i),onlineScore:10-i/10})));
 const ranked=buildRows(many,[],{},[],{now,tv:true}).find(r=>r.id==='top10');assert.equal(ranked.entries[0].score,10);
 assert.deepEqual(ranked.entries.map(t=>t.score),[10,9.9,9.8,9.7,9.6,9.5,9.4,9.3,9.2,9.1]);
});
test('Giro 2 punto 7: unica ripresa coincidente col n.1 non elimina la classifica del catalogo grande',()=>{
 const items=Array.from({length:30},(_,i)=>({...episode(`n${i}`,`N${i}`,now-i),onlineScore:10-i/10}));
 const progress={n0:{position:90,duration:1200,updated:now}};const titles=buildTitles(items,progress);
 const rows=buildRows(titles,items,progress,[],{now,tv:true});const ranked=rows.find(r=>r.id==='top10');assert(ranked);
 assert.equal(ranked.entries.length,10);assert.equal(ranked.entries[0].position,90);assert.equal(ranked.entries[0].item.id,'n0');
 assert.deepEqual(ranked.entries.map(key),titles.slice(0,10).map(t=>t.key));
 const heads=rows.map(r=>key(r.entries[0]));assert.equal(new Set(heads).size,heads.length);
});
