import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { OfflineMusic, streamURL, musicCacheName, cachedRangeResponse, byteRange, estimatedBytes } from '../public/music-offline-cache.js';
import { flushListening } from '../public/music-listening.js';
class FakeCache {
  constructor() { this.data = new Map(); }
  key(key) { return new URL(typeof key === 'string' ? key : key.url, 'http://local').href; }
  async match(key) { return this.data.get(this.key(key))?.clone(); }
  async put(key, response) { this.data.set(this.key(key), response.clone()); }
  async delete(key) { return this.data.delete(this.key(key)); }
  async keys() { return [...this.data.keys()].map(url => new Request(url)); }
}
class FakeCaches {
  constructor() { this.data = new Map(); }
  async open(name) { if (!this.data.has(name)) this.data.set(name, new FakeCache()); return this.data.get(name); }
}
function fixture(scope = 'demo:bruno', options = {}) {
  const caches = options.caches || new FakeCaches(); const calls = [];
  const fetch = async (url, opts) => { calls.push(url); return options.fetch ? options.fetch(url, opts) : new Response('0123456789', { headers: { 'Content-Type': 'audio/mpeg' } }); };
  const storage = { estimate: async () => ({ quota: 1000, usage: 0 }), persist: async () => false, ...options.storage };
  return { manager: new OfflineMusic(scope, { caches, fetch, storage, lock: null }), caches, calls };
}
const song = id => ({ id, title: `Finto ${id}`, size: 10, duration: 10 });
const collection = (id, ids) => ({ type: 'playlist', id, name: `Finta ${id}`, songs: ids.map(song) });
test('offline: cache finta, raccolta atomica, riuso brani condivisi e rimozione senza perdere altre raccolte', async () => {
  const { manager: m, caches, calls } = fixture();
  const result = await m.download(collection('a', ['1', '2'])); assert.equal(result.bytes, 20); assert.equal(result.persistent, false);
  await m.download(collection('b', ['2', '3'])); assert.equal(calls.length, 3); assert.equal((await m.collections()).length, 2);
  const restored = fixture('demo:bruno', { caches }).manager; assert.equal((await restored.collections())[0].songs.length, 2);
  assert.equal((await fixture('demo:marta', { caches }).manager.collections()).length, 0);
  await m.remove('playlist:a'); const cache = await caches.open(musicCacheName('demo:bruno'));
  assert.equal(await cache.match(streamURL('1', 'demo:bruno')), undefined); assert.ok(await cache.match(streamURL('2', 'demo:bruno')));
  await m.download(collection('b', ['3'])); assert.equal(await cache.match(streamURL('2', 'demo:bruno')), undefined);
  assert.equal(m.used(await m.manifest()), 10);
});
test('offline: interruzione, quota, file vuoti e risposta parziale non segnano raccolte scaricate', async () => {
  const { manager: m, caches } = fixture('u:p', { fetch: url => new Response(url.includes('id=2&') ? 'errore' : '0123456789', { status: url.includes('id=2&') ? 500 : 200, headers: { 'Content-Type': 'audio/mpeg' } }) });
  await assert.rejects(m.download(collection('a', ['1', '2'])), /scarica/); assert.equal((await m.collections()).length, 0);
  assert.equal(await (await caches.open(musicCacheName('u:p'))).match(streamURL('1', 'u:p')), undefined);
  const tiny = fixture('x:p', { storage: { estimate: async () => ({ quota: 5, usage: 0 }) } });
  await assert.rejects(tiny.manager.download(collection('a', ['1'])), /spazio/); assert.equal(tiny.calls.length, 0);
  const partial = fixture('partial:p', { fetch: () => new Response('123', { status: 206, headers: { 'Content-Type': 'audio/mpeg' } }) });
  await assert.rejects(partial.manager.download(collection('a', ['1'])), /scarica/);
  const empty = fixture('empty:p', { fetch: () => new Response('', { headers: { 'Content-Type': 'audio/mpeg' } }) });
  await assert.rejects(empty.manager.download(collection('a', ['1'])), /vuoto/);
  const abort = new AbortController(); const aborted = fixture('abort:p', { fetch: () => { abort.abort(); return new Response('123', { headers: { 'Content-Type': 'audio/mpeg' } }); } });
  await assert.rejects(aborted.manager.download(collection('a', ['1']), { signal: abort.signal }), { name: 'AbortError' }); assert.equal((await aborted.manager.collections()).length, 0);
});
test('offline: limite, stima, cache eliminata dal browser e due download simultanei', async () => {
  const { manager: m, caches } = fixture('limits:p'); await m.setLimit(50 * 1024 ** 2); assert.equal((await m.estimate([song('a')])).limit, 50 * 1024 ** 2);
  await assert.rejects(m.setLimit(10), /limite/);
  await Promise.all([m.download(collection('a', ['1'])), m.download(collection('b', ['2']))]); assert.equal((await m.collections()).length, 2);
  const cache = await caches.open(musicCacheName('limits:p')); await cache.delete(streamURL('1', 'limits:p')); assert.equal((await m.collections()).length, 1);
  assert.ok(estimatedBytes([{ duration: 60, bitRate: 128 }]) > 900000);
});
test('offline Range: suffissi, intervalli aperti, ultimo byte e 416', async () => {
  for (const [header, value, contentRange] of [['bytes=2-4', '234', 'bytes 2-4/10'], ['bytes=7-', '789', 'bytes 7-9/10'], ['bytes=-2', '89', 'bytes 8-9/10'], ['bytes=9-99', '9', 'bytes 9-9/10']]) {
    const response = await cachedRangeResponse(new Response('0123456789', { headers: { 'Content-Type': 'audio/finto' } }), header);
    assert.equal(response.status, 206); assert.equal(response.headers.get('content-range'), contentRange); assert.equal(await response.text(), value);
  }
  for (const range of ['bytes=10-', 'bytes=-0', 'bytes=4-2', 'bytes=0-1,3-4', 'oops']) assert.equal((await cachedRangeResponse(new Response('0123456789'), range)).status, 416);
  assert.equal(byteRange('bytes=0-', 0), null);
});
test('service worker: serve solo cache esplicita dello scope, nessuna cache automatica degli stream', async () => {
  const source = (await readFile(new URL('../public/sw.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, ''); const events = {}, caches = new FakeCaches(); let network = 0;
  const cache = await caches.open(musicCacheName('u:p')); await cache.put('http://local' + streamURL('1', 'u:p'), new Response('0123456789'));
  vm.runInNewContext(source, { self: { location: { origin: 'http://local' }, addEventListener: (type, fn) => { events[type] = fn; } }, caches, musicCacheName, cachedRangeResponse, videoCacheName: 'v', videoManifestURL: '/m', videoRangeResponse: () => { throw new Error('video'); }, URL, Response, fetch: async () => { network++; return new Response('rete'); } });
  let pending; const req = new Request('http://local' + streamURL('1', 'u:p'), { headers: { Range: 'bytes=3-5' } }); events.fetch({ request: req, respondWith: p => { pending = p; } });
  assert.equal(await (await pending).text(), '345'); assert.equal(network, 0);
  events.fetch({ request: new Request('http://local' + streamURL('1', 'altro:p')), respondWith: p => { pending = p; } }); assert.equal(await (await pending).text(), 'rete'); assert.equal(network, 1);
  events.fetch({ request: new Request('http://local/api/music/stream?id=1'), respondWith: () => { throw new Error('stream senza scope intercettato'); } });
});
test('ascolti offline: invio ritentabile, cumulativi in corso e nessuna cancellazione prematura', async () => {
  const saved = new Map([['bruno', { play1: { seconds: 30 } }]]); const storage = { get: (k, fallback) => structuredClone(saved.get(k) || fallback), set: (k, v) => saved.set(k, v) };
  await flushListening(storage, 'bruno', async () => { throw new Error('senza rete'); }); assert.equal(saved.get('bruno').play1.seconds, 30);
  const sent = []; await flushListening(storage, 'bruno', async event => { sent.push(event.seconds); if (event.seconds === 30) storage.set('bruno', { play1: { seconds: 60 } }); });
  assert.deepEqual(sent, [30, 60]); assert.deepEqual(saved.get('bruno'), {});
});
