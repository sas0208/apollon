import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzip } from 'node:zlib';

export function fail(status, message) { return Object.assign(new Error(message), { status }); }
export function idFor(value) { return createHash('sha256').update(value).digest('hex').slice(0, 24); }
export function secret() { return randomBytes(32).toString('hex'); }
export async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
export async function atomicJson(file, value, space = 2) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try { await writeFile(temp, JSON.stringify(value, null, space), { mode: 0o600 }); await rename(temp, file); }
  catch (e) { await rm(temp, { force: true }).catch(() => {}); throw e; }
}
// 8/11 (Fable): il catalogo è ~4 MB di JSON, compresso ~240 KB. Si comprime solo sopra 8 KB e se il lettore lo accetta,
// in asincrono così la riproduzione non si ferma mentre comprime.
export function json(res, value, status = 200) {
  const text = JSON.stringify(value); const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', Vary: 'Accept-Encoding' };
  if (text.length < 8192 || !/\bgzip\b/.test(res.req?.headers?.['accept-encoding'] || '')) { res.writeHead(status, headers); return res.end(text); }
  gzip(text, { level: 5 }, (err, zipped) => {
    if (res.headersSent || res.destroyed) return;
    if (err) { res.writeHead(status, headers); return res.end(text); }
    res.writeHead(status, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': zipped.length }); res.end(zipped);
  });
}
export async function body(req, limit = 128 * 1024) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'Invia dati in formato JSON.');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw fail(413, 'Richiesta troppo grande.');
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  }
  catch { throw fail(400, 'Dati non validi.'); }
}
export function text(value, max = 150) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw fail(400, 'Testo mancante o troppo lungo.');
  return value.trim();
}
export function number(value, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw fail(400, 'Numero non valido.');
  return value;
}
export function isInside(root, target) {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
}
