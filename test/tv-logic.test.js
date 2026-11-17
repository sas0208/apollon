import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrub } from '../public/tv/scrub.js';
import { FocusModel, acceptRepeat } from '../public/tv/focus.js';
import { Router } from '../public/tv/router.js';
import { nextEpisode, backLayer, nextPrompt } from '../public/tv/playback.js';
import { previewQueue, previewFrame } from '../public/tv/preview.js';

test('TV: tap, rilascio a 800ms, conferma singola e annullamento', () => {
  const s = createScrub({ position: 100, duration: 1440, now: 0 });
  assert.equal(s.press(1, 0), 110); s.release(50);
  assert.equal(s.due(849), false); assert.equal(s.due(850), true);
  assert.equal(s.confirm(), 110); assert.equal(s.confirm(), null);
  const cancel = createScrub({ position: 100, duration: 1440, now: 0 });
  cancel.press(-1, 0); cancel.tick(1500); assert.equal(cancel.cancel(), 100);
});
test('TV: ricerca indipendente dalle ripetizioni e attraversamento episodio/film', () => {
  const drive = interval => { const s = createScrub({position:0,duration:1440}); s.press(1,0); for(let t=interval;t<=2000;t+=interval) s.press(1,t); return s.tick(2000); };
  assert.equal(drive(50), drive(100));
  for(const [duration, time] of [[1440,3000],[7200,5000]]) {
    const s = createScrub({position:0,duration}); s.press(1,0); assert.equal(s.tick(time),duration);
  }
});
test('TV: inversione riparte da dieci secondi, limiti e durata ignota', () => {
  const s = createScrub({position:500,duration:1440}); s.press(1,0); const at=s.tick(1700);
  assert.equal(s.press(-1,1700),at-10); assert(s.tick(1750)>at-25);
  s.tick(7000); assert.equal(s.position,0);
  const unknown=createScrub({position:0,duration:NaN}); assert.equal(unknown.press(1,0),0);
});
test('TV: fuoco ricorda card per riga e ripristina per id dopo riordino', () => {
  const f=new FocusModel([{id:'a',items:['1','2','3']},{id:'b',items:['4','5']}]);
  f.move('right'); f.move('down'); f.move('right'); f.move('up'); assert.equal(f.current.item,'2');
  const state=f.snapshot(); f.setRows([{id:'b',items:['5','4']},{id:'a',items:['3','1','2']}]); f.restore(state);
  assert.deepEqual(f.current,{row:'a',item:'2',r:1,c:2});
  f.move('down'); assert.equal(f.current.item,'2');
  f.move('left'); f.move('left'); assert.equal(f.move('left'),'rail');
});
test('TV: niente coda di tasti, limiti orizzontali e verticali', () => {
  assert(acceptRepeat('right',110,{key:'right',at:0},true));
  assert(!acceptRepeat('right',109,{key:'right',at:0},true));
  assert(!acceptRepeat('down',159,{key:'down',at:0},true));
  assert(acceptRepeat('down',160,{key:'down',at:0},true));
  assert(acceptRepeat('down',1,{key:'down',at:0},false));
});
test('TV: router conserva stato isolato e ritorno esatto', () => {
  const r=new Router(); r.push('home'); const state={row:'film',memory:{film:'f:2'}};
  r.push('title',{id:'f:2'},state); state.memory.film='f:3'; r.push('player',{id:'2'},{row:'actions'});
  assert.equal(r.back().name,'title'); assert.equal(r.back().state.memory.film,'f:2'); assert.equal(r.back(),null);
});
test('TV: prossimo episodio attraversa stagioni, evita altro titolo e offline', () => {
  const items=[{id:'a',root:'Anime',series:'Luna',season:1,episode:9},{id:'b',root:'Anime',series:'Luna',season:2,episode:1},{id:'x',root:'Anime',series:'Altro',season:1,episode:1}];
  assert.equal(nextEpisode(items,items[0]).id,'b'); assert.equal(nextEpisode(items,items[1]),null);
  assert.equal(nextEpisode([{...items[1],remoteDown:true}],items[0]),null);
  assert.equal(nextEpisode(items,{id:'film'}),null);
});
test('TV: Indietro segue i livelli e priorità anteprime senza duplicati', () => {
  assert.equal(backLayer({panel:true,scrub:true,overlay:true}),'panel');
  assert.equal(backLayer({scrub:true,overlay:true}),'scrub'); assert.equal(backLayer({overlay:true}),'overlay'); assert.equal(backLayer({}),'exit');
  assert.deepEqual(previewQueue({current:'c',next:'n',continuing:['c','p'],rest:['n','r']}),['c','n','p','r']);
  const index={interval:10,width:320,height:180,columns:10,rows:10,frames:130,sheets:2};
  assert.deepEqual(previewFrame(index,1040),{sheet:1,x:1280,y:0,width:320,height:180});
  assert.equal(previewFrame(null,5),null); assert.equal(previewFrame(index,99999).sheet,1);
});
test('TV: il conto alla rovescia parte solo dove la storia è sicuramente finita, mai «negli ultimi venti secondi»',()=>{
 // 12/11: prima partiva all'inizio della sigla finale (o a 20 s dalla fine) e dopo 10 s cambiava episodio, tagliando la scena finale.
 assert(!nextPrompt({salti:{finale:[1300,1440]}},1440,1300,true));
 assert(!nextPrompt({},1440,1420,true));assert(!nextPrompt({},1440,1439,true));
 assert(nextPrompt({salti:{finale:[1300,1400]},fineStoria:1300},1440,1300,true));
 assert(!nextPrompt({salti:{finale:[1300,1400]},fineStoria:1300},1440,1299,true));
 assert(!nextPrompt({fineStoria:1300},1440,1420,false));assert(!nextPrompt({fineStoria:1300},NaN,10,true));
 assert(!nextPrompt({fineStoria:null,salti:{finale:[1300,1400]}},1440,1410,true));
});
