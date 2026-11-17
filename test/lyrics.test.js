import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLyrics, currentLyric } from '../public/logic.js';
import { fixture, fakeNavidrome } from './helpers.js';

test('testi OpenSubsonic: preferisce sincronizzati, ordina, conserva pause, scarta tempi invalidi', () => {
  const parsed = normalizeLyrics({ lyricsList: { structuredLyrics: [
    { synced: false, line: [{ value: 'Testo semplice' }] },
    { synced: true, line: [{ start: 4000, value: 'Dopo' }, { start: 1000, value: 'Prima' }, { start: 3000, value: '' },
      { start: -1, value: 'Errato' }, { start: '2000', value: 'Non numerico' }, { value: 'Senza tempo' }, null] }
  ] } });
  assert.equal(parsed.synced, true);
  assert.deepEqual(parsed.lines.map(l => l.start), [1000, 3000, 4000]);
  for (const [time, index] of [[0, -1], [0.999, -1], [1, 0], [2.999, 0], [3, 1], [4, 2], [999, 2], [1.5, 0]]) {
    assert.equal(currentLyric(parsed.lines, time), index);
  }
  assert.equal(currentLyric(parsed.lines, NaN), -1);
  assert.equal(currentLyric([], 1), -1);
  assert.equal(currentLyric([{ start: 0 }, { start: 0 }], 0), 1);
});

test('testi semplici, assenti, malformati e contenuti letterali senza interpretare HTML', () => {
  for (const raw of [null, {}, { lyricsList: { structuredLyrics: {} } }, { lyricsList: { structuredLyrics: [null, { line: [{}] }] } }]) {
    assert.deepEqual(normalizeLyrics(raw), { synced: false, lines: [] });
  }
  const parsed = normalizeLyrics({ lyricsList: { structuredLyrics: [{ synced: true, line: [{ start: -1, value: 'Scarta' }] },
    { synced: false, line: [{ value: '<img src=x onerror=alert(1)>' }, { value: 'Seconda riga', start: 3 }] }] } });
  assert.equal(parsed.synced, false);
  assert.deepEqual(parsed.lines, [{ text: '<img src=x onerror=alert(1)>', start: null }, { text: 'Seconda riga', start: null }]);
});

test('proxy testi richiede accesso e inoltra ID a Navidrome; copertina grande limitata a 1000', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/lyrics?id=demo-1')).status, 401);
  await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  const previousCalls = nav.calls.length;
  assert.equal((await f.request('/api/music/lyrics')).status, 400);
  assert.equal(nav.calls.length, previousCalls);
  for (const [id, synced, length] of [['demo-1', true, 6], ['demo-2', false, 3], ['demo-3', false, 0]]) {
    const response = await f.request(`/api/music/lyrics?id=${id}`); assert.equal(response.status, 200);
    const lyrics = normalizeLyrics(await response.json()); assert.equal(lyrics.synced, synced); assert.equal(lyrics.lines.length, length);
    assert.equal(nav.calls.at(-1).method, 'getLyricsBySongId'); assert.equal(nav.calls.at(-1).params.get('id'), id);
  }
  for (const [size, expected] of [['large', '1000'], ['999999', '400']]) {
    const response = await f.request(`/api/music/cover?id=cover&size=${size}`); await response.arrayBuffer();
    assert.equal(nav.calls.at(-1).params.get('size'), expected);
  }
});
