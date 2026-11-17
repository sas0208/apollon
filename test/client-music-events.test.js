import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { windowedList } from '../public/virtual-list.js';
import { equalizerSettings } from '../public/music-equalizer.js';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function fn(name, context) { const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`)); assert.ok(match); return vm.runInNewContext(`(${match[0]})`, context); }
test('attributi enumerati: draggable=true abilita il trascinamento e aria conserva false', () => {
  const attrs = {}; const node = { setAttribute: (k, v) => { attrs[k] = v; } };
  fn('el', { document: { createElement: () => node } })('li', { draggable: true, 'aria-pressed': false, hidden: false });
  assert.equal(attrs.draggable, 'true'); assert.equal(attrs['aria-pressed'], 'false'); assert.equal(attrs.hidden, undefined);
});
test('ripresa legge prima del clear e non salva la coda del precedente utente nel nuovo', async () => {
  const writes = []; const nodes = new Map(); const old = { id: 'vecchio', title: 'Vecchio' }; const song = { id: 'nuovo', title: 'Nuovo' };
  const context = { state: { boot: { music: true, musicUser: 'nuovo' }, queue: [old], queueIndex: 0 },
    storage: { get: () => ({ queue: [song], index: 0, position: 23 }), set: (key, value) => writes.push(value) }, restoreMusicFeedback() {},
    musicKey: () => 'music:nuovo', restoringMusic: false, likedIds: new Set(), likesLoaded: false, radioGeneration: 0, radio: null, heard: new Set(), storedVolume: 0.8,
    $: key => { if (!nodes.has(key)) nodes.set(key, {}); return nodes.get(key); }, renderQueue() {}, ensureLikes: async () => {}, audio: { currentTime: 23 }, notify() {},
  };
  context.playback = { volume: 0.8, configure() {}, setQueue() {}, clear: () => context.persistQueue(), play: async () => context.persistQueue() };
  context.persistQueue = fn('persistQueue', context);
  await fn('restoreMusic', context)();
  assert.equal(writes.length, 0); assert.equal(context.state.queue[0].id, 'nuovo'); assert.equal(context.restoringMusic, false);
  context.persistQueue(); assert.equal(writes.length, 1); assert.equal(writes[0].queue[0].id, 'nuovo');
});

test('opzioni player: equalizzatore e vibrazione isolati per utente e profilo, ripresa senza creare audio', () => {
  const saved = new Map([['music-options:finto:bruno', { vibration: false, equalizer: { preset: 'bass' } }],
    ['music-options:finto:marta', { equalizer: { preset: 'voice' } }]]);
  const context = { state: { boot: { musicUser: 'finto' }, profile: 'bruno' }, musicFeedback: {},
    storage: { get: key => saved.get(key) || {} }, equalizerSettings, $: () => ({}), paintEqualizer() {} };
  context.feedbackKey = () => `music-options:${context.state.boot.musicUser}:${context.state.profile}`;
  let settings;
  context.playback = { setEqualizer: value => { settings = value; } };
  const restore = fn('restoreMusicFeedback', context);
  restore(); assert.equal(settings.preset, 'bass');
  context.state.profile = 'marta'; restore(); assert.equal(settings.preset, 'voice');
  context.state.boot.musicUser = 'altro'; restore(); assert.equal(settings.preset, 'normal');
  assert.equal(saved.get('music-options:finto:bruno').equalizer.preset, 'bass');
});
test('cambio brano conserva l’indice precedente fino al passaggio del motore', async () => {
  const calls = []; const context = { state: { queue: [{ id: 'a' }, { id: 'b' }], queueIndex: 0, boot: { music: true } }, playback: { setQueue: (q, i) => calls.push(['queue', i]), play: async i => calls.push(['play', i]) } };
  await fn('playSong', context)(1); assert.deepEqual(calls, [['queue', 0], ['play', 1]]);
});
test('nuova coda chiude l’ascolto precedente prima di sostituire i suoi metadati', () => {
  const state = { queue: [{ id: 'old' }], queueIndex: 0 }; let paused;
  fn('setQueue', { state, pauseMusic: () => { paused = state.queue[0].id; }, radioGeneration: 0, radio: null, heard: new Set(), $: () => ({}), playback: { setQueue() {} }, renderQueue() {}, playSong() {} })([{ id: 'new' }]);
  assert.equal(paused, 'old'); assert.equal(state.queue[0].id, 'new');
});
test('lista di 2000 brani crea una finestra piccola e rende accessibile l’ultimo', () => {
  const previous = globalThis.document;
  class Node {
    constructor() { this.children = []; this.style = {}; this.attrs = {}; this.handlers = {}; this.classList = { add() {}, contains: () => false }; this.scrollTop = 0; this.clientHeight = 608; }
    setAttribute(k, v) { this.attrs[k] = v; } append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; } contains() { return false; }
    addEventListener(k, fn) { this.handlers[k] = fn; }
  }
  try {
    globalThis.document = { createElement: () => new Node() };
    let count = 0; const list = windowedList(Array.from({ length: 2000 }, (_, i) => i), value => { count++; const n = new Node(); n.value = value; return n; });
    assert.ok(count < 25); assert.ok(list.children.length < 25);
    list.scrollTop = 2000 * 76 - 608; list.handlers.scroll();
    assert.ok(list.children.some(n => n.value === 1999)); assert.ok(list.children.length < 25);
  } finally { globalThis.document = previous; }
});
