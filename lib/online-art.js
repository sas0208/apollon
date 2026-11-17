import path from 'node:path';
import { statSync, readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile, stat, rm } from 'node:fs/promises';
import { idFor, atomicJson, readJson } from './util.js';

// Giro G: copertine ufficiali da internet. SPENTE di base: finché l'interruttore in Gestisci non è acceso questo modulo
// non fa NESSUNA richiesta di rete (è la regola del progetto «niente servizi online»; decide il proprietario).
// Se acceso, manda SOLO il titolo (e artista/album/anno) a servizi pubblici di copertine e salva l'immagine in locale:
//   anime            → AniList (GraphQL):            poster verticale e banner
//   film e serie     → iTunes Search:                locandina
//   album musicali   → MusicBrainz + Cover Art Archive: fronte dell'album
// Non invia mai file, percorsi, nomi di profili o altro. Ogni titolo si cerca una volta sola (anche se non si trova).
const HOSTS = [/(^|\.)anilist\.co$/, /(^|\.)mzstatic\.com$/, /(^|\.)coverartarchive\.org$/, /(^|\.)archive\.org$/, /^taizen\.moe$/, /(^|\.)kitsu\.(app|io)$/];
const MAX_BYTES = 6 * 1024 ** 2;
const MAX_HR_BYTES = 40 * 1024 ** 2; // gli originali di Kitsu possono pesare molti MB: si rimpiccioliscono subito
const KITSU = { Accept: 'application/vnd.api+json' };
const RETRY_AFTER = 30 * 86400000;
const clean = value => String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 150);

// Generi dei servizi (inglese) → italiano. Ecchi si scarta; un genere sconosciuto passa com'è.
const GENRES = { 'Action': 'Azione', 'Adventure': 'Avventura', 'Comedy': 'Commedia', 'Drama': 'Drammatico', 'Fantasy': 'Fantasy', 'Horror': 'Horror', 'Mystery': 'Mistero',
  'Psychological': 'Psicologico', 'Romance': 'Romantico', 'Sci-Fi': 'Fantascienza', 'Slice of Life': 'Vita quotidiana', 'Sports': 'Sport', 'Supernatural': 'Soprannaturale',
  'Thriller': 'Thriller', 'Mecha': 'Mecha', 'Music': 'Musica', 'Mahou Shoujo': 'Maghette', 'Ecchi': null,
  'Animation': 'Animazione', 'Kids & Family': 'Famiglia', 'Family': 'Famiglia', 'Documentary': 'Documentario', 'Science Fiction': 'Fantascienza', 'Sci-Fi & Fantasy': 'Fantascienza',
  'Romantic Comedy': 'Commedia romantica', 'Crime': 'Poliziesco', 'Western': 'Western', 'War': 'Guerra', 'Musical': 'Musicale', 'Musicals': 'Musicale', 'Anime': 'Animazione',
  'Action & Adventure': 'Azione', 'Comedies': 'Commedia', 'Dramas': 'Drammatico', 'Horror & Thriller': 'Horror', 'Reality TV': 'Reality', 'Kids': 'Bambini', 'History': 'Storico', 'Biography': 'Biografico' };
export function translateGenres(list) {
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const name = clean(raw); if (!name) continue;
    const it = Object.hasOwn(GENRES, name) ? GENRES[name] : name; if (it && !out.includes(it)) out.push(it);
  }
  return out.slice(0, 12);
}

// Trame dei servizi: via i tag HTML (a capo e paragrafi diventano spazi), via le entità più comuni, spazi ripuliti.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—' };
export function plainText(html) {
  return String(html ?? '').replace(/<\s*(br|\/p|\/div|\/li)\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : ' '; } return ENTITIES[e.toLowerCase()] ?? m; })
    .replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
}

// Voto medio di AniList: da 0-100 a 0-10 con un decimale (8,2); niente voto = null.
const scoreOf = media => Number.isFinite(media?.averageScore) && media.averageScore > 0 ? Math.round(media.averageScore) / 10 : null;

// Stessa normalizzazione di tools/importa-loghi.cjs (c'è un test che le confronta).
export const normTitle = text => String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export class OnlineArt {
  constructor(config, store, { fetchImpl, ffmpeg } = {}) {
    this.config = config; this.store = store; this.fetch = fetchImpl || ((...args) => fetch(...args));
    this.ffmpeg = ffmpeg || null; // (argomenti) => Promise: serve a rimpicciolire le immagini grandi, una alla volta e con un solo thread
    this.dir = path.join(config.dataDir, 'copertine-online'); this.indexFile = path.join(this.dir, 'indice.json'); this.index = {};
    this.chain = Promise.resolve(); this.requests = 0; this.closed = false;
    // Loghi inglesi in alta qualità preparati da tools/importa-loghi.cjs: hanno la precedenza su taizen.moe. L'indice si rilegge da solo quando cambia.
    this.localDir = path.resolve(config.localLogosDir || path.join(config.dataDir, 'loghi-locali')); this.local = {}; this.localAt = 0; this.localCheck = 0; this.localEvery = 5000;
    this.coversDir = path.resolve(config.localCoversDir || path.join(config.dataDir, 'copertine-locali')); this.covers = {}; this.coversAt = 0; this.coversCheck = 0;
    this.posterTitled = new Set(config.posterConTitolo || []); this.small = new Map();
  }
  localIndex() {
    const now = Date.now(); if (now - this.localCheck < this.localEvery) return this.local; this.localCheck = now;
    try {
      const file = path.join(this.localDir, 'indice.json'); const at = statSync(file).mtimeMs;
      if (at !== this.localAt) { this.local = JSON.parse(readFileSync(file, 'utf8')); this.localAt = at; }
    } catch { this.local = {}; this.localAt = 0; }
    return this.local;
  }
  localLogo(query) { const name = this.localIndex()[normTitle(query?.title)]; const file = name && path.join(this.localDir, path.basename(name)); return file && existsSync(file) ? file : null; }
  // Versione dei loghi locali (data dell'indice): cambia quando ne arrivano di nuovi, così i telefoni li riscaricano.
  logoVersion(query) { return this.localLogo(query) ? Math.round(this.localAt) : 0; }
  coversIndex() {
    const now = Date.now(); if (now - this.coversCheck < this.localEvery) return this.covers; this.coversCheck = now;
    try {
      const file = path.join(this.coversDir, 'indice.json'); const at = statSync(file).mtimeMs;
      if (at !== this.coversAt) { this.covers = JSON.parse(readFileSync(file, 'utf8')); this.coversAt = at; }
    } catch { this.covers = {}; this.coversAt = 0; }
    return this.covers;
  }
  localCover(kind, query, role) {
    if (kind !== 'anime' || !['poster', 'backdrop'].includes(role)) return null;
    const name = this.coversIndex()[normTitle(query?.title)]?.[role];
    if (typeof name !== 'string' || path.basename(name) !== name || /[\\/]/.test(name)) return null;
    const file = path.join(this.coversDir, name);
    try { return statSync(file).isFile() ? file : null; } catch { return null; }
  }
  // Firma per titolo: importare una copertina estranea non invalida gli altri titoli.
  coversVersion(kind, query) {
    const files = ['poster', 'backdrop'].map(role => this.localCover(kind, query, role));
    if (!files.some(Boolean)) return 0;
    return idFor(JSON.stringify(files.map(file => { if (!file) return null; try { const s = statSync(file); return [file, s.size, s.mtimeMs]; } catch { return null; } })));
  }
  posterHasTitle(kind, query) { if (this.localCover(kind, query, 'poster')) return true; const key = this.keyFor(kind, query); return !!key && this.posterTitled.has(key); }
  // Logo rimpicciolito per le locandine (PNG, 320 px al massimo): fatto una volta con ffmpeg e tenuto accanto all'originale.
  async logoSmall(file, width = 320) {
    const out = path.join(path.dirname(file), 'piccoli', `${path.basename(file, '.png')}-${width}.png`);
    if (!this.small.has(out)) this.small.set(out, (async () => {
      if (await stat(out).then(s => s.mtimeMs >= statSync(file).mtimeMs, () => false)) return out;
      if (!this.ffmpeg) return file;
      await mkdir(path.dirname(out), { recursive: true });
      await this.ffmpeg(['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1', '-i', file, '-vf', `scale='min(${width},iw)':-2:flags=lanczos`, '-frames:v', '1', '-y', out]);
      return out;
    })().catch(() => { this.small.delete(out); return file; }));
    return this.small.get(out);
  }
  async init() { await mkdir(this.dir, { recursive: true }); this.index = await readJson(this.indexFile, {}); return this; }
  enabled() { return this.store.data.onlineArt === true; }
  async setEnabled(value) {
    if (typeof value !== 'boolean') throw Object.assign(new Error('Scegli acceso o spento.'), { status: 400 });
    await this.store.change(d => { d.onlineArt = value; });
    return this.status();
  }
  status() { return { enabled: this.enabled(), saved: Object.values(this.index).filter(e => e.poster || e.backdrop).length, requests: this.requests }; }
  exclusive(fn) { const task = this.chain.then(fn); this.chain = task.catch(() => {}); return task; }

  async json(url, init = {}) {
    this.requests++;
    const response = await this.fetch(url, { ...init, signal: AbortSignal.timeout(10000), redirect: 'error', headers: { 'User-Agent': 'MediatecaDiCasa/1.0 (uso familiare)', Accept: 'application/json', ...init.headers } });
    if (!response.ok) throw new Error(`Servizio copertine: ${response.status}`);
    return response.json();
  }
  // Solo indirizzi https di host noti, anche dopo i reindirizzamenti (controllati uno per uno).
  async download(url, targetBase, only = /^image\/(jpeg|png|webp)/, max = MAX_BYTES) {
    let current = new URL(url);
    for (let hop = 0; hop < 4; hop++) {
      if (current.protocol !== 'https:' || !HOSTS.some(rx => rx.test(current.hostname))) throw new Error('Indirizzo immagine non ammesso.');
      this.requests++;
      const response = await this.fetch(current, { signal: AbortSignal.timeout(15000), redirect: 'manual', headers: { 'User-Agent': 'MediatecaDiCasa/1.0 (uso familiare)' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) { current = new URL(response.headers.get('location'), current); continue; }
      if (!response.ok) throw new Error(`Immagine non disponibile: ${response.status}`);
      if (!only.test(response.headers.get('content-type') || '')) throw new Error('Non è un’immagine.');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > max) throw new Error('Immagine troppo grande o vuota.');
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[/^image\/(?:jpeg|png|webp)/.exec(response.headers.get('content-type'))[0]];
      const name = `${targetBase}.${ext}`; await writeFile(path.join(this.dir, name), bytes); return name;
    }
    throw new Error('Troppi reindirizzamenti.');
  }

  async lookupAnime(title) {
    const data = await this.json('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query($search:String){Media(search:$search,type:ANIME){id coverImage{extraLarge large} bannerImage genres description(asHtml:false) episodes averageScore tags{name rank isMediaSpoiler isGeneralSpoiler}}}', variables: { search: title } }) });
    const media = data?.data?.Media; return { anilistId: Number.isInteger(media?.id) ? media.id : null, poster: media?.coverImage?.extraLarge || media?.coverImage?.large || null, backdrop: media?.bannerImage || null, genres: translateGenres(media?.genres),
      description: plainText(media?.description), episodes: Number.isInteger(media?.episodes) && media.episodes > 0 ? media.episodes : null, score: scoreOf(media), tags: (media?.tags || []).filter(t => !t.isMediaSpoiler && !t.isGeneralSpoiler && t.rank >= 60).map(t => clean(t.name)).filter(Boolean).slice(0, 40) };
  }
  // Solo generi, trama e numero di episodi, senza immagini (per le voci scaricate prima che esistessero).
  async lookupAnimeInfo(title) {
    const data = await this.json('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'query($search:String){Media(search:$search,type:ANIME){id genres description(asHtml:false) episodes averageScore tags{name rank isMediaSpoiler isGeneralSpoiler}}}', variables: { search: title } }) });
    const media = data?.data?.Media;
    return { anilistId: Number.isInteger(media?.id) ? media.id : null, genres: translateGenres(media?.genres), description: plainText(media?.description), episodes: Number.isInteger(media?.episodes) && media.episodes > 0 ? media.episodes : null, score: scoreOf(media), tags: (media?.tags || []).filter(t => !t.isMediaSpoiler && !t.isGeneralSpoiler && t.rank >= 60).map(t => clean(t.name)).filter(Boolean).slice(0, 40) };
  }
  async lookupItunes(title, year, kind) {
    const entity = kind === 'series' ? 'tvSeason' : 'movie'; const media = kind === 'series' ? 'tvShow' : 'movie';
    const url = new URL('https://itunes.apple.com/search'); url.search = new URLSearchParams({ term: year ? `${title} ${year}` : title, media, entity, limit: '3', country: 'it' });
    const data = await this.json(url); const hit = (data.results || []).find(r => r.artworkUrl100);
    return { poster: hit ? hit.artworkUrl100.replace(/\/\d+x\d+(bb)?\./, '/2000x3000bb.') : null, backdrop: null, genres: translateGenres(hit?.primaryGenreName ? [hit.primaryGenreName] : []), description: plainText(hit?.longDescription), episodes: null };
  }
  // Kitsu: locandina e copertina originali (grandi). Prima per id AniList (nessuna ipotesi sul titolo), poi, solo se non c'è corrispondenza, per titolo.
  async lookupKitsu(anilistId, title) {
    let attrs = null;
    if (anilistId) {
      const url = new URL('https://kitsu.app/api/edge/mappings');
      url.search = new URLSearchParams({ 'filter[externalSite]': 'anilist/anime', 'filter[externalId]': String(anilistId), include: 'item' });
      attrs = ((await this.json(url, { headers: KITSU }))?.included || []).find(x => x.type === 'anime')?.attributes || null;
    }
    if (!attrs && title) {
      const url = new URL('https://kitsu.app/api/edge/anime'); url.search = new URLSearchParams({ 'filter[text]': title, 'page[limit]': '1' });
      attrs = (await this.json(url, { headers: KITSU }))?.data?.[0]?.attributes || null;
    }
    return { poster: attrs?.posterImage?.original || null, backdrop: attrs?.coverImage?.original || null };
  }
  // Scarica un originale grande e lo salva già rimpicciolito (larghezza massima, JPEG di qualità alta): niente file da 5 MB.
  async fetchBig(url, base, width) {
    if (!this.ffmpeg) throw new Error('Manca ffmpeg.');
    const original = await this.download(url, `${base}-orig`, undefined, MAX_HR_BYTES); const out = `${base}.jpg`;
    try {
      await this.ffmpeg(['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1', '-i', path.join(this.dir, original),
        '-vf', `scale='min(${width},iw)':-2`, '-frames:v', '1', '-q:v', '2', '-y', path.join(this.dir, out)]);
    } finally { await rm(path.join(this.dir, original), { force: true }); }
    return out;
  }
  async swapImage(entry, role, name) { const old = entry[role]; entry[role] = name; if (old && old !== name) await rm(path.join(this.dir, old), { force: true }); }
  // Immagini ad alta risoluzione. Anime: Kitsu (locandina max 1600 px, copertina max 1920 px). Film e serie: iTunes a 2000 px.
  // Il segno hr c'è comunque dopo il tentativo; se è andata male si riprova dopo 30 giorni. Se l'immagine cambia, hrOk e hr cambiano e le anteprime si rifanno.
  async upgrade(kind, query, entry, key) {
    entry.hr = Date.now(); delete entry.hrOk;
    try {
      if (kind === 'anime') {
        const found = await this.lookupKitsu(entry.anilistId, clean(query.title));
        if (found.poster) { try { await this.swapImage(entry, 'poster', await this.fetchBig(found.poster, `${key}-poster-hr`, 1600)); entry.hrOk = true; } catch { /* Resta quella di AniList. */ } }
        if (found.backdrop) { try { await this.swapImage(entry, 'backdrop', await this.fetchBig(found.backdrop, `${key}-backdrop-hr`, 1920)); entry.hrOk = true; } catch { /* Resta il banner di AniList. */ } }
      } else if (kind !== 'album') {
        const found = await this.lookupItunes(clean(query.title), query.year, kind);
        if (found.poster) { await this.swapImage(entry, 'poster', await this.download(found.poster, `${key}-poster-hr`)); entry.hrOk = true; }
      }
    } catch { /* Servizio non raggiungibile: si riprova fra 30 giorni. */ }
  }
  // Solo indice: il segno dell'ultimo passaggio riuscito (cambia quando le immagini cambiano; serve a rifare le anteprime).
  hrFor(kind, query) { const key = this.keyFor(kind, query); const e = key && this.index[key]; return e?.hrOk ? e.hr : 0; }
  // Passaggio una tantum per le voci già salvate (come generi e trame): una richiesta alla volta, 30 giorni fra un tentativo fallito e l'altro. Torna true se ha cambiato immagini.
  async fetchHr(kind, query) {
    const key = this.keyFor(kind, query); const known = key && this.index[key];
    if (!known || kind === 'album' || !known.poster || (kind === 'anime' && !this.ffmpeg) || (known.hr && (known.hrOk || Date.now() - known.hr < RETRY_AFTER)) || !this.enabled() || this.closed) return false;
    return this.exclusive(async () => {
      const entry = this.index[key]; if (!this.enabled() || (entry.hr && (entry.hrOk || Date.now() - entry.hr < RETRY_AFTER))) return false;
      await this.upgrade(kind, query, entry, key); await atomicJson(this.indexFile, this.index); return !!entry.hrOk;
    }).catch(() => false);
  }
  keyFor(kind, { title, artist = '', year = null } = {}) { title = clean(title); return title ? idFor(JSON.stringify([kind, title.toLowerCase(), clean(artist).toLowerCase(), year || null])) : null; }
  // I generi già salvati per un titolo (in italiano). Legge solo l'indice: nessuna richiesta.
  genresFor(kind, query) { const key = this.keyFor(kind, query); return (key && this.index[key]?.genres) || []; }
  // La trama ufficiale già salvata (testo semplice) e il numero di episodi. Legge solo l'indice: nessuna richiesta.
  infoFor(kind, query) { const key = this.keyFor(kind, query); const e = (key && this.index[key]) || {}; return { description: e.description || '', episodes: e.episodes || null, score: e.score || null, tags: e.tags || [] }; }
  // Il logo (PNG trasparente) di un anime, già salvato: solo l'indice, nessuna richiesta.
  logoFor(kind, query) { const local = this.localLogo(query); if (local) return local; const key = this.keyFor(kind, query); const name = key && this.index[key]?.logo; return name ? path.join(this.dir, name) : null; }
  // Scarica il logo di un anime dall'id AniList (solo PNG). Un 404 o un tipo sbagliato vale come «non c'è»: si riprova dopo 30 giorni.
  async fetchLogo(entry, key) {
    if (!entry.anilistId || entry.logo) return;
    entry.lat = Date.now();
    try { entry.logo = await this.download(`https://taizen.moe/i/a/${entry.anilistId}/logo`, `${key}-logo`, /^image\/png/); } catch { /* Senza logo si vede il titolo scritto. */ }
  }
  // Una voce è completa quando ha generi e trama e, per gli anime, il logo oppure un tentativo recente.
  complete(kind, e) { return !!e && ((e.metadataVersion === 2 && !!e.gat && Date.now() - e.gat < RETRY_AFTER) || (!!e.genres?.length && !!e.description?.trim() && (kind !== 'anime' || (Array.isArray(e.tags) && (!!e.logo || (!!e.lat && Date.now() - e.lat < RETRY_AFTER)))))); }
  // Recupero leggero di generi e trama mancanti: solo se acceso, un tentativo ogni 30 giorni. Torna true se ha fatto una richiesta.
  async fetchGenres(kind, query) {
    const key = this.keyFor(kind, query); const known = key && this.index[key];
    // Un anime già cercato prima che esistessero i loghi (niente id AniList né tentativo di logo) si richiede subito, una volta sola.
    const neverTriedLogo = kind === 'anime' && !known?.anilistId && !known?.lat;
    if (!key || kind === 'album' || this.complete(kind, known) || (known?.metadataVersion === 2 && known.gat && Date.now() - known.gat < RETRY_AFTER && !neverTriedLogo) || !this.enabled() || this.closed) return false;
    return this.exclusive(async () => {
      const entry = this.index[key] ||= {}; if (!this.enabled() || this.closed || this.complete(kind, entry)) return false;
      entry.gat = Date.now(); entry.metadataVersion = 2;
      try {
        const title = clean(query.title);
        const found = kind === 'anime' ? await this.lookupAnimeInfo(title) : await this.lookupItunes(title, query.year, kind);
        if (!entry.genres?.length) entry.genres = found.genres; if (found.tags) entry.tags = found.tags;
        entry.description = found.description || entry.description || ''; if (found.episodes) entry.episodes = found.episodes; if (found.score) entry.score = found.score;
        if (found.anilistId) entry.anilistId = found.anilistId;
        if (kind === 'anime') { if (found.anilistId) await this.fetchLogo(entry, key); else entry.lat = Date.now(); }
      } catch { if (kind === 'anime' && !entry.lat) entry.lat = Date.now(); /* Si riprova fra 30 giorni. */ }
      await atomicJson(this.indexFile, this.index); return true;
    }).catch(() => false);
  }
  async lookupAlbum(artist, album) {
    const url = new URL('https://musicbrainz.org/ws/2/release/');
    url.search = new URLSearchParams({ query: `release:"${album.replace(/"/g, ' ')}"${artist ? ` AND artist:"${artist.replace(/"/g, ' ')}"` : ''}`, fmt: 'json', limit: '1' });
    const data = await this.json(url); const release = data.releases?.[0];
    return { poster: release ? `https://coverartarchive.org/release/${release.id}/front-500` : null, backdrop: null };
  }

  // Il file della copertina ufficiale di un titolo, oppure null. Fa richieste SOLO se è acceso; mai errori verso chi chiama.
  // kind: 'anime' | 'series' | 'film' | 'album'. role: 'poster' | 'backdrop' | 'logo'.
  async get(kind, { title, artist = '', year = null } = {}, role = 'poster') {
    const cover = this.localCover(kind, { title }, role); if (cover) return cover;
    title = clean(title); artist = clean(artist); if (!title) return null;
    const key = this.keyFor(kind, { title, artist, year });
    const known = this.index[key];
    const local = r => known?.[r] ? path.join(this.dir, known[r]) : null;
    if (known && (known.poster || known.backdrop || Date.now() - known.at < RETRY_AFTER)) {
      const file = local(role); return file && await stat(file).then(s => s.isFile(), () => false) ? file : null;
    }
    if (!this.enabled() || this.closed) return null;
    return this.exclusive(async () => {
      if (!this.enabled()) return null;
      const entry = { at: Date.now(), gat: Date.now(), metadataVersion: 2 };
      try {
        const found = kind === 'anime' ? await this.lookupAnime(title) : kind === 'album' ? await this.lookupAlbum(artist, title) : await this.lookupItunes(title, year, kind);
        if (found.genres) entry.genres = found.genres; if (found.tags) entry.tags = found.tags;
        entry.description = found.description || entry.description || ''; if (found.episodes) entry.episodes = found.episodes; if (found.score) entry.score = found.score; if (found.anilistId) entry.anilistId = found.anilistId;
        for (const r of ['poster', 'backdrop']) if (found[r]) {
          try { entry[r] = await this.download(found[r], `${key}-${r}`); } catch { /* Un'immagine sola può mancare. */ }
        }
        if (kind === 'anime') { await this.fetchLogo(entry, key); if (entry.poster && this.ffmpeg) await this.upgrade(kind, { title }, entry, key); }
        else if (kind !== 'album' && entry.poster) { entry.hr = Date.now(); entry.hrOk = true; } // iTunes dà già 2000 px
      } catch { /* Servizio non raggiungibile: si riprova fra qualche tempo. */ }
      this.index[key] = entry; await atomicJson(this.indexFile, this.index);
      const file = entry[role] ? path.join(this.dir, entry[role]) : null; return file;
    }).catch(() => null);
  }
}
