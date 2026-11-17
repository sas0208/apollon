import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, readFile, writeFile, stat, utimes, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fixture } from './helpers.js';
import { OnlineArt, normTitle } from '../lib/online-art.js';

const require = createRequire(import.meta.url);
const { norm, csv, importCovers } = require('../tools/importa-copertine.cjs');
const sharp = require(process.env.SHARP_PATH || 'sharp');
async function temp(t) {
  const base = path.resolve('output/tests'); await mkdir(base, { recursive: true });
  const dir = await mkdtemp(path.join(base, 'copertine-')); t.after(() => rm(dir, { recursive: true, force: true })); return dir;
}

test('copertine: CSV con BOM, punti e virgola, virgolette e titoli normalizzati come i loghi', () => {
  const rows = csv('\uFEFFtitle;portrait_file;landscape_file;note\r\n"Café: L’eroe; Zero";p.jpg;b.jpg;"una ""nota""\ncon a capo"\r\n');
  assert.equal(rows[0].title, 'Café: L’eroe; Zero'); assert.equal(rows[0].note, 'una "nota"\ncon a capo');
  for (const title of [rows[0].title, 'Re:Zero', '  Chainsaw   Man ', 'Ōkami/Kun']) assert.equal(norm(title), normTitle(title));
  assert.throws(() => csv('title;portrait_file\nX;p.jpg'), /landscape_file/);
  assert.throws(() => csv('title;portrait_file;landscape_file\n"X;p.jpg;b.jpg'), /virgolette/);
});

test('importatore: JPEG qualità 90, limiti senza ingrandire, sorgenti intatte, seconda passata stabile', async t => {
  const dir = await temp(t); const src = path.join(dir, 'src'); const out = path.join(dir, 'out');
  await mkdir(path.join(src, '01 - Verticali 2x3'), { recursive: true }); await mkdir(path.join(src, '02 - Orizzontali 16x9'));
  const inputs = [];
  for (const [folder, name, width, height] of [
    ['01 - Verticali 2x3', 'piccolo.png', 950, 1426], ['01 - Verticali 2x3', 'grande.png', 1600, 2400],
    ['02 - Orizzontali 16x9', 'grande.png', 3840, 2160], ['02 - Orizzontali 16x9', 'piccolo.png', 1280, 720]
  ]) {
    const file = path.join(src, folder, name); await sharp({ create: { width, height, channels: 3, background: '#458bad' } }).png().toFile(file);
    inputs.push([file, await readFile(file), (await stat(file)).mtimeMs]);
  }
  await writeFile(path.join(src, 'INDICE_COPERTINE.csv'), 'title;portrait_file;landscape_file\n"Café; Zero";piccolo.png;grande.png\nAltro;grande.png;piccolo.png\n');
  const quality = []; const recording = bytes => {
    const image = sharp(bytes); const jpeg = image.jpeg.bind(image);
    image.jpeg = options => { quality.push(options.quality); return jpeg(options); }; return image;
  }; recording.concurrency = sharp.concurrency;
  assert.deepEqual(await importCovers(src, out, { sharp: recording }), { fatti: 4, saltati: 0, titoli: 2, errori: [] });
  assert.deepEqual(quality, [90, 90, 90, 90]);
  const indexFile = path.join(out, 'indice.json'); const index = JSON.parse(await readFile(indexFile, 'utf8'));
  for (const [key, role, width, height] of [['cafe zero', 'poster', 950, 1426], ['cafe zero', 'backdrop', 1920, 1080], ['altro', 'poster', 960, 1440], ['altro', 'backdrop', 1280, 720]]) {
    const meta = await sharp(path.join(out, index[key][role])).metadata(); assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, width); assert.equal(meta.height, height);
  }
  const before = (await stat(indexFile)).mtimeMs;
  assert.deepEqual(await importCovers(src, out, { sharp }), { fatti: 0, saltati: 4, titoli: 2, errori: [] });
  assert.equal((await stat(indexFile)).mtimeMs, before);
  for (const [file, bytes, mtime] of inputs) { assert.deepEqual(await readFile(file), bytes); assert.equal((await stat(file)).mtimeMs, mtime); }
  await assert.rejects(importCovers(src, path.join(src, 'out'), { sharp }), /esterna alla sorgente/);
});

test('copertine: nomi mancanti o percorsi esterni non entrano nell’indice', async t => {
  const dir = await temp(t); const src = path.join(dir, 'src'); await mkdir(src);
  await writeFile(path.join(src, 'INDICE_COPERTINE.csv'), 'title;portrait_file;landscape_file\nEsterno;../fuori.jpg;\nMancante;manca.jpg;\nVuoto;;\n');
  const stats = await importCovers(src, path.join(dir, 'out'), { sharp });
  assert.equal(stats.titoli, 0); assert.equal(stats.errori.length, 2);
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'out', 'indice.json'), 'utf8')), {});
});

test('copertine: precedenza locale su AniList/Kitsu anche senza consenso online, solo anime e ricarica indice', async t => {
  const dir = await temp(t); const covers = path.join(dir, 'custom'); await mkdir(covers);
  for (const name of ['p.jpg', 'b.jpg']) await writeFile(path.join(covers, name), name);
  const indexFile = path.join(covers, 'indice.json');
  await writeFile(indexFile, JSON.stringify({ 'cafe zero': { poster: 'p.jpg', backdrop: 'b.jpg' }, assente: { poster: 'manca.jpg' }, esterno: { poster: '../p.jpg' } }));
  const online = await new OnlineArt({ dataDir: dir, localCoversDir: covers }, { data: {} }, { fetchImpl: () => { throw new Error('Nessuna rete'); } }).init(); online.localEvery = 0;
  const query = { title: 'Café: ZERO!' }; const key = online.keyFor('anime', query);
  online.index[key] = { poster: 'anilist.jpg', backdrop: 'kitsu.jpg', at: Date.now() };
  assert.equal(await online.get('anime', query), path.join(covers, 'p.jpg'));
  assert.equal(await online.get('anime', query, 'backdrop'), path.join(covers, 'b.jpg'));
  assert.equal(online.posterHasTitle('anime', query), true); assert.equal(online.posterHasTitle('film', query), false);
  assert.equal(online.localCover('film', query, 'poster'), null);
  assert.equal(online.localCover('anime', { title: 'Assente' }, 'poster'), null);
  assert.equal(online.localCover('anime', { title: 'Esterno' }, 'poster'), null);
  assert.equal(online.coversVersion('anime', { title: 'Sconosciuto' }), 0);
  const before = online.coversVersion('anime', query);
  await writeFile(indexFile, JSON.stringify({ 'cafe zero': { poster: 'p.jpg', backdrop: 'b.jpg' }, nuovo: { poster: 'p.jpg' } }));
  const later = new Date(Date.now() + 5000); await utimes(indexFile, later, later);
  assert.equal(online.coversVersion('anime', query), before, 'indice diverso ma titolo invariato');
  assert.ok(online.coversVersion('anime', { title: 'Nuovo' }));
  await writeFile(path.join(covers, 'p.jpg'), 'nuova locandina'); assert.notEqual(online.coversVersion('anime', query), before);
});

test('copertine: rigenerazione leggera una volta per serie, miniature intatte, titoli estranei invariati e cache HTTP aggiornata', async t => {
  const runs = []; let probes = 0;
  const tools = { async probe() { probes++; return { duration: 600, streams: [{ type: 'video', codec: 'h264', index: 0 }] }; },
    async run(command, args) {
      const input = args[args.indexOf('-i') + 1]; const outs = args.filter(a => a.endsWith('.jpg') && a !== input);
      runs.push({ input, outs }); for (const file of outs) await writeFile(file, `immagine-${runs.length}`);
    } };
  const f = await fixture({ metadataDelayMs: 0, mediaTools: tools, smartFrames: false }); t.after(() => f.close());
  for (const name of ['Serie - 01.mp4', 'Serie - 02.mp4', 'Estraneo.mp4']) await f.video(name, 'Anime');
  f.app.config.metadata = true; await f.app.library.work();
  const library = f.app.library; const series = library.items.filter(i => i.series === 'Serie');
  const stranger = library.items.find(i => !i.series); const beforeStranger = structuredClone(stranger);
  const thumbs = await Promise.all(series.map(i => readFile(path.join(library.cacheDir, `${i.id}.jpg`))));
  const versions = series.map(i => library.get(i.id).images.v);
  const online = f.app.onlineArt; online.localEvery = 0;
  await mkdir(online.coversDir); await writeFile(path.join(online.coversDir, 'poster.jpg'), 'poster inglese'); await writeFile(path.join(online.coversDir, 'backdrop.jpg'), 'sfondo');
  await writeFile(path.join(online.coversDir, 'indice.json'), JSON.stringify({ serie: { poster: 'poster.jpg', backdrop: 'backdrop.jpg' }, 'altro fuori libreria': { poster: 'poster.jpg' } }));
  runs.length = 0; probes = 0; library.queueArt(); await library.workTask;
  assert.equal(probes, 0); assert.equal(runs.length, 2, 'due conversioni condivise fra tutti gli episodi');
  assert.ok(runs.every(r => r.outs.every(file => /-(poster|poster-s|wide|wide-s)\.jpg$/.test(file))));
  assert.deepEqual(stranger, beforeStranger);
  for (const [n, item] of series.entries()) {
    assert.deepEqual(await readFile(path.join(library.cacheDir, `${item.id}.jpg`)), thumbs[n]);
    const decorated = library.get(item.id); assert.equal(decorated.images.posterTitle, true, 'anche senza alcun logo');
    assert.ok(decorated.images.cv); assert.notEqual(decorated.images.v, versions[n]); assert.equal(library.needsWork(item), false);
    assert.equal(await (await f.request(`/media/${item.id}/poster`)).text(), 'immagine-1');
    assert.equal(await (await f.request(`/media/${item.id}/backdrop?s=1280`)).text(), 'immagine-2');
  }
  runs.length = 0; library.queueArt(); await library.workTask; assert.equal(runs.length, 0);
  // Al riavvio la versione applicata resta valida, non riparte alcuna conversione.
  await online.init();
  const saved = JSON.parse(await readFile(library.file, 'utf8')).items;
  assert.equal(saved.every(i => !library.needsWork(i)), true);
});
