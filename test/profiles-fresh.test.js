import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { Store } from '../lib/store.js';
import { APP_DIR } from '../server.js';
import { fixture } from './helpers.js';

async function scratch() { await mkdir(path.join(APP_DIR, 'output', 'tests'), { recursive: true }); return mkdtemp(path.join(APP_DIR, 'output', 'tests', 'profili-')); }
const quiet = { log() {} };

test('prima apertura: nessun profilo predefinito, il primo si crea da «Chi guarda?»', async t => {
  const dir = await scratch(); t.after(() => rm(dir, { recursive: true, force: true }));
  const store = await new Store(dir, { log: quiet }).init();
  assert.deepEqual(store.data.profiles, []);
  const p = await store.addProfile('Bruno'); assert.equal(p.name, 'Bruno');
  assert.equal((await new Store(dir, { log: quiet }).init()).data.profiles.length, 1);
  // Il server risponde lo stesso con la lista vuota: niente «Marta» e «Piero» inventati.
  const f = await fixture({ seedProfiles: [] }); t.after(() => f.close());
  assert.deepEqual((await (await f.request('/api/bootstrap')).json()).profiles, []);
  assert.equal((await f.request('/api/progress?profile=marta')).status, 404);
});

test('installazioni esistenti: Marta e Piero predefiniti spariscono solo se mai usati, altrimenti restano', async t => {
  const dir = await scratch(); t.after(() => rm(dir, { recursive: true, force: true }));
  const old = { profiles: [{ id: 'bruno', name: 'Bruno' }, { id: 'marta', name: 'Marta' }, { id: 'piero', name: 'Piero' }, { id: 'abc', name: 'Ospite' }],
    progress: { bruno: { x: { position: 3 } }, piero: { y: { position: 10, duration: 100 } } }, edits: {}, trash: [] };
  await writeFile(path.join(dir, 'stato.json'), JSON.stringify(old));
  const lines = []; const log = { log: m => lines.push(m) };
  const store = await new Store(dir, { log }).init();
  assert.deepEqual(store.data.profiles.map(p => p.id), ['bruno', 'piero', 'abc']);
  assert.ok(lines.some(l => l.includes('Marta')) && lines.some(l => l.includes('Piero') && l.includes('conservato')));
  // Salvato su disco e controllato una volta sola: riaprendo non si ripete e non si tocca più niente.
  const saved = JSON.parse(await readFile(path.join(dir, 'stato.json'), 'utf8'));
  assert.equal(saved.migrations.premade, 1); assert.equal(saved.profiles.length, 3);
  const again = await new Store(dir, { log }).init(); assert.equal(again.data.profiles.length, 3);
  // Una lista o degli ascolti bastano a tenere il profilo.
  const dir2 = await scratch(); t.after(() => rm(dir2, { recursive: true, force: true }));
  await writeFile(path.join(dir2, 'stato.json'), JSON.stringify({ profiles: old.profiles, progress: {}, edits: {}, trash: [], lists: { marta: [{ key: 'f:1', added: 1 }] }, musicActivity: { 'u/piero': [{ id: 's1' }] } }));
  assert.deepEqual((await new Store(dir2, { log: quiet }).init()).data.profiles.map(p => p.id), ['bruno', 'marta', 'piero', 'abc']);
});
