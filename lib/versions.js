import path from 'node:path';
import { mkdir, readdir, rename, stat, unlink } from 'node:fs/promises';
import { run } from './media.js';
import { atomicJson, readJson, fail } from './util.js';
import { WorkPause, ffmpegThreadCount } from './work-pause.js';

// Giro G: versioni leggere (480p) fatte in casa, in coda lenta, una alla volta, solo per i titoli che qualcuno chiede.
// Stanno in data/versioni/<id>-480.mp4 con la firma (dimensione e data) del file originale: se l'originale cambia, la
// versione non vale più e il lettore torna all'originale. L'originale non si tocca e non si sostituisce mai.
export const HEIGHT = 480;
// 8/11 (revisione Fable): sotto 720 righe i lettori presumono BT.601. Se la sorgente HD non ha i tag colore, la 480p
// usciva senza tag e i colori si spostavano: si scrivono i tag BT.709 senza convertire i pixel (setparams, non out_color_matrix).
export function lightArgs(input, output, encoder, ffmpegThreads, sourceHeight = 0) {
  // Misurato sull'telefono video (6/11, 60 s di un episodio 720p a ~870 kb/s): libx264 veryfast crf 28 su 2 thread = 11 s e 41%
  // dell'originale; h264_mediacodec ignora -b:v senza -bitrate_mode cbr (usciva PIÙ grande dell'originale), con cbr
  // 450k = 13 s e 65%. Quindi prima libx264, l'hardware solo come ripiego.
  const threads = ffmpegThreadCount(ffmpegThreads);
  const video = encoder === 'h264_mediacodec' ? ['-c:v', 'h264_mediacodec', '-bitrate_mode', 'cbr', '-b:v', '450k', ...(threads ? ['-threads', String(threads)] : [])]
    : ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-maxrate', '600k', '-bufsize', '1200k', '-threads', String(threads || 2), '-pix_fmt', 'yuv420p'];
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', ...(threads ? ['-threads', String(threads), '-filter_threads', String(threads)] : []), '-i', input, '-map', '0:v:0', '-map', '0:a:0?', '-sn', '-dn',
    '-vf', `scale=-2:${HEIGHT}${sourceHeight >= 720 ? ',setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv' : ''}`, ...video, '-c:a', 'aac', '-b:a', '96k', '-ac', '2', '-movflags', '+faststart', '-y', output];
}
const signature = item => `${item.size}:${Math.round(item.mtime)}`;

export class Versions {
  constructor(config, library, tools = {}) {
    this.config = config; this.library = library; this.run = tools.run || run;
    this.dir = path.join(config.dataDir, 'versioni'); this.ready = new Map(); this.queue = []; this.working = null; this.failed = new Set();
    this.urgent = new Set(); this.closed = false; this.controller = new AbortController(); this.task = null;
    this.pause = new WorkPause(config);
  }
  async init() {
    await mkdir(this.dir, { recursive: true });
    for (const name of await readdir(this.dir)) {
      const match = /^([a-f0-9]{24})-480\.json$/.exec(name); if (!match) continue;
      const meta = await readJson(path.join(this.dir, name), null);
      if (meta?.signature && await stat(this.file(match[1])).then(s => s.isFile(), () => false)) this.ready.set(match[1], meta);
    }
    this.library.versions = this; return this;
  }
  file(id) { return path.join(this.dir, `${id}-480.mp4`); }
  // Pronta solo se la firma dell'originale è ancora quella di quando è stata fatta.
  has(item) { const meta = this.ready.get(item.id); return !!meta && meta.signature === signature(item); }
  pathFor(id) { const item = this.library.items.find(i => i.id === id); return item && this.has(item) ? this.file(id) : null; }
  status() {
    let bytes = 0; for (const meta of this.ready.values()) bytes += meta.bytes || 0;
    return { count: this.ready.size, bytes, queued: this.queue.length, working: this.working, failed: [...this.failed] };
  }
  // `first`: chi scarica sul telefono aspetta questa versione, quindi passa avanti alla coda e non attende chi guarda.
  enqueue(ids, { first = false } = {}) {
    if (this.closed) throw fail(503, 'Il programma si sta chiudendo.');
    if (!Array.isArray(ids) || !ids.length || ids.length > 300) throw fail(400, 'Scegli almeno un titolo (al massimo 300 episodi alla volta).');
    const items = ids.map(id => this.library.get(id)); const add = [];
    if (items.some(i => i.remote)) throw fail(409, 'Questo titolo sta sul fisso: qui si può solo guardare.');
    for (const { id } of items) {
      this.failed.delete(id);
      if (this.has(this.library.items.find(i => i.id === id)) || this.working === id) continue;
      if (this.queue.includes(id)) { if (first) this.queue.splice(this.queue.indexOf(id), 1); else continue; }
      if (this.queue.length + add.length >= 600) throw fail(429, 'La coda delle versioni leggere è piena. Aspetta che finisca.');
      add.push(id);
    }
    if (first) { this.queue.unshift(...add); for (const id of add) this.urgent.add(id); } else this.queue.push(...add);
    if (!this.working && this.queue.length && !this.task) this.task = this.work().finally(() => { this.task = null; });
    return this.status();
  }
  itemStatus(id) {
    if (this.library.get(id).remote) return { id, state: 'none', bytes: 0, original: 0, estimate: 0 }; const item = this.library.items.find(i => i.id === id);
    const state = this.has(item) ? 'ready' : this.working === id ? 'working' : this.queue.includes(id) ? 'queued' : this.failed.has(id) ? 'failed' : 'none';
    return { id, state, bytes: this.ready.get(id)?.bytes || 0, original: item.size, estimate: Math.round(item.size * 0.45) };
  }
  async wait() { while (this.task) await this.task; }
  // Mentre qualcuno guarda la codifica aspetta. 8/11: non aspetta più l'analisi dei salti (ore di coda): è l'analisi a cedere il passo.
  busy() { return !!(this.library.skips?.playbackBusy() || this.library.trickplay?.working); }
  async work() {
    while (this.queue.length && !this.closed) {
      await this.pause.wait(); if (this.closed) break;
      while (this.busy() && !this.closed && !this.urgent.has(this.queue[0])) await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, this.config.versionPollMs ?? 5000); });
      await this.pause.wait();
      if (this.closed) break;
      const id = this.queue.shift(); const raw = this.library.items.find(i => i.id === id); if (!raw) continue;
      this.working = id;
      try { await this.make(raw); } catch { if (!this.closed) this.failed.add(id); }
      this.working = null; this.urgent.delete(id);
      if (this.queue.length && !this.closed) await new Promise(resolve => { this.wake = resolve; this.timer = setTimeout(resolve, this.config.versionDelayMs ?? 3000); });
    }
  }
  async make(item) {
    const input = await this.library.fileFor(item.id); const tmp = path.join(this.dir, `${item.id}-480.tmp.mp4`); const sig = signature(item);
    const height = (item.streams || []).find(s => s.type === 'video' && s.height)?.height || 0;
    let used = 'libx264';
    try { await this.pause.wait(); if (this.closed) return; await this.run('ffmpeg', lightArgs(input, tmp, 'libx264', this.config.ffmpegThreads, height), 6 * 3600 * 1000, this.controller.signal); }
    catch (error) {
      if (this.closed) throw error;
      await unlink(tmp).catch(() => {}); used = 'h264_mediacodec';
      await this.pause.wait(); if (this.closed) return;
      await this.run('ffmpeg', lightArgs(input, tmp, 'h264_mediacodec', this.config.ffmpegThreads, height), 6 * 3600 * 1000, this.controller.signal);
    }
    const info = await stat(tmp); if (!info.size) throw new Error('Versione vuota.');
    // L'originale non deve essere cambiato durante la codifica.
    const now = this.library.items.find(i => i.id === item.id);
    if (!now || signature(now) !== sig) { await unlink(tmp).catch(() => {}); throw new Error('Il video è cambiato.'); }
    await rename(tmp, this.file(item.id));
    const meta = { signature: sig, bytes: info.size, encoder: used, at: Date.now() };
    await atomicJson(path.join(this.dir, `${item.id}-480.json`), meta); this.ready.set(item.id, meta);
  }
  async clear() {
    this.queue = []; let removed = 0;
    for (const id of [...this.ready.keys()]) {
      await unlink(this.file(id)).catch(() => {}); await unlink(path.join(this.dir, `${id}-480.json`)).catch(() => {}); this.ready.delete(id); removed++;
    }
    this.failed.clear(); return { removed, ...this.status() };
  }
  async close() { this.closed = true; this.queue = []; this.pause.close(); this.controller.abort(); clearTimeout(this.timer); this.wake?.(); await this.task; await unlink(path.join(this.dir, `${this.working}-480.tmp.mp4`)).catch(() => {}); }
}
