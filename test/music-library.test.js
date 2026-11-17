import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryItems, pinEntry, init, preferences, markOpened } from '../public/music-library.js';
import { fixture, fakeNavidrome } from './helpers.js';
test('libreria: filtri, quattro ordinamenti, puntine prima e limite senza mutare input', () => {
  const items = [{ type: 'album', id: 'a', name: 'Zeta', artist: 'A', created: '2026-11-01' }, { type: 'playlist', id: 'p', name: 'Alfa', artist: 'Z', created: '2026-11-02' }];
  assert.equal(libraryItems(items, { sort: 'alpha' })[0].id, 'p');
  assert.equal(libraryItems(items, { sort: 'author' })[0].id, 'a');
  assert.equal(libraryItems(items, { sort: 'added' })[0].id, 'p');
  assert.equal(libraryItems(items, { recent: { 'album:a': 10 } })[0].id, 'a');
  assert.equal(libraryItems(items, { pins: ['album:a'], sort: 'alpha' })[0].id, 'a');
  assert.equal(libraryItems(items, { filter: 'playlist' }).length, 1);
  assert.equal(libraryItems(items, { filter: 'downloaded', downloaded: ['album:a'] })[0].id, 'a');
  assert.throws(() => pinEntry(['a', 'b', 'c', 'd'], 'e'), /4/);
  assert.deepEqual(pinEntry(['a'], 'a'), []); assert.equal(items[0].id, 'a');
});
test('indice libreria completo e autenticato, senza accedere a dati veri', async t => {
  const nav = await fakeNavidrome({ songs: [{ id: 's', title: 'Finto', albumId: 'a', album: 'Album', artistId: 'r', artist: 'Artista', created: '2026-11-05' }] }); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/library')).status, 401);
  await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  const data = await (await f.request('/api/music/library?profile=bruno')).json();
  assert.deepEqual(data.items.map(i => i.type), ['playlist', 'album', 'artist']);
});
test('preferenze libreria e accessi recenti restano separati tra utente e profilo', () => {
  let scope = 'u:bruno'; const data = new Map([['u:bruno:library', { view: 'grid', sort: 'author', filter: 'album', pins: ['album:a'], recent: {} }]]);
  init({ key: () => scope, storage: { get: (k, fallback) => structuredClone(data.get(k) || fallback), set: (k, v) => data.set(k, structuredClone(v)) } });
  markOpened('album', 'a'); assert.equal(preferences().view, 'grid'); assert.ok(preferences().recent['album:a'] > 0);
  scope = 'u:marta'; assert.equal(preferences().view, 'list'); assert.deepEqual(preferences().pins, []);
  scope = 'other:bruno'; assert.deepEqual(preferences().recent, {});
});
