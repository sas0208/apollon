import test from 'node:test';
import assert from 'node:assert/strict';
import * as logic from '../public/video-logic.js';
import { fixture } from './helpers.js';
import { TVData } from '../public/tv/api.js';
const anime=(id,tags=[],genres=['Fantasy'])=>({id,root:'Anime',series:`Storia ${id}`,title:'E1',season:1,episode:1,genres,tags});
test('Giro 2: famiglie anime dai metadati, soglia 3, nessun genere film estraneo',()=>{
  assert.equal(typeof logic.catalogCategories,'function');
  const titles=logic.buildTitles([anime('a',['Isekai','Dark Fantasy']),anime('b',['Isekai','Dark Fantasy']),anime('c',['Isekai']),anime('sport',[],['Sports']),
    ...['f1','f2','f3'].map(id=>({id,root:'Film',title:id,genres:['Crime']}))]);
  const groups=logic.catalogCategories(titles,'anime');
  assert(groups.some(g=>g.name==='Isekai e altri mondi'&&g.entries.length===3));
  assert(groups.some(g=>g.name==='Fantasy'&&g.entries.length===3));
  assert(!groups.some(g=>['Sport','Dark fantasy','Poliziesco'].includes(g.name)));
  assert(groups.every(g=>g.entries.every(t=>t.kind==='anime')));
  const film=logic.catalogCategories(titles,'film');assert.equal(film[0].name,'Poliziesco');assert(film.every(g=>g.entries.every(t=>t.kind==='film')));
});
test('Giro 2: una serie con stagioni e cartelle diverse conta una volta nelle categorie',()=>{
  const items=[anime('a'),anime('b'),anime('c'),{...anime('d'),series:'Storia a',season:2,path:'altro/S02E01.mp4'}];
  const titles=logic.buildTitles(items);assert.equal(titles.length,3);assert.equal(titles[0].episodes.length,2);
  assert.equal(typeof logic.catalogCategories,'function');assert.equal(logic.catalogCategories(titles,'anime')[0].entries.length,3);
});
test('Giro 2: top 10 bayesiana, voti casa 1-5 portati su 0-10, pareggi stabili',()=>{
  assert.equal(typeof logic.rankingScore,'function');assert.equal(typeof logic.topTen,'function');
  const titles=Array.from({length:12},(_,i)=>({key:`f:${String(i).padStart(2,'0')}`,title:`Film ${i}`,score:i===0?9:8}));
  assert.equal(logic.rankingScore(titles[0],{}),9);
  assert.equal(logic.rankingScore(titles[0],{count:1,sum:1}),7.25);
  assert.equal(logic.rankingScore(titles[1],{count:3,sum:15}),9);
  assert.equal(logic.rankingScore({score:null},{}),5);
  const votes={[titles[0].key]:{count:1,sum:1},[titles[1].key]:{count:3,sum:15}};
  assert.deepEqual(logic.topTen(titles,votes).map(t=>t.key),logic.topTen([...titles].reverse(),votes).map(t=>t.key));
  assert.equal(logic.topTen(titles,votes).length,10);assert.equal(logic.topTen(titles,votes)[0].key,titles[1].key);
  assert.deepEqual(logic.topTen([],{}),[]);
});
test('Giro 2: riepilogo voti aggregato senza dati dei profili e aggiornato a ogni voto',async t=>{
  const f=await fixture();t.after(()=>f.close());
  await f.app.store.setRating('bruno','s:Anime/A',5);await f.app.store.setRating('bruno','s:Anime/A',1);await f.app.store.setRating('marta','s:Anime/A',4);
  const r=await f.request('/api/ratings/summary');assert.equal(r.status,200);
  assert.deepEqual(await r.json(),{'s:Anime/A':{count:3,sum:10}});
  await f.app.store.setRating('bruno','s:Anime/A',null);
  assert.deepEqual(await (await f.request('/api/ratings/summary')).json(),{'s:Anime/A':{count:2,sum:9}});
});
test('Giro 2: TVData carica e aggiorna il riepilogo per la classifica',async t=>{
  let sum=5;t.mock.method(globalThis,'fetch',async url=>Response.json(url==='/api/ratings/summary'?{k:{count:1,sum}}:url==='/api/bootstrap'?{profiles:[]}:url==='/api/library'?{items:[]}:{}));
  const d=new TVData();await d.load();assert.deepEqual(d.ratings,{k:{count:1,sum:5}});sum=2;await d.refreshRatings();assert.equal(d.ratings.k.sum,2);
});
