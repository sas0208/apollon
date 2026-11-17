import test from 'node:test';
import assert from 'node:assert/strict';
import { musicRecap, periodLabel } from '../public/music-recap.js';
import { fixture, fakeNavidrome } from './helpers.js';
test('riepilogo: minuti reali, classifica, profilo, confine mese in Italia, duplicati e dati mancanti', () => {
  const songs = [{ id: 'a', title: 'A', artist: 'Uno', genre: 'Jazz', mood: ['Relax'] }, { id: 'b', title: 'B', artist: 'Due', genre: 'Rock', mood: ['Energia'] }];
  const events = [0, 1, 2].map(i => ({ id: i === 2 ? 'b' : 'a', playId: `p${i}`, seconds: 120, at: '2026-10-31T23:30:00Z' }));
  const recap = musicRecap([...events, events[0], { id: 'a', playId: 'old', seconds: 999, at: '2026-10-01' }], songs, '2026-11');
  assert.equal(recap.minutes, 6); assert.equal(recap.listens, 3); assert.equal(recap.trackCount, 2); assert.equal(recap.enough, true);
  assert.equal(recap.artists[0].name, 'Uno'); assert.equal(recap.genres[0].name, 'Jazz'); assert.equal(recap.moods[0].name, 'Relax'); assert.equal(recap.hours[0].name, '00:00');
  assert.equal(musicRecap(events, songs, '2026').minutes, 6);
  assert.equal(musicRecap([], songs, '2026-11').enough, false); assert.throws(() => musicRecap([], [], 'oops'));
});
test('ascolto cumulativo idempotente, ordinamento eventi fuori ordine e profili separati persistenti', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close()); const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  for (const seconds of [30, 60, 30, 60]) assert.equal((await f.request('/api/music/played', { method: 'POST', data: { profile: 'bruno', id: 's1', playId: 'a', seconds } })).status, 200);
  const period = new Date().getFullYear();
  const recap = async profile => (await (await f.request(`/api/music/recap?profile=${profile}&period=${period}`)).json());
  assert.equal((await recap('bruno')).seconds, 60); assert.equal((await recap('marta')).seconds, 0);
  assert.equal((await f.request('/api/music/played', { method: 'POST', data: { profile: 'nessuno', id: 's1', playId: 'b', seconds: 20 } })).status, 404);
});

test('il racconto mostra il mese per esteso', () => {
  assert.equal(periodLabel('2026-11'), 'novembre 2026');
  assert.equal(periodLabel('1999-01'), 'gennaio 1999');
  assert.equal(periodLabel('2026'), '2026');
});
