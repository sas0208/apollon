import { musicCacheName, manifestURL, streamURL } from './music-offline-range.js';
export { musicCacheName, manifestURL, streamURL, byteRange, cachedRangeResponse } from './music-offline-range.js';
// «Risparmio spazio» (low): il server ricodifica a 128 kbit/s; «Alta qualità» (high): il file originale.
export const LOW_KBPS = 128;
export function estimatedBytes(songs, quality = 'high') { return songs.reduce((n, s) => n + (quality === 'low' ? Math.ceil((Number(s.duration) || 240) * LOW_KBPS * 125 * 1.05) : Number(s.size) > 0 ? Number(s.size) : Math.ceil((Number(s.duration) || 240) * (Number(s.bitRate) || 192) * 125 * 1.1)), 0); }
const locks = new Map();
export class OfflineMusic {
  constructor(scope, { caches = globalThis.caches, fetch = (...args) => globalThis.fetch(...args), storage = globalThis.navigator?.storage, lock = globalThis.navigator?.locks } = {}) {
    Object.assign(this, { scope, caches, fetch, storage, lock }); this.name = musicCacheName(scope);
  }
  async manifest() {
    const response = await (await this.caches.open(this.name)).match(manifestURL);
    return response ? response.json() : { version: 1, tracks: {}, collections: {}, limitBytes: 1024 ** 3 };
  }
  async save(manifest) { await (await this.caches.open(this.name)).put(manifestURL, new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/json' } })); }
  exclusive(fn) {
    if (this.lock?.request) return this.lock.request(this.name, fn);
    const task = (locks.get(this.name) || Promise.resolve()).catch(() => {}).then(fn); locks.set(this.name, task.catch(() => {})); return task;
  }
  used(manifest) { return Object.values(manifest.tracks).reduce((n, t) => n + t.bytes, 0); }
  async collections() {
    if (!this.caches) return [];
    const m = await this.manifest(), cache = await this.caches.open(this.name); const result = [];
    for (const col of Object.values(m.collections)) {
      let complete = true;
      for (const id of col.ids) if (!m.tracks[id] || !(await cache.match(streamURL(id, this.scope)))) { complete = false; break; }
      if (complete) result.push({ ...col, songs: col.ids.map(id => m.tracks[id].song), bytes: col.ids.reduce((n, id) => n + m.tracks[id].bytes, 0), quality: col.ids.every(id => m.tracks[id].quality === 'low') ? 'low' : 'high', downloaded: true });
    }
    return result;
  }
  async estimate(songs, quality = 'high') {
    const m = await this.manifest(), system = await this.storage?.estimate?.() || {};
    const needed = estimatedBytes(songs.filter(s => !m.tracks[s.id]), quality);
    return { needed, used: this.used(m), limit: m.limitBytes, available: Math.max(0, Math.min(m.limitBytes - this.used(m), (system.quota ?? Infinity) - (system.usage || 0))), quota: system.quota };
  }
  async setLimit(bytes) {
    if (!Number.isFinite(bytes) || bytes < 50 * 1024 ** 2 || bytes > 20 * 1024 ** 3) throw new Error('Scegli un limite tra 50 MB e 20 GB.');
    return this.exclusive(async () => { const m = await this.manifest(); if (bytes < this.used(m)) throw new Error('Prima rimuovi qualche download per scendere a questo limite.'); m.limitBytes = bytes; await this.save(m); });
  }
  async download(collection, { signal, progress = () => {}, quality = 'high' } = {}) {
    return this.exclusive(async () => {
      const m = await this.manifest(), cache = await this.caches.open(this.name); const next = structuredClone(m), added = [];
      for (const request of await cache.keys()) {
        const url = new URL(typeof request === 'string' ? request : request.url, 'http://local');
        if (url.pathname === '/api/music/stream' && !m.tracks[url.searchParams.get('id')]) await cache.delete(request);
      }
      const songs = [...new Map(collection.songs.filter(s => !s.problema).map(s => [s.id, s])).values()];
      if (!songs.length) throw new Error('Questa raccolta non contiene brani da scaricare.');
      const space = await this.estimate(songs, quality); if (space.needed > space.available) throw new Error('Non c’è abbastanza spazio. Aumenta il limite o rimuovi un download.');
      const persistent = await this.storage?.persist?.().catch(() => false) || false;
      try {
        for (let i = 0; i < songs.length; i++) {
          signal?.throwIfAborted(); const song = songs[i]; const url = streamURL(song.id, this.scope);
          if (!next.tracks[song.id] || !(await cache.match(url))) {
            const response = await this.fetch(quality === 'low' ? `${url}&q=low` : url, { cache: 'no-store', signal });
            if (!response.ok || response.status !== 200 || !/^(audio\/|application\/octet-stream)/i.test(response.headers.get('Content-Type') || '')) throw new Error('Un brano non si scarica. Controlla la rete e riprova.');
            const blob = await response.blob(); signal?.throwIfAborted();
            if (!blob.size) throw new Error('Il brano ricevuto è vuoto.');
            const available = await this.storage?.estimate?.() || {};
            const previousBytes = next.tracks[song.id]?.bytes || 0;
            if (this.used(next) - previousBytes + blob.size > next.limitBytes || blob.size > (available.quota ?? Infinity) - (available.usage || 0)) throw new Error('Spazio esaurito durante il download. Rimuovi qualche download e riprova.');
            await cache.put(url, new Response(blob, { headers: { 'Content-Type': response.headers.get('Content-Type'), 'Content-Length': String(blob.size), 'Accept-Ranges': 'bytes' } }));
            added.push(song.id); next.tracks[song.id] = { song, bytes: blob.size, quality };
          }
          progress(i + 1, songs.length);
        }
        next.collections[`${collection.type}:${collection.id}`] = { id: collection.id, type: collection.type, name: collection.name, artist: collection.artist, cover: collection.cover, ids: songs.map(s => s.id) };
        // La copertina resta per la lista dei download senza rete; se non arriva si usa quella disegnata dall'interfaccia.
        if (collection.cover) try { const art = await this.fetch(collection.cover, { signal }); if (art.ok) await cache.put(collection.cover, art); } catch (error) { if (error.name === 'AbortError') throw error; }
        const keep = new Set(Object.values(next.collections).flatMap(c => c.ids)); const obsolete = Object.keys(next.tracks).filter(id => !keep.has(id));
        for (const id of obsolete) delete next.tracks[id];
        signal?.throwIfAborted(); await this.save(next);
        for (const id of obsolete) await cache.delete(streamURL(id, this.scope));
        return { persistent, bytes: this.used(next) };
      } catch (error) {
        for (const id of added) if (!m.tracks[id]) await cache.delete(streamURL(id, this.scope));
        throw error;
      }
    });
  }
  async remove(key) {
    return this.exclusive(async () => {
      const m = await this.manifest(), cache = await this.caches.open(this.name); const cover = m.collections[key]?.cover; delete m.collections[key];
      const removeCover = cover && !Object.values(m.collections).some(collection => collection.cover === cover);
      const keep = new Set(Object.values(m.collections).flatMap(c => c.ids));
      const removed = Object.keys(m.tracks).filter(id => !keep.has(id));
      for (const id of removed) delete m.tracks[id];
      await this.save(m);
      if (removeCover) await cache.delete(cover);
      for (const id of removed) await cache.delete(streamURL(id, this.scope));
    });
  }
}
