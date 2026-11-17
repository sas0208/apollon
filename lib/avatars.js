import path from 'node:path';
import { stat, rm, rename } from 'node:fs/promises';
import { OnlineArt } from './online-art.js';
import { atomicJson, idFor, fail } from './util.js';

// Indice separato: anche gli esiti vuoti/falliti restano su disco, senza richieste a ogni apertura.
export class AvatarChoices extends OnlineArt {
  constructor(config, store, library, onlineArt, tools) {
    super(config, store, tools);
    this.library = library; this.onlineArt = onlineArt;
    this.dir = path.join(config.dataDir, 'avatar'); this.indexFile = path.join(this.dir, 'indice.json');
  }
  ids() {
    const ids = new Set();
    for (const item of this.library.items) {
      const { kind, query } = this.library.onlineQuery(item);
      if (kind !== 'anime') continue;
      const id = this.onlineArt.index[this.onlineArt.keyFor(kind, query)]?.anilistId;
      if (Number.isInteger(id) && id > 0) ids.add(id);
    }
    return [...ids];
  }
  async pause() {
    await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, this.config.metadataDelayMs ?? 2000); });
    this.wake = null;
  }
  async choices() {
    return this.exclusive(async () => {
      const result = []; const seen = new Set();
      for (const id of this.ids()) {
        if (this.closed || result.length >= 40) break;
        let entry = this.index[id];
        if (!entry && this.enabled()) {
          // Condivide la coda delle copertine, senza sovrapporre richieste AniList.
          entry = await this.onlineArt.exclusive(async () => {
            await this.pause();
            const entry = { characters: [] };
            if (this.closed || !this.enabled()) return null;
            try {
              const data = await this.json('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: 'query($id:Int){Media(id:$id){characters(sort:FAVOURITES_DESC,perPage:6){nodes{name{full} image{large}}}}}', variables: { id } }) });
              entry.characters = (data?.data?.Media?.characters?.nodes || []).slice(0, 6).map(n => ({
                name: String(n?.name?.full || '').trim().slice(0, 150), source: n?.image?.large
              })).filter(n => n.name && typeof n.source === 'string');
            } catch { /* Si conserva anche il tentativo fallito. */ }
            this.index[id] = entry; await atomicJson(this.indexFile, this.index); return entry;
          });
        }
        for (const character of entry?.characters || []) {
          if (this.closed || result.length >= 40) break;
          const key = idFor(character.source);
          if (seen.has(key)) continue; seen.add(key);
          let image = this.index[`image:${key}`];
          if (!image && this.enabled()) {
            await this.pause(); if (this.closed || !this.enabled()) break;
            image = { tried: true };
            const out = `${key}.jpg`; let original;
            try {
              if (!this.ffmpeg) throw new Error('Manca ffmpeg.');
              original = await this.download(character.source, `${key}-original`);
              await this.ffmpeg(['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1', '-i', path.join(this.dir, original),
                '-vf', "scale=w='min(400,iw)':h='min(400,ih)':force_original_aspect_ratio=decrease", '-frames:v', '1', '-q:v', '3', '-y', path.join(this.dir, `${key}-tmp.jpg`)]);
              await rename(path.join(this.dir, `${key}-tmp.jpg`), path.join(this.dir, out));
              image.file = out;
            } catch { /* Nessun file incompleto nel catalogo. */ }
            finally {
              if (original) await rm(path.join(this.dir, original), { force: true });
              await rm(path.join(this.dir, `${key}-tmp.jpg`), { force: true });
            }
            this.index[`image:${key}`] = image; await atomicJson(this.indexFile, this.index);
          }
          if (image?.file && await stat(path.join(this.dir, image.file)).then(s => s.isFile(), () => false)) result.push({ name: character.name, url: `/media/avatar/${image.file}` });
        }
      }
      return result;
    });
  }
  async file(url) {
    if (typeof url !== 'string' || !/^\/media\/avatar\/[a-f0-9]{24}\.jpg$/.test(url)) throw fail(400, 'Immagine del profilo non valida.');
    const name = url.split('/').at(-1);
    if (!Object.values(this.index).some(e => e.file === name)) throw fail(400, 'Scegli un’immagine disponibile.');
    const file = path.join(this.dir, name); await stat(file); return file;
  }
  async close() { this.closed = true; clearTimeout(this.timer); this.wake?.(); await this.chain; }
}
