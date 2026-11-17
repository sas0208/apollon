import { fail } from './util.js';

// Chromaprint algorithm 1 (TEST2), 11025 Hz, 4096 frame, 1365 hop.
// https://github.com/acoustid/chromaprint/blob/master/src/fingerprinter_configuration.cpp
export const STEP = 1365 / 11025;
export const TYPES = ['riassunto', 'sigla', 'finale', 'anteprima'];
export function validateSkips(value, duration = 86400) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'Tempi dei salti non validi.');
  const result = {};
  for (const [type, range] of Object.entries(value)) {
    if (!TYPES.includes(type)) throw fail(400, 'Tipo di salto non riconosciuto.');
    if (range === null) { result[type] = null; continue; }
    if (!Array.isArray(range) || range.length !== 2 || range.some(n => typeof n !== 'number' || !Number.isFinite(n)) || range[0] < 0 || range[1] <= range[0] || range[1] > (duration || 86400)) throw fail(400, 'Controlla inizio e fine: usa secondi entro la durata del video.');
    result[type] = [...range];
  }
  const ranges = Object.values(result).filter(Boolean).sort((a, b) => a[0] - b[0]);
  if (ranges.some((r, i) => i && r[0] < ranges[i - 1][1])) throw fail(400, 'I tratti da saltare non possono sovrapporsi.');
  return result;
}
export function chapterSkips(chapters = []) {
  const result = {};
  for (const chapter of chapters) {
    const title = chapter.title || '';
    // 12/11: anche i capitoli «Opening»/«Ending» dentro il file (comuni nei mkv) valgono: li ha messi chi ha fatto il file.
    // Solo nomi inequivocabili e durate da sigla (30-150 s): un capitolo «Intro» può essere un prologo e resta fuori.
    const length = Number(chapter.end) - Number(chapter.start); const song = length >= 30 && length <= 150;
    const type = /recap|previously|riassunto|episodio precedente/i.test(title) ? 'riassunto'
      : /preview|anteprima|prossim[oa] episod/i.test(title) ? 'anteprima'
        : song && /^s*(op|opening|sigla( iniziale)?)s*d*s*$/i.test(title) ? 'sigla'
          : song && /^s*(ed|ending|credits|sigla finale|titoli di coda)s*d*s*$/i.test(title) ? 'finale' : null;
    if (type && !result[type]) try { Object.assign(result, validateSkips({ [type]: [Number(chapter.start), Number(chapter.end)] })); } catch { /* Ignore malformed chapters. */ }
  }
  return result;
}
export function aniSkipIntervals(data, duration) {
  const result = {}; const map = { op: 'sigla', 'mixed-op': 'sigla', ed: 'finale', 'mixed-ed': 'finale', recap: 'riassunto' };
  if (data?.found !== true || !Array.isArray(data.results)) return result;
  for (const row of data.results.slice(0, 30)) {
    const type = map[row?.skipType]; if (!type || result[type]) continue;
    // 12/11: i tempi di AniSkip sono presi su un'altra copia dell'episodio. Se la durata non è la stessa (±3 s)
    // la copia ha tagli diversi e i tempi sarebbero spostati: si scartano.
    if (duration > 0 && row.episodeLength > 0 && Math.abs(row.episodeLength - duration) > 3) continue;
    try { Object.assign(result, validateSkips({ ...result, [type]: [row.interval?.startTime, row.interval?.endTime] }, duration)); } catch { /* External suggestions are optional. */ }
  }
  return result;
}
function bits(n) { n -= (n >>> 1) & 0x55555555; n = (n & 0x33333333) + ((n >>> 2) & 0x33333333); return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; }
// Giro G: tratti che si interrompono per pochi secondi sulla STESSA diagonale (stesso scarto fra i due episodi) sono lo stesso brano:
// una nota diversa, un cambio di scena o la codifica non devono spezzare una sigla di un minuto e mezzo in due pezzi.
export const MERGE_GAP = 12; // secondi
export function matchFingerprints(first, second) {
  const a = first.words; const b = second.words;
  // A 15s audio segment loses up to ~2s at the fingerprint filter edges.
  const minimum = Math.ceil(13 / STEP); const maximum = Math.ceil(120 / STEP);
  const minRun = Math.ceil(4 / STEP); const mergeGap = Math.ceil(MERGE_GAP / STEP);
  if (!a?.length || !b?.length || a.length > 2500 || b.length > 2500) return null;
  let best = null;
  // Walk diagonals without an N*M matrix. Allow brief encoding noise, never
  // infer a match from silence or a constant fingerprint shared by many tones.
  for (let offset = minimum - b.length; offset <= a.length - minimum; offset++) {
    const runs = []; let start = -1; let last = -1; let gap = 0; let errors = 0;
    const end = Math.min(a.length, b.length + offset);
    const close = () => { if (start >= 0 && last - start + 1 >= minRun) runs.push({ start, last, errors }); start = -1; };
    for (let i = Math.max(0, offset); i < end; i++) {
      const distance = bits(a[i] ^ b[i - offset]);
      if (distance <= 1) { if (start < 0) { start = i; errors = 0; } last = i; gap = 0; errors += distance; }
      else if (start >= 0 && ++gap > 5) close();
    }
    close();
    for (let k = 0; k < runs.length;) {
      let m = k + 1; while (m < runs.length && runs[m].start - runs[m - 1].last <= mergeGap) m++;
      const group = runs.slice(k, m); k = m;
      const first = group[0].start; const final = group.at(-1).last; const span = final - first + 1;
      const matched = group.reduce((n, r) => n + r.last - r.start + 1, 0);
      if (span < minimum || span > maximum || matched < minimum || matched < span * 0.5 || (best && matched <= best.matched)) continue;
      const segment = a.slice(first, final + 1);
      const diversity = new Set(segment).size;
      if (diversity < 8 || diversity / span < 0.3) continue;
      best = { start: first, offset, length: span, matched, errors: group.reduce((n, r) => n + r.errors, 0) };
    }
  }
  if (!best) return null;
  // The fingerprint spans ~2.6s of audio; use its centre as the timestamp.
  const centre = 1.3;
  const padding = Math.max(0, (15 - best.length * STEP) / 2);
  const range = (index, offset) => [offset + index * STEP + centre - padding, offset + (index + best.length) * STEP + centre + padding].map(n => Math.round(n * 100) / 100);
  return { a: range(best.start, first.offset || 0), b: range(best.start - best.offset, second.offset || 0), score: 1 - best.errors / (best.matched * 32) };
}

// ---- Consenso della stagione ----
// Unisce tratti sovrapposti o separati da buchi brevi.
export function mergeRanges(ranges, gap = MERGE_GAP) {
  const sorted = ranges.filter(r => Array.isArray(r) && r.length === 2).map(r => [...r]).sort((x, y) => x[0] - y[0]); const out = [];
  for (const r of sorted) { const last = out.at(-1); if (last && r[0] - last[1] <= gap) last[1] = Math.max(last[1], r[1]); else out.push(r); }
  return out;
}
// Fra i tratti trovati per un episodio (uno per ogni confronto) tiene il gruppo contiguo più esteso.
export function pickCluster(ranges, gap = MERGE_GAP) {
  const clusters = mergeRanges(ranges, gap).sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  return clusters[0] ? [Math.round(clusters[0][0] * 100) / 100, Math.round(clusters[0][1] * 100) / 100] : null;
}
const median = values => { const v = [...values].sort((x, y) => x - y); const n = v.length; return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2; };
// Posizione e durata tipiche in una stagione (mediana): servono almeno 3 episodi.
export function consensusOf(ranges) {
  const list = ranges.filter(r => Array.isArray(r)); if (list.length < 3) return null;
  const start = median(list.map(r => r[0])); const end = median(list.map(r => r[1]));
  return { start, end, length: end - start, count: list.length };
}
// Per ogni episodio: ok (nel consenso), estendibile (un pezzo dentro il consenso: va esteso SOLO se l'impronta conferma),
// da_controllare (fuori dal consenso), assente (nessun tratto trovato).
export function reviewPlan(ranges, { tolerance = 6 } = {}) {
  const consensus = consensusOf(Object.values(ranges)); const status = {};
  for (const [id, range] of Object.entries(ranges)) {
    if (!Array.isArray(range)) { status[id] = 'assente'; continue; }
    if (!consensus) { status[id] = 'ok'; continue; }
    const aligned = Math.abs(range[0] - consensus.start) <= tolerance && Math.abs(range[1] - consensus.end) <= tolerance;
    const inside = range[0] >= consensus.start - tolerance && range[1] <= consensus.end + tolerance;
    status[id] = aligned ? 'ok' : inside && range[1] - range[0] < consensus.length * 0.9 ? 'estendibile' : 'da_controllare';
  }
  return { consensus, status };
}
// Quanti fotogrammi di A in rangeA coincidono (con tolleranza di qualche bit) con quelli di B allo scarto d (tempo A = tempo B + d).
export function softCoverage(first, second, rangeA, d = 0, maxBits = 8) {
  let compared = 0; let matched = 0;
  for (let t = rangeA[0]; t <= rangeA[1]; t += STEP) {
    const ia = Math.round((t - (first.offset || 0)) / STEP); const ib = Math.round((t - d - (second.offset || 0)) / STEP);
    if (ia < 0 || ib < 0 || ia >= first.words.length || ib >= second.words.length) continue;
    compared++; if (bits((first.words[ia] ^ second.words[ib]) >>> 0) <= maxBits) matched++;
  }
  return { compared, matched, fraction: compared ? matched / compared : 0 };
}
