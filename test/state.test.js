import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import { Store } from '../lib/store.js';

test('aggiornamenti simultanei non perdono profili o avanzamenti', async t => {
  const f = await fixture(); t.after(() => f.close()); const item = await f.video();
  await Promise.all(Array.from({ length: 8 }, (_, n) => f.app.store.addProfile(`Ospite ${n + 1}`)));
  assert.equal(f.app.store.data.profiles.length, 11);
  await Promise.all(f.app.store.data.profiles.map((p, n) => f.app.store.progress(p.id, item.id, { position: n, duration: 100 })));
  const reloaded = await new Store(f.app.config.dataDir).init();
  for (const [n, p] of reloaded.data.profiles.entries()) assert.equal(reloaded.profile(p.id)[item.id].position, n);
});
test('visto automatico, annullamento, titolo e salto sigla con vincoli', async t => {
  const f = await fixture(); t.after(() => f.close()); const item = await f.video();
  await f.app.store.progress('bruno', item.id, { position: 96, duration: 100 }); assert.equal(f.app.store.profile('bruno')[item.id].watched, true);
  await f.app.store.progress('bruno', item.id, { watched: false, position: 0 }); assert.equal(f.app.store.profile('bruno')[item.id].watched, false);
  await f.app.store.edit(item.id, { title: 'Titolo di casa', genres: ['Avventura'], introStart: 3, introEnd: 9 });
  await f.app.library.scan(); assert.equal(f.app.library.get(item.id).title, 'Titolo di casa'); assert.equal(f.app.library.get(item.id).introEnd, 9);
  await assert.rejects(f.app.store.edit(item.id, { introEnd: 1 }), { status: 400 });
  assert.equal(f.app.library.get(item.id).introEnd, 9);
  assert.throws(() => f.app.store.edit(item.id, { title: ' ' }), { status: 400 });
});
test('sposta fra raccolte e ripristino rifiutato se occuperebbe un altro file', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.video('Prova.mp4'); await f.login();
  const data = { root: 'Film', toRoot: 'Anime', from: 'Prova.mp4', to: 'Prova.mp4' };
  assert.equal((await f.request('/api/manage/move', { method: 'POST', data })).status, 200);
  assert.equal(f.app.library.items[0].root, 'Anime');
  const record = await (await f.request('/api/manage/trash', { method: 'POST', data: { root: 'Anime', path: 'Prova.mp4' } })).json();
  await f.video('Prova.mp4', 'Anime', 'un altro file');
  assert.equal((await f.request('/api/manage/restore', { method: 'POST', data: { id: record.id } })).status, 409);
  assert.equal(f.app.store.data.trash.length, 1);
});
