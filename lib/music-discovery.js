import { similarity } from '../public/music-logic.js';
export function recommendations(catalog, ids, { exclude = [], limit = 8 } = {}) {
  const blocked = new Set([...ids, ...exclude]); const wanted = new Set(ids);
  const seeds = catalog.filter(s => wanted.has(s.id) && !s.problema).slice(-100);
  const artists = new Set(seeds.map(s => s.artist).filter(Boolean)); const seen = new Set();
  return catalog.filter(s => !s.problema && !blocked.has(s.id) && !seen.has(s.id) && seen.add(s.id))
    .map(s => ({ song: s, score: (artists.has(s.artist) ? 3 : 0) + (seeds.length ? Math.max(...seeds.map(seed => similarity(seed, s))) : 0) }))
    .sort((a, b) => b.score - a.score || a.song.id.localeCompare(b.song.id)).slice(0, Math.min(10, Math.max(0, limit))).map(r => r.song);
}
