import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fixture, fakeNavidrome } from './helpers.js';
import { Store } from '../lib/store.js';

test('catalogo, streaming Range/HEAD, sottotitoli e stato persistente per profilo', async t => {
  const f = await fixture(); t.after(() => f.close());
  const item = await f.video();
  await writeFile(path.join(f.roots.Film, 'Film di prova (2026).it.srt'), '1\n00:00:01,000 --> 00:00:02,000\nCiao');
  await f.app.library.scan();
  const list = await (await f.request('/api/library')).json();
  assert.equal(list.items.length, 1); assert.equal(list.items[0].path, undefined); assert.equal(list.items[0].subtitles.length, 1);
  let r = await f.request(`/media/${item.id}`, { headers: { Range: 'bytes=2-5' } }); assert.equal(r.status, 206); assert.equal(await r.text(), '2345'); assert.equal(r.headers.get('content-range'), 'bytes 2-5/10');
  r = await f.request(`/media/${item.id}`, { method: 'HEAD' }); assert.equal(r.headers.get('content-length'), '10'); assert.equal(await r.text(), '');
  r = await f.request(`/media/${item.id}`, { headers: { Range: 'bytes=99-' } }); assert.equal(r.status, 416);
  assert.match(await (await f.request(`/media/${item.id}/subtitle/0`)).text(), /WEBVTT/);
  r = await f.request('/api/progress', { method: 'PUT', data: { profile: 'bruno', id: item.id, position: 10, duration: 100 } }); assert.equal(r.status, 200);
  assert.equal((await (await f.request('/api/progress?profile=bruno')).json())[item.id].position, 10);
  assert.deepEqual(await (await f.request('/api/progress?profile=marta')).json(), {});
  const saved = await new Store(f.app.config.dataDir).init(); assert.equal(saved.profile('bruno')[item.id].position, 10);
  assert.equal((await f.request('/api/progress', { method: 'PUT', data: { profile: 'bruno', id: item.id, position: -1 } })).status, 400);
  r = await f.request('/api/profiles', { method: 'POST', data: { name: 'Ospite' } }); assert.equal(r.status, 201);
});
test('gestione richiede chiave e origine corretta, upload non sovrascrive, cestino ripristinabile', async t => {
  const f = await fixture(); t.after(() => f.close());
  assert.equal((await f.request('/api/manage/space')).status, 401);
  assert.equal((await f.request('/api/login', { method: 'POST', data: { key: 'errata' } })).status, 401);
  assert.equal((await f.request('/api/login', { method: 'POST', data: { key: 'chiave-finta-test' }, headers: { Origin: 'http://sito-estraneo.example' } })).status, 403);
  assert.equal((await f.login()).status, 200);
  const upload = () => f.request('/api/manage/upload?root=Film&path=Finto.mp4', { method: 'POST', raw: Buffer.from('solo prova') });
  assert.equal((await upload()).status, 201); assert.equal((await upload()).status, 409);
  assert.equal(await readFile(path.join(f.roots.Film, 'Finto.mp4'), 'utf8'), 'solo prova');
  assert.equal((await f.request('/api/manage/upload?root=Film&path=script.js', { method: 'POST', raw: Buffer.from('x') })).status, 400);
  assert.equal((await f.request('/api/manage/files?root=Film&path=../state')).status, 400);
  assert.equal((await f.request('/api/manage/folder', { method: 'POST', data: { root: 'Film', path: 'Nuovi' } })).status, 200);
  const oldId = f.app.library.items[0].id;
  await f.request('/api/progress', { method: 'PUT', data: { profile: 'marta', id: oldId, position: 5, duration: 10 } });
  assert.equal((await f.request('/api/manage/move', { method: 'POST', data: { root: 'Film', from: 'Finto.mp4', to: 'Nuovi/Rinominato.mp4' } })).status, 200);
  const newId = f.app.library.items[0].id; assert.equal(f.app.store.profile('marta')[newId].position, 5);
  let r = await f.request('/api/manage/trash', { method: 'POST', data: { root: 'Film', path: 'Nuovi/Rinominato.mp4' } }); assert.equal(r.status, 200); const record = await r.json();
  assert.equal(f.app.library.items.length, 0);
  assert.equal((await f.request('/api/manage/restore', { method: 'POST', data: { id: record.id } })).status, 200);
  assert.equal(await readFile(path.join(f.roots.Film, 'Nuovi/Rinominato.mp4'), 'utf8'), 'solo prova');
  assert.equal((await f.request('/api/manage/space')).status, 200);
  assert.equal((await f.request('/api/logout', { method: 'POST', data: {} })).status, 200);
  assert.equal((await f.request('/api/manage/space')).status, 401);
});
test('blocca collegamenti e carichi oltre limite senza file parziali', async t => {
  const f = await fixture({ maxUploadGB: 4 / 1024 ** 3 }); t.after(() => f.close()); await f.login();
  const r = await f.request('/api/manage/upload?root=Film&path=Grande.mp4', { method: 'POST', raw: '12345' }); assert.equal(r.status, 413);
  assert.deepEqual(await f.app.files.list('Film'), []);
  await mkdir(path.join(f.dir, 'fuori')); await writeFile(path.join(f.dir, 'fuori', 'Finto.mp4'), 'fuori');
  try { await symlink(path.join(f.dir, 'fuori'), path.join(f.roots.Film, 'ponte'), 'junction'); }
  catch (e) { if (e.code === 'EPERM') { t.diagnostic('Il sistema non consente symlink; verifica collegamenti saltata.'); return; } throw e; }
  assert.equal((await f.request('/api/manage/files?root=Film&path=ponte')).status, 403);
  await f.app.library.scan(); assert.equal(f.app.library.items.length, 0);
});
test('musica: login, API Subsonic, playlist, Range e token nascosti al client', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/albums')).status, 401);
  assert.equal((await f.request('/api/music/login', { method: 'POST', data: { username: 'errore', password: 'finta' } })).status, 401);
  assert.equal((await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } })).status, 200);
  for (const route of ['artists', 'artist?id=r1', 'album?id=a1', 'albums', 'search?q=casa', 'playlists', 'playlist?id=p1']) assert.equal((await f.request(`/api/music/${route}`)).status, 200);
  assert.equal((await f.request('/api/music/playlist', { method: 'POST', data: { name: 'Preferiti', songs: ['s1', 's2'] } })).status, 200);
  const call = nav.calls.find(c => c.method === 'createPlaylist'); assert.deepEqual(call.params.getAll('songId'), ['s1', 's2']);
  assert.equal(call.params.get('p'), null); assert.equal(call.params.get('t').length, 32);
  const r = await f.request('/api/music/stream?id=s1', { headers: { Range: 'bytes=0-2' } }); assert.equal(r.status, 206); assert.equal(await r.text(), '012');
  assert.equal(nav.calls.at(-1).params.get('format'), 'raw');
  assert.equal((await f.request('/api/music/playlist', { method: 'DELETE', data: { id: 'p2' } })).status, 200);
  const boot = await (await f.request('/api/bootstrap')).text(); assert.doesNotMatch(boot, /"t"|"s"|finta|navidromeUrl/);
});
