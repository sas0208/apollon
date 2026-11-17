import { CHUNK, videoCacheName, videoManifestURL, partURL, downloadedBytes } from './video-offline-range.js';
export { CHUNK, videoCacheName, videoManifestURL, partURL, playURL, videoRangeResponse, downloadedBytes } from './video-offline-range.js';
// Quanto pesa un video scaricato: l'originale com'è, oppure la versione leggera (stimata finché non è pronta).
export const estimateBytes = (item, quality) => quality === 'light' ? Math.round((Number(item.size) || 0) * 0.45) : Number(item.size) || 0;
const TEXT_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text']);
export const subtitleURLs = item => [...new Set([
  ...(item.subtitles || []).map((_, i) => `/media/${item.id}/subtitle/${i}`),
  ...(item.streams || []).filter(s => s.type === 'subtitle' && TEXT_CODECS.has(String(s.codec).toLowerCase())).map(s => `/media/${item.id}/subtitle/s${s.index}`)
])];
// Il manager dei video scaricati. Vive nella pagina (non nel service worker): un download alla volta, a pezzi, sempre
// dentro la memoria dell'app (Cache Storage), mai nella galleria o nella cartella Download del telefono.
export class OfflineVideo {
  constructor({ caches = globalThis.caches, fetch = (...args) => globalThis.fetch(...args), storage = globalThis.navigator?.storage, chunk = CHUNK, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
    Object.assign(this, { caches, fetch, storage, chunk, sleep }); this.jobs = new Map(); this.listeners = new Set(); this.tail = Promise.resolve(); this.m = null; this.writing = Promise.resolve();
  }
  onchange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) try { fn(); } catch { /* una vista chiusa non ferma il download */ } }
  async cache() { return this.caches.open(videoCacheName); }
  async load() {
    if (this.m) return this.m;
    const response = await (await this.cache()).match(videoManifestURL); this.m = response ? await response.json() : { version: 1, entries: {} };
    // Un download rimasto a metà perché l'app è stata chiusa non sta più scaricando: si riprende dal pezzo a cui era arrivato.
    for (const entry of Object.values(this.m.entries)) if (entry.state === 'downloading' && !this.jobs.has(entry.id)) entry.state = 'paused';
    return this.m;
  }
  persist() {
    const body = JSON.stringify(this.m);
    return this.writing = this.writing.catch(() => {}).then(async () => (await this.cache()).put(videoManifestURL, new Response(body, { headers: { 'Content-Type': 'application/json' } })));
  }
  async list() { return Object.values((await this.load()).entries); }
  async completed() { return new Set((await this.list()).filter(e => e.state === 'done').map(e => e.id)); }
  async used() { return (await this.list()).reduce((n, e) => n + downloadedBytes(e), 0); }
  // Mette in coda un video; ritorna subito. Lo stato vive in this.jobs e in this.m.entries.
  enqueue(item, quality = 'original') {
    if (this.jobs.has(item.id)) return this.jobs.get(item.id);
    const job = { id: item.id, item, quality, state: 'queued', done: 0, total: 0, controller: new AbortController(), discard: false, error: '' };
    this.jobs.set(item.id, job); this.lastError = '';
    job.promise = this.tail = this.tail.catch(() => {}).then(() => this.run(job)).catch(error => { job.error = error.name === 'AbortError' ? '' : error.message; })
      .finally(() => { this.jobs.delete(item.id); this.lastError = job.error || this.lastError; this.emit(); });
    this.emit(); return job;
  }
  pause(id) { const job = this.jobs.get(id); if (job) job.controller.abort(); }
  async cancel(id) { const job = this.jobs.get(id); if (job) { job.discard = true; job.controller.abort(); await job.promise; } await this.remove(id); }
  async remove(id) {
    const job = this.jobs.get(id); if (job) { job.discard = true; job.controller.abort(); await job.promise; }
    const m = await this.load(); const entry = m.entries[id]; if (!entry) return;
    delete m.entries[id]; await this.persist(); await this.dropFiles(entry); this.emit();
  }
  async dropFiles(entry) {
    const cache = await this.cache();
    for (let n = 0; n < entry.parts; n++) await cache.delete(partURL(entry.id, n));
    await cache.delete(`/media/${entry.id}/poster?s=260`);
    for (const url of subtitleURLs(entry.item)) await cache.delete(url);
  }
  async json(route, data) {
    const response = await this.fetch(route, { method: data ? 'POST' : 'GET', cache: 'no-store', ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}) });
    if (!response.ok) throw new Error('Il programma di casa non risponde. Controlla la rete e riprova.'); return response.json();
  }
  // «Standard»: la versione leggera si prepara sul server (passa avanti alla coda) e qui si aspetta che sia pronta.
  async prepareLight(job) {
    job.state = 'preparing'; this.emit(); const id = job.id;
    for (;;) {
      job.controller.signal.throwIfAborted();
      const info = await this.json(`/api/versions/item?id=${encodeURIComponent(id)}`);
      if (info.state === 'ready') return info;
      if (info.state === 'failed') throw new Error('Non sono riuscito a preparare la versione leggera. Riprova, oppure scegli l’originale.');
      if (info.state === 'none') await this.json('/api/versions', { ids: [id], first: true });
      await this.sleep(1500);
    }
  }
  async extras(item, cache, signal) {
    const urls = [...(item.images?.poster ? [`/media/${item.id}/poster?s=260`] : []), ...subtitleURLs(item)];
    for (const url of urls) try { const response = await this.fetch(url, { signal }); if (response.ok) await cache.put(url, response); } catch (error) { if (error.name === 'AbortError') throw error; }
  }
  async run(job) {
    const { item, quality } = job; const signal = job.controller.signal; const m = await this.load(); const cache = await this.cache(); let entry;
    try {
      signal.throwIfAborted();
      if (quality === 'light') await this.prepareLight(job);
      const url = `/media/${item.id}${quality === 'light' ? '?q=480' : ''}`;
      const head = await this.fetch(url, { method: 'HEAD', cache: 'no-store', signal });
      const total = Number(head.headers.get('Content-Length'));
      if (!head.ok || !(total > 0)) throw new Error('Il video non è raggiungibile. Controlla la rete e riprova.');
      entry = m.entries[item.id];
      if (entry && (entry.quality !== quality || entry.total !== total || entry.chunk !== this.chunk)) { await this.dropFiles(entry); entry = null; }
      if (!entry) entry = m.entries[item.id] = { id: item.id, quality, total, chunk: this.chunk, type: head.headers.get('Content-Type') || 'video/mp4', parts: Math.ceil(total / this.chunk), done: 0, state: 'downloading', item, addedAt: Date.now() };
      if (entry.state === 'done') return;
      entry.state = 'downloading'; entry.item = item;
      const space = await this.storage?.estimate?.() || {}; const need = total - downloadedBytes(entry);
      if (need > (space.quota ?? Infinity) - (space.usage || 0)) throw new Error('Non c’è abbastanza spazio sul telefono. Elimina qualche download e riprova.');
      await this.storage?.persist?.().catch(() => false);
      Object.assign(job, { state: 'downloading', total, done: downloadedBytes(entry) }); await this.persist(); this.emit();
      await this.extras(item, cache, signal);
      for (let n = entry.done; n < entry.parts; n++) {
        signal.throwIfAborted();
        const from = n * this.chunk, to = Math.min(total, from + this.chunk) - 1;
        const response = await this.fetch(url, { headers: { Range: `bytes=${from}-${to}` }, cache: 'no-store', signal });
        if (response.status !== 206 && !(response.status === 200 && entry.parts === 1)) throw new Error('Il download si è interrotto. Riprova: riparte da dove era arrivato.');
        const blob = await response.blob(); signal.throwIfAborted();
        if (blob.size !== to - from + 1) throw new Error('Il download si è interrotto. Riprova: riparte da dove era arrivato.');
        await cache.put(partURL(item.id, n), new Response(blob));
        entry.done = n + 1; job.done = downloadedBytes(entry); await this.persist(); this.emit();
      }
      entry.state = 'done'; await this.persist();
    } catch (error) {
      if (entry && m.entries[item.id] === entry && !job.discard) { entry.state = 'paused'; await this.persist().catch(() => {}); }
      throw error;
    }
  }
}
