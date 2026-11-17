// Giro G, punto 5 (video/anime): immagini vere prima dei fotogrammi; fotogramma scelto bene; copertine ufficiali SPENTE di base.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fixture } from './helpers.js';
import { scoreFrame, samplePoints } from '../lib/frame-score.js';
import { pictureMatch, picturesSignature, artArgs } from '../lib/library.js';
import { OnlineArt, translateGenres, plainText } from '../lib/online-art.js';

const idle = async library => { for (let i = 0; i < 400 && (library.running || library.jobs.length); i++) await new Promise(r => setTimeout(r, 10)); await library.workTask; };
function frame(fn, w = 160, h = 90) { const b = Buffer.alloc(w * h * 3); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [r, g, bl] = fn(x, y); const i = (y * w + x) * 3; b[i] = r; b[i + 1] = g; b[i + 2] = bl; } return b; }
const black = frame(() => [0, 0, 0]);
const credits = frame((x, y) => (y > 40 && y < 44 && x % 5 < 3) ? [240, 240, 240] : [5, 5, 5]);
const blur = frame((x) => [120 + x / 10, 110, 100]);
const scene = frame((x, y) => { const edge = (Math.floor(x / 12) + Math.floor(y / 9)) % 2; return x > 60 && x < 100 && y > 20 && y < 70 ? [224, 172, 140 + edge * 10] : edge ? [40, 120, 200] : [60, 180, 90]; });

test('punteggio del fotogramma: niente nero, titoli, sfocato; vince la scena nitida con personaggio', () => {
  assert.equal(scoreFrame(black).score, 0); assert.equal(scoreFrame(black).reason, 'scuro');
  assert.ok(scoreFrame(credits).score < 0.1, 'Testo chiaro su nero: titoli di testa o di coda');
  assert.equal(scoreFrame(blur).score, 0, 'Sfocato e piatto');
  const s = scoreFrame(scene); assert.ok(s.score > 0.4); assert.equal(s.face, true); assert.ok(s.cx >= 0.19 && s.cx <= 0.81);
  assert.equal(scoreFrame(Buffer.alloc(10)).score, 0);
});

test('punti da campionare: fra il 22% e il 76%, lontano da sigla e finale noti', () => {
  const all = samplePoints(1400); assert.equal(all.length, 10); assert.ok(all[0] >= 1400 * 0.2 && all.at(-1) <= 1400 * 0.78);
  const without = samplePoints(1400, [[300, 600]]); assert.ok(without.length < 10 && without.every(t => t < 296 || t > 604));
});

test('nomi delle immagini accanto ai file e firma che cambia se se ne aggiunge una', () => {
  const names = ['Folder.JPG', 'poster.png', 'x.txt', 'Serie - 001.jpg', 'fanart.webp'];
  assert.equal(pictureMatch(names, ['poster', 'folder']), 'poster.png'); assert.equal(pictureMatch(names, ['cover']), null); assert.equal(pictureMatch(names, ['serie - 001']), 'Serie - 001.jpg');
  const item = { root: 'Anime', path: 'Serie/Stagione 1/Serie - 001.mp4' };
  const dirs = new Map([['Anime/Serie/Stagione 1', ['Serie - 001.jpg']], ['Anime/Serie', ['poster.jpg']], ['Anime/', ['poster.jpg']]]);
  const sig = picturesSignature(item, dirs); assert.match(sig, /Serie - 001\.jpg/); assert.match(sig, /poster\.jpg/); assert.ok(!sig.includes('0/poster'), 'La radice non conta: vale per tutta la raccolta');
  assert.notEqual(picturesSignature(item, new Map([...dirs, ['Anime/Serie', []]])), sig);
});

test('locandina: l’immagine messa accanto vince, poi il fotogramma scelto con ritaglio sul soggetto', async t => {
  const runs = [];
  const tools = { async probe() { return { duration: 600, streams: [{ type: 'video', codec: 'h264', index: 0 }] }; },
    async run(command, args, timeout, signal, mode) {
      if (mode === 'binary') { runs.push({ sample: args[args.indexOf('-ss') + 1] }); return scene; }
      const input = args[args.indexOf('-i') + 1];
      runs.push({ input: path.basename(input), graph: args[args.indexOf('-filter_complex') + 1], out: args.filter(a => a.endsWith('.jpg') && a !== input).map(p => path.basename(p)) });
      for (const out of args.filter(a => a.endsWith('.jpg') && a !== input)) await writeFile(out, 'img'); return '';
    } };
  const f = await fixture({ metadata: true, metadataDelayMs: 1, mediaTools: tools, smartFrames: true }); t.after(() => f.close());
  await mkdir(path.join(f.roots.Anime, 'Serie A'), { recursive: true }); await mkdir(path.join(f.roots.Anime, 'Serie B'), { recursive: true });
  await writeFile(path.join(f.roots.Anime, 'Serie A', 'Serie A - 001.mp4'), 'v'); await writeFile(path.join(f.roots.Anime, 'Serie A', 'poster.jpg'), 'p');
  await writeFile(path.join(f.roots.Anime, 'Serie B', 'Serie B - 001.mp4'), 'v');
  await f.app.library.scan(); await idle(f.app.library);
  const a = runs.filter(r => r.input);
  assert.ok(a.find(r => r.input === 'poster.jpg' && r.out.some(o => o.endsWith('-poster.jpg'))), 'Serie A: la locandina viene da poster.jpg accanto al video');
  assert.ok(a.find(r => r.input === 'Serie B - 001.mp4' && r.graph.includes('crop=w=')), 'Serie B: locandina 2:3 ritagliata sul soggetto dal fotogramma scelto');
  assert.ok(runs.filter(r => r.sample).length >= 10, 'Si campionano molti punti');
});

test('copertina incorporata nel file: usata con il flusso giusto', () => {
  const args = artArgs('/v/film.mp4', { image: true, stream: 3, outputs: [{ file: '/c/p.jpg', w: 520, h: 780, cx: 0.4 }] });
  assert.ok(args.join(' ').includes('[0:3]')); assert.ok(!args.includes('-ss')); assert.ok(args.join(' ').includes("x='max(0,min(iw-ow,0.4*iw-ow/2))'"));
});

// ---- copertine ufficiali da internet: spente di base ----
function fakeNet() {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); calls.push({ host: u.hostname, body: init.body, url: String(url) });
    if (u.hostname === 'graphql.anilist.co') return Response.json({ data: { Media: { coverImage: { extraLarge: 'https://s4.anilist.co/file/p.jpg' }, bannerImage: 'https://evil.example/b.jpg' } } });
    if (u.hostname === 'itunes.apple.com') return Response.json({ results: [{ artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg' }] });
    if (u.hostname === 'musicbrainz.org') return Response.json({ releases: [{ id: 'mbid-1' }] });
    if (u.hostname === 'coverartarchive.org') return new Response(null, { status: 307, headers: { location: 'https://ia800000.us.archive.org/x/front.jpg' } });
    return new Response(Buffer.from('immagine'), { headers: { 'content-type': 'image/jpeg' } });
  };
  return { calls, fetchImpl };
}
const tempDir = () => mkdtemp(path.join(os.tmpdir(), 'online-'));
const memoryStore = () => ({ data: {}, async change(fn) { return fn(this.data); } });

test('copertine ufficiali: spente di base, nessuna richiesta di rete', async () => {
  const net = fakeNet(); const online = await new OnlineArt({ dataDir: await tempDir() }, memoryStore(), { fetchImpl: net.fetchImpl }).init();
  assert.equal(online.enabled(), false);
  assert.equal(await online.get('anime', { title: 'Lama d’argento' }), null); assert.equal(await online.get('album', { title: 'Disco', artist: 'Band' }), null);
  assert.equal(net.calls.length, 0); assert.equal(online.status().requests, 0);
});

test('copertine ufficiali accese: manda solo il titolo, salva in locale, ogni titolo una sola volta, host non ammessi scartati', async () => {
  const net = fakeNet(); const dir = await tempDir();
  const online = await new OnlineArt({ dataDir: dir }, memoryStore(), { fetchImpl: net.fetchImpl }).init();
  assert.equal((await online.setEnabled(true)).enabled, true);
  const poster = await online.get('anime', { title: 'Lama d’argento' }); assert.ok(poster && poster.startsWith(dir)); assert.equal(await readFile(poster, 'utf8'), 'immagine');
  assert.equal(await online.get('anime', { title: 'Lama d’argento' }, 'backdrop'), null, 'evil.example non è ammesso');
  const sent = net.calls.find(c => c.host === 'graphql.anilist.co'); assert.deepEqual(Object.keys(JSON.parse(sent.body)), ['query', 'variables']); assert.deepEqual(JSON.parse(sent.body).variables, { search: 'Lama d’argento' });
  assert.ok(!net.calls.some(c => c.host === 'evil.example'));
  const before = net.calls.length; await online.get('anime', { title: 'Lama d’argento' }); assert.equal(net.calls.length, before, 'Già cercato: niente seconda richiesta');
  assert.ok(await online.get('film', { title: 'Rotta verso Sirio', year: 2026 })); assert.ok(net.calls.some(c => c.host === 'itunes.apple.com' && /Rotta/.test(c.url)));
  const album = await online.get('album', { title: 'Suoni di casa', artist: 'Artista' }); assert.ok(album, 'MusicBrainz, Cover Art Archive e poi archive.org');
  assert.ok(net.calls.every(c => !/[A-Za-z]:\\|\/Anime\/|\/Film\//.test(c.url + (c.body || ''))), 'Nessun percorso di file in nessuna richiesta');
  await online.setEnabled(false); const frozen = net.calls.length; assert.equal(await online.get('anime', { title: 'Altro titolo' }), null); assert.equal(net.calls.length, frozen);
});

test('gestione: l’interruttore è spento di base e si accende solo con la chiave di casa', async t => {
  const net = fakeNet(); const f = await fixture({ fetchImpl: net.fetchImpl }); t.after(() => f.close());
  assert.equal((await f.request('/api/manage/online-art')).status, 401);
  await f.login(); assert.deepEqual(await (await f.request('/api/manage/online-art')).json(), { enabled: false, saved: 0, requests: 0 });
  assert.equal((await f.request('/api/manage/online-art', { method: 'POST', data: { enabled: 'si' } })).status, 400);
  assert.equal((await (await f.request('/api/manage/online-art', { method: 'POST', data: { enabled: true } })).json()).enabled, true);
  assert.equal(net.calls.length, 0, 'Accenderlo non cerca niente da solo finché non c’è un titolo da preparare');
});

// ---- generi ufficiali ----
test('generi: tabella in italiano, Ecchi scartato, sconosciuti invariati, senza doppioni', () => {
  assert.deepEqual(translateGenres(['Action', 'Sci-Fi', 'Slice of Life', 'Mahou Shoujo', 'Ecchi', 'Action']), ['Azione', 'Fantascienza', 'Vita quotidiana', 'Maghette']);
  assert.deepEqual(translateGenres(['Animation', 'Kids & Family', 'Cyberpunk']), ['Animazione', 'Famiglia', 'Cyberpunk']);
  assert.deepEqual(translateGenres(undefined), []);
});

test('generi: online sotto, manuali sopra; voci vecchie recuperate con la pausa, rispettando l’interruttore e i 30 giorni', async t => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); calls.push({ host: u.hostname, body: init.body || '' });
    if (u.hostname === 'graphql.anilist.co') return Response.json({ data: { Media: { genres: ['Action', 'Ecchi', 'Fantasy'] } } });
    return Response.json({ results: [] });
  };
  const f = await fixture({ fetchImpl, metadataDelayMs: 1 }); t.after(() => f.close());
  const anime = await f.video('Lama d’argento - 01.mp4', 'Anime'); assert.deepEqual(f.app.library.get(anime.id).genres, []);
  const { kind, query } = f.app.library.onlineQuery(anime); const key = f.app.onlineArt.keyFor(kind, query);
  // Voce vecchia: scaricata prima dei generi (nessun campo genres).
  f.app.onlineArt.index[key] = { at: Date.now() };
  await f.app.library.backfillGenres(); assert.equal(calls.length, 0, 'Interruttore spento: nessuna richiesta');
  await f.login(); await f.request('/api/manage/online-art', { method: 'POST', data: { enabled: true } });
  await f.app.library.genreTask; await f.app.library.backfillGenres();
  assert.deepEqual(f.app.library.get(anime.id).genres, ['Azione', 'Fantasy']);
  const body = JSON.parse(calls.find(c => c.host === 'graphql.anilist.co').body); assert.ok(!/coverImage|bannerImage/.test(body.query), 'Query senza immagini');
  const sent = calls.length; await f.app.library.backfillGenres(); assert.equal(calls.length, sent, 'Già recuperati: nessuna nuova richiesta');
  // I generi si vedono nella risposta dell'API e la scansione non li cancella.
  await f.app.library.scan(); assert.deepEqual((await (await f.request('/api/library')).json()).items.find(i => i.id === anime.id).genres, ['Azione', 'Fantasy']);
  // Le modifiche a mano vincono (anche l'elenco vuoto scelto a mano).
  await f.request('/api/manage/edit', { method: 'POST', data: { id: anime.id, genres: ['Mio'] } }); assert.deepEqual(f.app.library.get(anime.id).genres, ['Mio']);
  await f.request('/api/manage/edit', { method: 'POST', data: { id: anime.id, genres: [] } }); assert.deepEqual(f.app.library.get(anime.id).genres, [], 'Elenco svuotato a mano: resta vuoto');
});

// ---- trame ufficiali ----
test('trame: pulizia dell’HTML e delle entità', () => {
  assert.equal(plainText('Un<br>mondo <i>strano</i>.<br><br>Fine &amp; inizio &#8212; &quot;ok&quot;&nbsp;!'), 'Un mondo strano. Fine & inizio — "ok" !');
  assert.equal(plainText(null), ''); assert.equal(plainText('<p>solo</p><p>testo</p>'), 'solo testo'); assert.ok(plainText('a'.repeat(3000)).length <= 1500);
});

test('trame: online sotto, scritta a mano sopra; voci vecchie recuperate con interruttore, pausa e 30 giorni', async t => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); calls.push({ host: u.hostname, body: init.body || '' });
    if (u.hostname === 'graphql.anilist.co') return Response.json({ data: { Media: { genres: ['Action'], description: 'Un eroe<br>parte.<br><i>Molto</i> lontano &amp; solo.', episodes: 12, averageScore: 82 } } });
    return Response.json({ results: [] });
  };
  const f = await fixture({ fetchImpl, metadataDelayMs: 1 }); t.after(() => f.close());
  const anime = await f.video('Lama d’argento - 01.mp4', 'Anime');
  const { kind, query } = f.app.library.onlineQuery(anime); const key = f.app.onlineArt.keyFor(kind, query);
  const field = f.app.library.get(anime.id).series ? 'seriesDescription' : 'description';
  f.app.onlineArt.index[key] = { at: Date.now(), genres: ['Azione'] }; // salvata prima delle trame
  await f.app.library.backfillGenres(); assert.equal(calls.length, 0, 'Interruttore spento: nessuna richiesta');
  assert.ok(!f.app.library.get(anime.id)[field]);
  await f.login(); await f.request('/api/manage/online-art', { method: 'POST', data: { enabled: true } });
  await f.app.library.genreTask; await f.app.library.backfillGenres();
  assert.match(calls.find(c => c.host === 'graphql.anilist.co').body, /description\(asHtml:false\)/);
  assert.equal(f.app.library.get(anime.id)[field], 'Un eroe parte. Molto lontano & solo.');
  assert.equal(f.app.onlineArt.index[key].episodes, 12); assert.equal(f.app.onlineArt.index[key].score, 8.2); assert.equal(f.app.library.get(anime.id).onlineScore, 8.2, 'Valutazione AniList nell’indice e nella voce'); assert.match(calls.find(c => c.host === 'graphql.anilist.co').body, /averageScore/); assert.deepEqual(f.app.library.get(anime.id).genres, ['Azione']);
  const sent = calls.length; await f.app.library.backfillGenres(); assert.equal(calls.length, sent, 'Già recuperata: nessuna nuova richiesta');
  // La trama scritta a mano vince sempre.
  await f.request('/api/manage/edit', { method: 'POST', data: { id: anime.id, [field]: 'La mia trama', ...(field === 'seriesDescription' ? { scope: 'series' } : {}) } });
  assert.equal(f.app.library.get(anime.id)[field], 'La mia trama');
  // iTunes: longDescription.
  const net = new OnlineArt({ dataDir: await mkdtemp(path.join(os.tmpdir(), 'trame-')) }, { data: { onlineArt: true } }, { fetchImpl: async () => Response.json({ results: [{ artworkUrl100: 'https://x.mzstatic.com/a/100x100bb.jpg', longDescription: '<b>Lunga</b> trama.', primaryGenreName: 'Drama' }] }) });
  assert.deepEqual(await net.lookupItunes('Film', 2000, 'film').then(r => [r.description, r.genres]), ['Lunga trama.', ['Drammatico']]);
});

test('loghi anime: PNG da taizen.moe con l’id AniList, 404 o tipo sbagliato = nessun logo, solo anime', async () => {
  const run = async (logoReply, kind = 'anime') => {
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      const u = new URL(url); calls.push(u.hostname + u.pathname);
      if (u.hostname === 'graphql.anilist.co') return Response.json({ data: { Media: { id: 127230, coverImage: { extraLarge: 'https://s4.anilist.co/file/p.jpg' } } } });
      if (u.hostname === 'taizen.moe') return logoReply();
      if (u.hostname === 'itunes.apple.com') return Response.json({ results: [{ artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg' }] });
      return new Response(Buffer.from('immagine'), { headers: { 'content-type': 'image/jpeg' } });
    };
    const online = await new OnlineArt({ dataDir: await tempDir() }, { data: { onlineArt: true }, async change(fn) { return fn(this.data); } }, { fetchImpl }).init();
    const query = { title: 'Chainsaw Man' }; await online.get(kind, query, 'poster');
    return { calls, file: await online.get(kind, query, 'logo'), logoFor: online.logoFor(kind, query), online };
  };
  const ok = await run(() => new Response(Buffer.from('png'), { headers: { 'content-type': 'image/png' } }));
  assert.ok(ok.calls.includes('taizen.moe/i/a/127230/logo')); assert.match(ok.file, /-logo\.png$/); assert.equal(ok.logoFor, ok.file);
  assert.equal((await run(() => new Response('no', { status: 404 }))).file, null);
  const wrong = await run(() => new Response(Buffer.from('x'), { headers: { 'content-type': 'image/jpeg' } })); assert.equal(wrong.file, null);
  assert.ok(!wrong.online.complete('anime', { genres: [], description: '', lat: Date.now() }), 'una vecchia trama vuota non impedisce il recupero dei metadati');
  const film = await run(() => new Response(Buffer.from('png'), { headers: { 'content-type': 'image/png' } }), 'film');
  assert.ok(!film.calls.some(c => c.startsWith('taizen.moe')) && film.file === null, 'film e serie senza logo');
});

// ---- immagini ad alta risoluzione: Kitsu per gli anime (via id AniList), iTunes a 2000 px ----
function hrNet({ mapping = true, kitsuFails = false } = {}) {
  const calls = []; const ffmpegs = [];
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); calls.push(String(url));
    if (u.hostname === 'graphql.anilist.co') return Response.json({ data: { Media: { id: 127230, coverImage: { extraLarge: 'https://s4.anilist.co/file/p.jpg' } } } });
    if (u.hostname === 'kitsu.app' && kitsuFails) return new Response('no', { status: 500 });
    if (u.hostname === 'kitsu.app' && u.pathname.endsWith('/mappings')) return Response.json({ included: mapping ? [{ type: 'anime', attributes: { posterImage: { original: 'https://media.kitsu.app/anime/1/poster_image/original.jpg' }, coverImage: { original: 'https://media.kitsu.app/anime/1/cover_image/original.jpg' } } }] : [] });
    if (u.hostname === 'kitsu.app') return Response.json({ data: [{ attributes: { posterImage: { original: 'https://media.kitsu.app/anime/2/poster_image/original.jpg' } } }] });
    if (u.hostname === 'taizen.moe') return new Response('no', { status: 404 });
    if (u.hostname === 'itunes.apple.com') return Response.json({ results: [{ artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/a/100x100bb.jpg' }] });
    return new Response(Buffer.from('immagine'), { headers: { 'content-type': 'image/jpeg' } });
  };
  const ffmpeg = async args => { ffmpegs.push(args); await writeFile(args.at(-1), 'ridotta'); };
  return { calls, ffmpegs, fetchImpl, ffmpeg };
}
const hrStore = () => ({ data: { onlineArt: true }, async change(fn) { return fn(this.data); } });

test('immagini grandi: anime da Kitsu per id AniList, rimpicciolite con un solo thread, la vecchia di AniList sparisce', async () => {
  const net = hrNet(); const dir = await tempDir();
  const online = await new OnlineArt({ dataDir: dir }, hrStore(), { fetchImpl: net.fetchImpl, ffmpeg: net.ffmpeg }).init();
  const poster = await online.get('anime', { title: 'Chainsaw Man' }, 'poster'); const backdrop = await online.get('anime', { title: 'Chainsaw Man' }, 'backdrop');
  assert.match(poster, /-poster-hr\.jpg$/); assert.match(backdrop, /-backdrop-hr\.jpg$/);
  const mapping = net.calls.find(c => c.includes('/mappings')); assert.match(decodeURIComponent(mapping), /filter\[externalSite\]=anilist\/anime/); assert.match(decodeURIComponent(mapping), /filter\[externalId\]=127230/);
  assert.equal(net.calls.some(c => c.includes('filter%5Btext%5D') || c.includes('filter[text]')), false, 'Con la corrispondenza non si cerca per titolo');
  assert.equal(net.ffmpegs.length, 2); const args = net.ffmpegs[0].join(' ');
  assert.match(args, /-threads 1/); assert.match(args, /scale='min\(1600,iw\)':-2/); assert.match(args, /-q:v 2/); assert.match(net.ffmpegs[1].join(' '), /min\(1920,iw\)/);
  const entry = Object.values(online.index)[0]; assert.equal(entry.hrOk, true); assert.ok(online.hrFor('anime', { title: 'Chainsaw Man' }) > 0);
  const { readdir } = await import('node:fs/promises'); const names = await readdir(dir + '/copertine-online').catch(() => readdir(online.dir));
  assert.equal(names.some(n => /-orig|-poster\.jpg$/.test(n)), false, 'Né l’originale grande né la vecchia locandina restano');
});

test('immagini grandi: senza corrispondenza si cerca per titolo; se Kitsu non risponde resta AniList, con il segno e 30 giorni', async () => {
  const noMap = hrNet({ mapping: false }); const a = await new OnlineArt({ dataDir: await tempDir() }, hrStore(), { fetchImpl: noMap.fetchImpl, ffmpeg: noMap.ffmpeg }).init();
  assert.match(await a.get('anime', { title: 'Sconosciuto' }, 'poster'), /-poster-hr\.jpg$/); assert.ok(noMap.calls.some(c => c.includes('/anime?')), 'Ripiego: ricerca per titolo');
  const bad = hrNet({ kitsuFails: true }); const b = await new OnlineArt({ dataDir: await tempDir() }, hrStore(), { fetchImpl: bad.fetchImpl, ffmpeg: bad.ffmpeg }).init();
  assert.match(await b.get('anime', { title: 'Chainsaw Man' }, 'poster'), /-poster\.jpg$/, 'Resta quella di AniList');
  const entry = Object.values(b.index)[0]; assert.ok(entry.hr > 0); assert.equal(entry.hrOk, undefined); assert.equal(b.hrFor('anime', { title: 'Chainsaw Man' }), 0);
  const before = bad.calls.length; assert.equal(await b.fetchHr('anime', { title: 'Chainsaw Man' }), false); assert.equal(bad.calls.length, before, 'Entro 30 giorni non richiede nulla');
  entry.hr -= 31 * 86400000; assert.equal(await b.fetchHr('anime', { title: 'Chainsaw Man' }), false, 'Dopo 30 giorni ritenta (e fallisce di nuovo)'); assert.ok(bad.calls.length > before);
});

test('immagini grandi: voci già salvate migliorate una volta sola; iTunes chiede 2000 px', async () => {
  const net = hrNet(); const dir = await tempDir();
  const online = await new OnlineArt({ dataDir: dir }, hrStore(), { fetchImpl: net.fetchImpl, ffmpeg: net.ffmpeg }).init();
  const key = online.keyFor('anime', { title: 'Vecchio' }); await writeFile(path.join(online.dir, `${key}-poster.jpg`), 'piccola');
  online.index[key] = { at: Date.now(), poster: `${key}-poster.jpg`, anilistId: 5, genres: [], description: '' };
  assert.equal(await online.fetchHr('anime', { title: 'Vecchio' }), true); assert.match(online.index[key].poster, /-poster-hr\.jpg$/); assert.match(net.calls.find(c => c.includes('externalId')), /externalId%5D=5|externalId\]=5/);
  const again = net.calls.length; assert.equal(await online.fetchHr('anime', { title: 'Vecchio' }), false); assert.equal(net.calls.length, again, 'Una volta sola');
  const film = await online.get('film', { title: 'Un film' }, 'poster'); assert.match(film, /-poster\.jpg$/);
  assert.ok(net.calls.some(c => c.startsWith('https://itunes.apple.com')), 'iTunes interrogato'); assert.equal(online.index[online.keyFor('film', { title: 'Un film' })].hrOk, true);
  assert.equal(await online.lookupItunes('Un film', null, 'film').then(r => r.poster), 'https://is1-ssl.mzstatic.com/image/thumb/a/2000x3000bb.jpg');
});

test('immagini online migliorate: si rifanno solo locandina e sfondo, senza campionare i video; una sola conversione per tutta la serie', async t => {
  const runs = [];
  const tools = { async probe() { return { duration: 600, streams: [{ type: 'video', codec: 'h264', index: 0 }] }; },
    async run(command, args, timeout, signal, mode) {
      if (mode === 'binary') { runs.push({ sample: true }); return scene; }
      const input = args[args.indexOf('-i') + 1]; const outs = args.filter(a => a.endsWith('.jpg') && a !== input);
      runs.push({ input: path.basename(input), out: outs.map(p => path.basename(p)) }); for (const out of outs) await writeFile(out, `img-${runs.length}`); return '';
    } };
  const f = await fixture({ metadata: true, metadataDelayMs: 1, mediaTools: tools, smartFrames: true }); t.after(() => f.close());
  await mkdir(path.join(f.roots.Anime, 'Serie'), { recursive: true });
  for (let n = 1; n <= 12; n++) await writeFile(path.join(f.roots.Anime, 'Serie', `Serie - ${String(n).padStart(2, '0')}.mp4`), 'v');
  await f.app.library.scan(); await idle(f.app.library);
  const items = f.app.library.items.filter(i => i.root === 'Anime'); assert.equal(items.length, 12);
  // Arriva l'immagine online: si rifà tutto una volta (prima passata completa).
  const online = f.app.onlineArt; const { kind, query } = f.app.library.onlineQuery(items[0]); const key = online.keyFor(kind, query);
  await writeFile(path.join(online.dir, `${key}-poster.jpg`), 'p'); await writeFile(path.join(online.dir, `${key}-backdrop.jpg`), 'b');
  online.index[key] = { at: Date.now(), poster: `${key}-poster.jpg`, backdrop: `${key}-backdrop.jpg`, genres: [], description: '' };
  await online.setEnabled(true); f.app.library.queueArt(); await idle(f.app.library);
  const thumbs = items.map(i => path.join(f.app.library.cacheDir, `${i.id}.jpg`)); const before = await Promise.all(thumbs.map(p => readFile(p, 'utf8')));
  const versions = items.map(i => f.app.library.get(i.id).images.v);
  // L'immagine online diventa ad alta risoluzione: solo il segno hr cambia.
  await writeFile(path.join(online.dir, `${key}-poster-hr.jpg`), 'P'); await writeFile(path.join(online.dir, `${key}-backdrop-hr.jpg`), 'B');
  Object.assign(online.index[key], { poster: `${key}-poster-hr.jpg`, backdrop: `${key}-backdrop-hr.jpg`, hr: Date.now() + 5, hrOk: true });
  runs.length = 0; f.app.library.queueArt(); await idle(f.app.library);
  assert.equal(runs.filter(r => r.sample).length, 0, 'Nessun campionamento del video');
  assert.equal(runs.length, 2, 'Una conversione per la locandina (grande e piccola) e una per lo sfondo, per tutta la serie');
  assert.ok(runs[0].out[0].endsWith('-poster.jpg') && runs[0].input === `${key}-poster-hr.jpg`);
  assert.deepEqual(await Promise.all(thumbs.map(p => readFile(p, 'utf8'))), before, 'Le miniature restano');
  for (const [n, item] of items.entries()) {
    assert.notEqual(f.app.library.get(item.id).images.v, versions[n], 'La versione cambia: i telefoni scaricano di nuovo');
    assert.equal(await readFile(path.join(f.app.library.cacheDir, `${item.id}-poster.jpg`), 'utf8'), await readFile(path.join(f.app.library.cacheDir, `${items[0].id}-poster.jpg`), 'utf8'), 'Anche le altre puntate hanno la nuova locandina');
  }
  runs.length = 0; f.app.library.queueArt(); await idle(f.app.library); assert.equal(runs.length, 0, 'Già applicato: niente da rifare');
  assert.equal(items.every(i => !f.app.library.needsWork(f.app.library.items.find(x => x.id === i.id))), true);
});
