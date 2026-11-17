import test from 'node:test';
import assert from 'node:assert/strict';
import { matchFingerprints, chapterSkips, validateSkips, aniSkipIntervals, STEP } from '../lib/skips.js';

function noise(n, seed = 1) {
  return Array.from({ length: n }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; });
}
test('impronte sfalsate: trova 25 secondi comuni con piccole differenze, entro 2 secondi', () => {
  const common = noise(Math.round(25 / STEP), 42);
  const a = [...noise(130), ...common, ...noise(120, 2)];
  const b = [...noise(270, 3), ...common.map((n, i) => i % 7 ? n : (n ^ 1) >>> 0), ...noise(150, 4)];
  const match = matchFingerprints({ words: a, offset: 0 }, { words: b, offset: 100 });
  assert.ok(match); assert.ok(Math.abs(match.a[0] - 130 * STEP) < 2);
  assert.ok(Math.abs(match.b[0] - (100 + 270 * STEP)) < 2);
  assert.ok(Math.abs(match.a[1] - (130 * STEP + 25)) < 2);
});
test('niente salti per silenzio, materiale diverso, tratto corto o episodio intero duplicato', () => {
  for (const [a, b] of [[Array(1000).fill(0), Array(1000).fill(0)], [noise(1000), noise(1000, 8)], [noise(90), noise(90)], [noise(1300), noise(1300)]]) {
    assert.equal(matchFingerprints({ words: a }, { words: b }), null);
  }
  const drone = Array.from({ length: 300 }, (_, i) => noise(16, 99)[i % 16]);
  assert.equal(matchFingerprints({ words: [...noise(90), ...drone, ...noise(90, 4)] }, { words: [...noise(80, 3), ...drone, ...noise(80, 5)] }), null);
});
test('capitoli recap e anteprima, intervalli manuali rigorosi e AniSkip finto', () => {
  assert.deepEqual(chapterSkips([{ start: 0, end: 23, title: 'Previously on' }, { start: 1300, end: 1320, title: 'Next episode preview' }]), { riassunto: [0, 23], anteprima: [1300, 1320] });
  assert.deepEqual(validateSkips({ riassunto: [0, 10], sigla: [12, 30], finale: null }, 100), { riassunto: [0, 10], sigla: [12, 30], finale: null });
  for (const input of [{ sigla: [10, 5] }, { sigla: [-1, 4] }, { sigla: [0, 101] }, { sigla: ['2', 5] }, { sigla: [0, 20], riassunto: [10, 30] }, { altro: [0, 3] }]) assert.throws(() => validateSkips(input, 100), { status: 400 });
  assert.deepEqual(aniSkipIntervals({ found: true, results: [{ skipType: 'mixed-op', interval: { startTime: 20, endTime: 85 } }, { skipType: 'recap', interval: { startTime: 0, endTime: 18 } }, { skipType: 'ed', interval: { startTime: 200, endTime: 500 } }] }, 250), { sigla: [20, 85], riassunto: [0, 18] });
});
