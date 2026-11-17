import path from 'node:path';
import { open } from 'node:fs/promises';
import { fail } from './util.js';

const DEFAULT_FILE = 'Libreria/catalogo_musica.json';
const MAX_BYTES = 32 * 1024 ** 2;
const normalize = value => typeof value === 'string' ? value.replace(/\\/g, '/').normalize('NFC') : '';
const label = value => typeof value === 'string' ? value.trim().slice(0, 150) : '';
function relative(value) {
  const name = normalize(value).replace(/^\.\//, '');
  return name && !name.startsWith('/') && !/[:\x00-\x1f]/.test(name) && !name.split('/').some(p => !p || p === '.' || p === '..') ? name : null;
}

// Match the complete path below the music root, never the title or basename alone.
export function matchSongs(entries, songs, base) {
  const wanted = new Map();
  const keys = entries.map(entry => {
    const file = relative(entry.file); const key = file ? [base === '.' ? '' : base, file].filter(Boolean).join('/') : null;
    if (key) wanted.set(key, new Map()); return key;
  });
  for (const song of songs) {
    if (typeof song.id !== 'string') continue;
    const parts = normalize(song.path).split('/');
    if (parts.includes('..')) continue;
    for (let i = 0; i < parts.length; i++) wanted.get(parts.slice(i).join('/'))?.set(song.id, song);
  }
  const result = []; const seen = new Set(); let missing = 0;
  for (const key of keys) {
    const matches = wanted.get(key);
    if (!matches || matches.size !== 1) { missing++; continue; }
    const song = matches.values().next().value;
    if (!seen.has(song.id)) { result.push(song); seen.add(song.id); }
  }
  return { songs: result, missing };
}

export class MusicCatalog {
  constructor(files, file = DEFAULT_FILE, musicPathPrefix) {
    this.files = files; this.file = file; this.indexes = new WeakMap();
    const prefix = musicPathPrefix ?? path.posix.dirname(file);
    this.prefix = prefix === '' || prefix === '.' ? '' : relative(prefix);
    if (this.prefix === null) throw new Error('Il prefisso dei percorsi Navidrome non è valido.');
  }
  async read() {
    try {
      // resolve checks the music root and rejects symbolic links and traversal.
      const target = await this.files.resolve('Musica', this.file);
      const handle = await open(target, 'r'); let raw;
      try {
        const info = await handle.stat();
        if (!info.isFile() || info.size > MAX_BYTES) throw new Error('size');
        // Bounded read also protects against a file growing while it is read.
        const bytes = Buffer.alloc(info.size + 1); let count = 0;
        while (count < bytes.length) {
          const { bytesRead } = await handle.read(bytes, count, bytes.length - count, count);
          if (!bytesRead) break; count += bytesRead;
        }
        if (count > info.size) throw new Error('changed'); raw = bytes.subarray(0, count).toString('utf8');
      } finally { await handle.close(); }
      const data = JSON.parse(raw.replace(/^\uFEFF/, ''));
      if (data.versione !== 1 || !Array.isArray(data.brani) || data.brani.length > 100000 || !Array.isArray(data.mood) || !Array.isArray(data.generi)) throw new Error('schema');
      const brani = data.brani.filter(b => b && relative(b.file)).map(b => ({ file: relative(b.file), mood: Array.isArray(b.mood) ? b.mood.map(label).filter(Boolean) : [], genere: label(b.genere), catalogAlbum: label(b.album), catalogYear: label(String(b.anno ?? '')),
        energia: Number.isFinite(b.energia) && b.energia >= 0 && b.energia <= 100 ? b.energia : null,
        bpm: Number.isFinite(b.bpm) && b.bpm > 0 ? b.bpm : null, tonalita: label(b.tonalita), problema: !!b.problema }));
      const counts = { mood: new Map(), generi: new Map() };
      for (const b of brani) {
        if (b.problema) continue;
        for (const mood of new Set(b.mood)) counts.mood.set(mood, (counts.mood.get(mood) || 0) + 1);
        counts.generi.set(b.genere, (counts.generi.get(b.genere) || 0) + 1);
      }
      const groups = (list, type) => [...new Map(list.slice(0, 500).filter(g => g && label(g.nome)).map(g => {
        const nome = label(g.nome);
        return [nome, { nome, descrizione: typeof g.descrizione === 'string' ? g.descrizione.slice(0, 500) : '', brani: counts[type].get(nome) || 0 }];
      })).values()].slice(0, 500);
      return { available: true, mood: groups(data.mood, 'mood'), generi: groups(data.generi, 'generi'), brani };
    } catch {
      return { available: false, mood: [], generi: [], brani: [], message: 'Mood e generi non sono disponibili. Puoi scegliere album, artisti e playlist.' };
    }
  }
  async home() { const { brani, ...home } = await this.read(); return home; }
  cachedSongs(auth) { return this.indexes.get(auth)?.value || []; }
  async songs(music, auth) {
    let entry = this.indexes.get(auth);
    if (!entry || entry.expires < Date.now()) {
      const promise = (async () => {
        const songs = []; const seen = new Set();
        for (let offset = 0; offset <= 100000;) {
          const result = await music.request('search3', auth, { query: '', songCount: 500, songOffset: offset, albumCount: 0, artistCount: 0 });
          const page = result.searchResult3?.song || [];
          if (!Array.isArray(page)) throw fail(502, 'L’indice musicale non è disponibile.');
          if (!page.length) return songs;
          let added = 0;
          for (const song of page) if (song && typeof song.id === 'string' && !seen.has(song.id)) { songs.push(song); seen.add(song.id); added++; }
          if (!added) throw fail(502, 'Navidrome non riesce a scorrere la raccolta. Usa le playlist Mood e Generi.');
          // Some servers cap page sizes below the requested count.
          offset += page.length;
        }
        throw fail(502, 'Raccolta troppo grande per i mood. Usa le playlist Mood e Generi.');
      })();
      entry = { expires: Date.now() + 60000, promise }; this.indexes.set(auth, entry);
      promise.then(value => { entry.value = value; }, () => {});
      promise.catch(() => { if (this.indexes.get(auth) === entry) this.indexes.delete(auth); });
    }
    return entry.promise;
  }
  async collection(type, name, music, auth) {
    if (!['mood', 'generi'].includes(type)) throw fail(400, 'Scegli un mood o un genere.');
    const catalog = await this.read();
    if (!catalog.available || !catalog[type].some(g => g.nome === name)) throw fail(404, 'Questa raccolta musicale non è disponibile. Torna alla musica e riprova.');
    const entries = catalog.brani.filter(b => !b.problema && (type === 'mood' ? b.mood.includes(name) : b.genere === name));
    const result = entries.length ? matchSongs(entries, await this.songs(music, auth), this.prefix) : { songs: [], missing: 0 };
    return { name, total: entries.length, ...result };
  }
  async enriched(music, auth) {
    const [catalog, songs] = await Promise.all([this.read(), this.songs(music, auth)]);
    const metadata = new Map(); const blocked = new Set();
    // Keep matching O(entries + songs), including ambiguous paths.
    const paths = new Map(catalog.brani.map(b => [[this.prefix, b.file].filter(Boolean).join('/'), new Set()]));
    for (const song of songs) {
      const parts = normalize(song.path).split('/'); if (parts.includes('..')) continue;
      for (let i = 0; i < parts.length; i++) paths.get(parts.slice(i).join('/'))?.add(song.id);
    }
    for (const entry of catalog.brani) {
      const key = [this.prefix, entry.file].filter(Boolean).join('/'); const ids = paths.get(key);
      if (entry.problema) { for (const id of ids || []) blocked.add(id); }
      else if (ids?.size === 1) metadata.set([...ids][0], entry);
    }
    return songs.filter(s => !blocked.has(s.id)).map(s => ({ ...s, ...metadata.get(s.id) }));
  }
}
