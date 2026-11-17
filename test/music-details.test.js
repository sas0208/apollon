import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicService } from '../lib/music-service.js';
import { fixture, fakeNavidrome } from './helpers.js';

test('schede: dati catalogo e Navidrome, artista con immagine locale e numero brani, niente percorsi', async () => {
  const song = { id: 'a', artistId: 'r', artist: 'Inventato', album: 'Album Navidrome', catalogAlbum: 'Album catalogo', catalogYear: '2026',
    genere: 'Prova', mood: ['Notte'], energia: 0, bpm: 90, tonalita: 'La minore', duration: 201, suffix: 'flac', bitRate: 800, path: 'non-esporre' };
  const c = { enriched: async () => [song, { id: 'b', artistId: 'r' }, { id: 'c', artistId: 'altro' }] };
  const m = { request: async (method, auth, params) => { assert.equal(method, 'getArtist'); assert.equal(params.id, 'r'); return { artist: { name: 'Inventato', coverArt: 'ar-r', largeImageUrl: 'https://non-usare.invalid/foto' } }; } };
  const data = await new MusicService(m, c, {}).details({}, 'a');
  assert.equal(data.song.album, 'Album catalogo'); assert.equal(data.song.year, '2026'); assert.equal(data.song.energia, 0);
  assert.equal(data.song.format, 'flac'); assert.equal(data.song.bitRate, 800);
  assert.equal(data.artist.songCount, 2); assert.equal(data.artist.coverArt, 'ar-r');
  assert.equal(JSON.stringify(data).includes('non-esporre'), false); assert.equal(JSON.stringify(data).includes('https:'), false);
});
test('schede: artista assente o endpoint guasto non impediscono i dati; ID sconosciuto 404', async () => {
  const s = new MusicService({ request: async () => { throw new Error('finto'); } }, { enriched: async () => [{ id: 'a', artistId: 'r', artist: 'Prova', coverArt: 'copertina' }] }, {});
  assert.equal((await s.details({}, 'a')).artist.coverArt, 'copertina');
  await assert.rejects(s.details({}, 'inesistente'), { status: 404 });
});
test('API schede richiede accesso musicale e restituisce solo dati del brano scelto', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/details?id=s1')).status, 401);
  await f.request('/api/music/login', { method: 'POST', data: { username: 'finto', password: 'finta' } });
  const response = await f.request('/api/music/details?id=s1'); assert.equal(response.status, 200);
  const result = await response.json(); assert.equal(result.song.id, 's1'); assert.equal(result.artist.songCount, 1); assert.equal(result.song.path, undefined);
  assert.equal((await f.request('/api/music/details?id=ignoto')).status, 404);
});
