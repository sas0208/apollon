// Shared, deterministic rules. No audio decoding, dependencies or network here.
const list = value => Array.isArray(value) ? value : [];
export function similarity(a = {}, b = {}) {
  let score = 0;
  if ((a.genere || a.genre) && (a.genere || a.genre) === (b.genere || b.genre)) score += 3;
  score += list(a.mood).filter(m => list(b.mood).includes(m)).length * 3;
  for (const [key, span] of [['energia', 100], ['bpm', 120]]) if (Number.isFinite(a[key]) && Number.isFinite(b[key])) score += 2 * Math.max(0, 1 - Math.abs(a[key] - b[key]) / span);
  if (a.tonalita && a.tonalita === b.tonalita) score += 1;
  return score;
}
export function smartQueue(songs, { exclude = [], stats = {}, seed, limit = 100, random = Math.random } = {}) {
  const seen = new Set(exclude); const pool = [];
  for (const song of songs) if (song?.id && !song.problema && !seen.has(song.id)) { pool.push(song); seen.add(song.id); }
  const result = []; let last = seed;
  // One weighted race per candidate, then local diversity when choosing each next.
  const ranks = new Map(pool.map(s => [s.id, -Math.log(Math.max(0.000001, random())) / ((s.starred ? 2 : 1) * (1 + 2 / (1 + (stats[s.id]?.count || 0))) * (1 + similarity(seed, s)))]));
  while (pool.length && result.length < limit) {
    let candidates = pool.filter(s => !last || ((!last.artist || s.artist !== last.artist) && (!(last.albumId || last.album) || (s.albumId || s.album) !== (last.albumId || last.album))));
    if (!candidates.length) candidates = pool.filter(s => !last?.artist || s.artist !== last.artist);
    if (!candidates.length) candidates = pool;
    let best = candidates[0]; let score = Infinity;
    for (const s of candidates) { const rank = ranks.get(s.id) / (1 + similarity(last, s) * 0.3); if (rank < score) { best = s; score = rank; } }
    result.push(best); pool.splice(pool.indexOf(best), 1); last = best;
  }
  return result;
}
export function dailyRandom(key) {
  let n = 2166136261; for (const c of key) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return () => { n |= 0; n = n + 0x6D2B79F5 | 0; let t = Math.imul(n ^ n >>> 15, 1 | n); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function moveEntry(queue, index, from, to) {
  if (![from, to].every(i => Number.isInteger(i) && i >= 0 && i < queue.length)) return { queue: [...queue], index };
  const positions = queue.map((song, i) => ({ song, i })); const [entry] = positions.splice(from, 1); positions.splice(to, 0, entry);
  return { queue: positions.map(p => p.song), index: positions.findIndex(p => p.i === index) };
}
export function removeEntry(queue, index, at) {
  const result = queue.filter((_, i) => i !== at);
  return { queue: result, index: Math.max(0, Math.min(result.length - 1, index - Number(at < index))), currentRemoved: index === at };
}
export function nextIndex(index, length, repeat, ended = false) {
  if (!length) return -1;
  if (ended && repeat === 'one') return index;
  return index + 1 < length ? index + 1 : repeat === 'all' ? 0 : -1;
}
export function volumeGain(song) {
  const gain = Number(song?.replayGain?.trackGain ?? song?.replayGain?.albumGain ?? 0);
  const peak = Number(song?.replayGain?.trackPeak ?? 1);
  return Number.isFinite(gain) ? Math.max(0, Math.min(1, 10 ** (gain / 20), peak > 0 ? 1 / peak : 1)) : 1;
}
export function qualifies(duration, listened) { return Number.isFinite(duration) && duration > 0 && listened >= Math.min(duration / 2, 240); }
