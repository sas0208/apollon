import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { idFor, atomicJson, readJson, fail } from './util.js';

// 8/11: un'altra Apollon (quella del PC fisso) presta il suo catalogo video a questa. Il catalogo si legge con un tempo breve e si ricorda;
// locandine, sottotitoli e video passano da qui (tramite, con Range) senza copiare nulla su disco. Fisso spento = titoli grigi, il resto non cambia.
export const OFF_MESSAGE = 'Il fisso è spento. Accendilo per guardare questo titolo.';
export const ONLY_WATCH = 'Questo titolo sta sul fisso: qui si può solo guardare.';
const PASS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'etag', 'last-modified', 'content-disposition', 'vary'];
const CASED = Object.fromEntries(PASS.map(h => [h, h === 'etag' ? 'ETag' : h.replace(/(^|-)[a-z]/g, c => c.toUpperCase())]));
const FORWARD = ['range', 'if-range', 'if-none-match', 'if-modified-since'];
const QUERY = ['s', 't', 'q'];
const CONNECTION = new Set(['ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN']);
const PICTURE = /^\/(poster|backdrop|thumb|logo|image)(\/|$)/;
const TYPES = ['riassunto', 'sigla', 'finale', 'anteprima'];
const fold = value => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('it');
const text = (v, max = 2000) => typeof v === 'string' ? v.slice(0, max) : undefined;
const num = v => Number.isFinite(v) ? v : undefined;

// Del titolo del fisso arriva solo quello che il cliente mostra: mai percorsi o nomi di file.
export function clean(i) {
  const out = { id: i.id, root: text(i.root, 40), title: text(i.title, 300), kind: text(i.kind, 20), series: text(i.series, 300), season: num(i.season), episode: num(i.episode),
    year: num(i.year), added: num(i.added), mtime: num(i.mtime), size: num(i.size), duration: num(i.duration), description: text(i.description), seriesDescription: text(i.seriesDescription),
    onlineScore: num(i.onlineScore), genres: Array.isArray(i.genres) ? i.genres.filter(g => typeof g === 'string').slice(0, 20) : [],
    tags: Array.isArray(i.tags) ? i.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 80)).slice(0, 40) : [],
    light: i.light === true, introStart: num(i.introStart), introEnd: num(i.introEnd),
    controllare: Array.isArray(i.controllare) ? i.controllare.filter(t => TYPES.includes(t)) : [] };
  if (i.fontiSalti && typeof i.fontiSalti === 'object') out.fontiSalti = Object.fromEntries(TYPES.filter(t => ['a mano', 'impronta', 'capitoli', 'aniskip'].includes(i.fontiSalti[t])).map(t => [t, i.fontiSalti[t]]));
  for (const kind of ['poster', 'backdrop']) {
    if (i[kind]?.path || i[kind]?.immagine === true || (!i[kind] && i.imagePath)) out[kind] = { immagine: true };
    else if (i[kind] && Number.isFinite(i[kind].at)) out[kind] = { at: i[kind].at, ...(/^[a-f0-9]{24}$/.test(i[kind].source) ? { source: i[kind].source } : {}) };
  }
  const im = i.images;
  if (im && typeof im === 'object') out.images = { thumb: !!im.thumb, poster: !!im.poster, backdrop: !!im.backdrop, logo: !!im.logo, posterTitle: !!im.posterTitle, v: typeof im.v === 'number' || typeof im.v === 'string' ? im.v : 0, ...(im.lv ? { lv: im.lv } : {}), ...(im.cv ? { cv: im.cv } : {}) };
  if (Array.isArray(i.streams)) out.streams = i.streams.slice(0, 60).map(s => ({ index: num(s?.index), type: text(s?.type, 20), codec: text(s?.codec, 40), language: text(s?.language, 40), title: text(s?.title, 200), height: num(s?.height), width: num(s?.width), default: s?.default ? true : undefined }));
  out.subtitles = Array.isArray(i.subtitles) ? i.subtitles.slice(0, 60).map(s => { const language = text(s?.language, 40) || 'Sottotitoli'; return { language, name: language }; }) : [];
  if (i.salti && typeof i.salti === 'object') {
    const salti = {}; for (const t of TYPES) { const r = i.salti[t]; if (Array.isArray(r) && r.length === 2 && r.every(Number.isFinite)) salti[t] = [r[0], r[1]]; }
    out.salti = salti;
  }
  return JSON.parse(JSON.stringify(out));
}
// Stessa serie su NAS e fisso: l'episodio che c'è in locale vince, quelli solo sul fisso restano.
export function mergeCatalog(local, far) {
  const key = i => `${i.root}|${fold(i.series)}|${i.season}|${i.episode}`;
  const have = new Set(local.filter(i => i.series).map(key));
  return [...local, ...far.filter(i => !(i.series && have.has(key(i))))];
}
const gone = res => { res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end('{"error":"Immagine non disponibile."}'); };
// La chiave del collegamento non apre le altre funzioni di gestione.
export const remoteOperation = p => /^\/api\/(?:versions(?:\/|$)|manage\/(?:skips|versions)(?:\/|$))/.test(p)
  || ['/api/manage/edit', '/api/manage/art', '/api/manage/pictures', '/api/manage/picture'].includes(p);
export class RemoteVideo {
  constructor(sources, { dataDir, timeoutMs = 1500, bodyMs = 8000, freshMs = 30000, downMs = 60000, proxyMs = 5000, streamMs = 20000, subtitleMs = 30000, idleMs = 30000, fetchImpl = fetch } = {}) {
    this.sources = sources.filter(s => s?.nome && /^https?:\/\//.test(s.url || '')).map(s => ({ nome: s.nome, url: s.url, key: typeof s.key === 'string' ? s.key : '', items: [], clean: [], up: null, at: 0, downUntil: 0, task: null, tried: false, hash: '' }));
    this.dir = dataDir; this.timeoutMs = timeoutMs; this.bodyMs = bodyMs; this.freshMs = freshMs; this.downMs = downMs; this.proxyMs = proxyMs; this.streamMs = streamMs; this.subtitleMs = subtitleMs; this.idleMs = idleMs; this.fetch = fetchImpl; this.refs = new Map();
  }
  fileOf(s) { return path.join(this.dir, `catalogo-${s.nome.replace(/[^a-z0-9_-]/gi, '_')}.json`); }
  async init() {
    for (const s of this.sources) {
      const saved = await readJson(this.fileOf(s), null).catch(() => null);
      if (Array.isArray(saved?.items)) { this.take(s, saved.items); s.hash = idFor(JSON.stringify(s.clean)); }
    }
    return this;
  }
  // Il catalogo si ricostruisce da zero a ogni arrivo: i vecchi riferimenti di questo fisso spariscono.
  take(s, items) {
    for (const [id, r] of this.refs) if (r.s === s) this.refs.delete(id);
    s.clean = items.filter(i => i && /^[a-f0-9]{24}$/.test(i.id)).map(clean);
    s.items = s.clean.map(i => { const id = idFor(`${s.nome}:${i.id}`); this.refs.set(id, { s, remoteId: i.id }); return { ...this.translate(i, s, false), id, remote: s.nome }; });
  }
  requireKey(s) { if (!s.key) throw fail(409, ONLY_WATCH); }
  // Preparare miniature non concede accesso ai file o alla gestione: è disponibile
  // anche sui collegamenti «solo guarda», come l'indice GET del provino.
  async queuePreviews(s,data) {
    const r = await this.fetch(new URL('/api/tv/trickplay',s.url), {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(this.proxyMs),redirect:'error'});
    if (!r.ok) throw fail(502,'Anteprime del fisso non disponibili.'); return r.json();
  }
  // Solo i campi che contengono ID vengono tradotti: titoli e descrizioni restano intatti.
  translate(value, s, outward, field = '') {
    const convert = id => {
      if (!outward) return /^[a-f0-9]{24}$/.test(id) ? idFor(`${s.nome}:${id}`) : id;
      const ref = this.refs.get(id);
      if (!ref || ref.s !== s) throw fail(409, 'Scegli titoli e immagini della stessa raccolta sul fisso.');
      return ref.remoteId;
    };
    if (typeof value === 'string') return ['id', 'ids', 'source', 'working', 'workingIds', 'failed'].includes(field) ? convert(value) : value;
    if (Array.isArray(value)) return value.map(v => this.translate(v, s, outward, field));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [!outward && /^[a-f0-9]{24}$/.test(k) ? convert(k) : k, this.translate(v, s, outward, k)]));
    return value;
  }
  async request(s, pathname, { method = 'GET', data, search = '', binary = false } = {}) {
    this.requireKey(s);
    if (s.downUntil > Date.now()) throw fail(503, OFF_MESSAGE);
    const url = new URL(pathname, s.url); url.search = search;
    const headers = { 'x-apollon-remote': s.key };
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    try {
      const r = await this.fetch(url, { method, headers, body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(this.proxyMs), redirect: 'error' });
      // Il limite vale anche per immagini e JSON: niente risposte senza fine in memoria.
      let size = 0; const chunks = [];
      if (method !== 'HEAD') for await (const chunk of r.body) { size += chunk.length; if (size > 8 * 1024 * 1024) throw new Error('Risposta troppo grande.'); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks);
      if (!r.ok) { let message; try { message = JSON.parse(bytes.toString('utf8')).error; } catch {} throw fail(r.status, message || 'Il fisso non ha completato la richiesta.'); }
      s.up = true;
      const result = binary ? bytes : this.translate(JSON.parse(bytes.toString('utf8')), s, false);
      return { data: result, status: r.status, headers: Object.fromEntries(PASS.filter(h => r.headers.has(h)).map(h => [h, r.headers.get(h)])) };
    } catch (e) {
      if (e.status) throw e;
      if (CONNECTION.has(e.cause?.code || e.code) || ['TimeoutError', 'AbortError'].includes(e.name)) { s.up = false; s.downUntil = Date.now() + this.downMs; throw fail(503, OFF_MESSAGE); }
      throw fail(502, 'Il fisso non ha risposto come previsto. Riprova fra poco.');
    }
  }
  async forward(s, pathname, method, data, search = '', binary = false) {
    this.requireKey(s);
    const query = new URLSearchParams(search);
    for (const k of ['id', 'ids']) if (query.has(k)) {
      const values = query.getAll(k); query.delete(k);
      for (const value of values) query.append(k, value.split(',').map(id => this.translate(id, s, true, k)).join(','));
    }
    const answer = await this.request(s, pathname, { method, data: this.translate(data, s, true), search: query.toString(), binary });
    if (!['GET', 'HEAD'].includes(method) || (pathname === '/api/versions/item' && answer.data.state === 'ready')) { await this.refresh(s); }
    return answer;
  }
  async refresh(s) {
    const ctl = new AbortController(); let timer = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const r = await this.fetch(new URL('/api/library', s.url), { signal: ctl.signal });
      clearTimeout(timer); timer = setTimeout(() => ctl.abort(), this.bodyMs);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json(); if (!Array.isArray(data.items)) throw new Error('catalogo non valido');
      this.take(s, data.items); s.up = true; s.at = Date.now(); s.downUntil = 0;
      const hash = idFor(JSON.stringify(s.clean));
      if (hash !== s.hash) { s.hash = hash; atomicJson(this.fileOf(s), { items: s.clean }, 0).catch(() => { s.hash = ''; }); }
    } catch { s.up = false; s.downUntil = Date.now() + this.downMs; }
    finally { clearTimeout(timer); s.tried = true; }
  }
  // Il catalogo dei fissi: sempre l'ultima copia, subito; l'aggiornamento corre in sottofondo (uno alla volta).
  // Solo la primissima volta, senza nessuna copia, si aspetta (al massimo il tempo breve).
  async list() {
    const now = Date.now(); const waits = [];
    for (const s of this.sources) {
      if ((s.up && now - s.at < this.freshMs) || (!s.up && s.downUntil > now)) continue;
      const task = s.task ||= this.refresh(s).finally(() => { s.task = null; });
      if (!s.tried && !s.items.length) waits.push(Promise.race([task, new Promise(r => setTimeout(r, this.timeoutMs))]));
    }
    await Promise.all(waits);
    return this.sources.flatMap(s => s.items.map(i => ({ ...i, remoteDown: s.up === false })));
  }
  find(id) { const r = this.refs.get(id); const i = r?.s.items.find(x => x.id === id); return i ? { ...i, remoteDown: r.s.up === false } : null; }
  status() { return this.sources.map(s => ({ nome: s.nome, up: s.up !== false })); }
  // Tramite: la stessa richiesta (con Range) va al fisso e la risposta torna com'è.
  proxy(req, res, id, suffix = '', search = '') {
    const ref = this.refs.get(id); if (!ref) throw fail(404, 'Titolo non trovato. Aggiorna la raccolta.');
    const s = ref.s; const picture = PICTURE.test(suffix);
    if (s.downUntil > Date.now() || s.up === false) { if (picture) return gone(res); if (s.downUntil > Date.now()) throw fail(503, OFF_MESSAGE); }
    const url = new URL(`/media/${ref.remoteId}${suffix}`, s.url);
    const allowed = suffix.startsWith('/trickplay') ? [...QUERY,'priority','playing','v'] : QUERY;
    const given = new URLSearchParams(search); for (const k of allowed) if (given.has(k)) url.searchParams.set(k, given.get(k));
    const headers = {}; for (const h of FORWARD) if (req.headers[h]) headers[h] = req.headers[h];
    // 8/11 (Fable): il disco del fisso può metterci ~8 s a svegliarsi; le immagini restano a 5 s, i video aspettano di più.
    const answerMs = suffix.startsWith('/subtitle') ? this.subtitleMs : picture ? this.proxyMs : Math.max(this.proxyMs, this.streamMs);
    return new Promise((resolve, reject) => {
      let timer; let settled = false; let clientGone = false; let up;
      const arm = (ms, fn) => { clearTimeout(timer); timer = setTimeout(fn, ms); };
      const finish = () => { clearTimeout(timer); if (!settled) { settled = true; resolve(); } };
      // Solo gli errori di connessione segnano il fisso spento; se se ne va il cliente non si tocca niente.
      const fault = (status, message, down) => {
        if (settled) return; up.destroy();
        if (clientGone || res.destroyed) return finish();
        if (res.headersSent) { res.destroy(); return finish(); }
        if (down) { s.up = false; s.downUntil = Date.now() + this.downMs; }
        if (picture && down) { gone(res); return finish(); }
        clearTimeout(timer); settled = true; reject(fail(status, message));
      };
      up = (url.protocol === 'https:' ? https : http).request(url, { method: req.method, headers }, r => {
        if (settled) return r.destroy();
        s.up = true;
        // Nomi con le maiuscole come nei video locali: il lettore della TV Samsung non riconosce «accept-ranges» in minuscolo,
        // tratta il file come non saltabile e non trova l'indice in fondo all'mp4.
        res.writeHead(r.statusCode, Object.fromEntries(PASS.filter(h => r.headers[h] !== undefined).map(h => [CASED[h], r.headers[h]])));
        // Inattività: se il fisso sparisce a metà film cade tutto; se è il cliente a essere lento si aspetta.
        const idle = () => arm(this.idleMs, () => { if (res.writableNeedDrain && !res.destroyed) return idle(); r.destroy(); res.destroy(); finish(); });
        idle(); r.on('data', idle); r.pipe(res);
        r.on('error', () => { res.destroy(); finish(); }); r.on('end', finish);
        r.on('close', () => { if (!r.complete) { res.destroy(); finish(); } });
      });
      res.on('close', () => { if (!res.writableFinished) clientGone = true; up.destroy(); finish(); });
      up.on('socket', sock => { const ready = () => arm(answerMs, () => fault(504, 'Il fisso ci mette troppo a rispondere. Riprova fra poco.', false)); if (sock.connecting) sock.once('connect', ready); else ready(); });
      up.on('error', e => {
        if (settled) return;
        if (clientGone || res.destroyed) return finish();
        if (res.headersSent) { res.destroy(); return finish(); }
        if (CONNECTION.has(e.code)) fault(503, OFF_MESSAGE, true); else fault(502, 'Il fisso non ha risposto come previsto. Riprova fra poco.', false);
      });
      arm(this.proxyMs, () => fault(503, OFF_MESSAGE, true)); up.end();
    });
  }
}
