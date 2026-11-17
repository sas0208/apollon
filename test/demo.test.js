import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { demoPort, listenForTest } from '../scripts/test-ports.js';
import { startDemo } from '../scripts/demo.js';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { prepareDemoMusic } from '../scripts/demo-music.js';
import { fixture } from './helpers.js';
import { MusicCatalog, matchSongs } from '../lib/music-catalog.js';

test('demo rifiuta porte non riservate prima di leggere dati o avviare server', async () => {
  for (const port of [0, 8787, 8797, 8870.5, 8880, NaN]) {
    assert.throws(() => demoPort(port), /8870 e 8879/);
    await assert.rejects(startDemo({ port, metadata: false }), /8870 e 8879/);
  }
});

test('server di prova sceglie solo porte riservate e salta quelle occupate', async t => {
  const first = http.createServer(); const second = http.createServer();
  const listeners = { error: second.listenerCount('error'), listening: second.listenerCount('listening') };
  t.after(async () => {
    for (const server of [first, second]) if (server.listening) await new Promise(resolve => server.close(resolve));
  });
  const a = await listenForTest(first); const b = await listenForTest(second);
  assert.ok(a.port >= 8870 && a.port <= 8879);
  assert.ok(b.port >= 8870 && b.port <= 8879);
  assert.notEqual(a.port, b.port);
  assert.equal(a.address, '127.0.0.1');
  assert.equal(second.listenerCount('error'), listeners.error);
  assert.equal(second.listenerCount('listening'), listeners.listening);
});

test('demo genera catalogo e playlist Mood/Generi finti, tutti collegati per percorso', async t => {
  const f = await fixture(); t.after(() => f.close());
  await writeFile(path.join(f.roots.Musica, 'Luce di casa.wav'), 'tono finto');
  const songs = await prepareDemoMusic(f.roots.Musica);
  const data = JSON.parse(await readFile(path.join(f.roots.Musica, 'Libreria', 'catalogo_musica.json'), 'utf8'));
  assert.equal(matchSongs(data.brani, songs, 'Libreria').songs.length, 3);
  const home = await new MusicCatalog(f.app.files).home(); assert.equal(home.mood.length, 4);
  assert.equal(home.mood.find(m => m.nome === 'Relax').brani, 2);
  assert.match(await readFile(path.join(f.roots.Musica, 'Libreria/Mood/Relax.m3u8'), 'utf8'), /\.\.\/Brano finto 2.wav/);
});
