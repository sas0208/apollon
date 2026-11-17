// Giro G, punto 2 (aggiunta): sigle e finali spezzati. Dati di prova: i tempi trovati sull'telefono video su 14 episodi veri (60-73), solo numeri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { matchFingerprints, mergeRanges, pickCluster, consensusOf, reviewPlan, softCoverage, STEP } from '../lib/skips.js';

const mmss = text => { const [m, s] = text.split(':').map(Number); return m * 60 + s; };
const range = (a, b) => [mmss(a), mmss(b)];
function noise(n, seed = 1) { return Array.from({ length: n }, () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; }); }

// Tempi misurati sull'telefono video prima della correzione (fonte «impronta»).
const REAL = {
  sigla: { 60: range('0:01', '0:16'), 61: range('0:01', '0:16'), 62: range('0:01', '1:24'), 63: range('0:17', '1:39'), 64: range('0:01', '1:39'), 65: range('0:17', '1:39'), 66: range('0:17', '1:39'),
    67: range('0:01', '1:39'), 68: range('1:11', '1:39'), 69: range('0:01', '1:40'), 70: range('0:01', '1:39'), 71: range('0:01', '1:40'), 72: range('1:11', '1:39'), 73: range('0:01', '1:39') },
  finale: { 60: range('21:46', '22:19'), 61: range('21:46', '22:20'), 62: range('21:46', '22:44'), 63: range('21:51', '22:50'), 64: range('21:51', '22:53'), 65: range('21:51', '22:50'),
    66: range('21:51', '22:53'), 67: range('21:51', '22:49'), 68: range('22:15', '22:30'), 69: range('21:51', '22:50'), 70: range('22:15', '22:30'), 71: range('21:51', '22:52'), 72: range('21:51', '22:52'), 73: null }
};

test('unione di tratti contigui con buchi brevi; il gruppo più grande vince', () => {
  assert.deepEqual(mergeRanges([[17, 99], [1, 16]], 12), [[1, 99]]);
  assert.deepEqual(mergeRanges([[1, 16], [40, 99]], 12), [[1, 16], [40, 99]], 'Buco di 24 secondi: non si uniscono');
  assert.deepEqual(mergeRanges([[1, 16], [20, 30], [200, 210]], 12), [[1, 30], [200, 210]]);
  assert.deepEqual(pickCluster([[1, 16], [17, 99], [900, 905]], 12), [1, 99]);
  assert.equal(pickCluster([]), null);
});

test('consenso della stagione sui dati veri: sigla 0:01-1:39, finale 21:51-22:50', () => {
  const sigla = consensusOf(Object.values(REAL.sigla)); assert.deepEqual([sigla.start, sigla.end], [1, 99]);
  const finale = consensusOf(Object.values(REAL.finale)); assert.deepEqual([finale.start, finale.end], [mmss('21:51'), mmss('22:50')]);
  assert.equal(consensusOf([[1, 2], [3, 4]]), null, 'Servono almeno 3 episodi per parlare di consenso');
});

test('piano: completi, parziali da estendere (solo se l’impronta conferma), fuori consenso da controllare', () => {
  const sigla = reviewPlan(REAL.sigla);
  for (const id of [64, 67, 69, 70, 71, 73]) assert.equal(sigla.status[id], 'ok', `E${id}`);
  for (const id of [60, 61, 62, 63, 65, 66, 68, 72]) assert.equal(sigla.status[id], 'estendibile', `E${id}`);
  const finale = reviewPlan(REAL.finale);
  for (const id of [62, 63, 64, 65, 66, 67, 69, 71, 72]) assert.equal(finale.status[id], 'ok', `E${id}`);
  for (const id of [60, 61, 68, 70]) assert.equal(finale.status[id], 'estendibile', `E${id}`);
  assert.equal(finale.status[73], 'assente');
  // Un tratto in tutt'altro punto non si estende: va controllato a mano.
  const odd = reviewPlan({ ...REAL.sigla, 61: [600, 640] }); assert.equal(odd.status[61], 'da_controllare');
});

test('copertura morbida: conferma l’estensione solo dove le impronte coincidono davvero', () => {
  const song = noise(Math.round(60 / STEP), 5);
  const noisy = song.map((n, i) => i % 5 ? n : (n ^ 0b1011) >>> 0); // pochi bit diversi per la codifica
  const A = { words: noisy, offset: 0 }; const B = { words: song, offset: 0 };
  const full = softCoverage(A, B, [0, 60], 0); assert.ok(full.compared > 400 && full.fraction > 0.95);
  const other = { words: noise(song.length, 77), offset: 0 };
  assert.ok(softCoverage(A, other, [0, 60], 0).fraction < 0.1, 'Altro materiale: nessuna conferma');
  assert.equal(softCoverage(A, B, [1000, 1060], 0).compared, 0, 'Fuori dalla finestra: niente da confrontare');
});

test('un buco di qualche secondo nel mezzo della sigla non la spezza più (stessa diagonale = stesso brano)', () => {
  const sigla = noise(Math.round(98 / STEP), 42); const hole = Math.round(45 / STEP);
  const broken = sigla.map((n, i) => (i >= hole && i < hole + 30) ? (n ^ 0xdeadbeef) >>> 0 : n); // 3,7 secondi diversi, più dei 5 fotogrammi tollerati
  const a = { words: [...noise(10, 3), ...sigla, ...noise(300, 4)], offset: 0 }; const b = { words: [...noise(20, 5), ...broken, ...noise(300, 6)], offset: 0 };
  const match = matchFingerprints(a, b); assert.ok(match);
  assert.ok(match.a[1] - match.a[0] > 90, `sigla intera, non un pezzo: ${match.a}`);
  assert.ok(Math.abs(match.a[0] - 10 * STEP) < 4 && Math.abs(match.b[0] - 20 * STEP) < 4);
  // Due pezzi lontani sulla stessa diagonale (più di 12 secondi) non si fondono.
  const far = sigla.map((n, i) => (i >= hole && i < hole + Math.round(30 / STEP)) ? (n ^ 0xdeadbeef) >>> 0 : n);
  const m2 = matchFingerprints({ words: sigla, offset: 0 }, { words: far, offset: 0 }); assert.ok(m2 === null || m2.a[1] - m2.a[0] < 60);
});
