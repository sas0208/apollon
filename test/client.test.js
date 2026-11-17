import test from 'node:test';
import assert from 'node:assert/strict';
import { groupVideos, followingEpisode, spatialTarget, playbackAction, storyEndOf, quantity } from '../public/logic.js';

test('contatori italiani: zero, uno e molti, incluse parole invariabili e concordanze', () => {
  for (const [singular, plural] of [['brano', 'brani'], ['episodio', 'episodi'], ['titolo', 'titoli'], ['artista', 'artisti'], ['stagione', 'stagioni'], ['anteprima', 'anteprime'], ['problema', 'problemi'], ['sottotitolo', 'sottotitoli'], ['album', 'album'], ['playlist', 'playlist'], ['file', 'file']]) {
    assert.equal(quantity(0, singular, plural), `0 ${plural}`);
    assert.equal(quantity(1, singular, plural), `1 ${singular}`);
    assert.equal(quantity(2, singular, plural), `2 ${plural}`);
  }
  assert.equal(quantity('1', 'brano', 'brani'), '1 brano');
  assert.equal(quantity(1, 'album'), '1 album');
  assert.equal(quantity(1, 'brano pronto', 'brani pronti'), '1 brano pronto');
  assert.equal(quantity(2, 'brano non è collegato', 'brani non sono collegati'), '2 brani non sono collegati');
});

test('scaffali serie, ripresa episodio e passaggio alla prossima stagione', () => {
  const items = [
    { id: 'a2', root: 'Anime', series: 'Casa', season: 2, episode: 1 },
    { id: 'a1', root: 'Anime', series: 'Casa', season: 1, episode: 2 },
    { id: 'a0', root: 'Anime', series: 'Casa', season: 1, episode: 1 },
    { id: 'b0', root: 'Film', series: 'Casa', season: 1, episode: 1 },
    { id: 'film', root: 'Film', title: 'Film' }
  ];
  const groups = groupVideos(items, { a0: { watched: true } }); assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].episodes.map(i => i.id), ['a0', 'a1', 'a2']); assert.equal(groups[0].item.id, 'a1');
  assert.equal(followingEpisode(items, items[1]).id, 'a2'); assert.equal(followingEpisode(items, items[0]), null);
  assert.equal(followingEpisode(items, items[4]), null); assert.equal(followingEpisode(items, { ...items[0], id: 'assente' }), null);
});

test('pulsanti nei tratti corretti, auto per profilo e conservazione delle scene dopo i titoli', () => {
  const item = { salti: { riassunto: [0, 15], sigla: [30, 95], finale: [1200, 1280] } };
  assert.equal(playbackAction(item, 16, 1281, true, {}), null);
  assert.equal(playbackAction(item, 8, 1281, true, {}).label, 'Salta riassunto');
  // 12/11: il salto da solo vale soltanto per i tratti che il server dichiara sicuri; altrimenti resta il pulsante.
  assert.equal(playbackAction(item, 50, 1281, true, { autoSkip: true }).automatic, false);
  assert.equal(playbackAction({ ...item, saltiSicuri: ['sigla'] }, 50, 1281, true, { autoSkip: true }).automatic, true);
  assert.equal(playbackAction({ ...item, saltiSicuri: ['sigla'] }, 50, 1281, true, {}).automatic, false);
  assert.equal(playbackAction(item, 95, 1281, true, {}), null);
  assert.equal(playbackAction(item, 1220, 1281, true, {}).label, 'Prossimo episodio');
  assert.equal(playbackAction(item, 1220, 1281, true, { autoSkip: true, autoNext: true }).next, true);
  assert.equal(playbackAction(item, 1220, 1350, true, { autoSkip: true, autoNext: true }).label, 'Salta sigla finale');
  assert.equal(playbackAction(item, 1220, 1350, true, { autoSkip: true, autoNext: true }).target, 1280);
  // Scena dopo i titoli: sigla finale sicura ma storia non finita -> si salta solo la sigla, mai all'episodio dopo.
  const scena = playbackAction({ ...item, saltiSicuri: ['finale'], fineStoria: null }, 1220, 1350, true, { autoSkip: true, autoNext: true });
  assert.equal(scena.next, false); assert.equal(scena.label, 'Salta sigla finale'); assert.equal(scena.automatic, true);
  // Storia finita con certezza (dopo c'è solo l'anteprima): «Prossimo episodio» già dalla sigla finale.
  const finita = { ...item, salti: { ...item.salti, anteprima: [1280, 1350] }, saltiSicuri: ['finale'], fineStoria: 1200 };
  assert.equal(playbackAction(finita, 1220, 1350, true, {}).label, 'Prossimo episodio'); assert.equal(playbackAction(finita, 1220, 1350, true, {}).automatic, false);
  assert.equal(playbackAction(finita, 1300, 1350, true, {}).label, 'Prossimo episodio');
  // Un valore assurdo (prima di metà episodio) non vale come fine della storia.
  assert.equal(storyEndOf({ fineStoria: 100 }, 1350), null); assert.equal(storyEndOf({ fineStoria: 1200 }, 1350), 1200); assert.equal(storyEndOf({}, 1350), null);
  assert.equal(playbackAction(item, 1220, 1281, false, { autoSkip: true }).next, false);
  assert.equal(playbackAction({ introStart: 10, introEnd: 30 }, 12, 100, false, {}).target, 30);
  assert.equal(playbackAction(item, NaN, 1281, true, {}), null);
});
test('telecomando sceglie i vicini nelle quattro direzioni', () => {
  const rect = (left, top) => ({ left, top, width: 100, height: 50 });
  const candidates = [['destra', 300, 100], ['sinistra', 0, 100], ['sopra', 150, 0], ['sotto', 150, 250], ['lontano', 400, 500]].map(([value, x, y]) => ({ value, rect: rect(x, y) }));
  for (const [key, value] of Object.entries({ ArrowRight: 'destra', ArrowLeft: 'sinistra', ArrowUp: 'sopra', ArrowDown: 'sotto' })) assert.equal(spatialTarget(rect(150, 100), candidates, key), value);
  assert.equal(spatialTarget(rect(150, 100), [], 'ArrowRight'), null);
});

test('server separati: la pagina dell’altro tipo si apre sull’altro server, conservando ?tv=1', async () => {
  const { otherServerTarget } = await import('../public/logic.js');
  const video = 'http://video.local:8787/', music = 'http://musica.local:8787';
  assert.equal(otherServerTarget('music', 'video', video), 'http://video.local:8787/#music');
  assert.equal(otherServerTarget('music', 'video', video, '?tv=1&x=2'), 'http://video.local:8787/?tv=1#music');
  assert.equal(otherServerTarget('home', 'music', music, '?tv=1&legacy=1'), 'http://musica.local:8787/?tv=1&legacy=1#home');
  assert.equal(otherServerTarget('film', 'music', music), 'http://musica.local:8787/#film');
  assert.equal(otherServerTarget('music', 'video', ''), '', 'Senza indirizzo dell’altro server resta tutto qui');
  assert.equal(otherServerTarget('home', 'video', video), ''); assert.equal(otherServerTarget('music', 'music', music), ''); assert.equal(otherServerTarget('manage', 'music', music), '');
  assert.equal(otherServerTarget('music', 'video', 'javascript:alert(1)'), '');
});

test('17/11: due file dello stesso film e dello stesso anno sono un titolo solo', () => {
  const items = [{ id: 'p', root: 'Film', title: 'Paradox', year: 2018, size: 2 }, { id: 'g', root: 'Film', title: 'Paradox', year: 2018, size: 9 },
    { id: 'x', root: 'Film', title: 'Paradox', year: 2008, size: 1 }, { id: 'n1', root: 'Film', title: 'Senza anno' }, { id: 'n2', root: 'Film', title: 'Senza anno' }];
  const g = groupVideos(items); assert.equal(g.length, 4); assert.equal(g[0].item.id, 'g');
  assert.equal(groupVideos(items, { p: { seconds: 30 } })[0].item.id, 'p');
});
