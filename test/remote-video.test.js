// 8/11: la raccolta «dal fisso» — catalogo unito, tramite con Range e fisso spento (due Apollon vere: il fisso e quella dell'NAS).
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';
import { buildTitles } from '../public/video-logic.js';

async function pair(t, extra = {}) {
  const fisso = await fixture({ readOnly: true });
  await mkdir(path.join(fisso.roots.Anime, 'Serie Lontana'));
  await writeFile(path.join(fisso.roots.Anime, 'Serie Lontana', 'Serie Lontana - Ep 1.mp4'), '0123456789');
  await writeFile(path.join(fisso.roots.Anime, 'Serie Lontana', 'Serie Lontana - Ep 1.it.srt'), '1\n00:00:01,000 --> 00:00:02,000\nCiao');
  await fisso.app.library.scan();
  const nas = await fixture({ remoteVideoSources: [{ nome: 'fisso', url: fisso.url }], remoteTimeoutMs: 800, remoteFreshMs: 50, remoteDownMs: 300, ...extra });
  await nas.video('Locale (2026).mp4', 'Anime');
  let off = false; const stop = async () => { if (!off) { off = true; await fisso.close(); } };
  t.after(async () => { await nas.close(); await stop(); });
  return { fisso, nas, stop };
}

test('il catalogo del fisso si unisce a quello locale, con il segno e senza toccare i file', async t => {
  const { nas } = await pair(t);
  const list = await (await nas.request('/api/library')).json();
  assert.equal(list.items.length, 2); assert.deepEqual(list.remotes, [{ nome: 'fisso', up: true }]);
  const far = list.items.find(i => i.series === 'Serie Lontana'); assert.equal(far.remote, 'fisso'); assert.equal(far.remoteDown, false); assert.equal(far.path, undefined);
  assert.equal(list.items.find(i => i.title === 'Locale').remote, undefined);
  // i profili e i progressi restano sull'NAS anche per i titoli del fisso
  assert.equal((await nas.request('/api/progress', { method: 'PUT', data: { profile: 'bruno', id: far.id, position: 4, duration: 10 } })).status, 200);
  const titles = buildTitles(list.items, {}); assert.equal(titles.find(x => x.title === 'Serie Lontana').remote, 'fisso');
});

test('il video e i sottotitoli del fisso passano dall\'NAS con Range e HEAD', async t => {
  const { nas } = await pair(t);
  const far = (await (await nas.request('/api/library')).json()).items.find(i => i.remote);
  let r = await nas.request(`/media/${far.id}`, { headers: { Range: 'bytes=2-5' } });
  assert.equal(r.status, 206); assert.equal(await r.text(), '2345'); assert.equal(r.headers.get('content-range'), 'bytes 2-5/10');
  r = await nas.request(`/media/${far.id}`, { method: 'HEAD' }); assert.equal(r.headers.get('content-length'), '10');
  assert.equal((await nas.request(`/media/${far.id}`, { headers: { Range: 'bytes=99-' } })).status, 416);
  assert.match(await (await nas.request(`/media/${far.id}/subtitle/0`)).text(), /WEBVTT/);
  assert.equal((await nas.request(`/media/${far.id}/frame?t=1`)).status, 404);
});

// La TV Samsung legge le intestazioni con le maiuscole: con «accept-ranges» in minuscolo crede che il file non si possa
// saltare, non va a leggere l'indice in fondo all'mp4 e dà «formato non supportato» (DBS 102, 8/11).
test('il tramite manda le intestazioni con le maiuscole, come i video locali', async t => {
  const { nas } = await pair(t);
  const far = (await (await nas.request('/api/library')).json()).items.find(i => i.remote);
  const raw = await new Promise((resolve, reject) => http.get(`${nas.url}/media/${far.id}`, { headers: { Range: 'bytes=0-' } }, res => { res.resume(); resolve(res.rawHeaders.filter((_, i) => i % 2 === 0)); }).on('error', reject));
  for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) assert.ok(raw.includes(name), `${name} in ${raw}`);
});

test('fisso spento: titoli segnati spenti, risposta pulita e il resto funziona', async t => {
  const { nas, stop } = await pair(t);
  const far = (await (await nas.request('/api/library')).json()).items.find(i => i.remote);
  await stop(); await new Promise(r => setTimeout(r, 100));
  await nas.request('/api/library'); await new Promise(r => setTimeout(r, 200)); // il primo giro aggiorna in sottofondo
  const started = Date.now();
  const list = await (await nas.request('/api/library')).json();
  assert.ok(Date.now() - started < 1500);
  assert.equal(list.items.length, 2); assert.equal(list.items.find(i => i.remote).remoteDown, true); assert.deepEqual(list.remotes, [{ nome: 'fisso', up: false }]);
  assert.equal(buildTitles(list.items, {}).find(x => x.remote).remoteDown, true);
  const r = await nas.request(`/media/${far.id}`); assert.equal(r.status, 503); assert.match((await r.json()).error, /fisso è spento/);
  // cache negativa: la seconda richiesta non aspetta il fisso
  const again = Date.now(); await nas.request('/api/library'); assert.ok(Date.now() - again < 300);
  assert.equal((await nas.request('/api/health')).status, 200);
  const local = list.items.find(i => !i.remote); assert.equal((await nas.request(`/media/${local.id}`)).status, 200);
});

test('fisso in sola lettura: profili permessi, file protetti', async t => {
  const { fisso } = await pair(t);
  assert.equal((await fisso.request('/api/profiles', { method: 'POST', data: { name: 'X' } })).status, 201);
  await fisso.login();
  assert.equal((await fisso.request('/api/manage/folder', { method: 'POST', data: { root: 'Anime', path: 'Nuova' } })).status, 403);
  assert.equal((await fisso.request('/api/library')).status, 200);
});

test('ricordato anche dopo un riavvio con il fisso spento', async t => {
  const { nas, stop } = await pair(t);
  await nas.request('/api/library'); await new Promise(r => setTimeout(r, 100)); await stop();
  const { createApp } = await import('../server.js');
  const again = await createApp({ dataDir: nas.app.config.dataDir, roots: nas.roots, adminKey: 'x', metadata: false, autoSkips: false, autoMusicArt: false, remoteVideoSources: [{ nome: 'fisso', url: 'http://127.0.0.1:1' }], remoteTimeoutMs: 300 });
  t.after(() => again.close());
  await again.remote.list(); await new Promise(r => setTimeout(r, 400)); const items = await again.remote.list(); const far = items.find(i => i.remote);
  assert.ok(far && far.remoteDown === true);
});

// ---- Revisione 8/11: tramite robusto, catalogo in sottofondo, solo guardare, niente doppioni ----
import http from 'node:http';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import { RemoteVideo } from '../lib/remote-video.js';
import { clean } from '../lib/remote-video.js';
import { listenForTest } from '../scripts/test-ports.js';

const ID = 'a'.repeat(24);
const wait = ms => new Promise(r => setTimeout(r, ms));
function item(extra = {}) {
  return { id: ID, root: 'Film', title: 'Lontano', kind: 'film', size: 10, duration: 60, genres: ['Azione'], path: 'SEGRETO/Lontano.mp4', light: true, versions: { x: 1 }, controllare: ['sigla'], introStart: 1, introEnd: 5,
    salti: { sigla: [1, 5] }, fontiSalti: { sigla: 'x' }, images: { poster: true, backdrop: true, thumb: true, v: 3 }, streams: [{ index: 0, type: 'video', codec: 'h264', language: 'und', height: 720, file: 'SEGRETO.mkv' }],
    subtitles: [{ name: 'SEGRETO.it.srt', path: 'SEGRETO/x.srt', language: 'it' }], ...extra };
}
// Un finto fisso: ogni percorso si comporta come dice `mode`.
async function stub(t, { catalog = [item()], mode = {} } = {}) {
  const seen = []; let library = 0;
  const server = http.createServer(async (req, res) => {
    seen.push({ url: req.url, headers: req.headers });
    if (req.url === '/api/library') {
      library++; if (mode.libraryHead) await wait(mode.libraryHead);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.flushHeaders();
      if (mode.libraryBody) await wait(mode.libraryBody);
      return res.end(JSON.stringify({ items: mode.catalog || catalog }));
    }
    if (mode.hang && req.url.includes(mode.hang)) return;
    if (req.url.includes('/subtitle')) { await wait(mode.subtitleDelay || 0); res.writeHead(200, { 'Content-Type': 'text/vtt' }); return res.end('WEBVTT'); }
    if (mode.stall) { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': 1000 }); return res.write('abc'); }
    if (mode.big) { res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': 1e9 }); const chunk = Buffer.alloc(65536); const tick = () => { if (res.destroyed) return; res.write(chunk); setTimeout(tick, 5); }; return tick(); }
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Disposition': 'inline; filename="x.mp4"', Vary: 'Accept-Encoding', 'Content-Length': 3 }); res.end('abc');
  });
  await listenForTest(server);
  t.after(() => { server.closeAllConnections(); server.close(); });
  return { url: `http://127.0.0.1:${server.address().port}`, seen, count: () => library };
}
async function viaNas(t, st, extra = {}) {
  const nas = await fixture({ remoteVideoSources: [{ nome: 'fisso', url: st.url }], remoteTimeoutMs: 800, remoteFreshMs: 50, remoteDownMs: 5000, ...extra });
  t.after(() => nas.close()); const list = await (await nas.request('/api/library')).json();
  return { nas, far: list.items.find(i => i.remote), remote: nas.app.remote };
}

test('se il cliente chiude la richiesta, il fisso non diventa spento', async t => {
  const st = await stub(t, { mode: { big: true } }); const { nas, far, remote } = await viaNas(t, st);
  await new Promise((resolve, reject) => {
    const req = http.get(`${nas.url}/media/${far.id}`, res => { res.once('data', () => { req.destroy(); resolve(); }); });
    req.on('error', () => {}); setTimeout(() => reject(new Error('nessun dato')), 3000);
  });
  await wait(300); assert.equal(remote.sources[0].up, true); assert.equal(remote.sources[0].downUntil, 0);
});

test('una risposta lenta dà 504 senza segnare il fisso spento; i sottotitoli hanno più tempo', async t => {
  const st = await stub(t, { mode: { hang: '/poster', subtitleDelay: 500 } }); const { nas, far, remote } = await viaNas(t, st, { remoteProxyMs: 250, remoteSubtitleMs: 3000 });
  const slow = await nas.request(`/media/${far.id}/poster`); assert.equal(slow.status, 504);
  assert.equal(remote.sources[0].downUntil, 0); assert.equal(remote.sources[0].up, true);
  assert.equal((await nas.request(`/media/${far.id}/subtitle/0`)).status, 200);
});

test('la connessione rifiutata segna il fisso spento; le immagini rispondono subito 404 senza cache', async t => {
  const st = await stub(t); const { nas, far, remote } = await viaNas(t, st);
  remote.sources[0].url = 'http://127.0.0.1:1';
  assert.equal((await nas.request(`/media/${far.id}`)).status, 503); assert.equal(remote.sources[0].up, false);
  const started = Date.now(); const img = await nas.request(`/media/${far.id}/poster?s=260`);
  assert.equal(img.status, 404); assert.equal(img.headers.get('cache-control'), 'no-store'); assert.ok(Date.now() - started < 300);
});

test('se il fisso sparisce a metà, la connessione cade da sola', async t => {
  const st = await stub(t, { mode: { stall: true } }); const { nas, far } = await viaNas(t, st, { remoteIdleMs: 300 });
  const ended = await new Promise(resolve => {
    const begin = Date.now(); const req = http.get(`${nas.url}/media/${far.id}`, res => { res.on('data', () => {}); res.on('close', () => resolve(Date.now() - begin)); res.on('error', () => {}); });
    req.on('error', () => resolve(Date.now() - begin)); setTimeout(() => resolve(-1), 3000);
  });
  assert.ok(ended > 0 && ended < 2000, `durata ${ended}`);
});

test('if-range, content-disposition e vary passano; solo i parametri previsti vanno al fisso', async t => {
  const st = await stub(t); const { nas, far } = await viaNas(t, st);
  const r = await nas.request(`/media/${far.id}?s=260&v=9&q=480&evil=1`, { headers: { Range: 'bytes=0-1', 'If-Range': '"abc"' } });
  assert.equal(r.headers.get('content-disposition'), 'inline; filename="x.mp4"'); assert.equal(r.headers.get('vary'), 'Accept-Encoding');
  const call = st.seen.find(c => c.url.startsWith('/media/')); assert.equal(call.headers['if-range'], '"abc"'); assert.equal(call.url, `/media/${ID}?s=260&q=480`);
});

test('catalogo: poco tempo per le intestazioni, più per il corpo; lo stesso catalogo non si riscrive; niente percorsi', async t => {
  const st = await stub(t, { mode: { libraryHead: 100, libraryBody: 600 } });
  const dir = await mkdtemp(path.join(os.tmpdir(), 'rv-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const rv = await new RemoteVideo([{ nome: 'fisso', url: st.url }], { dataDir: dir, timeoutMs: 300, bodyMs: 3000, freshMs: 10 }).init();
  await rv.list(); await wait(1200); const items = await rv.list(); assert.equal(items.length, 1); assert.equal(items[0].remoteDown, false);
  const flat = JSON.stringify(items); for (const bad of ['SEGRETO', '"path"', 'versions']) assert.ok(!flat.includes(bad), bad);
  assert.equal(items[0].id.length, 24); assert.deepEqual(items[0].salti, { sigla: [1, 5] });
  const file = rv.fileOf(rv.sources[0]); const first = await readFile(file, 'utf8'); assert.ok(!first.includes('\n  '));
  await rm(file); await wait(30); await rv.list(); await wait(1200);
  assert.equal(await stat(file).then(() => true, () => false), false, 'riscritto senza cambiamenti');
  assert.deepEqual((await readdir(dir)).filter(n => n.endsWith('.tmp')), []);
});

test('/api/library non aspetta mai il fisso: serve l\'ultima copia e aggiorna da solo, uno alla volta', async t => {
  const st = await stub(t); const { nas } = await viaNas(t, st, { remoteFreshMs: 10 });
  const slow = await stub(t, { mode: { libraryHead: 800 } }); nas.app.remote.sources[0].url = slow.url; await wait(30);
  const started = Date.now(); const calls = await Promise.all([nas.request('/api/library'), nas.request('/api/library'), nas.request('/api/library')]);
  assert.ok(Date.now() - started < 500); for (const c of calls) assert.equal((await c.json()).items.filter(i => i.remote).length, 1);
  await wait(200); assert.equal(slow.count(), 1);
});

test('i titoli del fisso si guardano soltanto: gli endpoint di gestione danno 409', async t => {
  const st = await stub(t); const { nas, far } = await viaNas(t, st); await nas.login();
  const post = (p, data) => nas.request(p, { method: 'POST', data });
  for (const [p, data] of [['/api/versions', { ids: [far.id] }], ['/api/manage/skips/analyze', { id: far.id }], ['/api/manage/skips/edit', { id: far.id, salti: { sigla: [1, 5] } }],
    ['/api/manage/art', { id: far.id }], ['/api/manage/edit', { id: far.id, title: 'X' }], ['/api/manage/skips/settings', { id: far.id, aniskip: false }]]) {
    const r = await post(p, data); assert.equal(r.status, 409, p); assert.equal((await r.json()).error, 'Questo titolo sta sul fisso: qui si può solo guardare.');
  }
  assert.equal((await nas.request(`/api/manage/pictures?id=${far.id}`)).status, 409);
  assert.equal((await nas.request(`/api/manage/skips?id=${far.id}`)).status, 409);
  assert.equal((await nas.request(`/api/versions/item?id=${far.id}`)).status, 409);
  // guardare invece funziona: progressi, segna visto in blocco, profili
  assert.equal((await nas.request('/api/progress/batch', { method: 'PUT', data: { profile: 'bruno', ids: [far.id], watched: true } })).status, 200);
  const prog = await (await nas.request('/api/progress?profile=bruno')).json(); assert.equal(JSON.stringify(prog).includes(far.id), true);
});

test('stessa serie su NAS e fisso: nessun episodio doppio, gli altri restano', async t => {
  const fisso = await fixture({ readOnly: true });
  await mkdir(path.join(fisso.roots.Anime, 'Serie Mista'));
  for (const n of [1, 2]) await writeFile(path.join(fisso.roots.Anime, 'Serie Mista', `Serie Mista - Ep ${n}.mp4`), '0123456789');
  await fisso.app.library.scan();
  const nas = await fixture({ remoteVideoSources: [{ nome: 'fisso', url: fisso.url }], remoteTimeoutMs: 800 });
  t.after(async () => { await nas.close(); await fisso.close(); });
  await mkdir(path.join(nas.roots.Anime, 'Serie Mista')); await writeFile(path.join(nas.roots.Anime, 'Serie Mista', 'Serie Mista - Ep 1.mp4'), '0123456789'); await nas.app.library.scan();
  const items = (await (await nas.request('/api/library')).json()).items.filter(i => i.series === 'Serie Mista');
  assert.equal(items.length, 2); assert.equal(items.filter(i => i.episode === 1)[0].remote, undefined); assert.equal(items.find(i => i.episode === 2).remote, 'fisso');
  const title = buildTitles(items, {}).find(x => x.title === 'Serie Mista'); assert.equal(title.remote, ''); assert.equal(title.hasRemote, true);
});

const REMOTE_KEY = 'chiave-finta-lunga-per-il-collegamento-test';
async function collegati(t, key = REMOTE_KEY) {
  const calls = [];
  const fisso = await fixture({ readOnly: true, remoteKey: REMOTE_KEY, ffmpegThreads: 1, skipDelayMs: 0,
    skipTools: { probe: async () => ({ duration: 120, chapters: [] }), fingerprint: async () => ({ offset: 0, words: [] }), black: async () => [], fotogrammi: async () => Buffer.alloc(120 * 2 * 9) },
    mediaTools: { run: async (cmd, args) => { calls.push(args); await writeFile(args.at(-1), 'leggera'); } } });
  t.after(() => fisso.close());
  const a = await fisso.video('Serie S01E01.mp4', 'Anime');
  const b = await fisso.video('Serie S01E02.mp4', 'Anime');
  const nas = await fixture({ remoteVideoSources: [{ nome: 'fisso', url: fisso.url, key }], remoteFreshMs: 60000 });
  t.after(() => nas.close());
  const items = (await (await nas.request('/api/library')).json()).items;
  await nas.login();
  return { fisso, nas, a, b, far: items.find(i => i.episode === 1), other: items.find(i => i.episode === 2), calls };
}

test('clean conserva i dati pubblici di versioni e salti senza percorsi', () => {
  const value = clean(item({ fontiSalti: { sigla: 'a mano', path: 'SEGRETO' }, controllare: ['sigla', 'SEGRETO'], light: true, poster: { path: 'SEGRETO.jpg' } }));
  assert.equal(value.light, true); assert.deepEqual(value.fontiSalti, { sigla: 'a mano' });
  assert.deepEqual(value.controllare, ['sigla']); assert.equal(value.introStart, 1); assert.equal(value.introEnd, 5);
  assert.deepEqual(value.poster, { immagine: true });
  assert.ok(!JSON.stringify(value).includes('SEGRETO'));
});

test('inoltro con chiave: edit, sorgenti immagini, query e salti usano gli ID del fisso', async t => {
  const { fisso, nas, a, b, far, other } = await collegati(t);
  let r = await nas.request('/api/manage/edit', { method: 'POST', data: { id: far.id, title: 'Corretto', poster: { source: other.id, at: 3 }, backdrop: { source: other.id, at: 4 } } });
  assert.equal(r.status, 200); const saved = await r.json();
  assert.equal(saved.poster.source, other.id); assert.equal(saved.backdrop.source, other.id);
  assert.equal(fisso.app.store.data.edits[a.id].poster.source, b.id);
  assert.equal(fisso.app.library.get(a.id).title, 'Corretto');
  r = await nas.request('/api/manage/skips/edit', { method: 'POST', data: { id: far.id, salti: { sigla: [1, 5] } } });
  assert.equal(r.status, 200); assert.deepEqual(fisso.app.library.get(a.id).salti.sigla, [1, 5]);
  r = await nas.request('/api/manage/skips/settings', { method: 'POST', data: { id: far.id, aniskip: false, malId: 123 } });
  assert.equal(r.status, 200);
  assert.equal((await (await nas.request(`/api/manage/skips?id=${far.id}`)).json()).malId, 123);
  await writeFile(path.join(fisso.roots.Anime, 'scelta.jpg'), 'immagine');
  assert.ok((await (await nas.request(`/api/manage/pictures?id=${far.id}`)).json()).pictures.includes('scelta.jpg'));
  assert.equal(await (await nas.request(`/api/manage/picture?id=${far.id}&path=scelta.jpg`)).text(), 'immagine');
  assert.equal((await nas.request(`/api/manage/picture?id=${far.id}&path=scelta.jpg`, { method: 'HEAD' })).headers.get('content-length'), '8');
  assert.equal((await nas.request('/api/manage/art', { method: 'POST', data: { id: far.id } })).status, 202);
  fisso.app.library.frame = async id => Buffer.from(id === a.id ? 'fotogramma' : 'errato');
  assert.equal(await (await nas.request(`/media/${far.id}/frame?t=3`)).text(), 'fotogramma');
  const updated = (await (await nas.request('/api/library')).json()).items.find(i => i.id === far.id);
  assert.equal(updated.title, 'Corretto'); assert.deepEqual(updated.salti.sigla, [1, 5]);
  const local = await nas.video('Locale.mp4');
  r = await nas.request('/api/manage/edit', { method: 'POST', data: { id: far.id, title: 'Non salvare', poster: { source: local.id, at: 1 } } });
  assert.equal(r.status, 409); assert.equal(fisso.app.library.get(a.id).title, 'Corretto');
});

test('versioni miste sul fisso: coda, stato, riproduzione 480p, HEAD e pulizia', async t => {
  const { fisso, nas, a, far, calls } = await collegati(t);
  const locale = await nas.video('Locale.mp4');
  // La versione locale è già pronta; sul fisso viene creata con lo strumento finto.
  nas.app.versions.ready.set(locale.id, { signature: `${locale.size}:${Math.round(locale.mtime)}`, bytes: 1 });
  let r = await nas.request('/api/versions', { method: 'POST', data: { ids: [locale.id, far.id], first: true } });
  assert.equal(r.status, 202); await fisso.app.versions.wait();
  assert.equal((await (await nas.request('/api/versions')).json()).count, 2);
  assert.equal((await (await nas.request('/api/library')).json()).items.find(i => i.id === far.id).light, true);
  const status = await (await nas.request(`/api/versions/item?id=${far.id}`)).json();
  assert.equal(status.id, far.id); assert.equal(status.state, 'ready');
  assert.equal((await (await nas.request('/api/versions')).json()).count, 2);
  assert.equal(await (await nas.request(`/media/${far.id}?q=480`)).text(), 'leggera');
  r = await nas.request(`/media/${far.id}?q=480`, { method: 'HEAD' }); assert.equal(r.headers.get('content-length'), '7');
  assert.equal(await (await nas.request(`/media/${far.id}?q=480`, { headers: { Range: 'bytes=0-2' } })).text(), 'leg');
  assert.ok(calls[0].includes('-threads')); assert.equal(fisso.app.versions.has(a), true);
  assert.equal((await (await nas.request('/api/library')).json()).items.find(i => i.id === far.id).light, true);
  r = await nas.request('/api/manage/versions/clear', { method: 'POST', data: {} });
  assert.equal(r.status, 200); assert.equal((await r.json()).removed, 2); assert.equal(fisso.app.versions.status().count, 0);
});

test('riepilogo salti e analisi del fisso arrivano alla pagina della serie', async t => {
  const { fisso, nas, far } = await collegati(t);
  const r = await nas.request('/api/manage/skips/analyze', { method: 'POST', data: { id: far.id } });
  assert.equal(r.status, 202); await fisso.app.skips.wait();
  const overview = await (await nas.request('/api/skips')).json();
  assert.equal(overview.series['Anime/Serie'].total, 2); assert.equal(overview.series['Anime/Serie'].ready, 2);
});

test('chiave remota errata rifiutata e chiave giusta limitata alle API previste', async t => {
  const { fisso, nas, far, a } = await collegati(t, 'sbagliata');
  assert.equal((await nas.request('/api/manage/edit', { method: 'POST', data: { id: far.id, title: 'X' } })).status, 401);
  const headers = { 'x-apollon-remote': REMOTE_KEY };
  for (const p of ['/api/manage/files?root=Anime', '/api/manage/trash', '/api/manage/space', '/api/manage/music']) {
    assert.equal((await fisso.request(p, { headers })).status, 401, p);
  }
  for (const p of ['/api/manage/upload', '/api/manage/folder', '/api/manage/move', '/api/manage/trash', '/api/manage/restore']) {
    assert.equal((await fisso.request(p, { method: 'POST', headers, data: {} })).status, 403, p);
  }
  assert.equal((await fisso.request('/api/manage/edit', { method: 'POST', headers, data: { id: a.id, title: 'Permesso' } })).status, 200);
  assert.equal((await fisso.request('/api/manage/edit', { method: 'POST', headers: { 'x-apollon-remote': 'errata' }, data: { id: a.id, title: 'Vietato' } })).status, 401);
});

test('inoltro gestione a fisso spento risponde 503 con il messaggio previsto', async t => {
  const { fisso, nas, far } = await collegati(t);
  await fisso.app.close();
  const r = await nas.request('/api/manage/edit', { method: 'POST', data: { id: far.id, title: 'X' } });
  assert.equal(r.status, 503); assert.match((await r.json()).error, /Il fisso è spento/);
});

test('ID in coda, fallimenti e liste nella query si traducono senza cambiare i titoli', async t => {
  const { nas, fisso, a, b, far, other } = await collegati(t);
  fisso.app.versions.working = a.id; fisso.app.versions.queue.push(b.id); fisso.app.versions.failed.add(b.id);
  const status = await (await nas.request('/api/versions')).json();
  assert.equal(status.working, far.id); assert.deepEqual(status.workingIds, [far.id]);
  assert.deepEqual(status.failed, [other.id]); assert.equal(status.queued, 1);
  const s = nas.app.remote.sources[0]; let received;
  fisso.app.server.prependListener('request', req => { received = new URL(req.url, fisso.url); });
  await nas.app.remote.forward(s, '/api/manage/skips', 'GET', undefined, `id=${far.id}&ids=${far.id},${other.id}&ids=${other.id}`);
  assert.equal(received.searchParams.get('id'), a.id); assert.deepEqual(received.searchParams.getAll('ids'), [`${a.id},${b.id}`, b.id]);
  assert.equal(nas.app.remote.translate({ title: a.id }, s, false).title, a.id);
  assert.deepEqual(nas.app.remote.translate({ [a.id]: { id: b.id } }, s, false), { [far.id]: { id: other.id } });
});

test('il riepilogo conta una volta gli episodi presenti sia in locale sia sul fisso', async t => {
  const { nas, fisso, a } = await collegati(t);
  await nas.video('Serie S01E01.mp4', 'Anime');
  fisso.app.skips.enqueue(a.id); await fisso.app.skips.wait();
  const overview = await (await nas.request('/api/skips')).json();
  assert.equal(overview.series['Anime/Serie'].total, 2); assert.equal(overview.series['Anime/Serie'].ready, 1);
});

test('gestione lenta: attesa breve, 503 e cache negativa', async t => {
  const st = await stub(t, { mode: { hang: '/api/manage/edit' } });
  const { nas, far } = await viaNas(t, st, { remoteVideoSources: [{ nome: 'fisso', url: st.url, key: REMOTE_KEY }], remoteProxyMs: 100 }); await nas.login();
  const start = Date.now();
  const r = await nas.request('/api/manage/edit', { method: 'POST', data: { id: far.id, title: 'X' } });
  assert.equal(r.status, 503); assert.match((await r.json()).error, /Il fisso è spento/); assert.ok(Date.now() - start < 1500);
  const calls = st.seen.length;
  assert.equal((await nas.request(`/api/manage/skips?id=${far.id}`)).status, 503); assert.equal(st.seen.length, calls);
});
