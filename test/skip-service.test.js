import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, utimes } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';
import { STEP } from '../lib/skips.js';
import { SkipService } from '../lib/skip-service.js';
import { Store } from '../lib/store.js';
import { analyzeSeason } from '../scripts/analizza-salti.js';
import { playbackAction } from '../public/logic.js';

test('recap 0–0,8 s pubblicato dopo correzione: lo snapshot vecchio non contiene i nuovi tempi', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login(); await f.video('Serie S01E01.mp4', 'Anime');
  const before = (await (await f.request('/api/library')).json()).items[0];
  assert.equal(playbackAction(before, 0.3, 12, false), null);
  assert.equal((await f.request('/api/manage/skips/edit', { method: 'POST', data: { id: before.id, salti: { riassunto: [0, 0.8], sigla: [1, 3] } } })).status, 200);
  const after = (await (await f.request('/api/library')).json()).items[0];
  assert.equal(playbackAction(before, 0.3, 12, false), null);
  assert.equal(playbackAction(after, 0.3, 12, false).kind, 'riassunto');
});

function words(seed, n) { return Array.from({ length: n }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; }); }
function tools(calls) {
  return { async probe() { return { duration: 900, chapters: [{ start: 0, end: 9, title: 'Recap' }] }; },
    async fotogrammi() { return Buffer.alloc(900 * 2 * 9); },
    async fingerprint(file, offset) { calls.push({ file, offset }); const episode = file.includes('E02') ? 2 : 1; return { offset, words: [...words(episode, 120 + episode * 30), ...words(offset ? 81 : 71, 200), ...words(episode + 8, 300)] }; },
    async black() { return []; } };
}
test('coda locale per stagione, cache riusata e salti esposti senza percorsi', async t => {
  const calls = []; const f = await fixture({ skipTools: tools(calls), skipDelayMs: 0 }); t.after(() => f.close());
  const a = await f.video('Serie S01E01.mp4', 'Anime'); const b = await f.video('Serie S01E02.mp4', 'Anime');
  await f.video('Serie S02E01.mp4', 'Anime');
  assert.equal((await f.request('/api/manage/skips/analyze', { method: 'POST', data: { id: a.id } })).status, 401);
  await f.login(); assert.equal((await f.request('/api/manage/skips/analyze', { method: 'POST', data: { id: a.id } })).status, 202);
  await f.app.skips.wait();
  assert.equal(calls.length, 4); assert.equal(f.app.skips.status().failed, 0);
  assert.equal(f.app.skips.cache.get(a.id).windows, undefined, 'Le impronte complete restano su disco, non in memoria per tutta la raccolta.');
  const first = f.app.library.get(a.id); assert.ok(first.salti.sigla); assert.ok(first.salti.finale); assert.deepEqual(first.salti.riassunto, [0, 9]);
  assert.equal(first.fontiSalti.sigla, 'impronta'); assert.ok(f.app.library.get(b.id).salti.sigla);
  assert.equal(f.app.library.list().find(i => i.id === a.id).path, undefined);
  await f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.equal(calls.length, 4);
  const cache = JSON.parse(await readFile(path.join(f.app.config.dataDir, 'salti', `${a.id}.json`), 'utf8')); assert.ok(cache.salti.sigla);
});
test('correzioni a mano persistenti, copia solo a impronta uguale mantenendo lo sfalsamento', async t => {
  const f = await fixture({ skipTools: tools([]), skipDelayMs: 0 }); t.after(() => f.close()); await f.login();
  const a = await f.video('Serie S01E01.mp4', 'Anime'); const b = await f.video('Serie S01E02.mp4', 'Anime'); const c = await f.video('Serie S02E01.mp4', 'Anime');
  await f.app.skips.enqueue(a.id); await f.app.skips.wait();
  const original = f.app.library.get(a.id).salti.sigla; const other = f.app.library.get(b.id).salti.sigla;
  const corrected = [original[0] + 0.5, original[1] - 1];
  let r = await f.request('/api/manage/skips/edit', { method: 'POST', data: { id: a.id, salti: { sigla: corrected }, sameOpening: true } }); assert.equal(r.status, 200);
  assert.deepEqual(f.app.library.get(a.id).salti.sigla, corrected);
  assert.ok(Math.abs(f.app.library.get(b.id).salti.sigla[0] - other[0] - 0.5) < 0.01);
  assert.equal(f.app.library.get(c.id).salti.sigla, undefined);
  r = await f.request('/api/manage/skips/edit', { method: 'POST', data: { id: a.id, salti: { sigla: [8, 20] } } }); assert.equal(r.status, 400);
  await f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.deepEqual(f.app.library.get(a.id).salti.sigla, corrected);
  await f.request('/api/manage/skips/edit', { method: 'POST', data: { id: a.id, salti: { sigla: null } } }); assert.equal(f.app.library.get(a.id).salti.sigla, null);
});
test('AniSkip spento di base: nessuna richiesta; opt-in invia soltanto MAL ed episodio, errori recuperabili', async t => {
  const calls = []; const f = await fixture({ skipTools: { ...tools([]), async aniSkip(mal, episode) { calls.push([mal, episode]); return { found: true, results: [{ skipType: 'recap', interval: { startTime: 0, endTime: 8 } }] }; } }, skipDelayMs: 0 }); t.after(() => f.close()); await f.login();
  const a = await f.video('Solo S01E01.mp4', 'Anime');
  assert.equal((await (await f.request('/api/manage/skips')).json()).aniskip, false);
  await f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.equal(calls.length, 0);
  assert.equal((await f.request('/api/manage/skips/settings', { method: 'POST', data: { aniskip: true, id: a.id, malId: 123 } })).status, 200);
  await f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.deepEqual(calls, [[123, 1]]);
  await f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.equal(calls.length, 1);
});
test('preferenze video per profilo persistono e sono validate', async t => {
  const f = await fixture(); t.after(() => f.close());
  const put = data => f.request('/api/profiles/preferences', { method: 'PUT', data });
  assert.equal((await put({ profile: 'bruno', autoSkip: true, autoNext: false })).status, 200);
  const profiles = (await (await f.request('/api/bootstrap')).json()).profiles;
  assert.equal(profiles.find(p => p.id === 'bruno').autoSkip, true); assert.equal(profiles.find(p => p.id === 'marta').autoSkip, undefined);
  assert.equal((await put({ profile: 'bruno', autoSkip: 'sì' })).status, 400);
  assert.equal((await put({ profile: 'assente', autoSkip: true })).status, 404);
  const restored = await new Store(f.app.config.dataDir).init(); assert.equal(restored.data.profiles[0].autoSkip, true);
});

test('cache e correzioni rilette dal disco; sostituzione del video invalida tempi e sigla manuale', async t => {
  const calls = []; const f = await fixture({ skipTools: tools(calls), skipDelayMs: 0 }); t.after(() => f.close());
  const a = await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime');
  await f.app.skips.enqueue(a.id); await f.app.skips.wait();
  await f.app.skips.edit(a.id, { sigla: [20, 30] });
  const fresh = await new SkipService(f.app.config, f.app.library, f.app.files, f.app.store, tools(calls)).init();
  try { fresh.enqueue(a.id); await fresh.wait(); assert.equal(calls.length, 4); assert.deepEqual(f.app.library.get(a.id).salti.sigla, [20, 30]); }
  finally { await fresh.close(); f.app.library.skips = f.app.skips; }
  await writeFile(path.join(f.roots.Anime, a.path), 'un video finto completamente sostituito e di diversa dimensione'); await f.app.library.scan();
  assert.equal(f.app.library.get(a.id).salti.sigla, undefined);
});
test('coda e anteprime mai simultanee; fermata interrompe il processo di analisi', async t => {
  let active = 0; let peak = 0; let started; const began = new Promise(r => { started = r; });
  const f = await fixture({ metadata: true, metadataDelayMs: 0, skipDelayMs: 0,
    mediaTools: { async probe() { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 10)); active--; return { duration: 900, streams: [] }; }, async run(command, args) { await writeFile(args.at(-1), 'immagine finta'); } },
    skipTools: { ...tools([]), async fingerprint(file, offset, length, signal) { active++; peak = Math.max(peak, active); started(); await new Promise(resolve => { if (signal.aborted) resolve(); else signal.addEventListener('abort', resolve, { once: true }); }); active--; throw new Error('Interrotto'); } }
  }); t.after(() => f.close());
  const a = await f.video('Serie S01E01.mp4', 'Anime'); f.app.skips.enqueue(a.id); await began;
  await f.app.skips.close(); assert.equal(peak, 1); assert.equal(active, 0); assert.equal(f.app.skips.running, false);
});
test('comando PC offline riusa la stessa coda anche quando AniSkip è abilitato nello stato', async t => {
  const f = await fixture(); t.after(() => f.close()); const a = await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime');
  await f.app.skips.setSettings({ id: a.id, malId: 123, aniskip: true }); let outgoing = 0;
  const result = await analyzeSeason(f.app.config, 'Serie', 1, { tools: { ...tools([]), async aniSkip() { outgoing++; return {}; } } });
  assert.equal(result.failed, 0); assert.equal(result.items.length, 2); assert.ok(result.items[0].salti.sigla); assert.equal(outgoing, 0);
});
test('rinomina conserva cache e correzioni senza rifare le impronte', async t => {
  const calls = []; const f = await fixture({ skipTools: tools(calls), skipDelayMs: 0 }); t.after(() => f.close()); await f.login();
  const a = await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime');
  f.app.skips.enqueue(a.id); await f.app.skips.wait(); await f.app.skips.edit(a.id, { sigla: [21, 34] });
  const move = f.app.files.move.bind(f.app.files);
  f.app.files.move = async (...args) => { const result = await move(...args); const time = new Date(Date.now() + 5000); await utimes(path.join(f.roots.Anime, args[2]), time, time); return result; };
  const result = await f.request('/api/manage/move', { method: 'POST', data: { root: 'Anime', from: a.path, to: 'Serie S01E01 Nuovo.mp4' } }); assert.equal(result.status, 200);
  const renamed = f.app.library.list().find(i => i.episode === 1);
  assert.deepEqual(renamed.salti.sigla, [21, 34]);
  f.app.skips.enqueue(renamed.id); await f.app.skips.wait(); assert.equal(calls.length, 4);
});
test('strumento mancante e AniSkip guasto non impediscono video; analisi recuperabile', async t => {
  let broken = true; const f = await fixture({ skipTools: { ...tools([]), async fingerprint(...args) { if (broken) throw new Error('Manca Chromaprint'); return tools([]).fingerprint(...args); }, async aniSkip() { throw new Error('Offline'); } }, skipDelayMs: 0 }); t.after(() => f.close());
  const a = await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime');
  f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.equal(f.app.skips.status().failed, 2);
  assert.equal((await f.request(`/media/${a.id}`)).status, 200);
  broken = false; await f.app.skips.setSettings({ aniskip: true, id: a.id, malId: 123 }); f.app.skips.enqueue(a.id); await f.app.skips.wait();
  assert.equal(f.app.skips.status().failed, 2); assert.ok(f.app.library.get(a.id).salti.sigla);
});
test('cambiare ID MAL elimina suggerimenti della stagione sbagliata e conserva quelli locali', async t => {
  const f = await fixture({ skipTools: { ...tools([]), async aniSkip(mal) { return { found: true, results: [{ skipType: 'op', interval: { startTime: mal === 111 ? 10 : 40, endTime: mal === 111 ? 30 : 60 } }] }; } }, skipDelayMs: 0 }); t.after(() => f.close());
  const a = await f.video('Solo S01E01.mp4', 'Anime');
  await f.app.skips.setSettings({ aniskip: true, id: a.id, malId: 111 }); f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.deepEqual(f.app.library.get(a.id).salti.sigla, [10, 30]);
  await f.app.skips.setSettings({ aniskip: true, id: a.id, malId: 222 }); assert.equal(f.app.library.get(a.id).salti.sigla, undefined);
  f.app.skips.enqueue(a.id); await f.app.skips.wait(); assert.deepEqual(f.app.library.get(a.id).salti.sigla, [40, 60]); assert.deepEqual(f.app.library.get(a.id).salti.riassunto, [0, 9]);
});
test('un episodio con due musiche non collega due sigle diverse per la correzione di stagione', async t => {
  const x = words(717, 160); const y = words(818, 160);
  const f = await fixture({ skipDelayMs: 0, skipTools: { ...tools([]), async fingerprint(file, offset) {
    const ep = Number(/E0(\d)/.exec(file)[1]);
    if (offset) return { offset, words: words(ep, 600) };
    return { offset, words: ep === 1 ? [...words(1, 150), ...x, ...words(11, 650)] : ep === 2 ? [...words(2, 180), ...x, ...words(12, 150), ...y, ...words(13, 300)] : [...words(3, 280), ...y, ...words(14, 650)] };
  } } }); t.after(() => f.close());
  const a = await f.video('Serie S01E01.mp4', 'Anime'); await f.video('Serie S01E02.mp4', 'Anime'); const c = await f.video('Serie S01E03.mp4', 'Anime');
  f.app.skips.enqueue(a.id); await f.app.skips.wait(); const old = f.app.library.get(c.id).salti.sigla;
  const result = await f.app.skips.edit(a.id, { sigla: [21, 34] }, true);
  assert.equal(result.updated, 2); assert.deepEqual(f.app.library.get(c.id).salti.sigla, old);
});
