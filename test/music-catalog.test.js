import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixture, fakeNavidrome } from './helpers.js';
import { MusicCatalog, matchSongs } from '../lib/music-catalog.js';

const sample = () => ({ versione: 1, mood: [{ nome: 'Energia', descrizione: 'Per partire.', brani: 2 }], generi: [{ nome: 'Pop', brani: 2 }],
  brani: [{ file: 'Uno.mp3', titolo: 'Omonimo', mood: ['Energia'], genere: 'Pop' }, { file: 'Due.mp3', titolo: 'Omonimo', mood: ['Energia'], genere: 'Pop' }] });
async function catalogFile(f, value) {
  const dir = path.join(f.roots.Musica, 'Libreria'); await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'catalogo_musica.json'), typeof value === 'string' ? value : JSON.stringify(value));
}
test('catalogo locale: assente/corrotto/versione sconosciuta non bloccano la musica; ricarica a modifica', async t => {
  const f = await fixture(); t.after(() => f.close()); const c = new MusicCatalog(f.app.files);
  assert.equal((await c.home()).available, false);
  await catalogFile(f, sample()); let home = await c.home();
  assert.equal(home.available, true); assert.equal(home.mood[0].nome, 'Energia'); assert.equal(home.generi[0].brani, 2);
  assert.equal(home.brani, undefined); // La home non trasmette l'intero catalogo.
  await catalogFile(f, '{rotto'); assert.equal((await c.home()).available, false);
  await catalogFile(f, { ...sample(), versione: 99 }); assert.equal((await c.home()).available, false);
  await catalogFile(f, sample()); assert.equal((await c.home()).available, true);
});
test('collegamento per percorso: titoli omonimi, separatori Windows, Unicode e duplicati ambigui', () => {
  const entries = sample().brani;
  const songs = [{ id: 'wrong', title: 'Omonimo', path: 'Altro/Uno.mp3' },
    { id: 'one', path: 'Libreria/Uno.mp3' }, { id: 'two', path: '/music/Libreria/Due.mp3' }];
  assert.deepEqual(matchSongs(entries, songs, 'Libreria').songs.map(s => s.id), ['one', 'two']);
  assert.equal(matchSongs(entries, [...songs, { id: 'duplicate', path: 'Libreria/Uno.mp3' }], 'Libreria').missing, 1);
  assert.equal(matchSongs([{ file: 'caffè.mp3' }], [{ id: 'accent', path: 'Libreria\\caffè.mp3' }], 'Libreria').songs[0].id, 'accent');
  assert.equal(matchSongs([{ file: '../Uno.mp3' }], songs, 'Libreria').songs.length, 0);
});

test('dati player: album e anno dal catalogo si uniscono solo al percorso completo', async t => {
  const f = await fixture(); t.after(() => f.close());
  const data = sample(); Object.assign(data.brani[0], { album: 'Inventato', anno: 2026, energia: 0, bpm: 80, tonalita: 'Do' });
  await catalogFile(f, data);
  const c = new MusicCatalog(f.app.files);
  const songs = [{ id: 'giusto', path: 'Libreria/Uno.mp3' }, { id: 'altro', path: 'Altro/Uno.mp3' }];
  const result = await c.enriched({ request: async (method, auth, p) => ({ searchResult3: { song: p.songOffset ? [] : songs } }) }, {});
  assert.equal(result[0].catalogAlbum, 'Inventato'); assert.equal(result[0].catalogYear, '2026'); assert.equal(result[0].energia, 0);
  assert.equal(result[1].catalogAlbum, undefined);
});
test('mood e generi: selezione, pagine Navidrome condivise per sessione, niente fallback per titolo', async t => {
  const f = await fixture(); t.after(() => f.close()); await catalogFile(f, sample());
  const c = new MusicCatalog(f.app.files); let calls = 0; const auth = {};
  const music = { async request(method, credentials, params) {
    calls++; assert.equal(method, 'search3'); assert.equal(credentials, auth); assert.equal(params.query, '');
    return { searchResult3: { song: params.songOffset ? [] : [{ id: 'one', title: 'Altro titolo', path: 'Libreria/Uno.mp3' }] } };
  } };
  const results = await Promise.all([c.collection('mood', 'Energia', music, auth), c.collection('generi', 'Pop', music, auth)]);
  assert.equal(calls, 2); assert.deepEqual(results[0].songs.map(s => s.id), ['one']); assert.equal(results[0].missing, 1);
  await assert.rejects(c.collection('mood', 'inesistente', music, auth), { status: 404 });
});
test('API catalogo richiede accesso musicale, fallback disponibile dopo login', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/home')).status, 401);
  await f.request('/api/music/login', { method: 'POST', data: { username: 'finto', password: 'finta' } });
  assert.equal((await (await f.request('/api/music/home')).json()).available, false);
  await catalogFile(f, sample());
  assert.equal((await (await f.request('/api/music/home')).json()).available, true);
  const r = await f.request('/api/music/collection?type=mood&name=Energia'); assert.equal(r.status, 200);
  const collection = await r.json(); assert.equal(collection.songs[0].id, 's1'); assert.equal(collection.missing, 1);
  assert.equal((await f.request('/api/music/collection?type=unknown&name=Energia')).status, 400);
  assert.equal((await f.request('/api/music/collection?type=generi&name=Altro')).status, 404);
  await f.request('/api/logout', { method: 'POST', data: {} });
  assert.equal((await f.request('/api/music/home')).status, 401);
});
test('indice paginato, sessioni isolate, ripresa dopo errore e radice Navidrome configurabile', async t => {
  const f = await fixture(); t.after(() => f.close()); await catalogFile(f, sample());
  const c = new MusicCatalog(f.app.files, 'Libreria/catalogo_musica.json', '');
  const songs = Array.from({ length: 501 }, (_, n) => ({ id: String(n), path: n === 500 ? 'Uno.mp3' : `Altro/${n}.mp3` }));
  const offsets = []; let failOnce = true;
  const music = { async request(method, auth, params) {
    if (failOnce) { failOnce = false; throw new Error('finto guasto'); }
    offsets.push(params.songOffset); return { searchResult3: { song: songs.slice(params.songOffset, params.songOffset + params.songCount) } };
  } };
  const a = {}; const b = {};
  await assert.rejects(c.collection('mood', 'Energia', music, a), /finto guasto/);
  assert.equal((await c.collection('mood', 'Energia', music, a)).songs[0].id, '500');
  await c.collection('mood', 'Energia', music, a); assert.deepEqual(offsets, [0, 500, 501]);
  await c.collection('mood', 'Energia', music, b); assert.deepEqual(offsets, [0, 500, 501, 0, 500, 501]);
  assert.throws(() => new MusicCatalog(f.app.files, undefined, '../fuori'), /prefisso/);
});
test('Navidrome con pagine corte non tronca i mood; pagine ripetute si fermano', async t => {
  const f = await fixture(); t.after(() => f.close()); await catalogFile(f, sample());
  const c = new MusicCatalog(f.app.files);
  const songs = [{ id: '1', path: 'Libreria/Uno.mp3' }, { id: '2', path: 'Libreria/Due.mp3' }];
  const music = { async request(method, auth, params) { return { searchResult3: { song: songs.slice(params.songOffset, params.songOffset + 1) } }; } };
  assert.deepEqual((await c.collection('mood', 'Energia', music, {})).songs.map(s => s.id), ['1', '2']);
  await assert.rejects(c.collection('mood', 'Energia', { async request() { return { searchResult3: { song: songs } }; } }, {}), { status: 502 });
});
