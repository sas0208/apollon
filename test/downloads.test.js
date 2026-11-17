// Scarica sul telefono: pezzi con Range, riprese, versione leggera su richiesta, musica a 128 kbit/s, avanzamento senza rete.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fixture, fakeNavidrome } from './helpers.js';
import { OfflineVideo, videoRangeResponse, partURL, videoCacheName, videoManifestURL, downloadedBytes, estimateBytes } from '../public/video-offline.js';
import { notePending, syncPending, asProgress } from '../public/downloads.js';
import { OfflineMusic, estimatedBytes, streamURL } from '../public/music-offline-cache.js';
import { musicArgs } from '../lib/music-transcode.js';

class FakeCache {
  constructor() { this.data = new Map(); }
  key(key) { return new URL(typeof key === 'string' ? key : key.url, 'http://local').href; }
  async match(key) { return this.data.get(this.key(key))?.clone(); }
  async put(key, response) { this.data.set(this.key(key), response.clone()); }
  async delete(key) { return this.data.delete(this.key(key)); }
  async keys() { return [...this.data.keys()].map(url => new Request(url)); }
}
class FakeCaches { constructor() { this.data = new Map(); } async open(name) { if (!this.data.has(name)) this.data.set(name, new FakeCache()); return this.data.get(name); } }

// Un server finto di casa: file da 10 byte, HEAD, Range, e lo stato della versione leggera.
function home({ body = '0123456789', light = ['working', 'ready'] } = {}) {
  const calls = []; let polls = 0;
  const fetch = async (url, options = {}) => {
    calls.push({ url, ...options });
    if (url.startsWith('/api/versions/item')) return Response.json({ state: light[Math.min(polls++, light.length - 1)] });
    if (url === '/api/versions') return Response.json({}, { status: 202 });
    if (url.includes('/poster') || url.includes('/subtitle')) return new Response('immagine', { headers: { 'Content-Type': 'image/jpeg' } });
    const data = url.includes('q=480') ? body.slice(0, 6) : body;
    if (options.method === 'HEAD') return new Response(null, { headers: { 'Content-Length': String(data.length), 'Content-Type': 'video/mp4' } });
    const m = /bytes=(\d+)-(\d+)/.exec(options.headers?.Range || '');
    if (!m) return new Response(data);
    return new Response(data.slice(Number(m[1]), Number(m[2]) + 1), { status: 206 });
  };
  return { fetch, calls };
}
const item = (id, extra = {}) => ({ id, title: `Episodio ${id}`, series: 'Serie finta', season: 1, episode: Number(id), size: 10, subtitles: [{ language: 'it' }], images: { poster: true }, ...extra });
const settle = async job => { await job.promise; };

test('video scaricato: risposte Range dai pezzi (inizio, salto, fine aperta, ultimi byte, 416)', async () => {
  const caches = new FakeCaches(); const h = home();
  const manager = new OfflineVideo({ caches, fetch: h.fetch, chunk: 4, storage: { estimate: async () => ({ quota: 1000, usage: 0 }), persist: async () => true } });
  await settle(manager.enqueue(item('1'), 'original'));
  const entry = (await manager.list())[0]; assert.equal(entry.state, 'done'); assert.equal(entry.parts, 3); assert.equal(downloadedBytes(entry), 10);
  const cache = await caches.open(videoCacheName);
  for (const [range, text, header] of [['bytes=0-3', '0123', 'bytes 0-3/10'], ['bytes=5-8', '5678', 'bytes 5-8/10'], ['bytes=8-', '89', 'bytes 8-9/10'], ['bytes=-2', '89', 'bytes 8-9/10']]) {
    const r = await videoRangeResponse(cache, entry, range); assert.equal(r.status, 206); assert.equal(await r.text(), text); assert.equal(r.headers.get('content-range'), header);
  }
  assert.equal(await (await videoRangeResponse(cache, entry, null)).text(), '0123456789');
  for (const bad of ['bytes=10-', 'bytes=4-2', 'oops']) assert.equal((await videoRangeResponse(cache, entry, bad)).status, 416);
  // Locandina e sottotitoli restano con il video.
  assert.ok(await cache.match('/media/1/poster?s=260')); assert.ok(await cache.match('/media/1/subtitle/0'));
  assert.equal((await manager.completed()).has('1'), true);
});

test('video scaricato: interruzione = in pausa, la ripresa riparte dal pezzo a cui era arrivato; Elimina libera tutto', async () => {
  const caches = new FakeCaches(); const h = home(); let stop;
  const flaky = async (url, options = {}) => { if (options.headers?.Range === 'bytes=4-7') { stop?.abort(); throw Object.assign(new Error('abort'), { name: 'AbortError' }); } return h.fetch(url, options); };
  const manager = new OfflineVideo({ caches, fetch: flaky, chunk: 4, storage: { estimate: async () => ({ quota: 1000, usage: 0 }) } });
  const job = manager.enqueue(item('1'), 'original'); stop = job.controller; await settle(job);
  let entry = (await manager.list())[0]; assert.equal(entry.state, 'paused'); assert.equal(entry.done, 1);
  // Riaprendo l'app un download rimasto "in corso" risulta in pausa, non fantasma.
  const reopened = new OfflineVideo({ caches, fetch: h.fetch, chunk: 4 }); entry = (await reopened.list())[0]; assert.equal(entry.state, 'paused');
  const before = h.calls.length; await settle(reopened.enqueue(item('1'), 'original'));
  const ranges = h.calls.slice(before).map(c => c.headers?.Range).filter(Boolean); assert.deepEqual(ranges, ['bytes=4-7', 'bytes=8-9']);
  assert.equal((await reopened.list())[0].state, 'done');
  await reopened.remove('1'); const cache = await caches.open(videoCacheName);
  assert.equal(await cache.match(partURL('1', 0)), undefined); assert.equal(await cache.match('/media/1/poster?s=260'), undefined); assert.deepEqual(await reopened.list(), []);
  // Annulla (a metà) toglie anche i pezzi già scaricati.
  const again = new OfflineVideo({ caches, fetch: flaky, chunk: 4 }); const j = again.enqueue(item('2'), 'original'); stop = j.controller; await j.promise;
  await again.cancel('2'); assert.equal(await cache.match(partURL('2', 0)), undefined); assert.deepEqual(await again.list(), []);
});

test('video scaricato: Standard chiede la versione leggera al server (passa avanti alla coda), aspetta che sia pronta e scarica quella', async () => {
  const caches = new FakeCaches(); const h = home({ light: ['queued', 'working', 'ready'] }); const states = [];
  const manager = new OfflineVideo({ caches, fetch: h.fetch, chunk: 4, sleep: async () => {}, storage: { estimate: async () => ({ quota: 1000, usage: 0 }) } });
  manager.onchange(() => states.push([...manager.jobs.values()][0]?.state));
  await settle(manager.enqueue(item('1'), 'light'));
  assert.ok(states.includes('preparing')); const entry = (await manager.list())[0];
  assert.equal(entry.quality, 'light'); assert.equal(entry.total, 6); assert.equal(entry.state, 'done');
  assert.ok(h.calls.every(c => !c.url.startsWith('/media/1') || c.url.includes('q=480') || c.url.includes('/poster') || c.url.includes('/subtitle')));
  assert.equal(estimateBytes({ size: 1000 }, 'light'), 450); assert.equal(estimateBytes({ size: 1000 }, 'original'), 1000);
  // Se il server non riesce a prepararla, errore chiaro e niente a metà.
  const bad = new OfflineVideo({ caches: new FakeCaches(), fetch: home({ light: ['failed'] }).fetch, sleep: async () => {} }); const job = bad.enqueue(item('3'), 'light'); await settle(job);
  assert.match(bad.lastError, /versione leggera/); assert.deepEqual(await bad.list(), []);
});

test('video scaricato: poco spazio ferma subito, senza scaricare', async () => {
  const h = home(); const manager = new OfflineVideo({ caches: new FakeCaches(), fetch: h.fetch, chunk: 4, storage: { estimate: async () => ({ quota: 5, usage: 0 }) } });
  await settle(manager.enqueue(item('1'), 'original')); assert.match(manager.lastError, /spazio/); assert.ok(!h.calls.some(c => c.headers?.Range));
});

test('avanzamento visto senza rete: resta sul telefono, parte quando torna la rete, il server più recente vince', async () => {
  const pending = {}; notePending(pending, 'a', { position: 40, duration: 100 }, 1000); notePending(pending, 'b', { position: 99, duration: 100 }, 1000); notePending(pending, 'c', { position: 10, duration: 100 }, 1000);
  assert.equal(pending.a.watched, false); assert.equal(pending.b.watched, true); assert.deepEqual(asProgress({ a: pending.a }).a, { position: 40, duration: 100, watched: false, updated: 1000 });
  const sent = []; const api = async (route, o = {}) => {
    if (route.startsWith('/api/progress?')) return { c: { updated: 5000 } };
    sent.push([route, o.data]); return {};
  };
  assert.deepEqual(await syncPending('bruno', pending, api), {});
  assert.deepEqual(sent, [['/api/progress', { profile: 'bruno', id: 'a', position: 40, duration: 100 }], ['/api/progress/batch', { ids: ['b'], profile: 'bruno', watched: true }]]);
  // Senza rete resta tutto da riprovare; un errore del server (500) pure, un 404 no.
  const offline = async () => { throw new Error('rete'); }; await assert.rejects(syncPending('bruno', pending, offline));
  const flaky = async (route) => { if (route.startsWith('/api/progress?')) return {}; throw Object.assign(new Error('x'), { status: route.endsWith('batch') ? 404 : 500 }); };
  assert.deepEqual(Object.keys(await syncPending('bruno', pending, flaky)).sort(), ['a', 'c']);
});

test('musica: qualità Risparmio spazio chiede &q=low e salva sotto l’indirizzo di sempre; la stima pesa meno', async () => {
  assert.ok(estimatedBytes([{ duration: 200, size: 9e6 }], 'low') < estimatedBytes([{ duration: 200, size: 9e6 }], 'high'));
  assert.equal(estimatedBytes([{ duration: 60 }], 'low'), Math.ceil(60 * 128 * 125 * 1.05));
  const caches = new FakeCaches(); const urls = [];
  const fetch = async url => { urls.push(url); return new Response('aac', { headers: { 'Content-Type': 'audio/mp4' } }); };
  const m = new OfflineMusic('u:p', { caches, fetch, storage: { estimate: async () => ({ quota: 1e9, usage: 0 }) }, lock: null });
  await m.download({ type: 'album', id: 'a', name: 'Album', cover: '/api/music/cover?id=x', songs: [{ id: '1', title: 'Uno', duration: 10 }] }, { quality: 'low' });
  assert.deepEqual(urls, [`${streamURL('1', 'u:p')}&q=low`, '/api/music/cover?id=x']);
  const [col] = await m.collections(); assert.equal(col.quality, 'low'); assert.equal(col.bytes, 3);
  assert.equal(await (await (await caches.open(m.name)).match(streamURL('1', 'u:p'))).text(), 'aac');
  await m.remove('album:a'); assert.equal(await (await caches.open(m.name)).match('/api/music/cover?id=x'), undefined);
});

test('server: la versione leggera di chi scarica passa avanti alla coda, con stato e dimensioni per titolo', async t => {
  let release; const gate = new Promise(resolve => { release = resolve; }); const order = [];
  const f = await fixture({ versionDelayMs: 0, mediaTools: { async run(command, args) { order.push(path.basename(args[args.indexOf('-i') + 1])); await gate; await writeFile(args.at(-1), 'leggera'); return ''; } } });
  t.after(() => f.close()); await f.login();
  const [a, b, c] = [await f.video('A (2024).mp4', 'Film', '0123456789'), await f.video('B (2024).mp4', 'Film', '0123456789'), await f.video('C (2024).mp4', 'Film', '0123456789')];
  await f.request('/api/versions', { method: 'POST', data: { ids: [a.id, b.id, c.id] } }); await new Promise(r => setTimeout(r, 40));
  assert.equal((await (await f.request(`/api/versions/item?id=${c.id}`)).json()).state, 'queued');
  await f.request('/api/versions', { method: 'POST', data: { ids: [c.id], first: true } });
  assert.equal((await (await f.request(`/api/versions/item?id=${a.id}`)).json()).state, 'working');
  const info = await (await f.request(`/api/versions/item?id=${c.id}`)).json(); assert.equal(info.original, 10); assert.equal(info.estimate, 5);
  release(); await f.app.versions.wait();
  assert.deepEqual(order, ['A (2024).mp4', 'C (2024).mp4', 'B (2024).mp4']);
  const done = await (await f.request(`/api/versions/item?id=${c.id}`)).json(); assert.equal(done.state, 'ready'); assert.equal(done.bytes, 7);
  assert.equal((await f.request('/api/versions/item?id=' + '0'.repeat(24))).status, 404);
  // HEAD dà la dimensione che il telefono usa per dividere in pezzi.
  assert.equal((await f.request(`/media/${c.id}?q=480`, { method: 'HEAD' })).headers.get('content-length'), '7');
});

test('server: musica a 128 kbit/s su richiesta, una sola ricodifica, tenuta in data, mai a pezzi', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close()); const runs = []; let fail = false;
  const f = await fixture({ navidromeUrl: nav.url, mediaTools: { async run(command, args) { runs.push({ command, args }); await new Promise(r => setTimeout(r, 30)); if (fail) throw new Error('ffmpeg rotto'); await writeFile(args.at(-1), 'aac finto'); return ''; } } });
  t.after(() => f.close());
  assert.equal((await f.request('/api/music/stream?id=s1&q=low')).status, 401);
  await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  const [one, two] = await Promise.all([f.request('/api/music/stream?id=s1&q=low'), f.request('/api/music/stream?id=s1&q=low')]);
  assert.equal(one.headers.get('content-type'), 'audio/mp4'); assert.equal(await one.text(), 'aac finto'); assert.equal(await two.text(), 'aac finto'); assert.equal(runs.length, 1);
  const args = runs[0].args; assert.equal(args[args.indexOf('-b:a') + 1], '128k'); assert.equal(args[args.indexOf('-threads') + 1], '1'); assert.deepEqual(args, musicArgs(args[args.indexOf('-i') + 1], args.at(-1)));
  const part = await f.request('/api/music/stream?id=s1&q=low', { headers: { Range: 'bytes=0-2' } }); assert.equal(part.status, 206); assert.equal(await part.text(), 'aac'); assert.equal(runs.length, 1);
  const original = await f.request('/api/music/stream?id=s1'); assert.equal(await original.text(), '0123456789'); assert.equal(runs.length, 1);
  const files = await readdir(path.join(f.app.config.dataDir, 'musica-128')); assert.deepEqual(files.filter(n => !n.endsWith('.m4a')), []); assert.equal(files.length, 1);
  fail = true; const bad = await f.request('/api/music/stream?id=s2&q=low'); assert.equal(bad.status, 502);
  assert.deepEqual((await readdir(path.join(f.app.config.dataDir, 'musica-128'))).length, 1);
  assert.ok((await stat(f.app.musicTranscode.file('s1'))).size > 0);
});
