import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialTarget } from '../public/logic.js';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const rect = (left, top, width = 100, height = 100) => ({ left, top, width, height });
const candidate = (value, ...box) => ({ value, rect: rect(...box) });

test('telecomando: destra e sinistra restano nella riga anche con un vicino diagonale', () => {
  const active = rect(500, 200);
  for (const [direction, sign] of [['ArrowRight', 1], ['ArrowLeft', -1]]) {
    assert.equal(spatialTarget(active, [candidate('diagonale', 500 + sign * 110, 301), candidate('riga', 500 + sign * 500, 200)], direction), 'riga');
  }
});

test('telecomando: su e giù preferiscono la colonna sovrapposta', () => {
  for (const [direction, sign] of [['ArrowDown', 1], ['ArrowUp', -1]]) {
    assert.equal(spatialTarget(rect(500, 500), [candidate('diagonale', 601, 500 + sign * 110), candidate('colonna', 500, 500 + sign * 450)], direction), 'colonna');
  }
});

test('telecomando: rettangoli vuoti o non finiti non ricevono focus', () => {
  const candidates = [candidate('vuoto', 105, 0, 0, 10), candidate('infinito', 110, 0, Infinity), candidate('valido', 300, 0)];
  assert.equal(spatialTarget(rect(0, 0), candidates, 'ArrowRight'), 'valido');
  assert.equal(spatialTarget(rect(NaN, 0), candidates, 'ArrowRight'), null);
});

test('aggiornare la scheda conserva il comando focalizzato e non sostituisce la scheda sotto il player', async () => {
  const source = await readFile(new URL('../public/video-app.js', import.meta.url), 'utf8');
  const match = source.match(/function paintTitle\(\) \{[^]*?\n  \}/); assert.ok(match);
  const document = { activeElement: null };
  const button = (label, cls = 'ep-open') => ({ id: '', className: cls, disabled: false, getAttribute: () => label,
    closest: () => ({ dataset: { ep: 'E2' } }), getClientRects: () => [1], focus() { document.activeElement = this; } });
  let nodes = [button('Riproduci episodio 2')]; const dialog = { open: true, contains: n => nodes.includes(n), querySelectorAll: () => nodes };
  let active = dialog, paints = 0; document.activeElement = nodes[0];
  const context = { document, $: () => dialog, c: { activeDialog: () => active }, paintTitleContent() { paints++; nodes = [button('Riproduci episodio 2')]; document.activeElement = {}; } };
  const paint = vm.runInNewContext(`(${match[0]})`, context); paint();
  assert.equal(document.activeElement, nodes[0]); assert.equal(paints, 1);
  active = { id: 'video-dialog' }; paint(); assert.equal(paints, 1);
});
