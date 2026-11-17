import { byteRange } from './music-offline-range.js';
// Video scaricati: il file sta nella memoria dell'app a pezzi da 4 MB (/offline-video-part/<id>/<n>). Così il download
// si può riprendere dal pezzo a cui era arrivato, e il lettore può saltare in avanti senza caricare tutto il file.
export const CHUNK = 4 * 1024 ** 2;
export const MAX_REPLY = 32 * 1024 ** 2;
export const videoCacheName = 'mediateca-video-v1';
export const videoManifestURL = '/offline-video-manifest';
export const partURL = (id, n) => `/offline-video-part/${id}/${n}`;
export const playURL = id => `/media/${id}?dl=1`;
export const downloadedBytes = entry => Math.min(entry.total, entry.done * entry.chunk);
// Risposta Range costruita dai pezzi: pochi pezzi alla volta, mai l'intero film in memoria.
export async function videoRangeResponse(cache, entry, rangeHeader) {
  const { total, chunk } = entry; let start = 0, end = total - 1, status = 200;
  if (rangeHeader) {
    const range = byteRange(rangeHeader, total);
    if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    start = range.start; end = Math.min(range.end, start + MAX_REPLY - 1); status = 206;
  }
  const blobs = [];
  for (let n = Math.floor(start / chunk); n <= Math.floor(end / chunk); n++) {
    const part = await cache.match(partURL(entry.id, n)); if (!part) return new Response(null, { status: 404 });
    blobs.push(await part.blob());
  }
  const offset = Math.floor(start / chunk) * chunk; const blob = new Blob(blobs).slice(start - offset, end - offset + 1);
  const headers = { 'Content-Type': entry.type || 'video/mp4', 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${total}`;
  return new Response(blob, { status, headers });
}
