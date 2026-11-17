export const musicCacheName = scope => `mediateca-music-v1:${encodeURIComponent(scope)}`;
export const manifestURL = '/offline-music-manifest';
export const streamURL = (id, scope) => `/api/music/stream?id=${encodeURIComponent(id)}&offline=${encodeURIComponent(scope)}`;
export function byteRange(range, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range || ''); if (!m || (!m[1] && !m[2]) || !size) return null;
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
  if (![start, end].every(Number.isSafeInteger) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}
export async function cachedRangeResponse(response, range) {
  if (!range) return response;
  const blob = await response.blob(); const selected = byteRange(range, blob.size);
  if (!selected) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${blob.size}` } });
  const { start, end } = selected;
  return new Response(blob.slice(start, end + 1), { status: 206, headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg', 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${blob.size}`, 'Accept-Ranges': 'bytes' } });
}
