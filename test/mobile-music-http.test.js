import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeNavidrome, fixture } from './helpers.js';

test('copertina a indice freddo non attende catalogo/ffmpeg; HEAD e Range restano diretti', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl:nav.url }); t.after(() => f.close());
  await f.request('/api/music/login', {method:'POST',data:{username:'prova',password:'finta'}});
  nav.calls.length = 0;
  const cover = await f.request('/api/music/cover?id=a1&size=80'); assert.equal(cover.status,200); await cover.arrayBuffer();
  assert.deepEqual(nav.calls.map(c => c.method), ['getCoverArt']);
  const head = await f.request('/api/music/stream?id=s1', {method:'HEAD'}); assert.equal(head.headers.get('Content-Length'),'10');
  assert.equal(nav.calls.at(-1).verb,'HEAD'); assert.equal(nav.calls.at(-1).params.get('format'),'raw');
  const range = await f.request('/api/music/stream?id=s1', {headers:{Range:'bytes=0-2'}});
  assert.equal(range.status,206); assert.equal(range.headers.get('Content-Range'),'bytes 0-2/10'); assert.equal(await range.text(),'012');
});
