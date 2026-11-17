import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendations } from '../lib/music-discovery.js';
test('consigli: genere mood energia bpm tonalità e artista, esclusi playlist problemi e duplicati', () => {
  const seed = { id: 'a', genre: 'Jazz', mood: ['Relax'], energia: 20, bpm: 60, tonalita: 'Do', artist: 'Uno' };
  const similar = { ...seed, id: 'b' }; const different = { id: 'c', genre: 'Rock', mood: ['Energia'], energia: 90, bpm: 150, artist: 'Due' };
  const pool = [seed, different, similar, similar, { ...similar, id: 'd', problema: 'muto' }];
  assert.deepEqual(recommendations(pool, ['a']).map(s => s.id), ['b', 'c']);
  assert.deepEqual(recommendations(pool, ['a', 'b'], { exclude: ['c'] }), []);
  assert.equal(recommendations(Array.from({ length: 30 }, (_, i) => ({ id: String(i) })), []).length, 8);
  assert.equal(recommendations([], []).length, 0);
});
