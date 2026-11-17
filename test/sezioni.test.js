import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildRows, kindLabel, catalogCategories, SECTION_OF } from '../public/video-logic.js';

// 13/11/2026: «dividere bene i film e serie TV dagli anime, anche nel menu e nelle suddivisioni».
const t = (key, kind, genres, extra = {}) => ({ key, kind, title: key, genres, added: 1, firstAdded: 1, year: 2020, item: { id: key + 'i' }, ...extra });
const titles = [
  t('a1', 'anime', ['Azione']), t('a2', 'anime', ['Azione']), t('a3', 'anime', ['Fantasy']),
  t('f1', 'film', ['Azione']), t('f2', 'film', ['Azione']),
  t('s1', 'series', ['Fantascienza'], { episodes: [{ id: 'e1' }] }), t('s2', 'series', ['Fantascienza'], { episodes: [{ id: 'e2' }] }),
];

test('Sezioni: le serie si chiamano «Serie TV» e stanno con i film, non con gli anime', () => {
  assert.equal(kindLabel({ kind: 'series' }), 'Serie TV');
  assert.deepEqual(SECTION_OF, { anime: 'anime', film: 'film-serie', series: 'film-serie' });
});

test('Sezioni: in Home un genere non mischia mai anime e film', () => {
  const rows = buildRows(titles, [], {}, [], { page: 'home' });
  const azione = rows.filter(r => r.id.startsWith('genere-') && r.title.startsWith('Azione'));
  assert.deepEqual(azione.map(r => r.title).sort(), ['Azione · Anime', 'Azione · Film e Serie TV']);
  for (const r of azione) assert.equal(new Set(r.entries.map(e => SECTION_OF[e.kind])).size, 1, r.title);
  assert.deepEqual(rows.find(r => r.id === 'serie').entries.map(e => e.key).sort(), ['s1', 's2']);
  assert.equal(rows.find(r => r.id === 'serie').title, 'Serie TV');
});

test('Sezioni: con i soli anime i generi restano senza etichetta di sezione', () => {
  const rows = buildRows(titles.filter(x => x.kind === 'anime'), [], {}, [], { page: 'home' });
  assert.ok(rows.some(r => r.title === 'Azione'));
  assert.ok(!rows.some(r => r.title.includes(' · ')));
});

test('Sezioni: la pagina Anime ha solo anime, la pagina Serie TV solo serie', () => {
  for (const [page, kind] of [['anime', 'anime'], ['series', 'series'], ['film', 'film']])
    for (const r of buildRows(titles, [], {}, [], { page })) assert.ok(r.entries.every(e => (e.kind ?? e.title.kind) === kind), `${page}: ${r.title}`);
  const tre = [1, 2, 3].map(n => t('x' + n, 'series', ['Fantascienza'], { episodes: [{ id: 'x' + n }] }));
  assert.ok(catalogCategories(tre, 'home').some(g => g.name === 'Serie TV'), 'TV: riga «Serie TV»');
});

test('Sezioni: menu del telefono/PC e della TV con Anime separato da Film e Serie TV', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const order = ['data-page="anime"', 'nav-sep', 'data-page="film"', 'data-page="series"'].map(s => html.indexOf(s));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'Anime, linea, Film, Serie TV');
  assert.match(html, />Serie TV<\/button>/);
  const rail = readFileSync(new URL('../public/tv/rail.js', import.meta.url), 'utf8');
  assert.match(rail, /\['anime','Anime'\],\['film','Film'\],\['series','Serie TV'\]/);
  const library = readFileSync(new URL('../lib/library.js', import.meta.url), 'utf8');
  assert.match(library, /\['Film', 'Serie', 'Anime'\]/, 'la cartella Serie del server viene letta');
});
