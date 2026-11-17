import { run } from './media.js';
import { ffmpegThreadCount } from './work-pause.js';

// Ogni record: un byte di validità (nero = 0) e otto byte di dHash.
// Il nero conserva il posto: il tempo resta indice / 2 secondi.
const RECORD = 9;
export function firmaFotogrammi(pixel) {
  if (pixel.length % 72) throw new Error('Fotogrammi incompleti.');
  const firme = Buffer.alloc(pixel.length / 72 * RECORD);
  for (let i = 0; i < pixel.length / 72; i++) {
    const base = i * 72; let somma = 0; let basso = 0; let alto = 0;
    for (let p = 0; p < 72; p++) somma += pixel[base + p];
    if (somma < 12 * 72) continue;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (pixel[base + r * 9 + c] <= pixel[base + r * 9 + c + 1]) continue;
      const bit = r * 8 + c;
      if (bit < 32) basso |= 1 << bit; else alto |= 1 << (bit - 32);
    }
    firme[i * RECORD] = 1;
    firme.writeUInt32LE(basso >>> 0, i * RECORD + 1); firme.writeUInt32LE(alto >>> 0, i * RECORD + 5);
  }
  return firme;
}
export async function estraiFotogrammi(file, signal, { exec = run, ffmpegThreads } = {}) {
  const pixel = await exec('ffmpeg', ['-nostdin', '-v', 'error', '-threads', String(ffmpegThreadCount(ffmpegThreads) || 1),
    '-skip_frame', 'noref', '-i', file, '-an', '-sn', '-filter_threads', '1', '-vf',
    'fps=2,crop=iw*0.8:ih*0.65:iw*0.1:ih*0.12,scale=9:8:flags=area,format=gray', '-f', 'rawvideo', 'pipe:1'], 1800000, signal, 'binary');
  return firmaFotogrammi(pixel);
}
export function corpoFotogrammi(firme, inizio, fine) {
  return firme.subarray(Math.max(0, Math.ceil(inizio * 2)) * RECORD, Math.max(0, Math.ceil(fine * 2)) * RECORD);
}
function bitAccesi(n) {
  n -= (n >>> 1) & 0x55555555; n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
  return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}
function riscontri(firme, inizio, fine, corpi) {
  const riferimenti = [];
  for (const corpo of corpi) for (let j = 0; j < corpo.length; j += RECORD) {
    if (corpo[j]) riferimenti.push([corpo.readUInt32LE(j + 1), corpo.readUInt32LE(j + 5)]);
  }
  const risultati = [];
  for (let i = Math.max(0, Math.ceil(inizio * 2)); i < Math.min(firme.length / RECORD, Math.ceil(fine * 2)); i++) {
    const base = i * RECORD; if (!firme[base]) continue;
    const basso = firme.readUInt32LE(base + 1); const alto = firme.readUInt32LE(base + 5);
    const combacia = riferimenti.some(([b, a]) => bitAccesi(basso ^ b) + bitAccesi(alto ^ a) <= 6);
    risultati.push({ tempo: i / 2, combacia });
  }
  return risultati;
}
export function trovaRiassunto(firme, [inizio, fine], corpi) {
  if (!corpi.length) return null;
  fine = Math.min(fine, inizio + 240);
  const risposte = riscontri(firme, inizio, fine, corpi);
  let ultimo = null;
  for (let t = inizio; t < fine; t += 5) {
    const termine = Math.min(t + 5, fine);
    const pezzo = risposte.filter(r => r.tempo >= t && r.tempo < termine);
    const presente = pezzo.length && pezzo.filter(r => r.combacia).length / pezzo.length >= 0.25;
    if (presente) {
      if (ultimo === null && t - inizio > 30) break;
      if (ultimo !== null && t - ultimo > 10) break;
      ultimo = termine;
    } else if (ultimo !== null && termine - ultimo > 10) break;
  }
  return ultimo !== null && ultimo - inizio >= 15 ? [inizio, Math.round(ultimo * 100) / 100] : null;
}
export function trovaAnteprima(firme, [inizio, durata], corpi) {
  if (!corpi.length) return null;
  const risposte = riscontri(firme, inizio, durata, corpi); const presenti = risposte.filter(r => r.combacia);
  if (!risposte.length || presenti.length / risposte.length < 0.25) return null;
  const ultimo = presenti.at(-1).tempo;
  return [inizio, durata - ultimo <= 20 ? durata : Math.min(durata, ultimo + 2)];
}

// ---- 12/11: prove video per decidere quando un salto è SICURO ----
// Un tratto trovato dall'audio (stessa canzone) è una sigla vera solo se anche le immagini sono le stesse:
// la canzone della sigla sopra una scena della storia non deve mai far partire un salto o un conto alla rovescia.
const leggi = (firme, i) => i >= 0 && (i + 1) * RECORD <= firme.length ? (firme[i * RECORD] ? [firme.readUInt32LE(i * RECORD + 1), firme.readUInt32LE(i * RECORD + 5)] : 'nero') : null;
const vicini = (a, b, maxBit) => a === 'nero' || b === 'nero' ? a === b : bitAccesi(a[0] ^ b[0]) + bitAccesi(a[1] ^ b[1]) <= maxBit;
// Quota dei fotogrammi di A in [inizio, fine] uguali a quelli di B allo stesso punto (tempo in A = tempo in B + d).
// Il nero conta come immagine: titoli di coda su fondo nero coincidono fra loro.
export function confermaVideo(firmeA, firmeB, [inizio, fine], d = 0, maxBit = 10) {
  let validi = 0; let uguali = 0;
  for (let i = Math.max(0, Math.ceil(inizio * 2)); i < Math.min(firmeA.length / RECORD, Math.floor(fine * 2)); i++) {
    const a = leggi(firmeA, i); const j = Math.round((i / 2 - d) * 2);
    const altri = [j, j - 1, j + 1].map(k => leggi(firmeB, k)).filter(Boolean);
    if (!a || !altri.length) continue;
    validi++; if (altri.some(b => vicini(a, b, maxBit))) uguali++;
  }
  return { validi, uguali, quota: validi ? uguali / validi : 0 };
}
// Quota dei fotogrammi (non neri) del tratto che compaiono nei corpi degli altri episodi: quanto è solido un riassunto.
export function quotaRiscontri(firme, [inizio, fine], corpi) {
  const risposte = riscontri(firme, inizio, fine, corpi);
  return risposte.length ? risposte.filter(r => r.combacia).length / risposte.length : 0;
}
// Che cosa c'è DOPO la sigla finale, fino alla fine del file:
// - anteprima: immagini prese qua e là dal prossimo episodio;
// - cartelli ricorrenti: le stesse immagini in coda agli altri episodi (sponsor, «continua»);
// - tutto il resto è storia (scena dopo i titoli, epilogo): «storia» sono i suoi secondi.
// Una scena che il prossimo episodio ripete pari pari all'inizio NON è un'anteprima: resta storia.
// inizioProssimo: da dove comincia il corpo del prossimo episodio (dopo sigla e riassunto): l'anteprima si cerca solo lì,
// perché il riassunto del prossimo episodio mostra scene di QUESTO e non deve passare per anteprima.
export function analizzaCoda(firme, [inizio, durata], { prossimo = null, inizioProssimo = 0, limiteProssimo = Infinity, code = [] } = {}) {
  const primo = Math.max(0, Math.ceil(inizio * 2)); const ultimo = Math.min(firme.length / RECORD, Math.ceil(durata * 2));
  const riferimenti = [];
  if (prossimo) for (let j = 0; j < Math.min(prossimo.length / RECORD, Math.ceil(limiteProssimo * 2)); j++) { const b = leggi(prossimo, j); if (b && b !== 'nero') riferimenti.push([b[0], b[1], j / 2]); }
  const ricorrenti = [];
  for (const coda of code) for (let j = 0; j < coda.length / RECORD; j++) { const b = leggi(coda, j); if (b && b !== 'nero') ricorrenti.push(b); }
  const righe = [];
  for (let i = primo; i < ultimo; i++) {
    const a = leggi(firme, i); if (!a || a === 'nero') continue;
    const trovato = riferimenti.find(b => b[2] >= inizioProssimo && bitAccesi(a[0] ^ b[0]) + bitAccesi(a[1] ^ b[1]) <= 6);
    righe.push({ tempo: i / 2, a, prossimo: trovato ? trovato[2] : null, ricorrente: ricorrenti.some(b => bitAccesi(a[0] ^ b[0]) + bitAccesi(a[1] ^ b[1]) <= 6) });
  }
  const presenti = righe.filter(r => r.prossimo !== null);
  let blocco = null; let ripetuta = false;
  if (presenti.length >= 8) {
    const da = presenti[0].tempo; const a = presenti.at(-1).tempo; const dentro = righe.filter(r => r.tempo >= da && r.tempo <= a);
    // Scena ripetuta: la stessa scena, di fila e alla stessa velocità, all'inizio del prossimo episodio (primi minuti)
    // (almeno 10 secondi, almeno il 70% dei riscontri sullo stesso scarto). Un'anteprima è fatta di pezzi brevi presi qua e là.
    const scarti = new Map();
    for (const r of presenti) {
      const visti = new Set();
      for (const b of riferimenti) {
        if (b[2] >= Math.max(240, inizioProssimo + 120)) break;
        if (bitAccesi(r.a[0] ^ b[0]) + bitAccesi(r.a[1] ^ b[1]) <= 6) visti.add(Math.round(b[2] - r.tempo));
      }
      for (const s of visti) scarti.set(s, (scarti.get(s) || 0) + 1);
    }
    const allineati = Math.max(0, ...[...scarti.keys()].map(s => (scarti.get(s) || 0) + (scarti.get(s + 1) || 0)));
    // Un'immagine ferma combacia con tutto e non dimostra niente: servono immagini diverse fra loro.
    const diverse = new Set(presenti.map(r => `${r.a[0]}:${r.a[1]}`)).size;
    ripetuta = diverse >= 8 && allineati >= 20 && allineati >= presenti.length * 0.7;
    if (!ripetuta && presenti.length >= dentro.length * 0.25) blocco = [da, durata - a <= 20 ? durata : Math.min(durata, a + 2)];
  }
  const storia = righe.filter(r => !r.ricorrente && (!blocco || r.tempo < blocco[0] || r.tempo >= blocco[1])).length / 2;
  const prima = blocco ? righe.filter(r => !r.ricorrente && r.tempo < blocco[0]).length / 2 : 0;
  // I confini uguali a quelli ricevuti (fine sigla, fine file) non si arrotondano: un centesimo oltre la durata farebbe scartare il tratto.
  const anteprima = blocco ? [prima <= 5 ? inizio : Math.round(blocco[0] * 100) / 100, blocco[1] >= durata ? durata : Math.round(blocco[1] * 100) / 100] : null;
  return { anteprima, storia, ripetuta, quota: blocco ? presenti.length / Math.max(1, righe.filter(r => r.tempo >= blocco[0] && r.tempo <= blocco[1]).length) : 0 };
}
