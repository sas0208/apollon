import path from 'node:path';
import { mkdir, readdir, stat, unlink, rename } from 'node:fs/promises';
import { run } from './media.js';
import { AUDIO } from './files.js';
import { atomicJson, readJson, idFor } from './util.js';

// Giro G: copertine vere per la musica. Si usa quello che c'è già nei file di casa, nell'ordine:
//   1. la copertina INCORPORATA nel primo brano della cartella (mp3, m4a, flac...) estratta con ffmpeg;
//   2. cover.jpg / folder.jpg / front.jpg... nella cartella dell'album;
//   3. (fuori da qui) Navidrome getCoverArt, se è collegato;
//   4. la copertina generata dall'interfaccia, solo come ultimo ripiego.
// Artista: artist.jpg se c'è, altrimenti un mosaico delle copertine dei suoi album.
// Una copertina per album, in coda lenta, con la firma del file da cui viene: se il file cambia si rifà.
export const SIZES = [80, 160, 400, 1000];
export const FOLDER_NAMES = ['cover', 'folder', 'front', 'albumart', 'album'];
export const ARTIST_NAMES = ['artist', 'artista'];
const IMAGE = /\.(jpe?g|png|webp)$/i;
const sizeFor = wanted => SIZES.find(s => s >= wanted) || SIZES.at(-1);
const baseOf = name => name.slice(0, name.length - path.extname(name).length).toLowerCase();

// Estrae (e ridimensiona al massimo a 1000 px) la prima immagine di un brano o la immagine stessa.
export function sourceArgs(input, output, { embedded }) {
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', input, ...(embedded ? ['-an', '-map', '0:v:0'] : []),
    '-frames:v', '1', '-vf', 'scale=1000:1000:force_original_aspect_ratio=decrease', '-q:v', '3', '-y', output];
}
export function sizeArgs(input, output, size) {
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', input,
    '-vf', `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`, '-frames:v', '1', '-q:v', size >= 1000 ? '3' : '4', '-y', output];
}
export function mosaicArgs(inputs, output, size = 1000) {
  const half = size / 2; const cells = [0, 1, 2, 3].map(i => inputs[i % inputs.length]);
  const graph = cells.map((_, i) => `[${i}:v]scale=${half}:${half}:force_original_aspect_ratio=increase,crop=${half}:${half},setsar=1[c${i}]`).join(';')
    + `;[c0][c1][c2][c3]xstack=inputs=4:layout=0_0|${half}_0|0_${half}|${half}_${half}[m]`;
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', ...cells.flatMap(c => ['-i', c]), '-filter_complex', graph, '-map', '[m]', '-frames:v', '1', '-q:v', '3', '-y', output];
}

export class MusicArt {
  constructor(config, files, tools = {}) {
    this.config = config; this.files = files; this.run = tools.run || run;
    this.dir = path.join(config.dataDir, 'copertine'); this.chain = Promise.resolve(); this.closed = false; this.controller = new AbortController();
    this.known = new Map(); this.crawlTask = null; this.report = { albums: 0, withArt: 0 };
  }
  async init() { await mkdir(this.dir, { recursive: true }); return this; }
  // Un lavoro alla volta: ffmpeg sul telefono non deve mai affollarsi.
  exclusive(fn) { const task = this.chain.then(() => (this.closed ? null : fn())); this.chain = task.catch(() => {}); return task; }
  cacheFile(key, size) { return path.join(this.dir, `${key}-${size}.jpg`); }
  async absolute(rel) { return this.files.resolve('Musica', rel, { directory: true }); }
  // Cosa c'è in una cartella: brani, immagini accanto, firma.
  async inspect(rel) {
    const dir = await this.absolute(rel); const entries = await readdir(dir, { withFileTypes: true });
    const audio = entries.filter(e => e.isFile() && !e.name.startsWith('.') && AUDIO.has(path.extname(e.name).toLowerCase())).map(e => e.name).sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
    const images = entries.filter(e => e.isFile() && !e.name.startsWith('.') && IMAGE.test(e.name)).map(e => e.name);
    const picked = names => { for (const wanted of names) { const hit = images.find(n => baseOf(n) === wanted); if (hit) return hit; } return null; };
    const folderImage = picked(FOLDER_NAMES); const artistImage = picked(ARTIST_NAMES);
    const sig = async name => { if (!name) return '-'; const s = await stat(path.join(dir, name)); return `${name}:${s.size}:${Math.round(s.mtimeMs)}`; };
    return { dir, audio, folderImage, artistImage, sig: [await sig(audio[0]), await sig(folderImage), audio.length].join('|') };
  }
  // Prepara (se serve) l'immagine di partenza di un album e dice da dove viene: 'incorporata', 'cartella' o null.
  async source(rel) {
    const key = idFor(`album/${rel}`); const info = await this.inspect(rel);
    const meta = await readJson(path.join(this.dir, `${key}.json`), null); const src = this.cacheFile(key, 'src');
    if (meta?.sig === info.sig && (meta.origin === null || await stat(src).then(s => s.isFile(), () => false))) return { key, origin: meta.origin, src, info };
    let origin = null; const tmp = path.join(this.dir, `${key}-src.tmp.jpg`);
    await this.removeSizes(key);
    if (info.audio.length) {
      // Il primo brano può non avere copertina: si provano fino a tre brani prima di passare alla cartella.
      for (const name of info.audio.slice(0, 3)) {
        try { await this.run('ffmpeg', sourceArgs(path.join(info.dir, name), tmp, { embedded: true }), 30000, this.controller.signal); if ((await stat(tmp)).size > 0) { origin = 'incorporata'; break; } }
        catch { await unlink(tmp).catch(() => {}); if (this.closed) return null; }
      }
    }
    if (!origin && info.folderImage) {
      try { await this.run('ffmpeg', sourceArgs(path.join(info.dir, info.folderImage), tmp, { embedded: false }), 30000, this.controller.signal); if ((await stat(tmp)).size > 0) origin = 'cartella'; }
      catch { await unlink(tmp).catch(() => {}); }
    }
    if (origin) await rename(tmp, src); else await unlink(src).catch(() => {});
    await atomicJson(path.join(this.dir, `${key}.json`), { sig: info.sig, origin, at: Date.now() });
    return { key, origin, src, info };
  }
  async removeSizes(key) { for (const size of SIZES) await unlink(this.cacheFile(key, size)).catch(() => {}); }
  // Il file immagine di un album nella misura chiesta, oppure null se non c'è nessuna copertina vera.
  album(rel, wanted = 400) {
    return this.exclusive(async () => {
      const { key, origin, src } = await this.source(rel); if (!origin) return null;
      const size = sizeFor(wanted); const file = this.cacheFile(key, size);
      if (!await stat(file).then(s => s.isFile(), () => false)) await this.run('ffmpeg', sizeArgs(src, file, size), 30000, this.controller.signal);
      return file;
    }).catch(() => null);
  }
  // Artista: artist.jpg (nella cartella dell'artista, sopra gli album) o mosaico delle copertine dei suoi album.
  artist(albumRels, wanted = 400) {
    return this.exclusive(async () => {
      const rels = [...new Set(albumRels)].sort(); if (!rels.length) return null;
      const parents = [...new Set(rels.map(r => path.posix.dirname(r)))];
      const key = idFor(`artista/${rels.join('|')}`); const size = sizeFor(wanted); const file = this.cacheFile(key, size);
      let artistImage = null; let artistDir = null;
      if (parents.length === 1 && parents[0] !== '.') { artistDir = parents[0]; artistImage = (await this.inspect(artistDir).catch(() => null))?.artistImage; }
      const sources = [];
      for (const rel of rels.slice(0, 12)) { const s = await this.source(rel).catch(() => null); if (s?.origin) sources.push(s); if (sources.length >= 4) break; }
      const sig = artistImage ? `foto:${artistImage}` : `mosaico:${sources.map(s => s.info.sig).join('|')}`;
      const meta = await readJson(path.join(this.dir, `${key}.json`), null);
      if (meta?.sig !== sig) { for (const s of SIZES) await unlink(this.cacheFile(key, s)).catch(() => {}); await atomicJson(path.join(this.dir, `${key}.json`), { sig, at: Date.now() }); }
      if (await stat(file).then(s => s.isFile(), () => false)) return file;
      if (artistImage) {
        const input = path.join(await this.absolute(artistDir), artistImage);
        await this.run('ffmpeg', sizeArgs(input, file, size), 30000, this.controller.signal); return file;
      }
      if (!sources.length) return null;
      const tmp = path.join(this.dir, `${key}-mosaico.tmp.jpg`);
      await this.run('ffmpeg', mosaicArgs(sources.map(s => s.src), tmp, 1000), 60000, this.controller.signal);
      if (size === 1000) await rename(tmp, file); else { await this.run('ffmpeg', sizeArgs(tmp, file, size), 30000, this.controller.signal); await unlink(tmp).catch(() => {}); }
      return file;
    }).catch(() => null);
  }
  // Prima passata lenta su tutta la musica: una cartella alla volta, con una pausa fra l'una e l'altra.
  crawl() {
    if (this.crawlTask || this.closed) return this.crawlTask;
    this.crawlTask = (async () => {
      const folders = []; const walk = async rel => {
        const entries = await readdir(await this.absolute(rel), { withFileTypes: true });
        if (rel && entries.some(e => e.isFile() && AUDIO.has(path.extname(e.name).toLowerCase()))) folders.push(rel);
        for (const e of entries) if (e.isDirectory() && !e.name.startsWith('.') && !e.isSymbolicLink()) await walk([rel, e.name].filter(Boolean).join('/'));
      };
      try { await walk(''); } catch { return; }
      this.report = { albums: folders.length, withArt: 0 };
      for (const rel of folders) {
        if (this.closed) break;
        const result = await this.exclusive(async () => { const s = await this.source(rel); if (s.origin) for (const size of [160, 400]) {
          const file = this.cacheFile(s.key, size); if (!await stat(file).then(x => x.isFile(), () => false)) await this.run('ffmpeg', sizeArgs(s.src, file, size), 30000, this.controller.signal);
        } return s.origin; }).catch(() => null);
        if (result) this.report.withArt++;
        await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, this.config.musicArtDelayMs ?? 1500); });
      }
    })().finally(() => { this.crawlTask = null; });
    return this.crawlTask;
  }
  // Il percorso di un brano secondo Navidrome → la cartella dell'album dentro la nostra raccolta Musica.
  async folderFor(songPath) {
    const parts = String(songPath || '').replaceAll('\\', '/').normalize('NFC').split('/').filter(Boolean).slice(0, -1);
    for (let i = 0; i < parts.length; i++) {
      const rel = parts.slice(i).join('/');
      if (!this.known.has(rel)) this.known.set(rel, await this.absolute(rel).then(() => true, () => false));
      if (this.known.get(rel)) return rel;
    }
    return null;
  }
  // Risposta a /api/music/cover: il file da servire, oppure null (allora tocca a Navidrome e poi alla copertina generata).
  async forRequest(id, wanted, songs, { cachedOnly = false } = {}) {
    const target = coverTarget(id, songs); if (!target) return null;
    const folders = []; for (const p of target.paths.slice(0, 400)) { const rel = await this.folderFor(p); if (rel && !folders.includes(rel)) folders.push(rel); }
    if (!folders.length) return null;
    if (cachedOnly) {
      const key = target.type === 'artist' ? idFor(`artista/${[...folders].sort().join('|')}`) : idFor(`album/${folders[0]}`);
      const file = this.cacheFile(key, sizeFor(wanted));
      return await stat(file).then(s => s.isFile(), () => false) ? file : null;
    }
    return target.type === 'artist' ? this.artist(folders, wanted) : this.album(folders[0], wanted);
  }
  status() { return { ...this.report, working: !!this.crawlTask }; }
  async close() { this.closed = true; this.controller.abort(); clearTimeout(this.timer); this.wake?.(); await this.crawlTask; await this.chain; }
}

// Dall'identificativo di copertina di Navidrome (mf-..., al-..., ar-...) alle cartelle locali dei brani.
export function coverTarget(id, songs) {
  if (typeof id !== 'string' || !id) return null;
  const match = song => id.startsWith('ar-') ? song.artistId === id.slice(3) : id.startsWith('al-') ? song.albumId === id.slice(3)
    : song.coverArt === id || song.albumId === id || song.id === id;
  const hits = songs.filter(match);
  return hits.length ? { type: id.startsWith('ar-') ? 'artist' : 'album', paths: hits.map(s => s.path).filter(Boolean), album: hits[0].album || '', artist: hits[0].artist || '' } : null;
}
