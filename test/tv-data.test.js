import test from 'node:test';
import assert from 'node:assert/strict';
import { TVData } from '../public/tv/api.js';
test('TV: il ritorno rilegge il catalogo e vede la versione leggera appena pronta',async t=>{
 let light=false;const item={id:'a'.repeat(24),root:'Film',title:'Luna',genres:[],duration:120,light:false};
 t.mock.method(globalThis,'fetch',async url=>Response.json(url==='/api/library'?{items:[{...item,light}]}:url==='/api/bootstrap'?{profiles:[{id:'bruno',name:'Bruno'}]}:url.startsWith('/api/mylist')?{items:[]}:{}));
 const d=new TVData();await d.load();assert.equal(d.items[0].light,false);d.profile='bruno';light=true;await d.refresh();assert.equal(d.items[0].light,true);assert.equal(d.titles[0].item.light,true);
});
