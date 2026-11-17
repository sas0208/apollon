// Il server dice da dove viene la locandina (images.source); il client scrive il titolo sopra SOLO per 'fotogramma' e 'generata'.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';

const idle = async library => { for (let i = 0; i < 400 && (library.running || library.jobs.length); i++) await new Promise(r => setTimeout(r, 10)); await library.workTask; };

test('locandina: images.source = file | incorporata | online | fotogramma | generata', async t => {
  const tools = { async probe(file) { return { duration: 600, streams: [{ type: 'video', codec: 'h264', index: 0 }, ...(/Serie C/.test(file) ? [{ type: 'cover', codec: 'mjpeg', index: 1 }] : [])] }; },
    async run(command, args, timeout, signal, mode) {
      if (mode === 'binary') return Buffer.alloc(160 * 90 * 3, 90);
      const input = args[args.indexOf('-i') + 1];
      for (const out of args.filter(a => a.endsWith('.jpg') && a !== input)) await writeFile(out, 'img'); return '';
    } };
  const f = await fixture({ metadata: true, metadataDelayMs: 1, mediaTools: tools, smartFrames: false }); t.after(() => f.close());
  for (const s of ['Serie A', 'Serie B', 'Serie C', 'Serie D']) { await mkdir(path.join(f.roots.Anime, s), { recursive: true }); await writeFile(path.join(f.roots.Anime, s, `${s} - 001.mp4`), 'v'); }
  await writeFile(path.join(f.roots.Anime, 'Serie A', 'poster.jpg'), 'p');
  const sourceOf = name => f.app.library.decorate(f.app.library.items.find(i => i.series === name)).images.source;
  // Prima che l'immagine sia pronta: disegno di ripiego.
  await f.app.library.scan();
  assert.equal(sourceOf('Serie B'), 'generata');
  await idle(f.app.library);
  assert.equal(sourceOf('Serie A'), 'file', 'immagine accanto al video');
  assert.equal(sourceOf('Serie B'), 'fotogramma', 'solo un fotogramma del video');
  assert.equal(sourceOf('Serie C'), 'incorporata', 'copertina dentro il file');
  // Copertine ufficiali accese: la locandina viene da internet.
  f.app.library.onlineArt = { enabled: () => true, get: async (kind, query, what) => (what === 'poster' ? path.join(f.dir, 'ufficiale.jpg') : null) };
  await writeFile(path.join(f.dir, 'ufficiale.jpg'), 'o');
  f.app.library.queueArt?.(); await f.app.library.scan(); await idle(f.app.library);
  assert.equal(sourceOf('Serie D'), 'online');
  assert.equal(sourceOf('Serie A'), 'file', 'l’immagine accanto al video vince sempre su internet');
});

test('client: il titolo sta sempre sulla locandina, anche con la copertina ufficiale', async () => {
  const js = await readFile(new URL('../public/video-app.js', import.meta.url), 'utf8');
  assert.ok(!js.includes('titleOnArt'));
  assert.ok(js.includes("el('span', { class: 't-name', 'aria-hidden': 'true' }, t.title)"));
  const lib = await readFile(new URL('../lib/library.js', import.meta.url), 'utf8');
  for (const name of ['online', 'file', 'incorporata', 'fotogramma', 'generata']) assert.ok(lib.includes(`'${name}'`), name);
});
