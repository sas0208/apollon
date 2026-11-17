import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fixture } from './helpers.js';
import { Store } from '../lib/store.js';

test('avatar dei profili: retrocompatibilità, persistenza, rimozione e validazione', async t => {
  const f = await fixture(); t.after(() => f.close());
  assert.equal(f.app.store.data.profiles[0].avatar, undefined);
  const url = '/media/avatar/0123456789abcdef01234567.jpg';
  const result = await f.app.store.setAvatar('bruno', url);
  assert.equal(result.avatar, url);
  const reopened = await new Store(f.app.config.dataDir).init();
  assert.equal(reopened.data.profiles.find(p => p.id === 'bruno').avatar, url);
  for (const bad of ['https://example.com/a.jpg', '/media/avatar/../stato.json', {}, undefined]) {
    assert.throws(() => f.app.store.setAvatar('bruno', bad), { status: 400 });
  }
  assert.throws(() => f.app.store.setAvatar('assente', null), { status: 404 });
  await f.app.store.setAvatar('bruno', null);
  assert.equal((await new Store(f.app.config.dataDir).init()).data.profiles.find(p => p.id === 'bruno').avatar, null);
});

test('endpoint avatar: personaggi solo da anime noti, JPEG locali, limite 40 e cache persistente', async t => {
  const calls = []; const conversions = [];
  const f = await fixture({ metadataDelayMs: 1, fetchImpl: async (url, init) => {
    calls.push(String(url));
    if (String(url) === 'https://graphql.anilist.co') {
      const b = JSON.parse(init.body);
      assert.match(b.query, /characters\(sort:FAVOURITES_DESC,perPage:6\)/);
      assert.ok(b.variables.id >= 1 && b.variables.id <= 8);
      return Response.json({ data: { Media: { characters: { nodes: Array.from({ length: 6 }, (_, n) => ({
        name: { full: `Volto ${b.variables.id}-${n}` }, image: { large: `https://s4.anilist.co/volto-${b.variables.id}-${n}.png` }
      })) } } } });
    }
    return new Response('immagine finta', { headers: { 'Content-Type': 'image/png' } });
  }, mediaTools: { async run(command, args) {
    conversions.push(args);
    await writeFile(args.at(-1), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  } } }); t.after(() => f.close());
  for (let id = 1; id <= 8; id++) {
    const item = await f.video(`Anime ${id}.mp4`, 'Anime');
    const { kind, query } = f.app.library.onlineQuery(item);
    f.app.onlineArt.index[f.app.onlineArt.keyFor(kind, query)] = { anilistId: id };
  }
  await f.video('Anime senza id.mp4', 'Anime');
  await f.video('Film.mp4');
  await f.app.store.change(d => { d.onlineArt = true; });
  const [a, b] = await Promise.all([f.request('/api/avatar-choices'), f.request('/api/avatar-choices')]);
  assert.equal(a.status, 200); const choices = await a.json();
  assert.deepEqual(await b.json(), choices); assert.equal(choices.length, 40);
  assert.equal(conversions.length, 40);
  assert.ok(conversions.every(args => args.at(-1).endsWith('.jpg') && args[args.indexOf('-vf') + 1].includes('400')));
  assert.equal(calls.filter(u => u === 'https://graphql.anilist.co').length, 7);
  const image = await f.request(choices[0].url); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/jpeg');
  assert.equal((await f.request(choices[0].url, { method: 'HEAD' })).status, 200);
  assert.equal((await f.request('/media/avatar/indice.json')).status, 404);
  let r = await f.request('/api/profiles/avatar', { method: 'PUT', data: { id: 'bruno', avatar: choices[0].url } });
  assert.equal(r.status, 200); assert.equal((await r.json()).avatar, choices[0].url);
  assert.equal((await f.request('/api/profiles/avatar', { method: 'PUT', data: { id: 'bruno', avatar: '/media/avatar/ffffffffffffffffffffffff.jpg' } })).status, 400);
  assert.equal((await f.request('/api/profiles/avatar', { method: 'PUT', data: { id: 'bruno', avatar: null } })).status, 200);
  const before = calls.length;
  await f.app.avatars.init(); // rilegge l'indice come dopo un riavvio
  assert.deepEqual(await (await f.request('/api/avatar-choices')).json(), choices);
  assert.equal(calls.length, before);
});

test('avatar: nessuna rete senza consenso o id, errori ed esiti vuoti non si richiedono di nuovo', async t => {
  let calls = 0;
  const f = await fixture({ metadataDelayMs: 1, fetchImpl: async () => { calls++; throw new Error('offline'); } }); t.after(() => f.close());
  const item = await f.video('Anime.mp4', 'Anime');
  const { kind, query } = f.app.library.onlineQuery(item);
  f.app.onlineArt.index[f.app.onlineArt.keyFor(kind, query)] = { anilistId: 1 };
  assert.deepEqual(await (await f.request('/api/avatar-choices')).json(), []); assert.equal(calls, 0);
  await f.app.store.change(d => { d.onlineArt = true; });
  assert.deepEqual(await (await f.request('/api/avatar-choices')).json(), []);
  await f.app.avatars.init();
  assert.deepEqual(await (await f.request('/api/avatar-choices')).json(), []); assert.equal(calls, 1);
});
