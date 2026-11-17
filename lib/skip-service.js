import path from 'node:path';
import { mkdir, readdir, stat, readFile, writeFile, rename, copyFile, unlink } from 'node:fs/promises';
import { statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { probe, fingerprint, black } from './media.js';
import { validateSkips, chapterSkips, aniSkipIntervals, matchFingerprints, pickCluster, reviewPlan, softCoverage, MERGE_GAP, TYPES } from './skips.js';
import { atomicJson, readJson, idFor, fail } from './util.js';
import { WorkPause } from './work-pause.js';
import { estraiFotogrammi, corpoFotogrammi, trovaRiassunto, confermaVideo, quotaRiscontri, analizzaCoda } from './fotogrammi.js';

// 12/11: versione delle regole. Le stagioni analizzate con regole più vecchie si ripassano da sole
// (senza rileggere i video: impronte e fotogrammi sono già in cache) per aggiungere le «prove» di certezza.
export const ANALISI = 2;
// Quando un salto è SICURO (può partire da solo, se chi guarda lo ha chiesto) e non solo un pulsante:
// - corretto a mano o scritto nei capitoli del file;
// - trovato dall'audio E confermato dalle immagini (stessa sigla anche da vedere), dentro il consenso della stagione;
// - riassunto/anteprima con almeno metà dei fotogrammi ritrovati negli episodi vicini.
// I tempi di AniSkip (inseriti da altri utenti su altre copie) non sono mai «sicuri».
export function certezza(type, fonte, prove = {}, controllare = {}) {
  if (fonte === 'a mano' || fonte === 'capitoli') return true;
  if (fonte === 'impronta') return !controllare[type] && prove[type]?.video >= 0.6;
  if (fonte === 'fotogrammi') return prove[type]?.quota >= 0.5;
  return false;
}
// Da dove la storia è finita: l'inizio della sigla finale, ma solo se la sigla è sicura e dopo non c'è altra storia
// (al massimo 5 secondi non spiegati). Nel dubbio null: nessun conto alla rovescia, nessun passaggio da solo.
export function fineStoria(salti, sicuri, prove = {}, duration = 0) {
  const finale = salti.finale; if (!finale || !sicuri.includes('finale') || !(duration > 0) || finale[0] < duration / 2) return null;
  if (duration - finale[1] <= 3) return finale[0];
  const coda = prove.coda;
  return coda && Math.abs(coda.da - finale[1]) <= 2 && coda.storia <= 5 ? finale[0] : null;
}

const signature = item => `${item.size}:${item.mtime}`;
const metadataOnly = ({ windows, ...data }) => data;
const seasonKey = item => idFor(JSON.stringify([item.root, item.series, item.season]));
const compatible = (a, b) => a.root === b.root && a.series === b.series && a.season === b.season;
async function aniSkip(mal, episode, signal) {
  const url = new URL(`https://api.aniskip.com/v2/skip-times/${mal}/${episode}`);
  for (const type of ['op', 'ed', 'recap', 'mixed-op', 'mixed-ed']) url.searchParams.append('types[]', type);
  url.searchParams.set('episodeLength', '0');
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), redirect: 'error' });
  if (response.status === 404) return { found: false };
  if (!response.ok) throw new Error('AniSkip non disponibile.');
  let size = 0; const chunks = [];
  for await (const chunk of response.body) { size += chunk.length; if (size > 512000) throw new Error('Risposta AniSkip troppo grande.'); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export class SkipService {
  constructor(config, library, files, store, tools = {}) {
    this.config = config; this.library = library; this.files = files; this.store = store;
    this.dir = path.join(config.dataDir, 'salti');
    this.resourcePause = new WorkPause(config);
    this.tools = { probe, fingerprint: (file, offset, length, signal) => fingerprint(file, offset, length, signal, { tempDir: this.dir, ffmpegThreads: config.ffmpegThreads, beforeRun: () => this.resourcePause.wait() }),
      black: (file, offset, length, signal) => black(file, offset, length, signal, { ffmpegThreads: config.ffmpegThreads }),
      fotogrammi: (file, signal) => estraiFotogrammi(file, signal, { ffmpegThreads: config.ffmpegThreads }), aniSkip, ...tools };
    this.cache = new Map(); this.jobs = []; this.running = false; this.closed = false;
    this.controller = new AbortController(); this.report = { completed: 0, failed: 0, message: 'Scegli una stagione da analizzare.' };
  }
  async init() {
    await mkdir(this.dir, { recursive: true });
    for (const name of await readdir(this.dir)) if (/^[a-f0-9]{24}\.json$/.test(name)) {
      try { const data = await readJson(path.join(this.dir, name), null); if (data?.versione === 1) this.cache.set(name.slice(0, -5), metadataOnly(data)); } catch { /* A damaged cache may be recalculated. */ }
    }
    this.library.skips = this;
    // Giro G: dopo ogni scansione della raccolta le stagioni nuove si analizzano da sole, in coda lenta.
    this.library.onScanned = () => this.autoQueue();
    this.autoQueue(); return this;
  }
  // Il lettore segnala che qualcuno sta guardando: l'analisi aspetta (ffmpeg e fpcalc sul telefono pesano).
  noteActivity() { this.lastPlayback = Date.now(); }
  playbackBusy() { return this.lastPlayback && Date.now() - this.lastPlayback < (this.config.skipPlaybackWindowMs ?? 20000); }
  async yieldToPlayback() {
    await this.resourcePause.wait();
    // 8/11: anche una versione leggera chiesta da chi guarda passa davanti all'analisi.
    while ((this.playbackBusy() || this.library.versions?.working || this.library.trickplay?.working) && !this.closed) await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, this.config.skipPlaybackPollMs ?? 4000); });
    await this.resourcePause.wait();
  }
  // 8/11 (Fable): un passo pesante (fotogrammi, impronte) parte solo a lettore fermo e, se qualcuno inizia a guardare
  // mentre gira, ffmpeg/fpcalc si fermano subito e il passo riparte da capo quando il lettore si libera.
  async guarded(step) {
    for (;;) {
      await this.yieldToPlayback(); if (this.closed) throw new Error('Analisi chiusa.');
      const controller = new AbortController(); const stop = () => controller.abort();
      this.controller.signal.addEventListener('abort', stop, { once: true });
      let interrupted = false;
      const monitor = setInterval(() => { if (this.playbackBusy() || this.library.versions?.working || this.library.trickplay?.working) { interrupted = true; controller.abort(); } }, this.config.skipMonitorMs ?? 500);
      try { return await step(controller.signal); }
      catch (error) { if (!interrupted || this.closed) throw error; }
      finally { clearInterval(monitor); this.controller.signal.removeEventListener('abort', stop); }
    }
  }
  // Stagioni nuove con almeno due episodi, oppure cache esistenti da completare.
  // Una stagione che non riesce (per esempio manca fpcalc) non riparte finché non cambiano i file.
  autoQueue() {
    if (this.closed || this.config.autoSkips === false) return 0;
    const seasons = new Map();
    for (const raw of this.library.items) {
      if (raw.root !== 'Anime' || !raw.series || !Number.isInteger(raw.episode)) continue;
      const item = this.library.get(raw.id); const key = seasonKey(item);
      if (!seasons.has(key)) seasons.set(key, { key, items: [] });
      seasons.get(key).items.push(item);
    }
    this.tried ||= new Map(); let queued = 0;
    for (const { key, items } of seasons.values()) {
      const todo = items.filter(i => !this.valid(i) || !this.hasFrames(i) || this.valid(i).analisi !== ANALISI); const done = items.length - todo.length;
      if (!(todo.length >= 2 || (todo.length === 1 && (done >= 1 || this.valid(todo[0]))))) continue;
      const fingerprint = todo.map(i => `${i.id}:${signature(i)}:${this.hasFrames(i)}:${ANALISI}`).sort().join(',');
      if (this.tried.get(key) === fingerprint || this.jobs.some(j => j.key === key) || this.activeKey === key) continue;
      if (this.jobs.length >= 20) break;
      this.tried.set(key, fingerprint); this.jobs.push({ key, id: items[0].id, auto: true }); queued++;
    }
    if (queued && !this.running) this.task = this.work();
    return queued;
  }
  // Per la pagina della serie: quanti episodi hanno i salti pronti e se la preparazione è in corso.
  overview(details = false) {
    const series = {}; const episodes = []; const waiting = new Set([...this.jobs.map(j => j.key), this.activeKey].filter(Boolean));
    for (const raw of this.library.items) {
      if (raw.root !== 'Anime' || !raw.series || !Number.isInteger(raw.episode)) continue;
      const row = series[`${raw.root}/${raw.series}`] ||= { total: 0, ready: 0, preparing: false, review: 0 };
      row.total++; const cache = this.valid(raw); if (cache) row.ready++;
      if (cache && Object.keys(cache.controllare || {}).length) row.review++;
      if (waiting.has(seasonKey(raw))) row.preparing = true;
      if (details) episodes.push({ id: raw.id, root: raw.root, series: raw.series, ready: !!cache,
        review: !!cache && !!Object.keys(cache.controllare || {}).length, preparing: waiting.has(seasonKey(raw)) });
    }
    for (const row of Object.values(series)) if (row.ready >= row.total) row.preparing = false;
    return { ...this.status(), auto: this.config.autoSkips !== false, series, ...(details ? { episodes } : {}) };
  }
  valid(item) { const data = this.cache.get(item.id); return data?.signature === signature(item) ? data : null; }
  hasFrames(item) {
    const info = this.valid(item)?.fotogrammi;
    if (info?.versione !== 1 || info.signature !== signature(item) || !(info.bytes > 0) || info.bytes % 9) return false;
    try { return statSync(path.join(this.dir, `${item.id}.fotogrammi`)).size === info.bytes; } catch { return false; }
  }
  async framesFor(item, data) {
    const destinazione = path.join(this.dir, `${item.id}.fotogrammi`);
    if (this.hasFrames(item)) {
      try {
        const firme = await readFile(destinazione);
        if (firme.length === data.fotogrammi.bytes && firme.length % 9 === 0) return firme;
      } catch { /* Una firma mancante si ricalcola senza rifare l'audio. */ }
    }
    await this.yieldToPlayback(); if (this.closed) return null;
    const file = await this.library.fileFor(item.id);
    const firme = await this.guarded(signal => this.tools.fotogrammi(file, signal));
    if (!Buffer.isBuffer(firme) || !firme.length || firme.length % 9) throw new Error('Firme dei fotogrammi non valide.');
    if (this.closed) return null;
    const temporaneo = `${destinazione}.${randomUUID()}.tmp`;
    try { await writeFile(temporaneo, firme); await rename(temporaneo, destinazione); }
    finally { await unlink(temporaneo).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
    data.fotogrammi = { versione: 1, signature: signature(item), bytes: firme.length };
    await this.save(item, data); await this.pause();
    return firme;
  }
  decorate(item) {
    const data = this.valid(item); const edit = this.store.data.edits[item.id];
    const salti = { ...data?.salti }; const fonti = { ...data?.fonti };
    const mal = this.store.data.skipSettings?.malIds?.[seasonKey(item)];
    if (data?.aniskipDone !== `${mal}:${item.episode}`) for (const type of TYPES) if (fonti[type] === 'aniskip') { delete salti[type]; delete fonti[type]; }
    if (item.introEnd > item.introStart && !edit?.salti?.sigla) { salti.sigla = [item.introStart, item.introEnd]; fonti.sigla = 'a mano'; }
    if (edit?.saltiSignature === signature(item)) for (const [type, range] of Object.entries(edit.salti || {})) { salti[type] = range; fonti[type] = 'a mano'; }
    // Old manual settings take priority over automatic candidates too.
    const accepted = {}; const sources = {};
    for (const type of [...TYPES].sort((a, b) => Number(fonti[b] === 'a mano') - Number(fonti[a] === 'a mano'))) {
      if (!(type in salti)) continue;
      try { Object.assign(accepted, validateSkips({ ...accepted, [type]: salti[type] }, data?.duration || item.duration)); sources[type] = fonti[type]; } catch { /* Ignore stale/overlapping suggestions. */ }
    }
    const sicuri = Object.keys(accepted).filter(type => certezza(type, sources[type], data?.prove, data?.controllare));
    return { ...item, salti: accepted, fontiSalti: sources, saltiSicuri: sicuri, fineStoria: fineStoria(accepted, sicuri, data?.prove, data?.duration || item.duration),
      controllare: Object.keys(data?.controllare || {}).filter(type => type in accepted), introStart: accepted.sigla?.[0] || 0, introEnd: accepted.sigla?.[1] || 0 };
  }
  status() { return { ...this.report, running: this.running, pending: this.jobs.length, aniskip: this.store.data.skipSettings?.aniskip === true }; }
  settings(item) { return { ...this.status(), malId: this.store.data.skipSettings?.malIds?.[seasonKey(item)] || null }; }
  async setSettings(patch) {
    if (typeof patch.aniskip !== 'boolean') throw fail(400, 'Scegli se usare l’aiuto AniSkip.');
    const item = patch.id ? this.library.get(patch.id) : null;
    if ('malId' in patch && patch.malId !== null && (!Number.isInteger(patch.malId) || patch.malId <= 0 || patch.malId > 1e8)) throw fail(400, 'Inserisci un ID MyAnimeList valido.');
    if ('malId' in patch && (!item?.series || item.root !== 'Anime')) throw fail(400, 'Scegli un episodio anime.');
    await this.store.change(d => { d.skipSettings ||= { aniskip: false, malIds: {} }; d.skipSettings.aniskip = patch.aniskip;
      d.skipSettings.malIds ||= {}; if (item && 'malId' in patch) d.skipSettings.malIds[seasonKey(item)] = patch.malId;
    });
    return this.status();
  }
  enqueue(id) {
    if (this.closed) throw fail(503, 'Analisi in chiusura.');
    const item = this.library.get(id);
    if (item.root !== 'Anime' || !item.series || !Number.isInteger(item.episode)) throw fail(400, 'Scegli un episodio nella raccolta Anime.');
    const key = seasonKey(item);
    if (!this.jobs.some(j => j.key === key) && this.activeKey !== key) {
      if (this.jobs.length >= 20) throw fail(429, 'La coda è piena. Aspetta che finisca una stagione.');
      this.jobs.push({ key, id });
    }
    if (!this.running) this.task = this.work();
    return this.status();
  }
  async wait() { await this.task; }
  async pause() {
    if (!this.closed && this.config.skipDelayMs !== 0) await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, this.config.skipDelayMs ?? 2000); });
  }
  async save(item, data) {
    const file = await this.library.fileFor(item.id); const now = await stat(file);
    if (signature({ size: now.size, mtime: now.mtimeMs }) !== signature(item)) throw new Error('Il video è cambiato durante l’analisi. Aggiorna la raccolta.');
    if (this.closed) return;
    await atomicJson(path.join(this.dir, `${item.id}.json`), data); this.cache.set(item.id, metadataOnly(data));
  }
  async work() {
    this.running = true; this.library.analysisBusy = true;
    clearTimeout(this.library.timer); this.library.wake?.(); await this.library.workTask;
    try {
      while (this.jobs.length && !this.closed) {
        await this.yieldToPlayback(); if (this.closed) break;
        // 7/11: fra una stagione e l'altra passano prima copertine e dati dei file nuovi (poco lavoro), poi si riprende coi salti.
        if (this.library.jobs.length && this.config.metadata !== false) {
          this.library.analysisBusy = false;
          if (!this.library.running) this.library.workTask = this.library.work();
          await this.library.workTask; this.library.analysisBusy = true; if (this.closed) break;
        }
        const job = this.jobs.shift(); this.activeKey = job.key;
        this.report = { completed: 0, failed: 0, message: 'Analisi locale della stagione in corso.' };
        try { await this.season(this.library.get(job.id)); if (!this.report.failed) this.tried?.delete(job.key); }
        catch (error) { if (!this.closed) { this.report.failed++; this.report.message = error.status ? error.message : 'Analisi non riuscita. Controlla ffmpeg, Chromaprint (fpcalc) e i permessi dei file.'; } }
        this.activeKey = null;
      }
    } finally {
      this.running = false; this.library.analysisBusy = false;
      if (!this.closed && this.config.metadata !== false && this.library.jobs.length) this.library.workTask = this.library.work();
      // La coda tiene 20 stagioni alla volta: finite quelle, si accodano le successive (ognuna si prova una volta sola).
      if (!this.closed) this.autoQueue();
    }
  }
  async season(selected) {
    const items = this.library.items.map(i => this.library.get(i.id)).filter(i => compatible(i, selected)).sort((a, b) => a.episode - b.episode);
    const available = [];
    for (const item of items) {
      if (this.closed) return;
      await this.yieldToPlayback();
      // 7/11: un titolo appena arrivato senza copertina non aspetta la fine di una stagione lunga.
      if (this.config.metadata !== false && this.library.urgentJobs?.().length) {
        this.library.analysisBusy = false; this.library.onlyUrgent = true;
        if (!this.library.running) this.library.workTask = this.library.work();
        await this.library.workTask; this.library.onlyUrgent = false; this.library.analysisBusy = true; if (this.closed) return;
      }
      try {
        let data = this.valid(item);
        if (data) {
          try { const saved = await readJson(path.join(this.dir, `${item.id}.json`), null); data = saved?.signature === signature(item) ? saved : null; } catch { data = null; }
        }
        if (!data?.windows) {
          const file = await this.library.fileFor(item.id); await this.resourcePause.wait(); if (this.closed) return;
          const info = await this.tools.probe(file, this.controller.signal);
          if (!(info.duration > 0 && info.duration <= 86400)) throw new Error('Durata non disponibile.');
          const offset = Math.max(0, info.duration - 240);
          await this.resourcePause.wait(); if (this.closed) return;
          const head = await this.guarded(signal => this.tools.fingerprint(file, 0, Math.min(300, info.duration), signal));
          if (this.closed) return;
          await this.resourcePause.wait(); if (this.closed) return;
          const tail = await this.guarded(signal => this.tools.fingerprint(file, offset, Math.min(240, info.duration), signal));
          await this.resourcePause.wait(); if (this.closed) return;
          let blacks = []; try { blacks = await this.guarded(signal => this.tools.black(file, offset, Math.min(240, info.duration), signal)); } catch { /* Il nero è solo un indizio. */ }
          data = { versione: 1, signature: signature(item), duration: info.duration, windows: { head, tail }, black: blacks, salti: chapterSkips(info.chapters), fonti: {}, gruppi: {} };
          for (const type of Object.keys(data.salti)) data.fonti[type] = 'capitoli';
          await this.save(item, data); await this.pause();
        }
        const mal = this.store.data.skipSettings?.malIds?.[seasonKey(item)];
        if (data.aniskipDone && data.aniskipDone !== `${mal}:${item.episode}`) {
          for (const type of TYPES) if (data.fonti[type] === 'aniskip') { delete data.salti[type]; delete data.fonti[type]; }
          delete data.aniskipDone; await this.save(item, data);
        }
        if (this.allowNetwork !== false && this.store.data.skipSettings?.aniskip === true && mal && item.episode > 0 && data.aniskipDone !== `${mal}:${item.episode}`) {
          try {
            const result = aniSkipIntervals(await this.tools.aniSkip(mal, item.episode, this.controller.signal), data.duration);
            if (this.closed) return;
            for (const [type, range] of Object.entries(result)) if (!data.salti[type]) { try { data.salti = validateSkips({ ...data.salti, [type]: range }, data.duration); data.fonti[type] = 'aniskip'; } catch {} }
            data.aniskipDone = `${mal}:${item.episode}`; await this.save(item, data);
          } catch { if (!this.closed) { this.report.failed++; this.report.message = 'Aiuto AniSkip non disponibile. I risultati locali restano validi; puoi riprovare.'; } }
        }
        // Le firme video sono facoltative: un errore non toglie i salti audio già pronti.
        let frames = null;
        try { frames = await this.framesFor(item, data); }
        catch { if (!this.closed) { this.report.failed++; this.report.message = 'Fotogrammi non disponibili per alcuni episodi. I salti già pronti restano disponibili.'; } }
        if (frames) for (const type of TYPES) if (data.fonti[type] === 'fotogrammi') { delete data.salti[type]; delete data.fonti[type]; }
        available.push({ item, data, frames }); this.report.completed++;
      } catch { if (!this.closed) { this.report.failed++; this.report.message = 'Alcuni episodi non sono stati analizzati. Servono ffmpeg e Chromaprint (fpcalc); i video restano riproducibili.'; } }
    }
    for (const { data } of available) data.prove = {};
    for (const type of ['sigla', 'finale']) {
      const window = type === 'sigla' ? 'head' : 'tail'; const links = new Map(); const found = new Map(); const pairs = [];
      for (const { item, data } of available) {
        delete data.gruppi[type]; found.set(item.id, []);
        // Le misure a impronta di un'analisi precedente si rifanno: ora tutti i confronti entrano nel conto.
        if (data.fonti[type] === 'impronta') { delete data.salti[type]; delete data.fonti[type]; }
      }
      for (let i = 0; i < available.length && !this.closed; i++) {
        // 12/11: anche il confronto delle impronte (solo calcolo, niente ffmpeg) cede il passo a chi sta guardando:
        // la ripassata di tutta la raccolta con le regole nuove non deve farsi sentire sul telefono che fa da server.
        await this.yieldToPlayback(); if (this.closed) return;
        for (let j = Math.max(0, i - 4); j < i; j++) {
          await new Promise(resolve => setImmediate(resolve)); if (this.closed) return;
          const a = available[i]; const b = available[j];
          const match = matchFingerprints(a.data.windows[window], b.data.windows[window]);
          if (!match) continue;
          const ranges = [match.a, match.b];
          if (type === 'finale' && ranges.some((r, n) => r[0] < [a, b][n].data.duration / 2)) continue;
          if (type === 'sigla' && ranges.some((r, n) => r[1] > [a, b][n].data.duration / 2)) continue;
          // Ogni confronto dà un pezzo, non per forza tutto: i pezzi di uno stesso episodio si uniscono (vedi sotto).
          const d = ranges[0][0] - ranges[1][0]; // tempo in A = tempo in B + d
          found.get(a.item.id).push({ range: ranges[0], other: b, d }); found.get(b.item.id).push({ range: ranges[1], other: a, d: -d });
          pairs.push({ a, b, ranges });
        }
        await new Promise(resolve => setImmediate(resolve));
      }
      // Un tratto per episodio: i pezzi contigui (buchi brevi) si uniscono.
      const merged = {};
      for (const { item } of available) { const list = found.get(item.id); merged[item.id] = list.length ? pickCluster(list.map(x => x.range)) : null; }
      // Si collegano solo gli episodi che condividono il tratto scelto: un episodio con due musiche diverse non unisce due sigle diverse.
      const linked = new Map(); // tratto già collegato di ogni episodio
      const near = (id, range) => !linked.has(id) || (range[0] <= linked.get(id)[1] + MERGE_GAP && range[1] >= linked.get(id)[0] - MERGE_GAP);
      for (const { a, b, ranges } of pairs) {
        if (!near(a.item.id, ranges[0]) || !near(b.item.id, ranges[1])) continue;
        linked.set(a.item.id, ranges[0]); linked.set(b.item.id, ranges[1]);
        const previousA = links.get(a.item.id); const previousB = links.get(b.item.id);
        const root = previousB || previousA || b.item.id;
        for (const [key, value] of links) if (value === previousA || value === previousB) links.set(key, root);
        links.set(a.item.id, root); links.set(b.item.id, root);
      }
      // Il consenso della stagione (posizione e durata tipiche) completa i pezzi parziali SOLO dove l'impronta lo conferma.
      const plan = reviewPlan(merged);
      for (const entry of available) {
        const id = entry.item.id; if (plan.status[id] !== 'estendibile') continue;
        for (const link of found.get(id)) {
          const theirs = merged[link.other.item.id]; if (plan.status[link.other.item.id] !== 'ok' || !theirs) continue;
          const mine = merged[id]; const mapped = [theirs[0] + link.d, theirs[1] + link.d];
          const target = [Math.max(0, Math.min(mine[0], mapped[0])), Math.min(entry.data.duration, Math.max(mine[1], mapped[1]))];
          const added = [[target[0], mine[0]], [mine[1], target[1]]].filter(r => r[1] - r[0] > 1);
          const confirmed = added.length && added.every(r => { const cover = softCoverage(entry.data.windows[window], link.other.data.windows[window], r, link.d); return cover.compared >= 20 && cover.fraction >= 0.6; });
          if (confirmed) { merged[id] = target.map(n => Math.round(n * 100) / 100); plan.status[id] = 'ok'; break; }
        }
      }
      for (const entry of available) {
        const { item, data } = entry; const range0 = merged[item.id]; data.controllare ||= {};
        const flagged = plan.consensus && ['estendibile', 'da_controllare', 'assente'].includes(plan.status[item.id]);
        if (flagged) data.controllare[type] = plan.status[item.id] === 'assente' ? 'assente' : 'fuori dal consenso'; else delete data.controllare[type];
        if (range0) {
          let range = range0;
          if (type === 'finale') {
            // Only refine an audio match; black alone never proves credits.
            const near = (point, bounds) => bounds.sort((x, y) => Math.abs(x - point) - Math.abs(y - point)).find(n => Math.abs(n - point) <= 1);
            const start = near(range[0], (data.black || []).map(b => b[1]));
            const end = near(range[1], (data.black || []).map(b => b[0]));
            range = [start ?? range[0], end ?? range[1]];
          }
          // I capitoli del file hanno la precedenza: li ha messi chi ha fatto il file.
          if (data.fonti[type] !== 'capitoli') try { data.salti = validateSkips({ ...data.salti, [type]: range }, data.duration); data.fonti[type] = 'impronta'; } catch { /* Sovrapposto a un altro tratto: resta quello. */ }
          // Prova video: le immagini del tratto sono le stesse dell'episodio con cui l'audio combacia?
          if (data.fonti[type] === 'impronta' && entry.frames) {
            let video = null;
            for (const link of found.get(item.id)) {
              if (!link.other.frames) continue;
              const esito = confermaVideo(entry.frames, link.other.frames, data.salti[type], link.d);
              if (esito.validi >= 20 && (video === null || esito.quota > video)) video = esito.quota;
            }
            if (video !== null) data.prove[type] = { video: Math.round(video * 100) / 100 };
          }
        }
        if (links.has(item.id)) data.gruppi[type] = `${seasonKey(item)}:${type}:${links.get(item.id)}`;
      }
    }
    await this.frameSkips(available);
    for (const { item, data } of available) { if (this.closed) return; data.analisi = ANALISI; await this.save(item, data); }
    if (!this.report.failed) this.report.message = 'Analisi conclusa. Controlla i tempi prima di attivare i salti automatici.';
  }
  async frameSkips(available) {
    const episodi = new Map(available.map(e => [e.item.episode, e]));
    // La decorazione include le correzioni manuali; si usa anche per delimitare i corpi.
    const saltiDi = e => {
      const edit = this.store.data.edits[e.item.id];
      // introStart/End nello snapshot possono venire dalla vecchia impronta.
      return this.decorate({ ...e.item, introStart: edit?.introStart || 0, introEnd: edit?.introEnd || 0 }).salti;
    };
    const corpoDi = (e, dopoRiassunto = false) => {
      if (!e?.frames) return null;
      const salti = saltiDi(e);
      const inizio = Math.max(salti.sigla?.[1] ?? 120, dopoRiassunto ? salti.riassunto?.[1] || 0 : 0);
      return corpoFotogrammi(e.frames, inizio, salti.finale?.[0] ?? e.data.duration - 60);
    };
    const aggiungi = (e, tipo, tratto) => {
      const { item, data } = e;
      if (!tratto || tipo in saltiDi(e)) return false;
      try {
        validateSkips({ ...saltiDi(e), [tipo]: tratto }, data.duration);
        // Conta la sigla effettiva: quella corretta a mano può avere altri confini
        // rispetto al suggerimento audio conservato nella cache.
        data.salti[tipo] = tratto; data.fonti[tipo] = 'fotogrammi';
        this.cache.set(item.id, metadataOnly(data)); return true;
      } catch { return false; /* Un altro salto ha la precedenza, anche se corretto a mano. */ }
    };
    // Prima tutti i riassunti, poi le anteprime: N+1 deve già avere il suo riassunto.
    for (const e of available) {
      await this.yieldToPlayback(); if (this.closed) return;
      this.cache.set(e.item.id, metadataOnly(e.data));
      if (!e.frames) continue;
      const corpi = [episodi.get(e.item.episode - 1), episodi.get(e.item.episode - 2)].map(p => corpoDi(p)).filter(Boolean);
      const salti = saltiDi(e); const inizio = salti.sigla?.[1] ?? 0;
      let tratto = trovaRiassunto(e.frames, [inizio, Math.min(inizio + 240, salti.finale?.[0] ?? e.data.duration)], corpi);
      if (!tratto && salti.sigla?.[0] > 20) tratto = trovaRiassunto(e.frames, [0, salti.sigla[0]], corpi);
      e.data.prove ||= {};
      if (aggiungi(e, 'riassunto', tratto)) e.data.prove.riassunto = { quota: Math.round(quotaRiscontri(e.frames, tratto, corpi) * 100) / 100 };
      await new Promise(resolve => setImmediate(resolve));
    }
    // Dopo la sigla finale: anteprima del prossimo episodio, cartelli che tornano uguali, oppure altra storia.
    const codaDi = p => { const finale = p?.frames && saltiDi(p).finale; return finale ? corpoFotogrammi(p.frames, finale[1], p.data.duration) : null; };
    for (const e of available) {
      await this.yieldToPlayback(); if (this.closed) return;
      const salti = saltiDi(e); const finale = salti.finale;
      if (e.frames && finale) {
        const prossimo = episodi.get(e.item.episode + 1); const saltiProssimo = prossimo?.frames ? saltiDi(prossimo) : null;
        const code = [-2, -1, 1, 2].map(n => codaDi(episodi.get(e.item.episode + n))).filter(Boolean);
        const esito = analizzaCoda(e.frames, [finale[1], e.data.duration], { prossimo: prossimo?.frames || null,
          inizioProssimo: saltiProssimo ? Math.max(saltiProssimo.sigla?.[1] ?? 120, saltiProssimo.riassunto?.[1] || 0) : 0,
          limiteProssimo: saltiProssimo?.finale?.[0] ?? (prossimo ? prossimo.data.duration - 60 : 0), code });
        e.data.prove.coda = { da: finale[1], storia: esito.storia, ...(esito.ripetuta ? { ripetuta: true } : {}) };
        if (aggiungi(e, 'anteprima', esito.anteprima)) e.data.prove.anteprima = { quota: Math.round(esito.quota * 100) / 100 };
        this.cache.set(e.item.id, metadataOnly(e.data));
      }
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  async edit(id, patch, sameOpening = false) {
    const item = this.library.get(id); const data = this.valid(item);
    const values = validateSkips(patch, data?.duration || item.duration);
    validateSkips({ ...item.salti, ...values }, data?.duration || item.duration);
    if (typeof sameOpening !== 'boolean') throw fail(400, 'Scelta della stagione non valida.');
    const changes = [{ item, values }];
    if (sameOpening) {
      if (!('sigla' in values) || !data?.gruppi?.sigla || !data.salti.sigla) throw fail(400, 'Analizza prima la stagione: serve una sigla riconosciuta uguale.');
      for (const raw of this.library.items) {
        const target = this.library.get(raw.id); const cache = this.valid(target);
        if (target.id === id || !compatible(target, item) || cache?.gruppi?.sigla !== data.gruppi.sigla || !cache.salti.sigla) continue;
        const shifted = values.sigla === null ? null : values.sigla.map((n, k) => Math.round((cache.salti.sigla[k] + n - data.salti.sigla[k]) * 100) / 100);
        validateSkips({ ...target.salti, sigla: shifted }, cache.duration); changes.push({ item: target, values: { sigla: shifted } });
      }
    }
    await this.store.change(d => { for (const { item: target, values: value } of changes) { const edit = d.edits[target.id] ||= {};
      if (edit.saltiSignature !== signature(target)) edit.salti = {};
      edit.salti = { ...edit.salti, ...value }; edit.saltiSignature = signature(target);
      if ('sigla' in value) { edit.introStart = value.sigla?.[0] || 0; edit.introEnd = value.sigla?.[1] || 0; }
    } });
    return { updated: changes.length };
  }
  async move(old, next, info) {
    let data = this.cache.get(old); if (!data) return;
    data = await readJson(path.join(this.dir, `${old}.json`), null); if (!data) return;
    const moved = { ...data, signature: signature({ size: info.size, mtime: info.mtimeMs }) };
    if (data.fotogrammi?.signature === data.signature) {
      try {
        await copyFile(path.join(this.dir, `${old}.fotogrammi`), path.join(this.dir, `${next}.fotogrammi`));
        moved.fotogrammi = { ...data.fotogrammi, signature: moved.signature };
      } catch { delete moved.fotogrammi; }
    }
    await atomicJson(path.join(this.dir, `${next}.json`), moved); this.cache.set(next, metadataOnly(moved)); this.cache.delete(old);
  }
  async close() { this.closed = true; this.jobs = []; this.resourcePause.close(); this.controller.abort(); clearTimeout(this.timer); this.wake?.(); await this.task; }
}
