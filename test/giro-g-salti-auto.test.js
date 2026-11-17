// Giro G, punto 2: l'analisi dei salti parte da sola, non serve guardare né ascoltare gli episodi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';

function words(seed, n) { return Array.from({ length: n }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; }); }
function tools(calls) {
  return { async probe() { return { duration: 900, chapters: [] }; },
    async fingerprint(file, offset) { calls.push(file); const episode = /E0(\d)/.exec(file)?.[1] * 1 || 1; return { offset, words: [...words(episode, 120 + episode * 30), ...words(offset ? 81 : 71, 200), ...words(episode + 8, 300)] }; },
    async fotogrammi() { return Buffer.alloc(900 * 2 * 9); },
    async black() { return []; } };
}

test('con 2 episodi non analizzati la stagione parte da sola; un solo episodio non basta', async t => {
  const calls = []; const f = await fixture({ skipTools: tools(calls), skipDelayMs: 0, autoSkips: true }); t.after(() => f.close()); await f.login();
  await f.video('Serie S01E01.mp4', 'Anime'); await f.app.skips.wait();
  assert.equal(calls.length, 0, 'Un episodio solo: niente da confrontare');
  assert.deepEqual(f.app.skips.overview().series['Anime/Serie'], { total: 1, ready: 0, preparing: false, review: 0 });
  await f.video('Serie S01E02.mp4', 'Anime'); await f.app.skips.wait();
  assert.equal(calls.length, 4); assert.ok(f.app.library.list().every(i => i.salti.sigla));
  assert.deepEqual(f.app.skips.overview().series['Anime/Serie'], { total: 2, ready: 2, preparing: false, review: 0 });
});

test('un episodio nuovo in una stagione già analizzata viene analizzato da solo', async t => {
  const calls = []; const f = await fixture({ skipTools: tools(calls), skipDelayMs: 0, autoSkips: true }); t.after(() => f.close());
  await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime'); await f.app.skips.wait();
  const before = calls.length; await f.video('Serie S01E03.mp4', 'Anime'); await f.app.skips.wait();
  assert.equal(calls.length - before, 2, 'Solo il nuovo episodio: le impronte degli altri sono già in cache');
  assert.equal(f.app.skips.overview().series['Anime/Serie'].ready, 3);
});

test('se gli strumenti mancano non si ritenta a ogni scansione finché i file non cambiano', async t => {
  let attempts = 0; const broken = { async probe() { attempts++; throw new Error('niente ffprobe'); }, async fingerprint() { throw new Error('x'); }, async black() { return []; } };
  const f = await fixture({ skipTools: broken, skipDelayMs: 0, autoSkips: true }); t.after(() => f.close());
  await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime'); await f.app.skips.wait();
  const first = attempts; assert.ok(first >= 2);
  await f.app.library.scan(); await f.app.skips.wait(); await f.app.library.scan(); await f.app.skips.wait();
  assert.equal(attempts, first);
});

test('durante una riproduzione l’analisi aspetta', async t => {
  const calls = []; const f = await fixture({ skipTools: tools(calls), skipDelayMs: 0, autoSkips: true, skipPlaybackWindowMs: 150, skipPlaybackPollMs: 20 }); t.after(() => f.close());
  await f.video('Serie S01E01.mp4', 'Anime'); f.app.skips.noteActivity();
  await f.video('Serie S01E02.mp4', 'Anime');
  await new Promise(r => setTimeout(r, 60)); assert.equal(calls.length, 0, 'Sta guardando qualcuno: ancora ferma');
  await f.app.skips.wait(); assert.equal(calls.length, 4);
});
