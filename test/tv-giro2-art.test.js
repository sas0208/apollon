import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as logic from '../public/video-logic.js';
import { OnlineArt } from '../lib/online-art.js';

test('Giro 2: hero preferisce trama e immagini anche a titoli mai iniziati incompleti', () => {
  const titles = logic.buildTitles([
    {id:'empty',root:'Anime',title:'Vuoto'},
    {id:'full',root:'Anime',title:'Completo',description:'Trama vera',images:{poster:true,backdrop:true}}
  ],{full:{position:42}});
  for(let day=0;day<20;day++) assert.equal(logic.featuredTitle(titles,day).title,'Completo');
});
test('Giro 2: art serie sceglie immagini dichiarate, trama di serie dagli altri episodi', () => {
  const [t]=logic.buildTitles([{id:'a',root:'Anime',title:'E1',series:'Storia',season:1,episode:1,description:'Solo episodio'},
    {id:'b',root:'Anime',title:'E2',series:'Storia',season:2,episode:1,seriesDescription:'Trama serie',images:{poster:true,backdrop:true}}]);
  assert.equal(t.art.id,'b');assert.equal(t.description,'Trama serie');assert.deepEqual(t.seasons,[1,2]);
});
test('Giro 2: immagini in cascata fotogramma, serie, poster, poi copertina disegnata', () => {
  assert.equal(typeof logic.artworkSources,'function');
  const title={title:'A & <B>',key:'s:Anime/A',art:{id:'serie',images:{backdrop:true,poster:true}}};
  const urls=logic.artworkSources(title,{id:'ep',images:{thumb:true}},'thumb',640);
  assert.match(urls[0],/^\/media\/ep\/thumb\?/);assert.match(urls[1],/^\/media\/serie\/backdrop\?/);
  assert.match(urls[2],/^\/media\/serie\/poster\?/);assert.match(urls.at(-1),/^data:image\/svg\+xml/);
  const svg=decodeURIComponent(urls.at(-1).split(',')[1]);assert.ok(svg.includes('A &amp; &lt;B&gt;'));assert.ok(!svg.includes('<B>'));
  assert.match(logic.artworkSources({},null)[0],/^data:image/);
});
test('Giro 2: cache con poster ma trama vuota viene aggiornata e conserva tags sicuri', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'apollon-giro2-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  let calls=0;
  const online=await new OnlineArt({dataDir:dir},{data:{onlineArt:true}},{fetchImpl:async(url,init)=>{
    calls++;assert.match(JSON.parse(init.body).query,/tags/);
    return Response.json({data:{Media:{id:1,genres:['Fantasy'],description:'Trama ufficiale.',averageScore:80,tags:[{name:'Isekai',rank:90,isMediaSpoiler:false},{name:'Dark Fantasy',rank:80,isMediaSpoiler:false},{name:'Segreto',rank:99,isMediaSpoiler:true}]}}});
  }}).init();
  const query={title:'Jack'};const key=online.keyFor('anime',query);
  online.index[key]={poster:'gia.jpg',logo:'logo.png',genres:[],description:'',gat:Date.now()};
  assert.equal(await online.fetchGenres('anime',query),true);
  assert.equal(online.infoFor('anime',query).description,'Trama ufficiale.');
  assert.deepEqual(online.infoFor('anime',query).tags,['Isekai','Dark Fantasy']);
  assert.deepEqual(online.genresFor('anime',query),['Fantasy']);assert.equal(calls,1);
  assert.equal(await online.fetchGenres('anime',query),false);assert.equal(calls,1);
});
test('Giro 2: metadati vuoti veri non causano richieste ripetute, interruttore spento rispettato', async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'apollon-giro2-'));t.after(()=>rm(dir,{recursive:true,force:true}));let calls=0;
  const store={data:{onlineArt:true}};const online=await new OnlineArt({dataDir:dir},store,{fetchImpl:async()=>{calls++;return Response.json({data:{Media:{id:1,genres:[],description:null,tags:[]}}});}}).init();
  const q={title:'Senza trama'};online.index[online.keyFor('anime',q)]={poster:'p',logo:'l'};
  await online.fetchGenres('anime',q);await online.fetchGenres('anime',q);assert.equal(calls,1);
  store.data.onlineArt=false;assert.equal(await online.fetchGenres('anime',{title:'Altro'}),false);assert.equal(calls,1);
});
test('Giro 2: recuperare prima la trama di un titolo nuovo non blocca il successivo download della copertina',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'apollon-giro2-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const online=await new OnlineArt({dataDir:dir},{data:{onlineArt:true}},{fetchImpl:async url=>String(url).includes('graphql.anilist')?
    Response.json({data:{Media:{genres:['Fantasy'],description:'Trama',tags:[],coverImage:{large:'https://s4.anilist.co/p.jpg'}}}}):new Response('jpg',{headers:{'content-type':'image/jpeg'}})}).init();
  await online.fetchGenres('anime',{title:'Nuovo'});
  assert.match(await online.get('anime',{title:'Nuovo'},'poster')||'',/poster\.jpg$/);
});
