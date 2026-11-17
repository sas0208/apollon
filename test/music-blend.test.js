import test from 'node:test';
import assert from 'node:assert/strict';
import { blend, taste, MIN_LISTENS, SIZE } from '../lib/music-blend.js';
import { affinityText, blendView, emptyText, savedName, whoLabel } from '../public/music-blend.js';
import { fixture, fakeNavidrome } from './helpers.js';
// Catalogo finto: 40 brani jazz tranquilli, 40 rock energici, 20 pop in mezzo, 5 con problema.
const catalog = [
  ...Array.from({ length: 40 }, (_, i) => ({ id: `j${i}`, title: `Jazz ${i}`, artist: `Jazzista ${i % 4}`, genere: 'Jazz', mood: ['Relax'], energia: 20 })),
  ...Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, title: `Rock ${i}`, artist: `Rocker ${i % 4}`, genere: 'Rock', mood: ['Grinta'], energia: 90 })),
  ...Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, title: `Pop ${i}`, artist: `Popper ${i % 4}`, genere: 'Pop', mood: ['Relax', 'Grinta'], energia: 55 })),
  ...Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, title: `Guasto ${i}`, artist: 'Jazzista 0', genere: 'Jazz', mood: ['Relax'], energia: 20, problema: true }))];
const listens = (prefix, count, extra = {}) => Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i % 40}`, playId: `${prefix}-${i}`, seconds: 120, at: Date.now(), ...extra }));
const run = (mine, other, extra = {}) => blend({ mine, other, catalog, seed: '2026-11-05/marta/bruno', ...extra });
test('miscela: 30 brani senza doppioni né brani con problema, con etichette uno/altro/tutti e due', () => {
  const r = run([...listens('j', 14), ...listens('p', 4)], [...listens('r', 14), ...listens('p', 4)]);
  assert.equal(r.empty, false); assert.equal(r.songs.length, SIZE); assert.equal(new Set(r.songs.map(s => s.id)).size, SIZE);
  assert.equal(r.songs.some(s => s.problema || s.id.startsWith('x')), false);
  const who = new Set(r.songs.map(s => s.who)); assert.deepEqual([...who].sort(), ['both', 'mine', 'other']);
  assert.ok(r.songs.filter(s => s.who === 'mine').every(s => s.genere === 'Jazz'), 'il gusto "uno" è jazz');
  assert.ok(r.songs.filter(s => s.who === 'other').every(s => s.genere === 'Rock'), 'il gusto "l’altro" è rock');
  assert.ok(r.songs.filter(s => s.who === 'both').some(s => s.genere === 'Pop'), 'i brani di mezzo piacciono a tutti e due');
});
test('miscela: percentuale di affinità alta per gusti uguali, bassa per gusti opposti, intera fra 0 e 100', () => {
  const same = run(listens('j', 12), listens('j', 12, { playId: 'z' })), opposite = run(listens('j', 12), listens('r', 12)), mixed = run([...listens('j', 8), ...listens('p', 6)], [...listens('r', 8), ...listens('p', 6)]);
  assert.equal(same.affinity, 100); assert.ok(opposite.affinity <= 10, `opposti ${opposite.affinity}`);
  assert.ok(mixed.affinity > opposite.affinity && mixed.affinity < same.affinity, `in mezzo ${mixed.affinity}`); assert.ok(Number.isInteger(mixed.affinity));
  assert.equal(affinityText(72), 'Siete in sintonia al 72%');
});
test('miscela: stessa scelta nello stesso giorno per entrambi i profili, diversa il giorno dopo', () => {
  const a = [...listens('j', 12), ...listens('p', 6)], b = [...listens('r', 12), ...listens('p', 6)];
  const today = run(a, b), again = run(a, b), swapped = run(b, a), tomorrow = run(a, b, { seed: '2026-11-06/marta/bruno' });
  assert.deepEqual(today.songs.map(s => s.id), again.songs.map(s => s.id));
  assert.deepEqual([...today.songs.map(s => s.id)].sort(), [...swapped.songs.map(s => s.id)].sort()); // l’altro profilo vede gli stessi brani
  const flip = { mine: 'other', other: 'mine', both: 'both' }, byId = new Map(today.songs.map(x => [x.id, x.who])); assert.ok(swapped.songs.every(x => flip[byId.get(x.id)] === x.who)); // le etichette si specchiano
  assert.notDeepEqual(today.songs.map(s => s.id), tomorrow.songs.map(s => s.id));
});
test('miscela: vuoto spiegato quando uno dei due ha pochi ascolti; ascolti sotto i 20 secondi non contano', () => {
  const short = listens('j', 30, { seconds: 19 });
  assert.equal(taste(short, new Map()).listens, 0);
  const r = run(listens('j', MIN_LISTENS), [...listens('r', 3), ...short]);
  assert.equal(r.empty, true); assert.equal(r.songs.length, 0); assert.equal(r.mine, MIN_LISTENS); assert.equal(r.other, 3); assert.equal(r.needed, MIN_LISTENS);
  assert.equal(run(listens('j', MIN_LISTENS - 1), listens('r', 12)).empty, true); assert.equal(run(listens('j', MIN_LISTENS), listens('r', MIN_LISTENS)).empty, false);
  assert.equal(emptyText({ ...r, mine: 10, other: 3 }, 'Bruno', 'Marta'), 'Marta ha solo 3 ascolti. Per creare la Miscela servono almeno 10 ascolti a testa: un ascolto conta dopo 20 secondi. Ascoltate un po’ di musica, ognuno dal proprio profilo, e riprovate.');
  assert.match(emptyText({ needed: 10, mine: 0, other: 1 }, 'Bruno', 'Marta'), /Bruno ha ancora nessun ascolto e Marta ha solo 1 ascolto\./);
});
test('miscela: i preferiti di casa e i brani già ascoltati pesano, catalogo piccolo dà meno di 30 brani', () => {
  const small = catalog.filter(s => /^(j[0-4]|r[0-4])$/.test(s.id));
  const r = blend({ mine: listens('j', 12), other: listens('r', 12), catalog: small, seed: 's' }); assert.equal(r.songs.length, 10);
  const starred = run(listens('p', 12), listens('p', 12), { starred: ['p3'] }); assert.ok(starred.songs.some(s => s.id === 'p3'));
});
test('vista: messaggi in italiano semplice, nessuna parola null e testi per chi ha il gusto', () => {
  assert.deepEqual(['mine', 'other', 'both'].map(w => whoLabel(w, 'Marta')), ['Piace a te', 'Piace a Marta', 'Piace a tutti e due']);
  assert.equal(savedName({ profiles: { mine: 'Bruno', other: 'Marta' }, day: '2026-11-05' }), 'Miscela Bruno e Marta · 05/11/2026');
  const made = []; const el = (tag, attrs = {}, ...children) => { const node = { tag, attrs, children: children.flat(Infinity) }; made.push(node); return node; };
  const c = { el, action: fn => fn, api: async () => ({}), notify() {}, image: id => `/c/${id}`, setQueue() {} };
  const text = node => typeof node === 'string' ? node : [node.tag === 'img' ? '' : '', ...node.children.map(text)].join(' ');
  const empty = blendView(c, { empty: true, needed: 10, mine: 2, other: 12, profiles: { mine: 'Bruno', other: 'Marta' } }, { name: 'Marta' });
  assert.match(text(empty[0]), /Bruno ha solo 2 ascolti/); assert.doesNotMatch(text(empty[0]), /null|undefined/);
  const ok = blendView(c, { empty: false, affinity: 72, day: '2026-11-05', profiles: { mine: 'Bruno', other: 'Marta' }, songs: [{ id: 'a', title: 'Uno', artist: 'Lei', who: 'both' }, { id: 'b', title: 'Due', who: 'other' }] }, { name: 'Marta' });
  const all = text({ tag: 'div', children: ok }); assert.match(all, /Siete in sintonia al 72%/); assert.match(all, /Piace a tutti e due/); assert.match(all, /Piace a Marta/); assert.doesNotMatch(all, /null|undefined/);
  assert.match(text(blendView(c, { empty: false, affinity: 50, songs: [], profiles: { mine: 'A', other: 'B' } }, { name: 'B' })[0]), /Nessun brano adatto/);
});
test('miscela HTTP: stessa casa, profili validi e diversi, ascolti dei due profili, vuoto poi pronta', async t => {
  const songs = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, title: `Brano ${i}`, path: `m/${i}.mp3`, artist: i < 6 ? 'Prima' : 'Seconda', album: 'Casa', albumId: 'a1', duration: 60, coverArt: 'a1' }));
  const nav = await fakeNavidrome({ songs }); t.after(() => nav.close()); const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  const get = path => f.request(path);
  assert.equal((await get('/api/music/blend?profile=bruno&with=marta')).status, 401); // serve l’accesso alla musica
  await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  assert.equal((await get('/api/music/blend?profile=bruno&with=bruno')).status, 400); assert.equal((await get('/api/music/blend?profile=bruno&with=sconosciuto')).status, 404); assert.equal((await get('/api/music/blend?profile=sconosciuto&with=bruno')).status, 404);
  const early = await (await get('/api/music/blend?profile=bruno&with=marta')).json(); assert.equal(early.empty, true); assert.deepEqual(early.profiles, { mine: 'Bruno', other: 'Marta' }); assert.equal(early.mine, 0);
  for (const [profile, from] of [['bruno', 0], ['marta', 4]]) for (let i = 0; i < 10; i++) assert.equal((await f.request('/api/music/played', { method: 'POST', data: { profile, id: `s${from + (i % 6)}`, playId: `${profile}-${i}`, seconds: 60 } })).status, 200);
  const ready = await (await get('/api/music/blend?profile=bruno&with=marta')).json();
  assert.equal(ready.empty, false); assert.equal(ready.songs.length, 12); assert.ok(ready.affinity >= 0 && ready.affinity <= 100); assert.ok(ready.songs.every(s => ['mine', 'other', 'both'].includes(s.who)));
  assert.match(ready.day, /^\d{4}-\d{2}-\d{2}$/);
  const other = await (await get('/api/music/blend?profile=marta&with=bruno')).json(); assert.equal(other.affinity, ready.affinity);
  assert.deepEqual(other.songs.map(s => s.id).sort(), ready.songs.map(s => s.id).sort());
});
