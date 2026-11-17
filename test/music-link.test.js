import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fixture, fakeNavidrome } from './helpers.js';
import { sortSongs, shuffled } from '../public/music-songs.js';

const link = (f, username = 'bruno', password = 'segreta-di-prova-123') => f.request('/api/manage/music/link', { method: 'POST', data: { username, password } }); // gitleaks:allow
test('musica collegata una volta: si apre senza login, credenziali mai nelle risposte, scollega', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  const password = 'segreta-di-prova-123'; // gitleaks:allow
  const seen = [];
  const look = async r => { const body = await r.text(); seen.push(body); return JSON.parse(body); };
  // non collegata: serve il login per sessione (ripiego)
  assert.equal((await f.request('/api/music/library')).status, 401);
  assert.equal((await look(await f.request('/api/bootstrap'))).music, false);
  // collegare richiede la chiave di gestione
  assert.equal((await link(f)).status, 401);
  await f.login();
  { const s = await look(await f.request('/api/manage/music')); assert.equal(s.linked, false); assert.equal(s.user, ''); }
  // password sbagliata: errore semplice, niente salvato
  const bad = await link(f, 'errore'); assert.equal(bad.status, 401); await look(bad);
  assert.equal((await look(await f.request('/api/manage/music'))).linked, false);
  const ok = await link(f); assert.equal(ok.status, 200); { const s = await look(ok); assert.equal(s.linked, true); assert.equal(s.user, 'bruno'); }
  // file sul server, riservato e senza password
  const file = path.join(f.app.config.dataDir, 'musica-collegata.json');
  const saved = await readFile(file, 'utf8'); assert.ok(!saved.includes(password)); assert.ok(JSON.parse(saved).t);
  if (process.platform !== 'win32') assert.equal((await stat(file)).mode & 0o777, 0o600);
  // un dispositivo nuovo, senza cookie e senza chiave di casa, apre la musica subito
  const bare = async route => fetch(f.url + route);
  const boot = await (await bare('/api/bootstrap')).json(); assert.equal(boot.music, true); assert.equal(boot.musicLinked, true); assert.equal(boot.musicUser, 'bruno');
  const anon = await bare('/api/music/library'); assert.equal(anon.status, 200);
  const anonText = await anon.text(); seen.push(anonText);
  assert.ok(!(await bare('/api/manage/music')).ok);
  // il browser non vede mai token, sale o password
  const tokens = JSON.parse(saved);
  for (const body of seen) for (const secret of [password, tokens.t, tokens.s]) assert.ok(!body.includes(secret));
  assert.ok(!JSON.stringify(boot).includes(tokens.t));
  // scollega: torna il ripiego col login
  assert.equal((await f.request('/api/manage/music/unlink', { method: 'POST', data: {} })).status, 200);
  assert.equal((await bare('/api/music/library')).status, 401);
  assert.equal((await (await bare('/api/bootstrap')).json()).music, false);
  await assert.rejects(stat(file));
});
test('musica collegata ma password cambiata su Navidrome: messaggio semplice, senza dettagli', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  await f.login(); assert.equal((await link(f)).status, 200);
  // simulo il rifiuto di Navidrome (il finto server rifiuta l'utente «errore»)
  f.app.musicLink.auth = { u: 'errore', t: 'x', s: 'y' };
  const r = await fetch(f.url + '/api/music/library'); assert.equal(r.status, 401);
  const body = await r.json(); assert.equal(body.error, 'La musica va ricollegata in Gestisci.');
  assert.ok(!JSON.stringify(body).includes('errore'));
});
test('login musicale per sessione resta il ripiego quando non è collegata', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/login', { method: 'POST', data: { username: 'bruno', password: 'x' } })).status, 200);
  assert.equal((await f.request('/api/music/library')).status, 200);
});
test('Tutti i brani: totale, elenco compatto e autenticato', async t => {
  const songs = Array.from({ length: 1400 }, (_, i) => ({ id: `s${i}`, title: `Brano ${i}`, artist: 'Artista', album: 'Album', albumId: 'a1', coverArt: 'a1', duration: 100 + i, created: '2026-11-01', path: `x/${i}.mp3`, suffix: 'mp3' }));
  const nav = await fakeNavidrome({ songs }); t.after(() => nav.close());
  const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  assert.equal((await f.request('/api/music/songs')).status, 401);
  await f.request('/api/music/login', { method: 'POST', data: { username: 'bruno', password: 'x' } });
  const r = await (await f.request('/api/music/songs')).json();
  assert.equal(r.total, 1400); assert.equal(r.songs.length, 1400); assert.equal(r.songs[0].path, undefined); assert.equal(r.songs[5].title, 'Brano 5');
});
test('Tutti i brani: ordinamenti e filtro', () => {
  const songs = [{ id: '1', title: 'Zeta', artist: 'Bruno', album: 'Due', duration: 50, created: '2026-01-01', track: 2 }, { id: '2', title: 'Àlfa', artist: 'Anna', album: 'Uno', duration: 300, created: '2026-11-01', track: 1 },
    { id: '3', title: 'Beta', artist: 'Anna', album: 'Uno', duration: 100, created: '2026-06-01', track: 2 }];
  const ids = (sort, filter) => sortSongs(songs, sort, filter).map(s => s.id).join('');
  assert.equal(ids('title'), '231'); assert.equal(ids('artist'), '231'); assert.equal(ids('album'), '123'); assert.equal(ids('added'), '231'); assert.equal(ids('duration'), '132');
  assert.equal(ids('title', 'alfa'), '2'); assert.equal(ids('title', 'anna uno'), '23'); assert.equal(ids('title', 'zzz'), '');
  assert.equal(songs[0].id, '1');
  assert.deepEqual(shuffled(songs, () => 0).map(s => s.id), ['2', '3', '1']); assert.equal(shuffled(songs).length, 3);
});
