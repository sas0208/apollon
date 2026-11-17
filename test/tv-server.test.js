import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import {readdir,readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {esbuild} from '../scripts/build-legacy.mjs';
const TV='Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
test('TV: redirect solo con consenso tv e UA televisore, app separata legacy', async t=>{
 const f=await fixture(); t.after(()=>f.close());
 const redirect=await fetch(f.url+'/?tv=1',{redirect:'manual',headers:{'User-Agent':TV}});
 assert.equal(redirect.status,302); assert.equal(redirect.headers.get('location'),'/tv/');
 const normal=await (await f.request('/?tv=1')).text(); assert.match(normal,/src="\/app.js"/);
 const plain=await (await f.request('/',{headers:{'User-Agent':TV}})).text(); assert.match(plain,/legacy\/app.js/);
 const page=await (await f.request('/tv/')).text(); assert.match(page,/legacy\/tv\/app.js/); assert.doesNotMatch(page,/tv-nav.js|type="module"/);
 for(const p of ['/tv/tv.css','/tv/focus.js','/legacy/tv/app.js','/legacy/tv/tv.css']) assert.equal((await f.request(p)).status,200,p);
 assert.equal((await f.request('/legacy/tv/../../server.js')).status,404);
 const intro=await fetch(f.url+'/?tv=1&apollonIntro=done&apollonStart=123',{redirect:'manual',headers:{'User-Agent':'SMART-TV'}});assert.equal(intro.headers.get('location'),'/tv/?apollonIntro=done&apollonStart=123');
});
test('TV: tutti i moduli sono serviti e nella cache; bundle e CSS compatibili chrome76',async t=>{
 const f=await fixture();t.after(()=>f.close());const names=await readdir(new URL('../public/tv/',import.meta.url));
 const sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');const scope={self:{addEventListener(){}}};vm.runInNewContext(sw.replace(/^import[^\n]+\n/gm,'')+'\nglobalThis.assets=ASSETS;',scope);
 for(const name of names){const url=`/tv/${name}`;assert.equal((await f.request(url)).status,200,url);assert(scope.assets.includes(url),`Cache: ${url}`);}
 const bundle=await readFile(new URL('../public/legacy/tv/app.js',import.meta.url),'utf8');await esbuild.transform(bundle,{loader:'js',target:'chrome76'});assert.doesNotMatch(bundle,/\?\.[^\d]|\?\?|\|\|=|&&=/);
 const css=await readFile(new URL('../public/legacy/tv/tv.css',import.meta.url),'utf8');assert.doesNotMatch(css,/(?:backdrop-filter|aspect-ratio|\bgap|\binset)\s*:|\bclamp\(|\bdvh\b/);for(const url of ['/legacy/tv/app.js','/legacy/tv/tv.css'])assert(scope.assets.includes(url));
});
