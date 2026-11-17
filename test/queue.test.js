import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';

async function idle(library) {
  for (let n = 0; n < 300 && (library.running || library.jobs.length); n++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(library.running, false); assert.equal(library.jobs.length, 0);
}
test('metadati in coda singola anche durante una nuova scansione, cache riusata', async t => {
  let active = 0; let peak = 0; const probes = [];
  const tools = {
    async probe(file) { active++; peak = Math.max(peak, active); probes.push(path.basename(file)); await new Promise(resolve => setTimeout(resolve, 15)); active--; return { duration: 12, streams: [{ type: 'video', codec: 'h264' }] }; },
    async run(command, args) { active++; peak = Math.max(peak, active); await writeFile(args.at(-1), 'immagine finta'); active--; }
  };
  const f = await fixture({ metadata: true, metadataDelayMs: 1, mediaTools: tools }); t.after(() => f.close());
  await f.video('Primo.mp4'); await f.video('Secondo.mp4'); await idle(f.app.library);
  assert.equal(peak, 1); assert.equal(probes.length, 2);
  assert.ok(f.app.library.items.every(i => i.duration === 12 && i.image));
  await f.app.library.scan(); await idle(f.app.library); assert.equal(probes.length, 2);
  await unlink(path.join(f.app.library.cacheDir, `${f.app.library.items[0].id}.jpg`));
  await f.app.library.scan(); await idle(f.app.library); assert.equal(probes.length, 3);
  await writeFile(path.join(f.roots.Film, 'Primo.mp4'), 'contenuto finto aggiornato');
  await f.app.library.scan(); await idle(f.app.library); assert.equal(probes.length, 4);
});
test('ffprobe mancante non impedisce il catalogo o la riproduzione', async t => {
  const f = await fixture({ metadata: true, metadataDelayMs: 1, mediaTools: { async probe() { throw new Error('Non installato'); }, async run() {} } }); t.after(() => f.close());
  const item = await f.video(); await idle(f.app.library);
  assert.match(f.app.library.get(item.id).metadataError, /riproducibile/);
  assert.equal((await f.request(`/media/${item.id}`)).status, 200);
  await f.app.library.retry(); await idle(f.app.library); assert.equal(f.app.library.items.length, 1);
});
