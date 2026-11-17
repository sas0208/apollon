// Giro G, punto 5 (musica): la copertina vera sta DENTRO i file; si estrae da sola, una per album, con cache e firma.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture, fakeNavidrome } from './helpers.js';
import { sourceArgs, sizeArgs, mosaicArgs, coverTarget } from '../lib/music-art.js';

// ffmpeg finto: scrive l'ultimo argomento; se il file di ingresso si chiama «senzacopertina» l'estrazione incorporata fallisce.
function fakeTools(calls) {
  return { async probe() { return { duration: 1, chapters: [], streams: [] }; },
    async run(command, args) {
      const input = args[args.indexOf('-i') + 1]; calls.push({ input: path.basename(input), embedded: args.includes('-an'), out: path.basename(args.at(-1)) });
      if (args.includes('-an') && /senzacopertina/.test(input)) throw new Error('Output file does not contain any stream');
      await writeFile(args.at(-1), Buffer.from(`jpg:${path.basename(input)}`)); return '';
    } };
}
const song = (id, title, folder, extra = {}) => ({ id, title, path: `${folder}/${title}.mp3`, artist: 'Artista', artistId: 'r1', album: folder.split('/').at(-1), albumId: `a-${folder}`, coverArt: `mf-${id}`, duration: 8, ...extra });
async function setup(t, songs, files, options = {}) {
  const nav = await fakeNavidrome({ songs }); t.after(() => nav.close());
  const calls = []; const f = await fixture({ navidromeUrl: nav.url, mediaTools: fakeTools(calls), musicArtDelayMs: 0, ...options }); t.after(() => f.close());
  for (const [rel, body] of Object.entries(files)) { await mkdir(path.join(f.roots.Musica, path.dirname(rel)), { recursive: true }); await writeFile(path.join(f.roots.Musica, rel), body); }
  await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  const cover = async (id, size = 400) => f.request(`/api/music/cover?id=${encodeURIComponent(id)}&size=${size}`);
  const coverCalls = () => nav.calls.filter(c => c.method === 'getCoverArt').length;
  // L'indice dei brani si riempie quando la musica viene aperta (qui: una raccolta del catalogo); solo allora la richiesta conosce le cartelle.
  const warm = async () => { const dir = path.join(f.roots.Musica, 'Libreria'); await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'catalogo_musica.json'), JSON.stringify({ versione: 1, mood: [{ nome: 'E' }], generi: [], brani: [{ file: 'x.mp3', mood: ['E'], genere: 'Pop' }] }));
    await f.request('/api/music/collection?type=mood&name=E'); };
  return { f, nav, calls, cover, coverCalls, warm };
}

test('argomenti ffmpeg: copertina incorporata, ridimensionamenti e mosaico', () => {
  const a = sourceArgs('/m/a.mp3', '/c/x.jpg', { embedded: true }); assert.ok(a.includes('-an')); assert.ok(a.includes('0:v:0')); assert.ok(a.join(' ').includes('scale=1000'));
  assert.ok(!sourceArgs('/m/cover.png', '/c/x.jpg', { embedded: false }).includes('-an'));
  assert.ok(sizeArgs('/c/x.jpg', '/c/y.jpg', 160).join(' ').includes('crop=160:160'));
  const m = mosaicArgs(['/1', '/2'], '/out.jpg'); assert.ok(m.join(' ').includes('xstack=inputs=4')); assert.equal(m.filter(x => x === '-i').length, 4);
});

test('copertina incorporata: su richiesta solo cache (mai ffmpeg); prodotta dalla passata lenta, poi usata al posto di Navidrome', async t => {
  const songs = [song('s1', 'Uno', 'Artista/Album A')];
  const { f, calls, cover, coverCalls, warm } = await setup(t, songs, { 'Artista/Album A/Uno.mp3': 'x' }, { autoMusicArt: false }); await warm();
  const first = await cover('mf-s1', 160); assert.equal(first.status, 200); assert.doesNotMatch(await first.text(), /^jpg:/, 'Cache vuota: risponde Navidrome');
  assert.equal(calls.length, 0, 'Su richiesta nessuna estrazione'); assert.equal(coverCalls(), 1);
  await f.app.musicArt.crawl(); assert.equal(calls.filter(c => c.embedded).length, 1, 'Un solo estratto per album');
  const r = await cover('mf-s1', 160); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.match(await r.text(), /^jpg:/);
  const n = calls.length; await cover('mf-s1', 160); await cover('al-a-Artista/Album A', 400);
  assert.equal(calls.length, n, 'Dalla cache, senza ffmpeg'); assert.equal(coverCalls(), 1, 'Navidrome non serve più');
  // Cambia il brano: la firma non corrisponde più, la strada completa (non solo cache) la rifà.
  await writeFile(path.join(f.roots.Musica, 'Artista/Album A/Uno.mp3'), 'x più lungo'); await f.app.musicArt.forRequest('mf-s1', 160, songs);
  assert.equal(calls.filter(c => c.embedded).length, 2);
});

test('senza copertina incorporata si usa cover.jpg / folder.jpg della cartella, poi Navidrome, poi (client) quella generata', async t => {
  const { f, cover, coverCalls, calls, warm } = await setup(t, [song('s2', 'senzacopertina', 'Artista/Album B'), song('s3', 'senzacopertina', 'Artista/Album C')],
    { 'Artista/Album B/senzacopertina.mp3': 'x', 'Artista/Album B/Folder.JPG': 'img', 'Artista/Album C/senzacopertina.mp3': 'x' }, { autoMusicArt: false }); await warm();
  await cover('mf-s2'); assert.equal(calls.length, 0, 'Su richiesta nessuna estrazione'); assert.equal(coverCalls(), 1, 'Cache vuota: Navidrome');
  await f.app.musicArt.crawl();
  const b = await cover('mf-s2'); assert.equal(b.status, 200); assert.match(await b.text(), /^jpg:/);
  assert.equal(calls.some(c => c.embedded === false && c.input === 'Folder.JPG'), true);
  assert.equal(coverCalls(), 1, 'Album B non chiede più a Navidrome');
  const c = await cover('mf-s3'); assert.equal(c.status, 200); assert.equal(coverCalls(), 2, 'Ripiego su Navidrome');
});

test('artista: artist.jpg se c’è, altrimenti mosaico delle copertine dei suoi album', async t => {
  const songs = [song('a1', 'Uno', 'Gruppo/Primo'), song('a2', 'Due', 'Gruppo/Secondo'), song('b1', 'Tre', 'Solista/Disco', { artistId: 'r2', artist: 'Solista' })];
  const { f, cover, calls, coverCalls, warm } = await setup(t, songs, { 'Gruppo/Primo/Uno.mp3': 'x', 'Gruppo/Secondo/Due.mp3': 'x', 'Solista/Disco/Tre.mp3': 'x', 'Solista/artist.jpg': 'foto' }, { autoMusicArt: false }); await warm();
  await cover('ar-r1'); assert.equal(calls.length, 0, 'Su richiesta nessuna estrazione'); assert.equal(coverCalls(), 1);
  // Gli artisti si producono sulla strada completa (non solo cache); poi la richiesta li serve dalla cache.
  await f.app.musicArt.forRequest('ar-r1', 400, songs); await f.app.musicArt.forRequest('ar-r2', 400, songs);
  const mosaic = await cover('ar-r1'); assert.equal(mosaic.status, 200); assert.match(await mosaic.text(), /^jpg:/); assert.ok(calls.some(c => c.out.endsWith('-mosaico.tmp.jpg')));
  const photo = await cover('ar-r2'); assert.ok(calls.some(c => c.input === 'artist.jpg')); assert.equal(photo.status, 200); assert.match(await photo.text(), /^jpg:/);
  assert.equal(coverCalls(), 1, 'Dopo la produzione Navidrome non serve');
});

test('prima passata lenta: una copertina per album senza che nessuno la chieda; stato in gestione', async t => {
  const { f, calls } = await setup(t, [], { 'X/Uno/a.mp3': 'x', 'X/Due/b.mp3': 'x' }, { autoMusicArt: false });
  await f.app.musicArt.crawl(); assert.equal(calls.filter(c => c.embedded).length, 2);
  assert.deepEqual([f.app.musicArt.status().albums, f.app.musicArt.status().withArt], [2, 2]);
  await f.app.musicArt.crawl(); assert.equal(calls.filter(c => c.embedded).length, 2, 'Seconda passata: tutto già in cache');
});

test('coverTarget: riconosce brano, album e artista', () => {
  const songs = [{ id: 's', coverArt: 'mf-s', albumId: 'a', artistId: 'r', path: 'A/B/c.mp3' }];
  assert.deepEqual({ ...coverTarget('mf-s', songs) }, { type: 'album', paths: ['A/B/c.mp3'], album: '', artist: '' });
  assert.equal(coverTarget('al-a', songs).type, 'album'); assert.equal(coverTarget('ar-r', songs).type, 'artist');
  assert.equal(coverTarget('mf-zzz', songs), null);
});
