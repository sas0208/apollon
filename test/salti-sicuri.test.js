// 12/11: i salti non devono mai «tagliare» la storia.
// - un salto parte da solo soltanto se è SICURO (audio + immagini uguali, capitoli del file, correzione a mano);
// - il conto alla rovescia per il prossimo episodio parte solo da dove la storia è finita con certezza;
// - nel dubbio resta il pulsante e decide chi guarda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { firmaFotogrammi, confermaVideo, analizzaCoda } from '../lib/fotogrammi.js';
import { certezza, fineStoria, ANALISI } from '../lib/skip-service.js';
import { chapterSkips, aniSkipIntervals } from '../lib/skips.js';
import { Store } from '../lib/store.js';
import { fixture } from './helpers.js';
import { APP_DIR } from '../server.js';

// Firme finte: ogni «scena» è un numero; scene diverse hanno firme lontane (molti bit diversi), il nero è 0.
function firme(scene) {
  const out = Buffer.alloc(scene.length * 9);
  scene.forEach((s, i) => {
    if (!s) return;
    out[i * 9] = 1; out.writeUInt32LE(Math.imul(s, 2654435761) >>> 0, i * 9 + 1); out.writeUInt32LE(Math.imul(s + 7, 40503 * 65537) >>> 0, i * 9 + 5);
  });
  return out;
}
const fila = (da, quanti) => Array.from({ length: quanti }, (_, i) => da + i);

test('prova video: la stessa sigla si vede uguale, la canzone sopra una scena no', () => {
  const sigla = fila(1000, 120); // 60 secondi a 2 fotogrammi al secondo
  const a = firme([...fila(1, 200), ...sigla, ...fila(5000, 40)]);
  const b = firme([...fila(300, 220), ...sigla, ...fila(6000, 40)]); // stessa sigla, 10 secondi più tardi
  const uguale = confermaVideo(a, b, [100, 160], -10);
  assert.equal(uguale.quota, 1); assert.equal(uguale.validi, 120);
  const scena = firme([...fila(300, 220), ...fila(9000, 120), ...fila(6000, 40)]); // stessa canzone, immagini della storia
  assert.equal(confermaVideo(a, scena, [100, 160], -10).quota, 0);
  // Titoli di coda su fondo nero: il nero coincide col nero.
  const neroA = firme([...fila(1, 200), ...Array(120).fill(0)]); const neroB = firme([...fila(300, 200), ...Array(120).fill(0)]);
  assert.equal(confermaVideo(neroA, neroB, [100, 160], 0).quota, 1);
  assert.equal(confermaVideo(neroA, a, [100, 160], 0).quota, 0);
});

test('dopo la sigla finale: anteprima, cartello che torna uguale, scena dopo i titoli, scena ripetuta', () => {
  const corpoProssimo = fila(20000, 2400); // 20 minuti
  const prossimo = firme(corpoProssimo);
  // Anteprima: pezzi brevi presi qua e là dal prossimo episodio, poi un cartello di 5 secondi.
  const pezzi = [...corpoProssimo.slice(900, 908), ...corpoProssimo.slice(1500, 1508), ...corpoProssimo.slice(400, 408), ...corpoProssimo.slice(2000, 2008), ...corpoProssimo.slice(1200, 1208)];
  const cartello = Array(10).fill(777);
  const conAnteprima = firme([...fila(1, 200), ...pezzi, ...cartello]);
  const esito = analizzaCoda(conAnteprima, [100, 125], { prossimo, inizioProssimo: 120, limiteProssimo: 1100, code: [firme(cartello)] });
  assert.deepEqual(esito.anteprima, [100, 125]); assert.equal(esito.storia, 0); assert.equal(esito.ripetuta, false);
  // Scena dopo i titoli (30 secondi mai visti altrove) e poi l'anteprima: la storia NON è finita alla sigla.
  const conScena = firme([...fila(1, 200), ...fila(70000, 60), ...pezzi]);
  const scena = analizzaCoda(conScena, [100, 150], { prossimo, inizioProssimo: 120, limiteProssimo: 1100 });
  assert.equal(scena.storia, 30); assert.deepEqual(scena.anteprima, [130, 150]);
  // Solo scena, nessuna anteprima.
  const soloScena = analizzaCoda(firme([...fila(1, 200), ...fila(70000, 60)]), [100, 130], { prossimo, inizioProssimo: 120, limiteProssimo: 1100 });
  assert.equal(soloScena.anteprima, null); assert.equal(soloScena.storia, 30);
  // Scena finale che il prossimo episodio ripete pari pari subito dopo la sigla: è storia, non anteprima.
  const ripetuta = analizzaCoda(firme([...fila(1, 200), ...corpoProssimo.slice(260, 320)]), [100, 130], { prossimo, inizioProssimo: 120, limiteProssimo: 1100 });
  assert.equal(ripetuta.ripetuta, true); assert.equal(ripetuta.anteprima, null); assert.equal(ripetuta.storia, 30);
  // Senza prossimo episodio non si indovina: tutto quello che non è un cartello noto resta storia.
  assert.equal(analizzaCoda(conAnteprima, [100, 125], { code: [firme(cartello)] }).storia, 20);
});

test('certezza: mano e capitoli sì; audio solo con le immagini; AniSkip mai', () => {
  assert.equal(certezza('sigla', 'a mano'), true); assert.equal(certezza('finale', 'capitoli'), true);
  assert.equal(certezza('sigla', 'aniskip', { sigla: { video: 1 } }), false);
  assert.equal(certezza('sigla', 'impronta', {}), false);
  assert.equal(certezza('sigla', 'impronta', { sigla: { video: 0.59 } }), false);
  assert.equal(certezza('sigla', 'impronta', { sigla: { video: 0.9 } }), true);
  assert.equal(certezza('sigla', 'impronta', { sigla: { video: 0.9 } }, { sigla: 'fuori dal consenso' }), false);
  assert.equal(certezza('riassunto', 'fotogrammi', { riassunto: { quota: 0.3 } }), false);
  assert.equal(certezza('riassunto', 'fotogrammi', { riassunto: { quota: 0.7 } }), true);
});

test('fine della storia: solo con sigla finale sicura e niente altra storia dopo', () => {
  const salti = { finale: [1300, 1360] };
  assert.equal(fineStoria(salti, ['finale'], {}, 1362), 1300); // la sigla arriva alla fine del file
  assert.equal(fineStoria(salti, [], {}, 1362), null); // sigla non sicura
  assert.equal(fineStoria(salti, ['finale'], {}, 1400), null); // 40 secondi dopo la sigla mai controllati
  assert.equal(fineStoria(salti, ['finale'], { coda: { da: 1360, storia: 0 } }, 1400), 1300); // solo anteprima
  assert.equal(fineStoria(salti, ['finale'], { coda: { da: 1360, storia: 30 } }, 1400), null); // scena dopo i titoli
  assert.equal(fineStoria(salti, ['finale'], { coda: { da: 1300, storia: 0 } }, 1400), null); // prova fatta su altri confini
  assert.equal(fineStoria({ finale: [200, 260] }, ['finale'], {}, 1400), null); // «finale» a inizio episodio: assurdo
  assert.equal(fineStoria({}, ['finale'], {}, 1400), null);
});

test('capitoli del file: Opening/Ending valgono come sigle, «Intro» e durate strane no', () => {
  const salti = chapterSkips([{ title: 'Intro', start: 0, end: 80 }, { title: 'Opening', start: 80, end: 170 }, { title: 'Episode', start: 170, end: 1300 },
    { title: 'ED', start: 1300, end: 1390 }, { title: 'Preview', start: 1390, end: 1420 }]);
  assert.deepEqual(salti, { sigla: [80, 170], finale: [1300, 1390], anteprima: [1390, 1420] });
  assert.deepEqual(chapterSkips([{ title: 'Opening', start: 0, end: 600 }, { title: 'Ending credits roll', start: 700, end: 760 }]), {});
});

test('AniSkip: tempi presi su una copia di durata diversa si scartano', () => {
  const data = { found: true, results: [{ skipType: 'op', interval: { startTime: 7.5, endTime: 97.5 }, episodeLength: 1387 },
    { skipType: 'recap', interval: { startTime: 107, endTime: 148.7 }, episodeLength: 1406.2 }] };
  assert.deepEqual(aniSkipIntervals(data, 1405), { riassunto: [107, 148.7] });
});

test('salto automatico: spento per tutti una volta sola, poi la scelta resta', async t => {
  const f = await fixture(); t.after(() => f.close());
  const put = data => f.request('/api/profiles/preferences', { method: 'PUT', data });
  await put({ profile: 'bruno', autoSkip: true, autoNext: false });
  // Simula un'installazione di prima del 12/11: la scelta era accesa di base e la migrazione non c'è ancora.
  await f.app.store.change(d => { delete d.migrations.autoSkipOff; });
  const prima = await new Store(f.app.config.dataDir).init();
  assert.equal(prima.data.profiles.find(p => p.id === 'bruno').autoSkip, undefined);
  assert.equal(prima.data.profiles.find(p => p.id === 'bruno').autoNext, false);
  await prima.change(d => { d.profiles.find(p => p.id === 'bruno').autoSkip = true; });
  const dopo = await new Store(f.app.config.dataDir).init();
  assert.equal(dopo.data.profiles.find(p => p.id === 'bruno').autoSkip, true);
});

test('stagione vera (finta): sigle confermate dalle immagini danno salti sicuri e fine storia; la canzone sopra la storia no', async t => {
  // Impronte audio finte: la sigla iniziale e quella finale sono gli stessi «suoni» in tutti gli episodi.
  const parole = (seme, n) => Array.from({ length: n }, (_, i) => (Math.imul(seme + i, 2246822519) ^ Math.imul(i + 3, 3266489917)) >>> 0);
  const passo = 1365 / 11025; const quanti = s => Math.round(s / passo);
  const op = parole(11, quanti(60)); const ed = parole(22, quanti(60));
  const strumenti = {
    async probe() { return { duration: 600, chapters: [] }; },
    async fingerprint(file, offset) {
      const ep = Number(/E(\d+)/.exec(file)[1]);
      return offset === 0 ? { offset: 0, words: [...parole(1000 * ep, quanti(20)), ...op, ...parole(2000 * ep, quanti(220))] }
        : { offset, words: [...parole(3000 * ep, quanti(140)), ...ed, ...parole(4000 * ep, quanti(40))] }; // finestra 360-600: sigla finale 500-560
    },
    async black() { return []; },
    async fotogrammi(file) {
      const ep = Number(/E(\d+)/.exec(file)[1]);
      const scene = fila(ep * 100000, 1200); // 600 secondi tutti diversi fra gli episodi
      for (let i = 0; i < 120; i++) scene[40 + i] = 500 + i; // sigla iniziale 20-80 s: stesse immagini
      // Sigla finale 500-560 s: stesse immagini, tranne l'episodio 3 dove la canzone suona sopra la storia.
      if (ep !== 3) for (let i = 0; i < 120; i++) scene[1000 + i] = 900 + i;
      // Dopo la sigla (560-600): episodi 1 e 4 hanno un cartello uguale; il 2 ha una scena dopo i titoli.
      if (ep !== 2) for (let i = 0; i < 80; i++) scene[1120 + i] = 4242;
      return firme(scene);
    }
  };
  const f = await fixture({ skipTools: strumenti, skipDelayMs: 0 }); t.after(() => f.close());
  const items = []; for (const ep of [1, 2, 3, 4]) items.push(await f.video(`Serie S01E0${ep}.mp4`, 'Anime'));
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  const [uno, due, tre, quattro] = items.map(i => f.app.library.get(i.id));
  for (const e of [uno, due, tre, quattro]) { assert.ok(e.salti.sigla, 'sigla trovata'); assert.ok(e.salti.finale, 'finale trovato'); assert.ok(e.saltiSicuri.includes('sigla')); }
  // Episodio 1 e 4: sigla finale vista uguale, dopo solo il cartello che torna -> storia finita all'inizio della sigla finale.
  assert.ok(uno.saltiSicuri.includes('finale')); assert.ok(Math.abs(uno.fineStoria - uno.salti.finale[0]) < 0.01); assert.ok(Math.abs(uno.fineStoria - 500) < 4);
  assert.ok(quattro.saltiSicuri.includes('finale')); assert.ok(quattro.fineStoria > 490);
  // Episodio 2: sigla sicura ma dopo c'è una scena -> nessun conto alla rovescia.
  assert.ok(due.saltiSicuri.includes('finale')); assert.equal(due.fineStoria, null);
  // Episodio 3: stessa canzone ma immagini della storia -> non sicuro: resta solo il pulsante.
  assert.ok(!tre.saltiSicuri.includes('finale')); assert.equal(tre.fineStoria, null);
  const cache = JSON.parse(await readFile(path.join(f.app.config.dataDir, 'salti', `${items[1].id}.json`), 'utf8'));
  assert.equal(cache.analisi, ANALISI); assert.ok(cache.prove.coda.storia >= 30);
});

test('stagioni analizzate con le regole vecchie si ripassano da sole senza rileggere i video', async t => {
  let letture = 0;
  const strumenti = { async probe() { return { duration: 400, chapters: [] }; }, async fingerprint(file, offset) { letture++; return { offset, words: [] }; }, async black() { return []; },
    async fotogrammi() { letture++; return firme(fila(1, 800)); } };
  const f = await fixture({ skipTools: strumenti, skipDelayMs: 0 }); t.after(() => f.close());
  const items = []; for (const ep of [1, 2]) items.push(await f.video(`Serie S01E0${ep}.mp4`, 'Anime'));
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  const dopoPrima = letture; assert.ok(dopoPrima > 0);
  f.app.config.autoSkips = true;
  assert.equal(f.app.skips.autoQueue(), 0, 'già con le regole nuove: niente da rifare');
  // Torna indietro alle regole vecchie (come le cache di prima del 12/11).
  for (const item of items) { const file = path.join(f.app.config.dataDir, 'salti', `${item.id}.json`); const data = JSON.parse(await readFile(file, 'utf8')); delete data.analisi; delete data.prove; await f.app.skips.save(item, data); }
  assert.equal(f.app.skips.autoQueue(), 1); await f.app.skips.wait();
  assert.equal(letture, dopoPrima, 'nessuna nuova lettura dei video');
  assert.equal(f.app.skips.autoQueue(), 0);
});

test('lettori: il fuoco dopo «pausa» torna su Riproduci/Pausa (TV e telefono/browser)', async () => {
  const tv = await readFile(path.join(APP_DIR, 'public', 'tv', 'player.js'), 'utf8');
  // Telecomando: tasto pausa/riproduci e OK a comandi nascosti scelgono sempre «toggle» prima di agire.
  assert.match(tv, /\['toggle','play','pause'\]\.includes\(key\)\)\{if\(e\.repeat\)return;focus\.select\('controls','toggle'\);/);
  assert.match(tv, /if\(!overlay\)\{focus\.select\('controls','toggle'\);toggle\(\);return;\}/);
  const mobile = await readFile(path.join(APP_DIR, 'public', 'video-player.js'), 'utf8');
  assert.match(mobile, /video\.addEventListener\('pause', \(\) => focusToggle\(\)\)/);
  assert.match(mobile, /function sleep\(\) \{[^\n]*focusToggle\(true\); \}/);
  // Clic col mouse/dito su ±10: il fuoco torna su Riproduci/Pausa (da tastiera resta, per premere più volte).
  assert.ok(mobile.includes("$('#vp-forward').addEventListener('click', event => { jump(10); afterJump(event); });"));
  assert.ok(mobile.includes("const afterJump = event => { if (event.detail > 0) $('#vp-toggle').focus({ preventScroll: true }); };"));
});
