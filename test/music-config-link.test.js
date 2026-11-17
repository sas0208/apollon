import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fakeNavidrome } from './helpers.js';

test('musica senza login: con utente e password in config.json la musica si apre da sola, senza chiedere niente', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url, navidromeUser: 'casa', navidromePassword: 'segreta-config-456' }); t.after(() => f.close());
  const bare = async route => fetch(f.url + route);
  const boot = await (await bare('/api/bootstrap')).json();
  assert.equal(boot.music, true); assert.equal(boot.musicLinked, true); assert.equal(boot.musicUser, 'casa');
  assert.equal((await bare('/api/music/library')).status, 200);
  // La password non finisce mai nelle risposte né su disco (nessun file musica-collegata.json).
  for (const route of ['/api/bootstrap', '/api/music/library']) assert.ok(!(await (await bare(route)).text()).includes('segreta-config-456'));
  await f.login();
  const status = await (await f.request('/api/manage/music')).json();
  assert.equal(status.linked, true); assert.equal(status.source, 'config'); assert.equal(status.configured, true);
  // «Scollega» non può togliere quello che sta in config.json: si ricollega da solo.
  const after = await (await f.request('/api/manage/music/unlink', { method: 'POST', data: {} })).json();
  assert.equal(after.linked, true); assert.equal(after.source, 'config');
});

test('musica senza login: se Navidrome è spento all’avvio ci si riprova dopo, senza bloccare Apollon', async t => {
  const nav = await fakeNavidrome(); const url = nav.url; await nav.close();
  const f = await fixture({ navidromeUrl: url, navidromeUser: 'casa', navidromePassword: 'segreta-config-456' }); t.after(() => f.close());
  const boot = await (await fetch(f.url + '/api/bootstrap')).json();
  assert.equal(boot.music, false); assert.equal(boot.musicLinked, false);
  await f.login();
  const status = await (await f.request('/api/manage/music')).json();
  assert.equal(status.linked, false); assert.equal(status.configured, true); assert.ok(status.error.includes('Navidrome'));
  assert.equal((await f.request('/api/music/library')).status, 401);
});

test('musica senza login: password sbagliata in config.json = errore chiaro in Gestisci, non un modulo di login per tutti', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url, navidromeUser: 'errore', navidromePassword: 'sbagliata-123' }); t.after(() => f.close());
  await f.login();
  const status = await (await f.request('/api/manage/music')).json();
  assert.equal(status.linked, false); assert.equal(status.configured, true); assert.ok(status.error.includes('password'));
});
