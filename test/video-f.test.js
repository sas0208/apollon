// Giro F: logica delle righe «da servizio di streaming» e le API nuove (La mia lista, togli dalla riga, nomi dei profili, immagini a mano).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fixture } from './helpers.js';
import { buildTitles, continueEntries, resumePoint, playLabel, featuredTitle, buildRows, novitaGroups, searchTitles, sortList,
  episodeCode, remainingText, metaParts, languageBadges, similarTitles, featuredTitles, shortPlayLabel, shortKind, genreLine, detailLine, aboutInfo } from '../public/video-logic.js';
import { Store } from '../lib/store.js';
import { APP_DIR } from '../server.js';

const DAY = 86400000; const NOW = Date.UTC(2026, 10, 5, 12);
let n = 0;
const id = () => (++n).toString(16).padStart(24, '0');
const film = (title, extra = {}) => ({ id: id(), root: 'Film', title, year: 2024, genres: ['Commedia'], added: NOW - 40 * DAY, duration: 5400, ...extra });
const episode = (series, season, ep, extra = {}) => ({ id: id(), root: extra.root || 'Film', series, season, episode: ep, title: `Episodio ${ep}`, genres: ['Mistero'], added: NOW - 40 * DAY, duration: 1500, ...extra });

function library() {
  const items = [
    film('Notte di vetro', { genres: ['Thriller', 'Mistero'], added: NOW - 2 * DAY, year: 2026 }),
    film('Città sotto la neve', { genres: ['Mistero'], year: 2023 }),
    film('Una sera a colori', { genres: ['Commedia', 'Romantico'] }),
    ...[1, 2, 3].map(e => episode('Casa Moretti', 1, e, { genres: ['Commedia'] })),
    episode('Casa Moretti', 2, 1, { genres: ['Commedia'], added: NOW - DAY }),
    ...[1, 2].map(e => episode('Lama d’argento', 1, e, { root: 'Anime', genres: ['Azione'], streams: [{ type: 'audio', language: 'jpn' }, { type: 'subtitle', language: 'ita' }] })),
  ];
  return items;
}

test('titoli: un film o una serie intera, tipo, riga dati e badge SUB/DOPPIATO', () => {
  const items = library(); const titles = buildTitles(items);
  assert.equal(titles.length, 5);
  const moretti = titles.find(t => t.title === 'Casa Moretti');
  assert.equal(moretti.kind, 'series'); assert.equal(moretti.key, 's:Film/Casa Moretti'); assert.deepEqual(moretti.seasons, [1, 2]);
  assert.deepEqual(metaParts(moretti), ['Commedia', '2 stagioni']);
  const lama = titles.find(t => t.title === 'Lama d’argento');
  assert.equal(lama.kind, 'anime'); assert.ok(lama.badges.includes('SUB'));
  assert.deepEqual(languageBadges([{ streams: [{ type: 'audio', language: 'jpn' }, { type: 'audio', language: 'ita' }] }], true).filter(b => b !== 'SUB'), ['DOPPIATO']);
  assert.equal(episodeCode(items[3]), 'S1:E1'); assert.equal(episodeCode(items[0]), '');
  assert.equal(remainingText(600, 1500), 'Mancano 15 min');
  assert.deepEqual(metaParts(titles.find(t => t.title === 'Notte di vetro')), ['2026', 'Thriller', '1 h 30 min']);
});

test('Continua a guardare: ripresa a metà, episodio dopo, togli dalla riga, un posto per titolo', () => {
  const items = library(); const [e1, e2, e3] = items.slice(3, 6);
  const progress = { [e1.id]: { position: 1500, watched: true, updated: NOW - 3000 }, [e2.id]: { position: 600, duration: 1500, updated: NOW - 2000 },
    [items[0].id]: { position: 300, duration: 5400, updated: NOW - 1000 } };
  let titles = buildTitles(items, progress);
  const moretti = titles.find(t => t.title === 'Casa Moretti');
  const point = resumePoint(moretti, items, progress);
  assert.equal(point.item.id, e2.id); assert.equal(point.position, 600); assert.equal(playLabel(moretti, point), 'Riprendi S1:E2');
  let entries = continueEntries(titles, items, progress);
  assert.deepEqual(entries.map(e => e.title.title), ['Notte di vetro', 'Casa Moretti']);
  // Episodio finito: si propone il successivo.
  progress[e2.id] = { position: 1500, watched: true, updated: NOW - 500 };
  titles = buildTitles(items, progress);
  entries = continueEntries(titles, items, progress);
  assert.equal(entries[0].item.id, e3.id); assert.ok(entries[0].next);
  // «Togli dalla riga» nasconde il titolo finché non si riguarda.
  progress[e2.id].hidden = true;
  assert.deepEqual(continueEntries(buildTitles(items, progress), items, progress).map(e => e.title.title), ['Notte di vetro']);
});

test('titolo in evidenza: stabile nella giornata, preferisce i titoli mai iniziati', () => {
  const items = library(); const progress = Object.fromEntries(items.slice(1).map(i => [i.id, { position: 10, updated: NOW }]));
  const titles = buildTitles(items, progress);
  for (let day = 0; day < 10; day++) assert.equal(featuredTitle(titles, day).title, 'Notte di vetro');
  const fresh = buildTitles(items);
  assert.equal(featuredTitle(fresh, 20000).key, featuredTitle(fresh, 20000).key);
  assert.ok(new Set(Array.from({ length: 30 }, (_, d) => featuredTitle(fresh, d).key)).size > 1, 'Il titolo in evidenza deve cambiare nei giorni');
  assert.equal(featuredTitle([]), null);
});

test('righe: lista, recenti, nuovi episodi, anime, film, generi, perché hai guardato, da rivedere', () => {
  const items = library(); const progress = { [items[2].id]: { position: 5400, watched: true, updated: NOW } };
  const titles = buildTitles(items, progress);
  const list = [{ key: titles.find(t => t.title === 'Casa Moretti').key, added: NOW }];
  const rows = buildRows(titles, items, progress, list, { now: NOW });
  const ids = rows.map(r => r.id);
  for (const want of ['lista', 'recenti', 'nuovi-episodi', 'anime', 'film', 'serie', 'rivedere']) assert.ok(ids.includes(want), want);
  assert.deepEqual(rows.find(r => r.id === 'nuovi-episodi').entries.map(t => t.title), ['Casa Moretti']);
  assert.deepEqual(rows.find(r => r.id === 'rivedere').entries.map(t => t.title), ['Una sera a colori']);
  assert.ok(ids.some(i => i.startsWith('genere-')));
  const anime = buildRows(titles, items, progress, list, { page: 'anime', now: NOW });
  assert.ok(anime.every(r => r.entries.every(e => (typeof e.title === 'object' ? e.title : e).kind === 'anime')));
  const mistero = buildRows(titles, items, progress, [], { genre: 'Mistero', now: NOW });
  assert.ok(mistero.flatMap(r => r.entries).every(t => t.genres.includes('Mistero')));
  assert.ok(similarTitles(titles[0], titles).every(t => t.key !== titles[0].key));
});

test('Novità a gruppi, ricerca senza accenti e per anno, lista ordinabile', () => {
  const items = library(); const titles = buildTitles(items);
  const groups = novitaGroups(titles, NOW);
  assert.equal(groups[0].label, 'Questa settimana');
  assert.deepEqual(groups[0].entries.map(e => [e.title.title, e.note]), [['Casa Moretti', 'Nuova stagione: stagione 2'], ['Notte di vetro', 'Nuovo film']]);
  assert.deepEqual(searchTitles(titles, 'citta').map(t => t.title), ['Città sotto la neve']);
  assert.deepEqual(searchTitles(titles, '2023').map(t => t.title), ['Città sotto la neve']);
  assert.ok(searchTitles(titles, 'mistero').length >= 2);
  assert.deepEqual(searchTitles(titles, '   '), []);
  const list = [{ key: titles[0].key, added: 1 }, { key: titles[2].key, added: 3 }, { key: 'f:sparito', added: 9 }];
  assert.deepEqual(sortList(titles, list).map(t => t.title), ['Una sera a colori', 'Notte di vetro']);
  assert.deepEqual(sortList(titles, list, 'titolo').map(t => t.title), ['Notte di vetro', 'Una sera a colori']);
  assert.deepEqual(sortList(titles, list, 'anno').map(t => t.title), ['Notte di vetro', 'Una sera a colori']);
});

test('API: La mia lista per profilo, Togli dalla riga, nome del profilo', async t => {
  const f = await fixture(); t.after(() => f.close());
  const v = await f.video('Notte di vetro (2026).mp4');
  const put = data => f.request('/api/mylist', { method: 'PUT', data });
  let r = await put({ profile: 'bruno', key: `f:${v.id}`, on: true });
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).items.map(i => i.key), [`f:${v.id}`]);
  await put({ profile: 'bruno', key: 's:Anime/Serie', on: true });
  r = await f.request('/api/mylist?profile=bruno'); assert.deepEqual((await r.json()).items.map(i => i.key), ['s:Anime/Serie', `f:${v.id}`]);
  r = await f.request('/api/mylist?profile=marta'); assert.deepEqual((await r.json()).items, []);
  assert.equal((await put({ profile: 'bruno', key: 's:Anime/Serie', on: 'sì' })).status, 400);
  assert.equal((await put({ profile: 'nessuno', key: 'x', on: true })).status >= 400, true);
  await put({ profile: 'bruno', key: 's:Anime/Serie', on: false });
  r = await f.request('/api/mylist?profile=bruno'); assert.deepEqual((await r.json()).items.map(i => i.key), [`f:${v.id}`]);

  const progress = data => f.request('/api/progress', { method: 'PUT', data: { id: v.id, profile: 'bruno', ...data } });
  assert.equal((await progress({ position: 30, duration: 100 })).status, 200);
  const before = f.app.store.profile('bruno')[v.id];
  assert.equal((await progress({ hidden: true })).status, 200);
  let saved = f.app.store.profile('bruno')[v.id];
  assert.equal(saved.hidden, true); assert.equal(saved.position, 30); assert.equal(saved.updated, before.updated, 'Togliere dalla riga non cambia l’ordine');
  assert.equal((await progress({ hidden: 'sì' })).status, 400);
  await progress({ position: 40, duration: 100 });
  saved = f.app.store.profile('bruno')[v.id]; assert.equal(saved.hidden, undefined, 'Riguardare rimette il titolo nella riga');

  r = await f.request('/api/profiles/name', { method: 'PUT', data: { id: 'marta', name: 'Marta Rossi' } });
  assert.equal(r.status, 200);
  const boot = await (await f.request('/api/bootstrap')).json();
  assert.equal(boot.profiles.find(p => p.id === 'marta').name, 'Marta Rossi');
  assert.equal((await f.request('/api/profiles/name', { method: 'PUT', data: { id: 'marta', name: '' } })).status, 400);
});

test('Gestisci: locandina e sfondo a mano, descrizioni, solo immagini della raccolta', async t => {
  const f = await fixture(); t.after(() => f.close()); await f.login();
  const a = await f.video('Serie S01E01 Primo.mp4', 'Anime');
  const b = await f.video('Serie S01E02 Secondo.mp4', 'Anime');
  const other = await f.video('Altro S01E01 Uno.mp4', 'Anime');
  await writeFile(path.join(f.roots.Anime, 'locandina.webp'), 'immagine sintetica');
  const edit = data => f.request('/api/manage/edit', { method: 'POST', data: { id: a.id, ...data } });
  let r = await f.request(`/api/manage/pictures?id=${a.id}`);
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).pictures, ['locandina.webp']);
  assert.equal((await edit({ poster: { path: 'locandina.webp' }, backdrop: { at: 4 } })).status, 200);
  assert.deepEqual(f.app.store.data.edits[a.id].poster, { path: 'locandina.webp' });
  assert.deepEqual(f.app.store.data.edits[a.id].backdrop, { at: 4 });
  assert.equal((await edit({ backdrop: { at: 2, source: b.id } })).status, 200);
  for (const invalid of [{ poster: { path: '../fuori.webp' } }, { poster: { path: 'Serie S01E02 Secondo.mp4' } }, { poster: 'locandina.webp' }, { backdrop: { at: -1 } },
    { backdrop: { at: 1, source: other.id } }, { description: 42 }]) assert.equal((await edit(invalid)).status, 400, JSON.stringify(invalid));
  assert.equal((await edit({ poster: null })).status, 200); assert.equal(f.app.store.data.edits[a.id].poster, null);
  assert.equal((await edit({ description: 'Episodio di prova.', seriesDescription: 'Una serie di prova.', scope: 'series' })).status, 200);
  assert.equal(f.app.library.get(a.id).description, 'Episodio di prova.');
  assert.equal(f.app.library.get(b.id).seriesDescription, 'Una serie di prova.');
  assert.equal(f.app.library.get(b.id).description || '', '');
  r = await f.request('/api/manage/art', { method: 'POST', data: { id: a.id, scope: 'series' } }); assert.ok([200, 202].includes(r.status), 'La rigenerazione delle immagini parte');
  // Senza chiave non si cambia niente.
  await f.request('/api/logout', { method: 'POST', data: {} });
  assert.equal((await edit({ description: 'no' })).status, 401);
});

test('pagina: i file del giro F esistono, sono nel service worker e non usano servizi esterni', async () => {
  const pub = name => readFile(path.join(APP_DIR, 'public', name), 'utf8');
  const sw = await pub('sw.js'); const html = await pub('index.html');
  for (const name of ['video-app.js', 'video-app.css', 'video-logic.js', 'video-player.js', 'video-manage.js', 'tv-nav.js']) {
    assert.ok(sw.includes(`'/${name}'`), name);
    const source = await pub(name);
    assert.doesNotMatch(source, /https?:\/\/(?!www\.w3\.org)/, `${name} non deve chiamare indirizzi esterni`);
    assert.doesNotMatch(source, /tmdb|themoviedb|netflix|crunchyroll/i, name);
  }
  assert.ok(html.includes('href="/video-app.css"'));
  const css = await pub('video-app.css');
  assert.match(css, /--accent:#ff8c42/); assert.doesNotMatch(css, /#e50914|#f47521/i, 'niente rosso Netflix né arancione Crunchyroll');
});

test('telefono: titoli che ruotano in evidenza, tasto grande, riga sotto la locandina e riga dei generi', () => {
  const items = library(); const titles = buildTitles(items); const day = 20000;
  const six = featuredTitles(titles, 6, day);
  assert.equal(six.length, titles.length); assert.equal(featuredTitles(titles, 3, day).length, 3); assert.equal(six[0].key, featuredTitle(titles, day).key); assert.equal(new Set(six.map(t => t.key)).size, titles.length, 'Nessun doppione');
  assert.deepEqual(featuredTitles(titles, 6, day).map(t => t.key), six.map(t => t.key), 'Stesso ordine per tutta la giornata');
  assert.equal(featuredTitles([], 6, day).length, 0); assert.equal(featuredTitles(titles.slice(0, 2), 6, day).length, 2);
  const serie = titles.find(t => t.title === 'Lama d’argento'); const first = serie.episodes[0]; const second = serie.episodes[1]; const solo = titles.find(t => t.title === 'Notte di vetro');
  assert.equal(shortPlayLabel(serie, { item: first, resume: false }), 'Riproduci'); assert.equal(shortPlayLabel(serie, { item: second, resume: false }), 'Riproduci E2');
  assert.equal(shortPlayLabel(serie, { item: second, resume: true }), 'Continua E2'); assert.equal(shortPlayLabel(serie, { item: first, resume: false }, true), 'Guarda E1');
  assert.equal(shortPlayLabel(solo, { item: solo.item, resume: true }), 'Continua'); assert.equal(shortPlayLabel(solo, { item: solo.item, resume: false }, true), 'Guarda');
  assert.equal(shortKind(solo, NOW), 'Film'); assert.equal(shortKind(serie, NOW), '2 episodi');
  const casa = titles.find(t => t.title === 'Casa Moretti'); assert.equal(shortKind(casa, NOW), 'Nuovo episodio'); assert.equal(shortKind(casa, NOW + 30 * DAY), '2 stagioni');
  assert.equal(genreLine(serie), 'Azione • 2 episodi'); assert.match(genreLine(solo), /^Thriller, Mistero • /);
});

test('voti a stelle: ogni tocco è un voto nuovo, media e conteggio su tutti i voti, ultimo voto del profilo, validazione', async t => {
  const f = await fixture(); t.after(() => f.close());
  const key = 's:Anime/Serie'; const put = data => f.request('/api/ratings', { method: 'PUT', data });
  const read = async profile => (await f.request(`/api/ratings?key=${encodeURIComponent(key)}&profile=${profile}`)).json();
  assert.deepEqual(await read('bruno'), { key, count: 0, average: null, counts: [0, 0, 0, 0, 0], mine: null });
  let r = await put({ profile: 'bruno', key, value: 5 }); assert.equal(r.status, 200); assert.deepEqual((await r.json()).counts, [0, 0, 0, 0, 1]);
  await put({ profile: 'marta', key, value: 4 }); r = await (await put({ profile: 'piero', key, value: 4 })).json();
  assert.equal(r.count, 3); assert.equal(r.average, 4.3); assert.deepEqual(r.counts, [0, 0, 0, 2, 1]); assert.equal(r.mine, 4);
  r = await (await put({ profile: 'bruno', key, value: 2 })).json();
  assert.equal(r.count, 4, 'Un secondo voto dello stesso profilo si aggiunge'); assert.equal(r.average, 3.8); assert.deepEqual(r.counts, [0, 1, 0, 2, 1]); assert.equal(r.mine, 2, 'Le stelle mostrano l’ultimo voto');
  r = await (await put({ profile: 'bruno', key, value: 2 })).json(); assert.equal(r.count, 5, 'Anche lo stesso voto ripetuto conta'); assert.equal(r.average, 3.4);
  assert.equal((await read('marta')).mine, 4); assert.equal((await read('bruno')).mine, 2);
  r = await (await put({ profile: 'bruno', key, value: null })).json(); assert.equal(r.count, 4, 'Senza valore si toglie solo l’ultimo voto'); assert.equal(r.mine, 2);
  for (const value of [0, 6, 2.5, '3', true, [], {}]) assert.equal((await put({ profile: 'bruno', key, value })).status, 400, `voto ${JSON.stringify(value)}`);
  assert.equal((await put({ profile: 'nessuno', key, value: 3 })).status >= 400, true);
  assert.equal((await f.request(`/api/ratings?key=${encodeURIComponent(key)}&profile=nessuno`)).status >= 400, true);
  assert.deepEqual((await (await f.request('/api/ratings?key=f:altro')).json()).counts, [0, 0, 0, 0, 0]);
  const saved = JSON.parse(await readFile(f.app.store.file, 'utf8')); assert.deepEqual(saved.ratings.marta, { [key]: [4] }, 'Salvato come lista nel file dei dati'); assert.deepEqual(saved.ratings.bruno[key], [5, 2]);
});

test('voti a stelle: i voti singoli già salvati diventano il primo della lista, con copia di sicurezza del file', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'voti-'));
  const old = { profiles: [{ id: 'bruno', name: 'Bruno' }], progress: {}, edits: {}, trash: [], migrations: { premade: 1 }, ratings: { bruno: { k: 4 } } };
  await writeFile(path.join(dir, 'stato.json'), JSON.stringify(old));
  const store = await new Store(dir, { log: { log() {}, warn() {}, error() {} } }).init();
  assert.deepEqual(store.data.ratings.bruno.k, [4]); assert.equal(store.ratings('k', 'bruno').count, 1);
  assert.deepEqual(JSON.parse(await readFile(path.join(dir, 'stato.json.prima-dei-voti-multipli.bak'), 'utf8')).ratings, { bruno: { k: 4 } }, 'Copia del file com’era');
  assert.equal((await store.setRating('bruno', 'k', 5)).count, 2); assert.equal(store.ratings('k', 'bruno').mine, 5);
});

test('riga della scheda: «Sottotitolato» solo con sottotitoli, poi i generi, senza numero di episodi', () => {
  assert.equal(detailLine({ subs: true, genres: ['Azione', 'Avventura'] }), 'Sottotitolato • Azione, Avventura');
  assert.equal(detailLine({ subs: false, genres: ['Azione'] }), 'Azione');
});

test('Altre info: durata, lingue di audio e sottotitoli in italiano, solo ciò che c’è, «und» saltato', () => {
  const ep = (season, episode, extra = {}) => ({ id: `e${season}${episode}`, season, episode, ...extra });
  const serie = { description: 'Trama intera.', seasons: [1, 2], episodes: [ep(1, 1, { streams: [{ type: 'audio', language: 'jpn' }, { type: 'audio', language: 'und' }, { type: 'subtitle', language: 'eng' }], subtitles: [{ language: 'it' }, { language: 'Sottotitoli' }] }),
    ep(1, 2, { streams: [{ type: 'audio', language: 'ita' }, { type: 'audio', language: 'jpn' }] }), ep(2, 1)] };
  assert.deepEqual(aboutInfo(serie), { description: 'Trama intera.', duration: '2 Stagioni, 3 Episodi', audio: ['Giapponese', 'Italiano'], subs: ['Inglese', 'Italiano'] });
  const film = aboutInfo({ description: '', episodes: undefined, duration: 5400, item: { streams: [] } }); assert.deepEqual(film, { description: '', duration: '1 h 30 min', audio: [], subs: [] });
  assert.equal(aboutInfo({ seasons: [1], episodes: [ep(1, 1)] }).duration, '1 Episodio');
});
