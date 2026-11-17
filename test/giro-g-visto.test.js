// Giro G, punto 0 e 4: «Segna visto» con la struttura vera di un anime (una sola stagione, episodi da 60) e punto di ripresa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';
import { buildTitles, resumePoint, continueEntries } from '../public/video-logic.js';

async function anime(f, from = 60, count = 14) {
  await mkdir(path.join(f.roots.Anime, 'Mia Serie'), { recursive: true });
  for (let e = from; e < from + count; e++) await writeFile(path.join(f.roots.Anime, 'Mia Serie', `Mia Serie - ${String(e).padStart(3, '0')}.mp4`), 'x');
  await f.app.library.scan();
  return (await (await f.request('/api/library')).json()).items;
}
const put = (f, data, route = '/api/progress') => f.request(route, { method: 'PUT', data: { profile: 'bruno', ...data } });

test('segna visto: una richiesta sola per tutta la serie, resta dopo il ricaricamento', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login(); const items = await anime(f);
  assert.equal(items.length, 14); assert.equal(items[0].season, 1); assert.equal(items[0].episode, 60);
  const r = await put(f, { ids: items.map(i => i.id), watched: true }, '/api/progress/batch'); assert.equal(r.status, 200);
  const saved = await (await f.request('/api/progress?profile=bruno')).json();
  assert.equal(Object.keys(saved).length, 14); assert.ok(items.every(i => saved[i.id].watched === true));
  assert.equal(buildTitles(items, saved)[0].watched, true);
  // «Tolgo dai visti»: tutto torna da vedere e ricomincia dalla prima puntata.
  await put(f, { ids: items.map(i => i.id), watched: false, position: 0 }, '/api/progress/batch');
  const again = await (await f.request('/api/progress?profile=bruno')).json();
  assert.ok(items.every(i => again[i.id].watched === false));
  assert.equal(resumePoint(buildTitles(items, again)[0], items, again).item.episode, 60);
  assert.equal((await put(f, { ids: ['ffffffffffffffffffffffff'], watched: true }, '/api/progress/batch')).status, 404);
  assert.equal((await put(f, { ids: [], watched: true }, '/api/progress/batch')).status, 400);
});

test('il salvataggio automatico del lettore non cancella un «visto» messo a mano (causa del tasto «che non funziona»)', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login(); const items = await anime(f);
  const id = items[2].id;
  await put(f, { id, position: 100, duration: 1400 });
  await put(f, { id, watched: true });
  // Basta aprire l'episodio e lasciarlo andare qualche secondo: arriva position+duration senza «watched».
  const r = await (await put(f, { id, position: 12, duration: 1400 })).json();
  assert.equal(r.watched, true);
  // Solo un comando esplicito toglie il visto.
  assert.equal((await (await put(f, { id, watched: false, position: 0 })).json()).watched, false);
  // E oltre il 95% il visto arriva da solo.
  assert.equal((await (await put(f, { id, position: 1390, duration: 1400 })).json()).watched, true);
});

test('punto di ripresa: dopo gli episodi già visti si va al primo non visto, anche segnando in disordine', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login(); const items = await anime(f);
  // Bruno segna 60, 62, 61 (in quest'ordine): il prossimo da guardare è 63, non 62.
  for (const i of [0, 2, 1]) await put(f, { id: items[i].id, watched: true });
  const progress = await (await f.request('/api/progress?profile=bruno')).json();
  const title = buildTitles(items, progress)[0];
  const point = resumePoint(title, items, progress);
  assert.equal(point.item.episode, 63); assert.equal(point.position, 0);
  // Un episodio a metà ha la precedenza.
  progress[items[5].id] = { position: 300, duration: 1400, updated: Date.now() + 10 };
  assert.deepEqual([resumePoint(title, items, progress).item.episode, resumePoint(title, items, progress).position], [65, 300]);
  assert.equal(continueEntries(buildTitles(items, progress), items, progress).length, 1);
});

test('ripresa: la posizione si salva ogni pochi secondi e resta per profilo', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login(); const items = await anime(f);
  await put(f, { id: items[0].id, position: 77, duration: 1400 });
  await f.request('/api/progress', { method: 'PUT', data: { profile: 'marta', id: items[0].id, position: 5, duration: 1400 } });
  assert.equal((await (await f.request('/api/progress?profile=bruno')).json())[items[0].id].position, 77);
  assert.equal((await (await f.request('/api/progress?profile=marta')).json())[items[0].id].position, 5);
});
