import test from 'node:test';
import assert from 'node:assert/strict';
import { firmaFotogrammi, estraiFotogrammi, trovaRiassunto, trovaAnteprima } from '../lib/fotogrammi.js';
import { playbackAction } from '../public/logic.js';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';
import { SkipService } from '../lib/skip-service.js';

async function stagioneFinta(t, episodi = [1, 2, 3]) {
  const chiamate = []; let audio = 0;
  const strumenti = {
    async fingerprint() { audio++; throw new Error('La cache audio deve bastare.'); },
    async fotogrammi(file) {
      const ep = Number(/E(\d+)/.exec(file)[1]); chiamate.push(ep);
      return firmeFinte(400, ep === 1 ? [[200, 230], [367, 390]]
        : ep === 2 ? [[95.6, 110, 0, 0], [110, 140], [200, 230], [367, 390]] : [[200, 230]]);
    }
  };
  const f = await fixture({ skipTools: strumenti, skipDelayMs: 0 }); t.after(() => f.close());
  const items = [];
  for (const ep of episodi) items.push(await f.video(`Serie S01E${String(ep).padStart(2, '0')}.mp4`, 'Anime'));
  for (const item of items) await f.app.skips.save(item, {
    versione: 1, signature: `${item.size}:${item.mtime}`, duration: 400,
    windows: { head: { words: [] }, tail: { words: [] } }, gruppi: {},
    salti: { sigla: [1, 95.6], finale: [330, 366.9] }, fonti: { sigla: 'capitoli', finale: 'capitoli' }
  });
  return { f, items, chiamate, strumenti, audio: () => audio };
}

test('cache vecchia: coda automatica aggiunge i fotogrammi senza rifare audio né perdere salti pronti', async t => {
  const { f, items, chiamate, strumenti, audio } = await stagioneFinta(t);
  assert.equal(f.app.skips.overview().series['Anime/Serie'].ready, 3);
  f.app.config.autoSkips = true;
  assert.equal(f.app.skips.autoQueue(), 1); await f.app.skips.wait();
  assert.deepEqual(chiamate, [1, 2, 3]); assert.equal(audio(), 0);
  const secondo = f.app.library.get(items[1].id);
  assert.deepEqual(secondo.salti.riassunto, [95.6, 140.6]);
  assert.deepEqual(secondo.salti.anteprima, [366.9, 400]);
  assert.equal(secondo.fontiSalti.riassunto, 'fotogrammi'); assert.equal(secondo.fontiSalti.anteprima, 'fotogrammi');
  assert.equal(f.app.library.get(items[0].id).salti.riassunto, undefined);
  assert.equal(f.app.library.get(items[2].id).salti.anteprima, undefined);
  assert.equal(f.app.skips.overview().series['Anime/Serie'].ready, 3);
  const dir = path.join(f.app.config.dataDir, 'salti');
  assert.equal((await readFile(path.join(dir, `${items[0].id}.fotogrammi`))).length, 7200);
  const json = JSON.parse(await readFile(path.join(dir, `${items[0].id}.json`), 'utf8'));
  assert.equal(json.fotogrammi.signature, `${items[0].size}:${items[0].mtime}`);
  assert.ok(JSON.stringify(json).length < 1500);
  await f.app.skips.close();
  const nuovo = await new SkipService(f.app.config, f.app.library, f.app.files, f.app.store, strumenti).init();
  f.app.skips = nuovo; await nuovo.wait();
  nuovo.enqueue(items[0].id); await nuovo.wait(); assert.deepEqual(chiamate, [1, 2, 3]);
  await unlink(path.join(dir, `${items[1].id}.fotogrammi`));
  nuovo.autoQueue(); await nuovo.wait(); assert.deepEqual(chiamate, [1, 2, 3, 2]);
  await unlink(path.join(dir, `${items[1].id}.fotogrammi`));
  nuovo.autoQueue(); await nuovo.wait(); assert.deepEqual(chiamate, [1, 2, 3, 2, 2]);
});

test('correzioni manuali prevalgono, anche null; capitoli e AniSkip conservano i loro tratti', async t => {
  const { f, items } = await stagioneFinta(t);
  await f.app.skips.edit(items[1].id, { riassunto: [95.6, 150], anteprima: null });
  const primo = JSON.parse(await readFile(path.join(f.app.config.dataDir, 'salti', `${items[0].id}.json`), 'utf8'));
  primo.salti.anteprima = [370, 395]; primo.fonti.anteprima = 'capitoli';
  await f.app.skips.save(items[0], primo);
  await f.app.skips.setSettings({ aniskip: false, id: items[2].id, malId: 123 });
  const terzo = JSON.parse(await readFile(path.join(f.app.config.dataDir, 'salti', `${items[2].id}.json`), 'utf8'));
  terzo.salti.riassunto = [95.6, 160]; terzo.fonti.riassunto = 'aniskip'; terzo.aniskipDone = '123:3';
  await f.app.skips.save(items[2], terzo);
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  assert.equal(f.app.skips.status().failed, 0);
  assert.deepEqual(f.app.library.get(items[1].id).salti.riassunto, [95.6, 150]);
  assert.equal(f.app.library.get(items[1].id).salti.anteprima, null);
  assert.deepEqual(f.app.library.get(items[0].id).salti.anteprima, [370, 395]);
  assert.deepEqual(f.app.library.get(items[2].id).salti.riassunto, [95.6, 160]);
  assert.equal(f.app.library.get(items[2].id).fontiSalti.riassunto, 'aniskip');
});

test('episodio singolo già analizzato riceve la firma, senza salti senza vicini', async t => {
  const { f, items, chiamate } = await stagioneFinta(t, [1]);
  f.app.config.autoSkips = true; assert.equal(f.app.skips.autoQueue(), 1); await f.app.skips.wait();
  assert.deepEqual(chiamate, [1]); assert.equal(f.app.library.get(items[0].id).salti.anteprima, undefined);
});

test('non usa episodi lontani al posto dei vicini mancanti', async t => {
  const { f, items } = await stagioneFinta(t, [1, 4]);
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  for (const item of items) {
    assert.equal(f.app.library.get(item.id).salti.riassunto, undefined);
    assert.equal(f.app.library.get(item.id).salti.anteprima, undefined);
  }
});

test('anteprima confrontata con il corpo successivo dopo il suo riassunto', async t => {
  const { f, items } = await stagioneFinta(t, [1, 2]);
  f.app.skips.tools.fotogrammi = async file => firmeFinte(400, file.includes('E01')
    ? [[200, 230], [367, 390]] : [[110, 140], [200, 230, 0, 0]]);
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  assert.deepEqual(f.app.library.get(items[1].id).salti.riassunto, [95.6, 140.6]);
  assert.equal(f.app.library.get(items[0].id).salti.anteprima, undefined);
});

test('riassunto prima di una sigla tardiva e riscontri provenienti anche da N meno due', async t => {
  const { f, items } = await stagioneFinta(t);
  await f.app.skips.edit(items[2].id, { sigla: [40, 95.6] });
  f.app.skips.tools.fotogrammi = async file => firmeFinte(400, file.includes('E01')
    ? [[200, 230]] : file.includes('E03') ? [[0, 25]] : [[200, 230, 0, 0]]);
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  assert.deepEqual(f.app.library.get(items[2].id).salti.riassunto, [0, 25]);
});

test('correzione della sigla impedisce al riassunto di sovrapporsi', async t => {
  const { f, items } = await stagioneFinta(t);
  await f.app.skips.edit(items[1].id, { sigla: [1, 120] });
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  assert.deepEqual(f.app.library.get(items[1].id).salti.riassunto, [120, 140]);
  assert.equal(f.app.library.get(items[1].id).fontiSalti.sigla, 'a mano');
});

test('il confronto usa i confini appena aggiornati, senza scambiare lo snapshot vecchio per una correzione manuale', async t => {
  const { f, items } = await stagioneFinta(t, [1, 2]);
  const snapshot = items.map(i => f.app.library.get(i.id));
  const disponibili = [];
  for (const [indice, item] of items.entries()) {
    const data = JSON.parse(await readFile(path.join(f.app.config.dataDir, 'salti', `${item.id}.json`), 'utf8'));
    if (indice === 1) data.salti.sigla = [1, 110];
    await f.app.skips.save(item, data);
    disponibili.push({ item: snapshot[indice], data, frames: firmeFinte(400, indice ? [[110, 140]] : [[200, 230]]) });
  }
  await f.app.skips.frameSkips(disponibili);
  assert.deepEqual(f.app.library.get(items[1].id).salti.riassunto, [110, 140]);
});

test('rinomina riusa il binario e aggiorna la sua signature', async t => {
  const { f, items, chiamate } = await stagioneFinta(t, [1, 2]); await f.login();
  f.app.skips.enqueue(items[0].id); await f.app.skips.wait();
  const risposta = await f.request('/api/manage/move', { method: 'POST', data: { root: 'Anime', from: items[1].path, to: 'Serie S01E02 Nuovo.mp4' } });
  assert.equal(risposta.status, 200);
  const nuovo = f.app.library.items.find(i => i.episode === 2);
  f.app.skips.enqueue(nuovo.id); await f.app.skips.wait();
  assert.deepEqual(chiamate, [1, 2]); assert.equal(f.app.skips.hasFrames(nuovo), true);
});

test('chiusura annulla anche l’estrazione dei fotogrammi in corso', async t => {
  const { f, items } = await stagioneFinta(t, [1, 2]);
  let iniziato; const pronto = new Promise(resolve => { iniziato = resolve; }); let annullato = false;
  f.app.skips.tools.fotogrammi = async (file, signal) => {
    iniziato(); await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    annullato = true; signal.throwIfAborted();
  };
  f.app.skips.enqueue(items[0].id); await pronto; await f.app.skips.close();
  assert.equal(annullato, true); assert.equal(f.app.skips.running, false);
  assert.equal(f.app.skips.hasFrames(items[0]), false);
});

// Record indipendenti dal convertitore: validità, metà bassa e metà alta del dHash.
export function firmeFinte(durata, tratti = []) {
  const firme = Buffer.alloc(durata * 2 * 9);
  for (const [inizio, fine, basso = 0x89abcdef, alto = 0x13579bdf] of tratti) {
    for (let i = Math.ceil(inizio * 2); i < fine * 2; i++) {
      firme[i * 9] = 1; firme.writeUInt32LE(basso >>> 0, i * 9 + 1); firme.writeUInt32LE(alto >>> 0, i * 9 + 5);
    }
  }
  return firme;
}
const corpo = firmeFinte(100, [[0, 100]]);

test('riassunto parte dalla fine sigla anche con i primi quindici secondi diversi', () => {
  const firme = firmeFinte(900, [[95.6, 110, 0, 0], [110, 140]]);
  assert.deepEqual(trovaRiassunto(firme, [95.6, 335.6], [corpo]), [95.6, 140.6]);
});

test('buchi fino a dieci secondi uniti; nero escluso dal denominatore', () => {
  const firme = firmeFinte(400, [[100, 105], [115, 120], [130, 135]]);
  assert.deepEqual(trovaRiassunto(firme, [100, 340], [corpo]), [100, 135]);
  assert.equal(trovaRiassunto(firmeFinte(400), [100, 340], [corpo]), null);
});

test('nessun riassunto per scene riprese solo a metà episodio o oltre i primi trenta secondi', () => {
  assert.equal(trovaRiassunto(firmeFinte(900, [[450, 480]]), [100, 340], [corpo]), null);
  assert.equal(trovaRiassunto(firmeFinte(900, [[135, 160]]), [100, 340], [corpo]), null);
  assert.equal(trovaRiassunto(firmeFinte(900, [[100, 110]]), [100, 340], [corpo]), null);
});

test('anteprima include cartello finale entro venti secondi, altrimenti ultimo riscontro più due', () => {
  assert.deepEqual(trovaAnteprima(firmeFinte(405, [[367, 390]]), [366.9, 405], [corpo]), [366.9, 405]);
  assert.deepEqual(trovaAnteprima(firmeFinte(440, [[367, 390]]), [366.9, 440], [corpo]), [366.9, 391.5]);
  assert.equal(trovaAnteprima(firmeFinte(405, [[367, 372], [372, 405, 0, 0]]), [366.9, 405], [corpo]), null);
});

test('confronto a 64 bit tollera sei bit, ma non sette; vicini assenti non producono salti', () => {
  assert.deepEqual(trovaRiassunto(firmeFinte(400, [[100, 120, 0x89abcdef ^ 63]]), [100, 340], [corpo]), [100, 120]);
  assert.equal(trovaRiassunto(firmeFinte(400, [[100, 120, 0x89abcdef ^ 127]]), [100, 340], [corpo]), null);
  assert.equal(trovaRiassunto(corpo, [0, 100], []), null);
  assert.equal(trovaAnteprima(corpo, [0, 100], []), null);
});

test('dHash conserva il tempo dei neri e usa tutti i sessantaquattro confronti', () => {
  const pixel = Buffer.alloc(72 * 3);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 9; c++) {
    pixel[72 + r * 9 + c] = 200 - c;
    pixel[144 + r * 9 + c] = 100 + c;
  }
  const firme = firmaFotogrammi(pixel);
  assert.equal(firme.length, 27); assert.equal(firme[0], 0); assert.equal(firme[9], 1);
  assert.equal(firme.readBigUInt64LE(10), 0xffffffffffffffffn);
  assert.equal(firme[18], 1); assert.equal(firme.readBigUInt64LE(19), 0n);
});

test('estrazione usa noref, crop, due fotogrammi al secondo e thread configurati', async () => {
  let chiamata;
  await estraiFotogrammi('finto.mp4', undefined, { ffmpegThreads: 2, exec: async (...args) => { chiamata = args; return Buffer.alloc(72); } });
  const args = chiamata[1];
  assert.equal(args[args.indexOf('-skip_frame') + 1], 'noref');
  assert.equal(args[args.indexOf('-threads') + 1], '2');
  assert.equal(args[args.indexOf('-vf') + 1], 'fps=2,crop=iw*0.8:ih*0.65:iw*0.1:ih*0.12,scale=9:8:flags=area,format=gray');
  assert.equal(chiamata[4], 'binary');
});

test('lettore offre entrambi i pulsanti; il salto automatico vale solo per i tratti sicuri', () => {
  for (const [tipo, label] of [['riassunto', 'Salta riassunto'], ['anteprima', 'Salta anteprima']]) {
    const action = playbackAction({ salti: { [tipo]: [10, 30] }, saltiSicuri: [tipo] }, 15, 40, true, { autoSkip: true, autoNext: false });
    assert.equal(action.label, label); assert.equal(action.automatic, true); assert.equal(action.target, 30);
    assert.equal(action.next, false);
    // 12/11: senza la certezza del server resta il pulsante, mai il salto da solo.
    const dubbio = playbackAction({ salti: { [tipo]: [10, 30] } }, 15, 40, true, { autoSkip: true, autoNext: false });
    assert.equal(dubbio.label, label); assert.equal(dubbio.automatic, false); assert.equal(dubbio.certain, false);
  }
});
