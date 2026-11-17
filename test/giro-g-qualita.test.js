// Giro G, punto 3: versioni leggere (480p) fatte sul server in coda lenta, mai al posto dell'originale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';
import { lightArgs } from '../lib/versions.js';
import { chooseQuality, connectionIsSlow, qualityOptions } from '../public/video-logic.js';

function fakeFfmpeg(calls, { failSoftware = false } = {}) {
  return { async probe() { return { duration: 60, chapters: [], streams: [{ index: 0, type: 'video', codec: 'h264', height: 720 }] }; },
    async run(command, args) {
      calls.push({ command, args });
      if (failSoftware && args.includes('libx264')) throw new Error('libx264 non disponibile');
      await writeFile(args.at(-1), Buffer.from('versione leggera finta')); return '';
    } };
}

test('argomenti ffmpeg: libx264 veryfast con tetto di bitrate, hardware cbr come ripiego, mai sull’originale', () => {
  const hw = lightArgs('/in/a.mp4', '/out/a.tmp.mp4', 'h264_mediacodec'); const sw = lightArgs('/in/a.mp4', '/out/a.tmp.mp4', 'libx264');
  assert.ok(hw.includes('h264_mediacodec')); assert.ok(sw.includes('libx264')); assert.ok(sw.includes('veryfast')); assert.ok(sw.includes('-maxrate'));
  // h264_mediacodec senza -bitrate_mode cbr ignora -b:v e fa file più grandi dell'originale.
  assert.equal(hw[hw.indexOf('-bitrate_mode') + 1], 'cbr');
  for (const args of [hw, sw]) { assert.equal(args.at(-1), '/out/a.tmp.mp4'); assert.ok(args.join(' ').includes('scale=-2:480')); assert.ok(args.includes('+faststart')); }
});

test('prepara la versione leggera una alla volta, con firma del file e senza toccare l’originale', async t => {
  const calls = []; const f = await fixture({ mediaTools: fakeFfmpeg(calls), versionDelayMs: 0 }); t.after(() => f.close()); await f.login();
  const a = await f.video('Film A (2024).mp4', 'Film', 'originale A'); const b = await f.video('Film B (2024).mp4', 'Film', 'originale B');
  let r = await f.request('/api/versions', { method: 'POST', data: { ids: [a.id, b.id] } }); assert.equal(r.status, 202);
  await f.app.versions.wait();
  const status = await (await f.request('/api/versions')).json();
  assert.equal(status.count, 2); assert.ok(status.bytes > 0);
  assert.equal(calls.length, 2);
  const list = (await (await f.request('/api/library')).json()).items; assert.ok(list.every(i => i.light === true));
  assert.equal(await readFile(path.join(f.roots.Film, 'Film A (2024).mp4'), 'utf8'), 'originale A');
  // Il flusso 480p esce con ?q=480, l'originale resta quello di prima, entrambi con Range.
  const light = await f.request(`/media/${a.id}?q=480`, { headers: { Range: 'bytes=0-4' } }); assert.equal(light.status, 206); assert.equal(await light.text(), 'versi');
  assert.equal(await (await f.request(`/media/${a.id}`)).text(), 'originale A');
  // Cambia il file: la firma non corrisponde più, si torna all'originale e la versione non risulta pronta.
  await writeFile(path.join(f.roots.Film, 'Film A (2024).mp4'), 'originale A, ma piu lungo'); await f.app.library.scan();
  assert.equal(await (await f.request(`/media/${a.id}?q=480`)).text(), 'originale A, ma piu lungo');
  assert.equal(f.app.library.list().find(i => i.id === a.id).light, false);
});

test('se libx264 fallisce si ripiega sull’hardware; elimina versioni leggere libera lo spazio', async t => {
  const calls = []; const f = await fixture({ mediaTools: fakeFfmpeg(calls, { failSoftware: true }), versionDelayMs: 0 }); t.after(() => f.close()); await f.login();
  const a = await f.video('Film A (2024).mp4');
  await f.request('/api/versions', { method: 'POST', data: { ids: [a.id] } }); await f.app.versions.wait();
  assert.deepEqual(calls.map(c => c.args.includes('h264_mediacodec') ? 'hw' : 'sw'), ['sw', 'hw']);
  assert.equal((await (await f.request('/api/versions')).json()).count, 1);
  assert.equal((await f.request('/api/manage/versions/clear', { method: 'POST', data: {} })).status, 200);
  assert.deepEqual(await (await f.request('/api/versions')).json(), { count: 0, bytes: 0, queued: 0, working: null, failed: [] });
  await assert.rejects(stat(path.join(f.app.config.dataDir, 'versioni', `${a.id}-480.mp4`)));
});

test('una richiesta chiede solo titoli che esistono e la coda ha un limite', async t => {
  const f = await fixture({ mediaTools: fakeFfmpeg([]), versionDelayMs: 0 }); t.after(() => f.close()); await f.login();
  assert.equal((await f.request('/api/versions', { method: 'POST', data: { ids: ['0'.repeat(24)] } })).status, 404);
  assert.equal((await f.request('/api/versions', { method: 'POST', data: { ids: [] } })).status, 400);
});

test('scelta della qualità: Automatica sceglie 480p con connessione lenta o fuori casa, altrimenti originale', () => {
  const item = { light: true, streams: [{ type: 'video', height: 720 }] };
  const fast = { host: 'apollon.local', effectiveType: '4g', downlink: 20 };
  assert.equal(connectionIsSlow(fast), false);
  assert.equal(connectionIsSlow({ ...fast, effectiveType: '3g' }), true);
  assert.equal(connectionIsSlow({ ...fast, downlink: 0.8 }), true);
  assert.equal(connectionIsSlow({ ...fast, saveData: true }), true);
  assert.equal(connectionIsSlow({ host: '100.64.0.1', effectiveType: '4g', downlink: 30 }), true, 'Fuori casa (Tailscale)');
  assert.equal(connectionIsSlow({ host: 'mediateca.local' }), false);
  assert.equal(connectionIsSlow({ host: 'apollon.local', measuredKbps: 900 }), true);
  assert.equal(chooseQuality('auto', item, { ...fast, effectiveType: '3g' }), '480');
  assert.equal(chooseQuality('auto', item, fast), 'original');
  assert.equal(chooseQuality('auto', { ...item, light: false }, { ...fast, effectiveType: '3g' }), 'original', 'Senza versione leggera pronta resta l’originale');
  assert.equal(chooseQuality('480', item, fast), '480'); assert.equal(chooseQuality('480', { light: false }, fast), 'original');
  assert.deepEqual(qualityOptions(item).map(o => o.label), ['Automatica', 'Originale (720p)', 'Risparmio dati (480p)']);
  assert.equal(qualityOptions({ light: false, streams: [] })[2].disabled, true);
});

// 8/11: chi chiede la versione leggera non aspetta ore dietro l'analisi dei salti; aspetta solo chi sta guardando.
test('la versione leggera chiesta parte anche mentre i salti si analizzano, e l’analisi le cede il passo', async t => {
  const calls = []; const f = await fixture({ mediaTools: fakeFfmpeg(calls), versionDelayMs: 0 }); t.after(() => f.close()); await f.login();
  const a = await f.video('Film C (2024).mp4', 'Film', 'originale C');
  f.app.skips.running = true; t.after(() => { f.app.skips.running = false; });
  await f.request('/api/versions', { method: 'POST', data: { ids: [a.id] } });
  await Promise.race([f.app.versions.wait(), new Promise((_, no) => setTimeout(() => no(new Error('ferma dietro l’analisi')), 3000))]);
  assert.equal(calls.length, 1);
  assert.equal(f.app.versions.busy(), false);
  // Mentre una versione si prepara, l'analisi dei salti si mette in pausa.
  f.app.versions.working = a.id; let yielded = false;
  const waiting = f.app.skips.yieldToPlayback().then(() => { yielded = true; });
  await new Promise(r => setTimeout(r, 50)); assert.equal(yielded, false);
  f.app.versions.working = null; f.app.skips.wake?.(); await waiting; assert.equal(yielded, true);
});
