import { dailyRandom } from '../public/music-logic.js';
// "Miscela": gusti di due profili della casa, tutto calcolato in locale dal catalogo e dagli ascolti registrati.
export const MIN_LISTENS = 10, SIZE = 30, MIN_SECONDS = 20;
const list = v => Array.isArray(v) ? v : v ? [v] : [];
export function features(s = {}) {
  const genre = s.genere || s.genre;
  return [...(genre ? [`g:${genre}`] : []), ...list(s.mood).map(m => `m:${m}`), ...(Number.isFinite(s.energia) ? [`e:${Math.min(4, Math.floor(s.energia / 20))}`] : []), ...(s.artist ? [`a:${s.artist}`] : [])];
}
const norm = v => { const n = Math.sqrt([...v.values()].reduce((t, x) => t + x * x, 0)); return n ? new Map([...v].map(([k, x]) => [k, x / n])) : v; };
const dot = (a, b) => { let t = 0; for (const [k, x] of a) t += x * (b.get(k) || 0); return t; };
// Ascolti validi: almeno 20 secondi; il peso cresce fino a 4 minuti. I preferiti di Navidrome sono di tutta la casa: contano per entrambi, a metà peso.
export function taste(events, byId, starred = []) {
  const v = new Map(), plays = new Map(); let listens = 0;
  const add = (song, weight) => { for (const f of features(song)) v.set(f, (v.get(f) || 0) + weight); };
  for (const e of events) {
    if (!(e.seconds >= MIN_SECONDS)) continue;
    listens++; const w = Math.min(e.seconds, 240) / 240; add({ ...e.song, ...byId.get(e.id) }, w); plays.set(e.id, (plays.get(e.id) || 0) + 1);
  }
  for (const s of starred) add(s, 0.5);
  return { vector: norm(v), plays, listens };
}
const score = (t, song, starred) => dot(t.vector, norm(new Map(features(song).map(f => [f, 1])))) + 0.25 * Math.min(1, (t.plays.get(song.id) || 0) / 3) + (starred.has(song.id) ? 0.15 : 0);
export function blend({ mine, other, catalog, starred = [], seed = '' }) {
  const byId = new Map(catalog.map(s => [s.id, s])), stars = new Set(starred), liked = catalog.filter(s => stars.has(s.id));
  const a = taste(mine, byId, liked), b = taste(other, byId, liked);
  if (a.listens < MIN_LISTENS || b.listens < MIN_LISTENS) return { empty: true, needed: MIN_LISTENS, mine: a.listens, other: b.listens, songs: [] };
  const seen = new Set(), random = dailyRandom(seed), pool = catalog.filter(s => !s.problema && !seen.has(s.id) && seen.add(s.id));
  const raw = pool.map(song => ({ song, a: score(a, song, stars), b: score(b, song, stars), noise: random() * 0.12 }));
  const top = k => Math.max(1e-9, ...raw.map(r => r[k]));
  const ma = top('a'), mb = top('b');
  const rows = raw.map(r => { const x = r.a / ma, y = r.b / mb; return { ...r, a: x, b: y, who: Math.min(x, y) >= 0.7 * Math.max(x, y) ? 'both' : x > y ? 'mine' : 'other' }; });
  const picked = [], taken = new Set();
  const take = (rank, count) => { for (const r of [...rows].sort(rank)) { if (count <= 0) break; if (!taken.has(r.song.id)) { taken.add(r.song.id); picked.push(r); count--; } } };
  const both = (p, q) => Math.sqrt(q.a * q.b) + q.noise - Math.sqrt(p.a * p.b) - p.noise;
  take(both, 14); take((p, q) => (q.a - 0.6 * q.b + q.noise) - (p.a - 0.6 * p.b + p.noise), 8); take((p, q) => (q.b - 0.6 * q.a + q.noise) - (p.b - 0.6 * p.a + p.noise), 8); take(both, SIZE - picked.length);
  for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }
  const cos = dot(taste(mine, byId).vector, taste(other, byId).vector);
  return { empty: false, affinity: Math.max(0, Math.min(100, Math.round(cos * 100))), songs: picked.map(r => ({ ...r.song, who: r.who })) };
}
