import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers.js';
import { Subsonic } from '../lib/subsonic.js';
import { createHash } from 'node:crypto';

test('tutti gli asset sono locali, disponibili e protetti dalla policy del browser', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const name of ['', 'app.js', 'logic.js', 'music-logic.js', 'music-playback.js', 'music-motion.js', 'music-gestures.js', 'music-feedback.js', 'music-equalizer.js', 'virtual-list.js', 'style.css', 'music-app.css', 'video-app.css', 'video-app.js', 'video-logic.js', 'video-player.js', 'video-manage.js', 'music-shell.js', 'music-home.js', 'music-cover.svg', 'icon.svg', 'icon-192.png', 'icon-512.png', 'sw.js', 'manifest.webmanifest']) {
    const r = await f.request('/' + name); assert.equal(r.status, 200, name); await r.arrayBuffer();
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  }
  assert.equal((await f.request('/server.js')).status, 404);
  assert.equal((await f.request('/data/access.json')).status, 404);
  assert.equal((await f.request('/config.json')).status, 404);
});
test('richieste malformate e cross-site rifiutate, accesso con cookie HttpOnly', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const raw of ['null', '[]', '"testo"', '{']) assert.equal((await f.request('/api/profiles', { method: 'POST', raw, headers: { 'Content-Type': 'application/json' } })).status, 400);
  assert.equal((await f.request('/api/profiles', { method: 'POST', raw: '{}', headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.request('/api/profiles', { method: 'POST', data: { name: 'Intruso' }, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
  const r = await f.login(); assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.equal((await (await f.request('/api/bootstrap')).json()).admin, true);
});
test('troppi tentativi di chiave vengono rallentati', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (let n = 0; n < 12; n++) assert.equal((await f.request('/api/login', { method: 'POST', data: { key: 'errata' } })).status, 401);
  assert.equal((await f.login()).status, 429);
});
test('la password Subsonic conserva gli spazi e non compare nella URL', () => {
  const nav = new Subsonic('http://127.0.0.1:4533'); const auth = nav.credentials('casa', ' password finta ');
  assert.equal(auth.t, createHash('md5').update(' password finta ' + auth.s).digest('hex'));
  assert.equal(nav.url('ping', auth).searchParams.has('p'), false);
});
