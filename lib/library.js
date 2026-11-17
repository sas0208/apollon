import path from 'node:path';
import { readdir, lstat, mkdir, stat, copyFile } from 'node:fs/promises';
import { idFor, atomicJson, readJson, fail } from './util.js';
import { VIDEO } from './files.js';
import { probe, run } from './media.js';
import { scoreFrame, samplePoints, SAMPLE } from './frame-score.js';

export function cleanName(value) {
  return value.replace(/\[[^\]]*\]/g, '').replace(/[._]/g, ' ').replace(/\b(1080p|2160p|720p|480p|h264|h265|x264|x265|hevc|web[- ]?dl|webrip|bluray|bdrip|aac|e?ac3|dts|subs?|hdr|10bit|remux|hdtv|dvdrip|multi|ita|eng)\b/ig, '').replace(/\s+/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '').trim();
}
export function parseName(relative, root) {
  const base = path.posix.basename(relative, path.posix.extname(relative));
  const folders = relative.split('/').slice(0, -1);
  const match = /(?:s(\d{1,3})[ ._-]*e(\d{1,4})|(\d{1,3})x(\d{1,4}))/i.exec(base);
  // «Titolo - Ep 37» (come arrivano gli anime scaricati) vale ovunque; «Titolo - 37» solo fra gli anime.
  const simpleAnime = match ? null : /(?:^|\s)-?\s*ep(?:isodio|isode)?[.\s_-]*(\d{1,4})(?=$|[\s.\-[(_])/i.exec(base)
    || (root === 'Anime' ? /\s-\s(\d{1,4})(?:\s|$|\[)/.exec(base) : null);
  const seasonFolder = folders.find(p => /^(stagione|season|s)\s*\d+$/i.test(p));
  const folderEpisode = !match && !simpleAnime && seasonFolder ? /^(\d{1,3})(?:[ ._-]+|$)/.exec(base) : null;
  const episode = match ? Number(match[2] || match[4]) : simpleAnime ? Number(simpleAnime[1]) : folderEpisode ? Number(folderEpisode[1]) : null;
  const season = match ? Number(match[1] || match[3]) : episode !== null ? Number(seasonFolder?.match(/\d+/)?.[0] || 1) : null;
  const episodeMatch = match || simpleAnime || folderEpisode;
  const prefix = episodeMatch ? cleanName(base.slice(0, episodeMatch.index)) : '';
  const seriesFolder = folders.filter(p => !/^(stagione|season|s)\s*\d+$/i.test(p)).at(-1);
  // «Dark/S01/Bugie S01E02.mkv»: nella cartella di stagione il nome prima di S01E02 è il titolo dell'episodio, non la serie (15/11)
  const norm = v => cleanName(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const prefixIsTitle = Boolean(match && seasonFolder && seriesFolder && prefix && !norm(prefix).includes(norm(seriesFolder)) && !norm(seriesFolder).includes(norm(prefix)));
  const series = episode !== null ? (prefixIsTitle ? cleanName(seriesFolder) : prefix || cleanName(seriesFolder || 'Serie senza nome')) : null;
  // 17/11: «Titolo.Film.2018.iTA.ENG.AC3.SUB...-GRUPPO»: dopo l'anno del film c'è solo roba del file
  // (lingue, audio, gruppo). Si taglia all'ultimo anno seguito da altro: «Blade Runner 2049.mkv» resta intero.
  const yearCut = series ? null : [...base.matchAll(/[ ._([-]((?:19|20)\d{2})(?=[ ._)\]-])/g)].at(-1);
  const yearMatch = yearCut || /(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/.exec(base);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const tail = episodeMatch ? cleanName(base.slice(episodeMatch.index + episodeMatch[0].length)) : '';
  const filmBase = yearCut ? base.slice(0, yearCut.index) : base.replace(/[([](?:19|20)\d{2}[)\]]/g, '');
  return { title: series ? (prefixIsTitle ? [prefix, tail].filter(Boolean).join(' - ') : tail) || `Episodio ${episode}` : cleanName(filmBase) || cleanName(base) || base,
    series, season, episode, year, kind: series ? 'episode' : root === 'Anime' ? 'anime' : 'film' };
}

// Giro F: immagini fatte in casa, una volta per file, in coda lenta.
// Per ogni video: un fotogramma 16:9 piccolo (miniatura dell'episodio), uno sfondo 16:9 grande
// e una locandina 2:3 in due misure. Locandina e sfondo si possono scegliere a mano in Gestisci
// (un altro fotogramma, anche di un altro episodio della stessa serie, o un'immagine accanto al video).
export const ART_VERSION = 4;
// Il segno «:o<numero>» delle firme vecchie (immagini online ad alta risoluzione) non è più parte della firma: si confronta a parte.
const baseSig = s => String(s || '').replace(/:o\d+$/, ':o');
export const ART_FILES = { thumb: '', wide: '-wide', wideSmall: '-wide-s', poster: '-poster', posterSmall: '-poster-s' };
const SIZES = { thumb: [640, 360], wide: [1280, 720], wideSmall: [640, 360], poster: [1440, 2160], posterSmall: [480, 720] };
export const IMAGE_FILE = /\.(jpe?g|png|webp)$/i;
const noExt = name => name.replace(/\.[^.]+$/, '').toLowerCase();
// Fra i nomi di una cartella, il primo che corrisponde a uno dei nomi cercati (senza estensione, maiuscole indifferenti), in ordine di preferenza.
export function pictureMatch(names, wanted) {
  for (const w of wanted) { const hit = names.find(n => IMAGE_FILE.test(n) && noExt(n) === w.toLowerCase()); if (hit) return hit; }
  return null;
}
// Firma delle immagini accanto a un titolo: cambia se se ne aggiunge o se ne toglie una, così le immagini si rifanno.
export function picturesSignature(item, dirPics) {
  const parts = item.path.split('/'); const base = parts.at(-1).replace(/\.[^.]+$/, '').toLowerCase(); const found = [];
  for (let depth = parts.length - 1; depth >= 0; depth--) {
    const names = dirPics.get(`${item.root}/${parts.slice(0, depth).join('/')}`) || [];
    for (const name of names) { const stem = noExt(name); if (stem.startsWith(base) || (depth > 0 && /^(poster|cover|folder|front|fanart|backdrop|background|banner|landscape)$/.test(stem))) found.push(`${depth}/${name}`); }
  }
  return found.length ? found.sort().join(',') : '';
}
export function defaultFrameAt(item, duration) {
  if (!(duration > 0)) return 0;
  // Lontano da loghi iniziali, riassunti e sigle; mai oltre l'ultimo secondo.
  const share = item.series ? 0.32 : duration > 1200 ? 0.12 : 0.3;
  return Math.max(0, Math.min(duration - 1, Math.round(duration * share * 10) / 10));
}
// Il ritaglio "increase + crop" riempie sempre la misura, qualunque sia la forma del video o dell'immagine.
// stream: indice del flusso da usare (copertina incorporata nel file); cx: dove sta il soggetto (0-1) per ritagliare una locandina 2:3 da un 16:9.
export function artArgs(input, { at = null, image = false, stream = null, outputs }) {
  const source = stream === null ? '0:v' : `0:${stream}`;
  const pre = o => o.cx === undefined ? '' : `crop=w='min(iw,ih*2/3)':h=ih:x='max(0,min(iw-ow,${o.cx}*iw-ow/2))':y=0,`;
  const graph = `[${source}]${image ? '' : 'thumbnail=24,'}split=${outputs.length}${outputs.map((_, i) => `[s${i}]`).join('')};` +
    outputs.map((o, i) => `[s${i}]${pre(o)}scale=${o.w}:${o.h}:force_original_aspect_ratio=increase,crop=${o.w}:${o.h},setsar=1[o${i}]`).join(';');
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1',
    ...(image ? [] : ['-ss', String(at)]), '-i', input, '-filter_complex', graph,
    ...outputs.flatMap((o, i) => ['-map', `[o${i}]`, '-frames:v', '1', '-q:v', String(o.q || 4), '-y', o.file])];
}

export class Library {
  constructor(config, files, store, tools = { probe, run }) {
    this.config = config; this.files = files; this.store = store;
    this.cacheDir = path.join(config.dataDir, 'immagini'); this.file = path.join(config.dataDir, 'indice.json');
    this.items = []; this.warnings = []; this.jobs = []; this.running = false; this.closed = false; this.lastScan = null; this.scanTask = null;
    this.sharedArt = new Map(); this.tools = tools; this.controller = new AbortController(); this.saveQueue = Promise.resolve(); this.previewBusy = false;
  }
  async init() {
    const saved = await readJson(this.file, { items: [] }); this.items = saved.items;
    await mkdir(this.cacheDir, { recursive: true }); await this.scan(); return this;
  }
  scan() {
    if (this.scanTask) return this.scanTask;
    this.scanTask = this.performScan().finally(() => { this.scanTask = null; }); return this.scanTask;
  }
  async performScan() {
    const old = new Map(this.items.map(i => [i.id, i])); const result = []; const warnings = []; const dirPics = new Map();
    for (const root of ['Film', 'Serie', 'Anime']) {
      if (!this.config.roots[root] || this.config.mode === 'music') continue;
      const walk = async (relative = '') => {
        const dir = await this.files.resolve(root, relative, { directory: true });
        const entries = await readdir(dir, { withFileTypes: true });
        dirPics.set(`${root}/${relative}`, entries.filter(e => e.isFile() && !e.name.startsWith('.') && IMAGE_FILE.test(e.name)).map(e => e.name).sort());
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
          const rel = [relative, entry.name].filter(Boolean).join('/');
          if (entry.isDirectory()) { await walk(rel); continue; }
          if (!entry.isFile() || !VIDEO.has(path.extname(entry.name).toLowerCase())) continue;
          const info = await lstat(path.join(dir, entry.name)); const id = idFor(`${root}/${rel}`);
          const previous = old.get(id); const same = previous?.size === info.size && previous?.mtime === info.mtimeMs;
          const basename = entry.name.slice(0, -path.extname(entry.name).length);
          const subtitles = entries.filter(s => !s.isSymbolicLink() && s.isFile() && ['.srt', '.ass', '.vtt'].includes(path.extname(s.name).toLowerCase()) && (s.name.slice(0, -path.extname(s.name).length) === basename || s.name.startsWith(basename + '.')))
            .map(s => ({ name: s.name, path: [relative, s.name].filter(Boolean).join('/'), language: s.name.slice(basename.length + 1, -path.extname(s.name).length) || 'Sottotitoli' }));
          // «Aggiunto il»: la prima volta che il file entra nella raccolta (la data del file, se è più vecchia).
          const added = previous?.added || Math.min(Date.now(), Math.round(info.mtimeMs));
          const item = { ...(same ? previous : {}), id, root, path: rel, ...parseName(rel, root), size: info.size, mtime: info.mtimeMs, added, subtitles,
            genres: [], ...(same ? { duration: previous.duration, streams: previous.streams, metadataError: previous.metadataError, image: previous.image, art: previous.art } : {}) };
          if (item.image && !await stat(path.join(this.cacheDir, `${id}.jpg`)).then(s => s.isFile()).catch(() => false)) item.image = false;
          result.push(item);
        }
      };
      try { await walk(); } catch (e) { warnings.push(`${root}: ${e.status ? e.message : 'Impossibile leggere una cartella.'}`); }
    }
    // Le immagini messe accanto ai file (poster.jpg, folder.jpg, <nome>.jpg...): se cambiano, le immagini del titolo si rifanno.
    for (const item of result) {
      const sig = picturesSignature(item, dirPics); if (sig) item.picsSig = sig; else delete item.picsSig;
    }
    result.sort((a, b) => (a.series || a.title).localeCompare(b.series || b.title, 'it') || (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0));
    this.items = result; this.warnings = warnings; this.lastScan = Date.now();
    await this.save();
    try { this.onScanned?.(); } catch { /* L'analisi automatica non deve mai far fallire la scansione. */ }
    this.jobs = result.filter(i => this.needsWork(i)).map(i => i.id);
    if (this.config.metadata !== false && !this.running) this.workTask = this.work();
    if (this.config.metadata !== false) this.genreTask = this.backfillGenres();
    return this.summary();
  }
  // Un lavoro serve se mancano i dati del file, la miniatura, o se le immagini scelte in Gestisci sono cambiate.
  // Immagini online migliorate (segno hr cambiato) senza altro di nuovo: basta rifare locandina e sfondo che vengono da lì, non le miniature.
  hrOf(item) { if (!this.onlineArt?.enabled()) return 0; const { kind, query } = this.onlineQuery(item); return this.onlineArt.hrFor?.(kind, query) || 0; }
  appliedHr(item) { return item.art?.hr ?? (Number(/:o(\d+)$/.exec(item.art?.sig || '')?.[1]) || 0); }
  coversOf(item) { const { kind, query } = this.onlineQuery(item); return this.onlineArt?.coversVersion?.(kind, query) || 0; }
  artFresh(item) { return baseSig(item.art?.sig) === this.artSignature(item); }
  // Lavori «urgenti»: il primo in coda di ogni titolo (serie o film) che non ha ancora nessuna immagine pronta.
  urgentJobs() {
    const titleOf = i => `${i.root}|${i.series || i.title}`;
    const ready = new Set(this.items.filter(i => i.image && i.art).map(titleOf));
    const seen = new Set(); const out = [];
    for (const id of this.jobs) {
      const item = this.items.find(i => i.id === id); if (!item) continue;
      const t = titleOf(item); if (ready.has(t) || seen.has(t)) continue;
      seen.add(t); out.push(id);
    }
    return out;
  }
  needsWork(item) { return !item.metadataError && (!item.streams || !item.image || !this.artFresh(item) || this.hrOf(item) > this.appliedHr(item) || this.coversOf(item) !== (item.art?.cv || 0)); }
  artChoice(item) {
    const edit = this.store.data.edits[item.id] || {};
    const legacy = edit.imagePath ? { path: edit.imagePath } : null;
    return { poster: edit.poster || legacy, backdrop: edit.backdrop || legacy };
  }
  artSignature(item) { return `${ART_VERSION}:${JSON.stringify(this.artChoice(item))}${item.picsSig ? `:${item.picsSig}` : ''}${this.onlineArt?.enabled() ? ':o' : ''}`; }
  // Le immagini scelte a mano: dopo una modifica si rifanno, una alla volta, senza bloccare il server.
  queueArt(ids = this.items.map(i => i.id)) {
    for (const id of ids) {
      const item = this.items.find(i => i.id === id);
      if (item && this.needsWork(item) && !this.jobs.includes(id)) this.jobs.push(id);
    }
    if (this.config.metadata !== false && !this.running && this.jobs.length) this.workTask = this.work();
    return this.summary();
  }
  regenerate(ids) {
    for (const id of ids) { const item = this.items.find(i => i.id === id); if (item) { delete item.art; delete item.metadataError; } }
    return this.queueArt(ids);
  }
  save() {
    const snapshot = structuredClone(this.items);
    const task = this.saveQueue.then(() => atomicJson(this.file, { items: snapshot }));
    this.saveQueue = task.catch(() => {}); return task;
  }
  summary() { return { count: this.items.length, warnings: this.warnings, lastScan: this.lastScan, pending: this.jobs.length + Number(this.running), mode: this.config.mode }; }
  decorate(item) {
    const value = { ...item, ...this.store.data.edits[item.id] };
    if (value.series) { value.kind = 'episode'; value.season ??= 1; value.episode ??= 1; }
    else { value.kind = value.root === 'Anime' ? 'anime' : 'film'; value.season = null; value.episode = null; }
    // Cosa può mostrare il client: le immagini pronte (o scelte a mano e servite così come sono) e un numero per la cache del browser.
    const choice = this.artChoice(item); const fresh = this.artFresh(item);
    value.images = { thumb: !!item.image, poster: !!(item.image && item.art) || !!choice.poster?.path, backdrop: !!item.image || !!choice.backdrop?.path,
      v: Math.round((fresh ? item.art?.at : value.updated) || item.art?.at || item.mtime || 0),
      // 'online' | 'file' | 'incorporata' | 'fotogramma' | 'generata'. Una scelta a mano con un file vale 'file'; senza immagine pronta è 'generata'.
      source: choice.poster?.path ? 'file' : !item.image ? 'generata' : (item.art?.source || null) };
    if (item.art?.cv) { value.images.cv = item.art.cv; value.images.v = `${value.images.v}-${item.art.cv}`; }
    delete value.art;
    // Generi: quelli scelti a mano vincono; se non ce ne sono, quelli ufficiali già salvati (la scansione non li tocca).
    if (!value.genres?.length && !('genres' in (this.store.data.edits[item.id] || {})) && this.onlineArt) { const { kind, query } = this.onlineQuery(item); value.genres = this.onlineArt.genresFor?.(kind, query) || []; }
    // Trama: quella scritta a mano (serie o film) vince sempre; sotto, quella ufficiale già salvata.
    if (this.onlineArt?.infoFor) { const { kind, query } = this.onlineQuery(item); const info = this.onlineArt.infoFor(kind, query); const field = value.series ? 'seriesDescription' : 'description';
      if (!value[field] && !(field in (this.store.data.edits[item.id] || {})) && info.description) value[field] = info.description;
      if (info.score) value.onlineScore = info.score;
      if (info.tags?.length) value.tags = info.tags;
      if (this.onlineArt.logoFor?.(kind, query)) { value.images.logo = true; const lv = this.onlineArt.logoVersion?.(query); if (lv) value.images.lv = lv; }
      const localPoster = this.onlineArt.localCover?.(kind, query, 'poster');
      if (this.onlineArt.posterHasTitle?.(kind, query) && (!localPoster || (!choice.poster && item.art?.source === 'online' && item.art?.cv))) value.images.posterTitle = true; }
    value.light = !!this.versions?.has(item);
    return this.skips ? this.skips.decorate(value) : value;
  }
  list() { return this.items.map(i => ({ ...this.decorate(i), path: undefined })); }
  get(id) { const item = this.items.find(i => i.id === id); if (!item) { const far = this.extra?.find(id); if (far) return far; throw fail(404, 'Titolo non trovato. Aggiorna la raccolta.'); } return this.decorate(item); }
  async fileFor(id) { const i = this.get(id); if (i.remote) throw fail(409, 'Questo titolo sta sul fisso: qui si può solo guardare.'); return this.files.resolve(i.root, i.path); }
  // Quale file servire per un'immagine: la cache fatta con ffmpeg, oppure il file scelto a mano finché la cache non è rifatta.
  async imageFile(id, kind, size) {
    const item = this.items.find(i => i.id === id); if (!item) throw fail(404, 'Titolo non trovato. Aggiorna la raccolta.');
    const fresh = this.artFresh(item); const choice = this.artChoice(item)[kind === 'poster' ? 'poster' : 'backdrop'];
    const cached = name => path.join(this.cacheDir, `${id}${ART_FILES[name]}.jpg`);
    const names = kind === 'thumb' ? ['thumb'] : kind === 'poster' ? (size <= 300 ? ['posterSmall', 'poster'] : ['poster', 'posterSmall'])
      : size <= 700 ? ['wideSmall', 'thumb', 'wide'] : ['wide', 'wideSmall', 'thumb'];
    const candidates = [];
    const picked = choice?.path && kind !== 'thumb' ? await this.files.resolve(item.root, choice.path).catch(() => null) : null;
    if (picked && !fresh) candidates.push(picked);
    candidates.push(...names.filter(n => n !== 'thumb' || item.image).map(cached));
    if (picked && fresh) candidates.push(picked);
    for (const file of candidates.filter(Boolean)) if (await stat(file).then(s => s.isFile()).catch(() => false)) return file;
    throw fail(404, 'Immagine non ancora pronta.');
  }
  // Anteprima di un fotogramma per scegliere locandina e sfondo in Gestisci: una alla volta, niente cache.
  async frame(id, at) {
    const item = this.get(id);
    if (!Number.isFinite(at) || at < 0 || at > Math.max(0, (item.duration || 86400) - 0.5)) throw fail(400, 'Scegli un punto dentro il video.');
    if (this.previewBusy) throw fail(429, 'Sto già preparando un fotogramma. Riprova fra un attimo.');
    this.previewBusy = true;
    try {
      return await this.tools.run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-ss', String(at), '-i', await this.fileFor(id),
        '-frames:v', '1', '-vf', 'scale=480:270:force_original_aspect_ratio=increase,crop=480:270', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '5', 'pipe:1'], 20000, this.controller.signal, 'binary');
    } finally { this.previewBusy = false; }
  }
  // Le immagini messe accanto al file o nella cartella della serie (cammino dalla cartella del file verso la radice).
  async sidecars(item) {
    const found = { poster: null, backdrop: null, thumb: null }; const parts = item.path.split('/'); const base = parts.at(-1).replace(/\.[^.]+$/, '');
    for (let depth = parts.length - 1; depth >= 0; depth--) {
      const relative = parts.slice(0, depth).join('/');
      const names = await readdir(await this.files.resolve(item.root, relative, { directory: true })).catch(() => []);
      const pick = wanted => { const hit = pictureMatch(names, wanted); return hit ? [relative, hit].filter(Boolean).join('/') : null; };
      const own = depth === parts.length - 1; const generic = depth > 0;
      found.poster ||= pick([`${base}-poster`, `${base}.poster`, ...(generic ? ['poster', 'cover', 'folder', 'front'] : [])]);
      found.backdrop ||= pick([`${base}-fanart`, `${base}-backdrop`, `${base}-landscape`, ...(generic ? ['fanart', 'backdrop', 'background', 'banner', 'landscape'] : [])]);
      if (own) found.thumb = pick([`${base}-thumb`, base]);
    }
    return found;
  }
  // Copertine ufficiali da internet: solo se il proprietario ha acceso l'interruttore in Gestisci (altrimenti non si chiede nulla a nessuno).
  onlineQuery(item) {
    const kind = item.root === 'Anime' ? 'anime' : item.series || item.root === 'Serie' ? 'series' : 'film';
    return { kind, query: { title: item.series || this.store.data.edits[item.id]?.title || item.title, year: item.series ? null : item.year } };
  }
  // Generi dei titoli già in indice ma scaricati senza: una richiesta alla volta, con la stessa pausa delle anteprime. Con l'interruttore spento non parte nulla.
  async backfillGenres() {
    if (this.genreBusy || !this.onlineArt?.enabled() || !this.onlineArt.fetchGenres) return;
    this.genreBusy = true;
    try {
      const done = new Set(); const same = new Map();
      for (const i of this.items) { const { kind, query } = this.onlineQuery(i); const k = this.onlineArt.keyFor(kind, query); if (k) same.set(k, [...(same.get(k) || []), i.id]); }
      for (const item of [...this.items]) {
        if (this.closed || !this.onlineArt.enabled()) break;
        const { kind, query } = this.onlineQuery(item); const key = this.onlineArt.keyFor(kind, query);
        if (!key || done.has(key)) continue; done.add(key);
        const moreInfo = await this.onlineArt.fetchGenres(kind, query); const sharper = !this.closed && await this.onlineArt.fetchHr?.(kind, query);
        if (sharper) this.queueArt(same.get(key) || []); // immagini nuove: si rifanno le anteprime di quel titolo
        if ((moreInfo || sharper) && !this.closed) await new Promise(resolve => { this.genreTimer = setTimeout(resolve, this.config.metadataDelayMs ?? 2000); this.wake2 = resolve; });
      }
    } finally { this.genreBusy = false; }
  }
  // Il logo PNG di un anime, se già scaricato.
  async logoFile(id, width = 0) { const { kind, query } = this.onlineQuery(this.items.find(i => i.id === id) || {}); const file = this.onlineArt?.logoFor?.(kind, query); if (!file) throw fail(404, 'Logo non disponibile.'); return width ? this.onlineArt.logoSmall(file, 320) : file; }
  async online(item) {
    if (!this.onlineArt) return {};
    const { kind, query } = this.onlineQuery(item);
    const get = role => this.onlineArt.localCover?.(kind, query, role) || (this.onlineArt.enabled() ? this.onlineArt.get(kind, query, role) : null);
    const [poster, backdrop] = [await get('poster'), await get('backdrop')];
    return { poster: poster ? { image: true, input: poster } : null, backdrop: backdrop ? { image: true, input: backdrop } : null };
  }
  // Il fotogramma migliore: molti punti a metà episodio, fuori dalle sigle note; punteggio su nitidezza, colore, luminosità e personaggi.
  async pickFrame(item, file, duration) {
    const fallback = { at: defaultFrameAt(item, duration), cx: 0.5, smart: false };
    if (this.config.smartFrames === false || !(duration > 30)) return fallback;
    const avoid = Object.values(this.decorate(item).salti || {}).filter(Array.isArray);
    let best = null;
    for (const at of samplePoints(duration, avoid)) {
      if (this.closed) break;
      try {
        const bytes = await this.tools.run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-ss', String(at), '-i', file, '-frames:v', '1',
          '-vf', `scale=${SAMPLE.w}:${SAMPLE.h}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], 20000, this.controller.signal, 'binary');
        const result = scoreFrame(bytes); if (result.score > (best?.score ?? 0)) best = { ...result, at };
      } catch { /* Un punto illeggibile si salta. */ }
    }
    return best ? { at: best.at, cx: best.cx ?? 0.5, smart: true } : fallback;
  }
  async makeArt(item, file, duration, streams = item.streams, { onlineOnly = false } = {}) {
    const target = name => path.join(this.cacheDir, `${item.id}${ART_FILES[name]}.jpg`);
    const out = (name, q = name === 'poster' ? 3 : 4) => ({ name, file: target(name), w: SIZES[name][0], h: SIZES[name][1], q });
    const choice = this.artChoice(item); const runs = [];
    const source = async picked => {
      if (picked?.path) return { image: true, input: await this.files.resolve(item.root, picked.path) };
      if (picked && Number.isFinite(picked.at)) {
        const other = picked.source && picked.source !== item.id ? this.items.find(i => i.id === picked.source) : null;
        return { at: picked.at, input: other ? await this.files.resolve(other.root, other.path) : file };
      }
      return null;
    };
    // Ordine: scelta a mano, poi immagini accanto ai file, poi copertina incorporata nel file, poi il fotogramma scelto bene.
    const found = await this.sidecars(item); const absolute = rel => this.files.resolve(item.root, rel);
    const attached = (streams || []).find(s => s.type === 'cover'); const web = await this.online(item);
    // Da dove viene la locandina: il client disegna il titolo sopra solo se è un fotogramma o un disegno di ripiego.
    let posterSource = 'fotogramma'; const chosen = await source(choice.poster); if (chosen) posterSource = chosen.image ? 'file' : 'fotogramma';
    const poster = chosen || (found.poster ? (posterSource = 'file', { image: true, input: await absolute(found.poster) })
      : attached ? (posterSource = 'incorporata', { image: true, input: file, stream: attached.index }) : web.poster ? (posterSource = 'online', web.poster)
        : found.backdrop ? (posterSource = 'file', { image: true, input: await absolute(found.backdrop) }) : null);
    const backdrop = await source(choice.backdrop) || (found.backdrop ? { image: true, input: await absolute(found.backdrop) } : web.backdrop || null);
    const thumbFile = found.thumb ? { image: true, input: await absolute(found.thumb) } : null;
    if (onlineOnly) { // solo le uscite che vengono dall'immagine online; niente campionamento del video, le miniature restano
      const todo = [];
      if (web.poster && poster === web.poster) todo.push({ ...poster, outputs: [out('poster'), out('posterSmall', 4)] });
      if (web.backdrop && backdrop === web.backdrop) todo.push({ ...backdrop, outputs: [out('wide'), out('wideSmall', 5)] });
      for (const step of todo) { if (this.closed) return null; await this.convertShared(step); }
      return todo.length ? posterSource : null;
    }
    const needsFrame = !poster || !backdrop || !thumbFile;
    const pick = needsFrame ? await this.pickFrame(item, file, duration) : null;
    if (poster) runs.push({ ...poster, outputs: [out('poster'), out('posterSmall', 4)] });
    if (backdrop) runs.push({ ...backdrop, outputs: [out('wide'), out('wideSmall', 5)] });
    if (thumbFile && !(pick && (!poster || !backdrop))) runs.push({ ...thumbFile, outputs: [...(backdrop ? [] : [out('wide'), out('wideSmall', 5)]), out('thumb', 5)] });
    // Il fotogramma automatico per ultimo: la miniatura è sempre l'ultimo file scritto.
    if (pick) runs.push({ at: pick.at, input: file, outputs: [...(poster ? [] : [{ ...out('poster'), cx: pick.cx }, { ...out('posterSmall', 5), cx: pick.cx }]), ...(backdrop ? [] : [out('wide'), out('wideSmall', 5)]), ...(thumbFile ? [] : [out('thumb', 5)])] });
    if (thumbFile && pick) runs.push({ ...thumbFile, outputs: [out('thumb', 5)] });
    for (const step of runs) {
      if (this.closed) return;
      await this.tools.run('ffmpeg', artArgs(step.input, step), 60000, this.controller.signal);
    }
    return posterSource;
  }
  // Più episodi della stessa serie hanno la stessa immagine online: si converte una volta e le altre uscite sono copie.
  async convertShared(step) {
    const pending = [];
    for (const o of step.outputs) {
      const key = `${step.input}|${o.name}`; const first = this.sharedArt.get(key);
      if (first && first !== o.file && await stat(first).then(s => s.isFile(), () => false)) await copyFile(first, o.file); else pending.push({ o, key });
    }
    if (!pending.length) return;
    await this.tools.run('ffmpeg', artArgs(step.input, { ...step, outputs: pending.map(p => p.o) }), 60000, this.controller.signal);
    for (const p of pending) this.sharedArt.set(p.key, p.o.file);
  }
  async work() {
    if (this.running || this.closed || this.analysisBusy) return;
    this.running = true;
    while (this.jobs.length && !this.closed && !this.analysisBusy) {
      // 7/11: prima un episodio per ogni titolo che non ha ancora nessuna copertina, poi il resto in ordine.
      const urgent = this.urgentJobs();
      if (this.onlyUrgent && !urgent.length) break;
      const id = urgent.length ? this.jobs.splice(this.jobs.indexOf(urgent[0]), 1)[0] : this.jobs.shift(); const item = this.items.find(i => i.id === id);
      if (!item || !this.needsWork(item)) continue;
      const matchingItem = () => this.items.find(i => i.id === id && i.mtime === item.mtime && i.size === item.size);
      let data; const sig = this.artSignature(item); const hr = this.hrOf(item); const cv = this.coversOf(item); const light = !!(item.streams && item.image && this.artFresh(item));
      try {
        const file = await this.fileFor(id);
        data = item.streams && item.image ? { duration: item.duration } : await this.tools.probe(file, this.controller.signal);
        if (this.closed) break;
        const source = await this.makeArt(item, file, data.duration, data.streams || item.streams, { onlineOnly: light });
        if (this.closed) break;
        const current = matchingItem(); if (current) { Object.assign(current, data, { image: true, art: light && source === null ? { ...item.art, sig, hr, cv } : { sig, at: Date.now(), source, hr, cv } }); delete current.metadataError; }
      } catch {
        if (this.closed) break;
        const current = matchingItem(); if (current) Object.assign(current, data || {}, { metadataError: 'Anteprima o informazioni non disponibili. Il file resta riproducibile.' });
      }
      try { await this.save(); } catch { this.warnings = ['Impossibile salvare l’indice. Controlla lo spazio libero.']; }
      if (this.jobs.length && !this.closed) await new Promise(resolve => { this.timer = setTimeout(resolve, light ? 50 : (this.config.metadataDelayMs ?? 2000)); this.wake = resolve; });
    }
    this.sharedArt.clear(); this.running = false;
  }
  async retry() { this.items.forEach(i => { delete i.metadataError; if (!i.image) delete i.streams; }); return this.scan(); }
  async close() { this.closed = true; this.controller.abort(); clearTimeout(this.timer); clearTimeout(this.genreTimer); this.wake?.(); this.wake2?.(); await this.workTask; await this.genreTask; await this.saveQueue; }
}
