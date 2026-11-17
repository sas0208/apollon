import test from 'node:test';
import assert from 'node:assert/strict';
import { recentSearches, remember } from '../public/music-search.js';
test('ricerche: ultime dieci, scelta ripetuta davanti, cancellazione e isolamento profilo', () => {
  let previous = []; for (let i = 0; i < 12; i++) previous = recentSearches(previous, `Finto ${i}`);
  assert.equal(previous.length, 10); assert.equal(previous.at(-1), 'Finto 2');
  previous = recentSearches(previous, ' fINTO 2 '); assert.equal(previous[0], 'fINTO 2'); assert.equal(previous.length, 10);
  assert.deepEqual(recentSearches(previous, ' '), previous);
  const data = new Map(); let profile = 'bruno'; const c = { key: () => profile, storage: { get: (k, d) => data.get(k) || d, set: (k, d) => data.set(k, d) } };
  remember(c, 'Sera'); profile = 'marta'; remember(c, 'Mattina');
  assert.deepEqual(data.get('bruno:searches'), ['Sera']); assert.deepEqual(data.get('marta:searches'), ['Mattina']);
});
