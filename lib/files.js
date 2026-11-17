import path from 'node:path';
import { lstat, realpath, readdir, mkdir, rename, statfs, unlink, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { fail, isInside } from './util.js';

export const VIDEO = new Set(['.mp4', '.m4v', '.mkv', '.webm', '.mov', '.avi', '.ts']);
export const AUDIO = new Set(['.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.wav']);
const ALLOWED = new Set([...VIDEO, ...AUDIO, '.srt', '.ass', '.vtt', '.jpg', '.jpeg', '.png']);
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
export function validRelative(relative, allowEmpty = false) {
  if (typeof relative !== 'string' || (!allowEmpty && !relative) || relative.length > 1500 || relative.includes('\\') || relative.startsWith('/') || /[:\x00-\x1f]/.test(relative)) throw fail(400, 'Percorso non valido.');
  const parts = relative.split('/');
  if (relative && parts.some(p => !p || p === '.' || p === '..' || p.startsWith('.') || /[<>"|?*]/.test(p) || /[. ]$/.test(p) || RESERVED.test(p))) throw fail(400, 'Nome o cartella non validi.');
  return relative;
}
export class Files {
  constructor(roots, store, maxUploadGB = 20) { this.roots = roots; this.store = store; this.limit = maxUploadGB * 1024 ** 3; }
  async resolve(rootName, relative = '', { allowMissing = false, directory = false } = {}) {
    const root = this.roots[rootName];
    if (!root) throw fail(404, 'Cartella non disponibile.');
    validRelative(relative, true);
    const rootPath = await realpath(root).catch(() => { throw fail(404, 'Cartella non trovata. Controlla il permesso di archiviazione.'); });
    const target = path.join(rootPath, ...relative.split('/').filter(Boolean));
    if (!isInside(rootPath, target)) throw fail(403, 'Percorso fuori dalla raccolta.');
    let current = rootPath;
    const parts = relative.split('/').filter(Boolean);
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      let info;
      try { info = await lstat(current); }
      catch (e) { if (e.code === 'ENOENT' && allowMissing && i === parts.length - 1) return target; throw e; }
      if (info.isSymbolicLink()) throw fail(403, 'I collegamenti a cartelle esterne non sono ammessi.');
      if (i < parts.length - 1 && !info.isDirectory()) throw fail(400, 'Cartella non valida.');
    }
    if (directory && !(await lstat(target)).isDirectory()) throw fail(400, 'Scegli una cartella.');
    return target;
  }
  async list(root, relative = '') {
    const dir = await this.resolve(root, relative, { directory: true });
    const entries = await readdir(dir, { withFileTypes: true });
    return (await Promise.all(entries.filter(e => !e.name.startsWith('.') && !e.isSymbolicLink()).map(async e => {
      const s = await lstat(path.join(dir, e.name));
      return { name: e.name, directory: e.isDirectory(), size: s.size, modified: s.mtimeMs, path: [relative, e.name].filter(Boolean).join('/') };
    }))).sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, 'it'));
  }
  async space() {
    return Promise.all(Object.keys(this.roots).map(async name => {
      try { const s = await statfs(await this.resolve(name)); return { name, free: s.bavail * s.bsize, total: s.blocks * s.bsize }; }
      catch { return { name, unavailable: true }; }
    }));
  }
  async folder(root, relative) {
    validRelative(relative); const target = await this.resolve(root, relative, { allowMissing: true });
    await mkdir(target); return { ok: true };
  }
  async move(root, from, to, toRoot = root) {
    validRelative(from); validRelative(to);
    const src = await this.resolve(root, from); const dest = await this.resolve(toRoot, to, { allowMissing: true });
    if (!(await lstat(src)).isFile()) throw fail(400, 'Sposta un file alla volta.');
    this.allowed(to);
    // Android shared storage does not support hard links. EXCL refuses replacement.
    await copyFile(src, dest, constants.COPYFILE_EXCL); await unlink(src); return { ok: true };
  }
  allowed(relative) { if (!ALLOWED.has(path.extname(relative).toLowerCase())) throw fail(400, 'Formato non ammesso: scegli un video, un brano, un’immagine o sottotitoli.'); }
  async upload(root, relative, stream) {
    validRelative(relative); this.allowed(relative);
    const dest = await this.resolve(root, relative, { allowMissing: true });
    const temp = path.join(path.dirname(dest), `.upload-${randomUUID()}`); let size = 0;
    try {
      await pipeline(stream, new Transform({ transform: (chunk, enc, cb) => { size += chunk.length; cb(size > this.limit ? fail(413, 'File troppo grande.') : null, chunk); } }), createWriteStream(temp, { flags: 'wx', mode: 0o600 }));
      await copyFile(temp, dest, constants.COPYFILE_EXCL); return { ok: true, size };
    } finally { await unlink(temp).catch(() => {}); }
  }
  async trash(root, relative) {
    validRelative(relative); const src = await this.resolve(root, relative);
    if (!(await lstat(src)).isFile()) throw fail(400, 'Metti nel cestino un file alla volta.');
    const rootPath = await this.resolve(root); const bin = path.join(rootPath, '.mediateca-cestino');
    await mkdir(bin, { recursive: true });
    if ((await lstat(bin)).isSymbolicLink()) throw fail(403, 'Cestino non valido.');
    const record = { id: randomUUID(), root, path: relative, date: Date.now() };
    // Save intent first: a crash can leave a recoverable pending record, never an untracked removed file.
    await this.store.change(d => { d.trash.push(record); });
    try { await rename(src, path.join(bin, record.id)); }
    catch (e) { await this.store.change(d => { d.trash = d.trash.filter(r => r.id !== record.id); }); throw e; }
    return record;
  }
  async restore(id) {
    const record = this.store.data.trash.find(r => r.id === id);
    if (!record) throw fail(404, 'File nel cestino non trovato.');
    const rootPath = await this.resolve(record.root);
    const bin = path.join(rootPath, '.mediateca-cestino');
    if ((await lstat(bin)).isSymbolicLink()) throw fail(403, 'Cestino non valido.');
    const src = path.join(bin, record.id); const dest = await this.resolve(record.root, record.path, { allowMissing: true });
    if ((await lstat(src)).isSymbolicLink()) throw fail(403, 'File non valido.');
    await copyFile(src, dest, constants.COPYFILE_EXCL); await unlink(src);
    await this.store.change(d => { d.trash = d.trash.filter(r => r.id !== id); }); return { ok: true };
  }
}
