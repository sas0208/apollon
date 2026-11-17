import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../public/tv/ui.js';
// 13/11: in «Titoli simili» e nei risultati di Cerca la TV mostrava un fotogramma a caso di un episodio
// (con i sottotitoli) al posto della copertina della serie.
test('Card di un titolo intero: copertina larga, non il fotogramma di un episodio', () => {
  assert.equal(typeof ui.cardArtKind, 'function');
  const serie = { key: 'vinland saga', title: 'Vinland Saga', kind: 'anime', art: { id: 'a' }, item: { id: 'e1' } };
  assert.equal(ui.cardArtKind(serie), 'backdrop');
  assert.equal(ui.cardArtKind({ ...serie, kind: 'film' }), 'backdrop');
});
test('Card di un episodio o di «Continua a guardare»: resta il fotogramma', () => {
  const episodio = { key: 'e1', title: '1. Episodio', item: { id: 'e1' }, art: { id: 'e1' }, genres: [] };
  assert.equal(ui.cardArtKind(episodio), 'thumb');
  const continua = { title: { key: 'vinland saga', kind: 'anime' }, item: { id: 'e3' }, position: 100 };
  assert.equal(ui.cardArtKind(continua), 'thumb');
});
test('Locandine delle righe: invariate', () => {
  const serie = { key: 'x', title: 'X', kind: 'anime' };
  assert.equal(ui.cardArtKind(serie, { poster: true, active: false }), 'poster');
  assert.equal(ui.cardArtKind(serie, { poster: true, active: true }), 'backdrop');
  assert.equal(ui.cardArtKind({ title: { key: 'x' }, item: {}, position: 1 }, { poster: true, active: true }), 'thumb');
});
