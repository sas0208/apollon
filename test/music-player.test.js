import test from 'node:test';
import assert from 'node:assert/strict';
import { smartQueue, similarity, moveEntry, removeEntry, nextIndex, volumeGain, qualifies } from '../public/music-logic.js';
const songs = Array.from({ length: 12 }, (_, i) => ({ id: String(i), artist: `Artista ${i % 3}`, album: `Album ${i % 3}`, mood: [i < 8 ? 'Relax' : 'Energia'], energia: i < 8 ? 20 : 90, bpm: i < 8 ? 70 : 140, genre: 'Pop' }));
test('shuffle evita artisti/album consecutivi, duplicati e brani della sessione', () => {
  const result = smartQueue([...songs, songs[0]], { exclude: ['0'], random: () => 0.5 });
  assert.equal(result.length, 11); assert.equal(new Set(result.map(s => s.id)).size, 11);
  assert.ok(result.every((s, i) => !i || s.artist !== result[i - 1].artist));
  assert.ok(!result.some(s => s.id === '0'));
});
test('radio favorisce mood, genere, energia, bpm e tonalità vicini; peso amati/poco ascoltati', () => {
  assert.ok(similarity(songs[0], songs[1]) > similarity(songs[0], songs[10]));
  assert.equal(smartQueue([{ id: 'a' }, { id: 'b', starred: 'oggi' }], { random: () => 0.5 })[0].id, 'b');
  assert.equal(smartQueue([{ id: 'a' }, { id: 'b' }], { stats: { a: { count: 100 } }, random: () => 0.5 })[0].id, 'b');
});
test('riordino e rimozione conservano il brano corrente anche con duplicati', () => {
  const queue = [songs[0], songs[0], songs[1]];
  const moved = moveEntry(queue, 1, 0, 2); assert.equal(moved.index, 0);
  assert.equal(removeEntry(queue, 1, 0).index, 0);
  assert.equal(removeEntry(queue, 1, 1).currentRemoved, true);
  assert.equal(nextIndex(2, 3, 'all'), 0); assert.equal(nextIndex(2, 3, 'off'), -1);
  assert.equal(nextIndex(1, 3, 'one', true), 1); assert.equal(nextIndex(1, 3, 'one', false), 2);
});
test('ReplayGain evita clipping; scrobble richiede ascolto effettivo e non un seek', () => {
  assert.ok(volumeGain({ replayGain: { trackGain: -6 } }) < 0.51);
  assert.equal(volumeGain({ replayGain: { trackGain: 6, trackPeak: 2 } }), 0.5);
  assert.equal(volumeGain({ replayGain: { trackGain: 'rotto' } }), 1);
  assert.equal(qualifies(100, 1), false); assert.equal(qualifies(100, 50), true);
  assert.equal(qualifies(1000, 240), true); assert.equal(qualifies(NaN, 400), false);
});
