import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './helpers.js';

test('gestione serie/stagione e immagine locale, senza cambiare il video o la ripresa', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login();
  const a = await f.video('Serie S01E01 Primo.mp4', 'Anime');
  const b = await f.video('Serie S01E02 Secondo.mp4', 'Anime');
  const c = await f.video('Serie S02E01 Terzo.mp4', 'Anime');
  await writeFile(path.join(f.roots.Anime, 'locandina.png'), 'immagine sintetica');
  await f.app.store.progress('bruno', a.id, { position: 4, duration: 100 });
  const save = data => f.request('/api/manage/edit', { method: 'POST', data: { id: a.id, ...data } });
  let r = await save({ title: 'Nuovo episodio', series: 'Nuova serie', season: 3, episode: 7, genres: ['Avventura'], imagePath: 'locandina.png', scope: 'season' });
  assert.equal(r.status, 200);
  const first = f.app.library.get(a.id); const second = f.app.library.get(b.id);
  assert.equal(first.series, 'Nuova serie'); assert.equal(first.season, 3); assert.equal(first.episode, 7);
  assert.equal(second.series, 'Nuova serie'); assert.equal(second.season, 3); assert.equal(second.episode, 2);
  assert.equal(f.app.library.get(c.id).series, 'Serie');
  assert.equal(first.path, a.path); assert.equal(f.app.store.profile('bruno')[a.id].position, 4);
  r = await f.request(`/media/${a.id}/image`); assert.equal(await r.text(), 'immagine sintetica');
  await f.app.library.scan(); assert.equal(f.app.library.get(a.id).series, 'Nuova serie');
  for (const invalid of [{ imagePath: '../fuori.png' }, { imagePath: 123 }, { imagePath: 'Serie S01E01 Primo.mp4' }, { season: -1 }, { episode: 1.5 }, { scope: 'tutto' }]) {
    assert.equal((await save(invalid)).status, 400);
    assert.equal(f.app.library.get(a.id).series, 'Nuova serie');
  }
  await save({ series: '', imagePath: '' });
  assert.equal(f.app.library.get(a.id).series, null); assert.equal(f.app.library.get(a.id).episode, null);
});

test('applicazione a tutta la serie atomica: errore sigla non salva parte delle modifiche', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login();
  const first = await f.video('Serie S01E01 Primo.mp4', 'Anime');
  const second = await f.video('Serie S02E01 Secondo.mp4', 'Anime');
  const edit = data => f.request('/api/manage/edit', { method: 'POST', data: { id: second.id, scope: 'series', ...data } });
  assert.equal((await edit({ series: 'Sbagliato', genres: ['Altro'], introStart: 10, introEnd: 2 })).status, 400);
  assert.equal(f.app.library.get(first.id).series, 'Serie'); assert.deepEqual(f.app.library.get(first.id).genres, []);
  assert.equal((await edit({ series: 'Nuovo nome', genres: ['Famiglia'] })).status, 200);
  for (const item of [first, second]) {
    assert.equal(f.app.library.get(item.id).series, 'Nuovo nome'); assert.deepEqual(f.app.library.get(item.id).genres, ['Famiglia']);
  }
  assert.equal(f.app.library.get(first.id).season, 1); assert.equal(f.app.library.get(second.id).season, 2);
});
