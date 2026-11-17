import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { run } from './media.js';
import { idFor, fail } from './util.js';

// Scarica sul telefono: «Risparmio spazio» = il brano ricodificato in AAC a 128 kbit/s, fatto una volta sola e tenuto in
// data/musica-128. Un solo ffmpeg alla volta, un solo thread. L'originale su Navidrome non si tocca.
export const KBPS = 128;
export function musicArgs(input, output) {
  return ['-nostdin', '-hide_banner', '-loglevel', 'error', '-i', input, '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-c:a', 'aac', '-b:a', `${KBPS}k`, '-threads', '1', '-movflags', '+faststart', '-y', output];
}
export class MusicTranscode {
  constructor(config, music, tools = {}) {
    this.dir = path.join(config.dataDir, 'musica-128'); this.music = music; this.run = tools.run || run;
    this.chain = Promise.resolve(); this.pending = new Map(); this.controller = new AbortController(); this.closed = false;
  }
  file(id) { return path.join(this.dir, `${idFor(`musica:${id}`)}-${KBPS}.m4a`); }
  async ensure(auth, id) {
    const out = this.file(id);
    if ((await stat(out).catch(() => null))?.size) return out;
    let job = this.pending.get(out);
    if (!job) {
      if (this.closed) throw fail(503, 'Il programma si sta chiudendo.');
      job = this.chain.catch(() => {}).then(() => this.make(auth, id, out)); this.chain = job; this.pending.set(out, job);
      job.then(() => this.pending.delete(out), () => this.pending.delete(out));
    }
    return job;
  }
  async make(auth, id, out) {
    if ((await stat(out).catch(() => null))?.size) return out;
    await mkdir(this.dir, { recursive: true });
    const source = `${out}.src`; const tmp = `${out}.tmp.m4a`;
    try {
      let upstream;
      try { upstream = await fetch(this.music.url('stream', auth, { id, format: 'raw' }), { headers: this.music.headers?.(auth) || {}, signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(60000)]), redirect: 'error' }); }
      catch { throw fail(502, 'Brano non disponibile. Controlla Navidrome.'); }
      if (!upstream.ok || /json|xml/.test(upstream.headers.get('content-type') || '')) { await upstream.body?.cancel(); throw fail(502, 'Brano non disponibile.'); }
      await pipeline(Readable.fromWeb(upstream.body), createWriteStream(source));
      try { await this.run('ffmpeg', musicArgs(source, tmp), 15 * 60 * 1000, this.controller.signal); }
      catch { throw fail(502, 'Non riesco a preparare la versione leggera del brano.'); }
      if (!(await stat(tmp)).size) throw fail(502, 'Versione leggera vuota.');
      await rename(tmp, out); return out;
    } finally { await unlink(source).catch(() => {}); await unlink(tmp).catch(() => {}); }
  }
  async close() { this.closed = true; this.controller.abort(); await this.chain.catch(() => {}); }
}
