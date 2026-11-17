// Run the actual event callbacks with in-memory media/API stubs, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { quantity } from '../public/logic.js';
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function fn(name, context) {
  const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `Funzione ${name} presente`); return vm.runInNewContext(`(${match[0]})`, context);
}
function ended(context) {
  const match = source.match(/video\.addEventListener\('ended', action\((async \(\) => \{[^]*?\n\})\)\);/);
  assert.ok(match); return vm.runInNewContext(`(${match[1]})`, context);
}
test('ended non salta E2 se lo stato cambia mentre si salva E1', async () => {
  let release; const saving = new Promise(resolve => { release = resolve; });
  const state = { current: { item: { id: 'E1' } } }; const played = [];
  const handler = ended({ state, saveVideo: () => saving, renderCatalog() {}, nextEpisode: item => ({ id: item.id === 'E1' ? 'E2' : 'E3' }), $: () => ({ checked: true }), playItem: async item => played.push(item.id) });
  const pending = handler(); state.current = { item: { id: 'E2' } }; release(); await pending;
  assert.equal(played.length, 0);
});
test('ended durante un salto già avviato non lancia una seconda transizione', async () => {
  let saved = 0; let played = 0;
  const state = { current: { item: { id: 'E1' }, transitioning: true } };
  await ended({ state, saveVideo: async () => saved++, renderCatalog() {}, nextEpisode: () => ({ id: 'E2' }), $: () => ({ checked: true }), playItem: async () => played++ })();
  assert.equal(saved, 0); assert.equal(played, 0);
});
test('Prossimo episodio conserva visto e mette il focus sul video seguente', async () => {
  const first = { id: 'E1', duration: 100 }; const next = { id: 'E2', duration: 100 };
  const state = { current: { item: first, profile: 'bruno', ready: true, skipped: new Set() }, profile: 'bruno', progress: {} };
  const saves = []; let focused = 0;
  const video = { currentTime: 80, duration: 100, replaceChildren() {}, load() {}, focus() { focused++; }, async play() {} };
  const nodes = new Map(); const $ = key => { if (!nodes.has(key)) nodes.set(key, { hidden: false, close() {}, pause() {} }); return nodes.get(key); };
  const context = { state, video, $, quantity, navigator: { onLine: true }, dropPending() {}, downloadedIds: new Set(), playURL: id => `/media/${id}?dl=1`, chooseQuality: () => 'original', storage: { get: (key, fallback) => fallback }, connectionInfo: () => ({}), mediaUrl: item => `/media/${item.id}`, pauseMusic() {}, api: async (route, options) => { saves.push(options.data); return {}; }, syncVideoPreferences() {}, fmtSize: () => '', minutes: () => '', showDialog() {}, el() {}, updateVideoSkips() {}, nextEpisode: () => next };
  context.saveVideo = fn('saveVideo', context); context.videoPlayRequest = 0; context.playItem = fn('playItem', context);
  await fn('performSkip', context)({ kind: 'finale', next: true, target: 99 });
  assert.equal(saves.length, 1); assert.equal(saves[0].watched, true); assert.equal(state.current.item.id, 'E2'); assert.equal(focused, 1);
});
test('chiudere il player mentre si salva il salto non riapre il prossimo episodio', async () => {
  let release; const saving = new Promise(resolve => { release = resolve; }); let played = 0;
  const state = { current: { item: { id: 'E1' }, skipped: new Set() } };
  const context = { state, saveVideo: () => saving, nextEpisode: () => ({ id: 'E2' }), playItem: async () => played++ };
  const pending = fn('performSkip', context)({ kind: 'finale', next: true, target: 99 });
  state.current = null; release(); await pending; assert.equal(played, 0);
});
test('salvataggi ordinati: una pausa durante Prossimo episodio non toglie il visto', async () => {
  const current = { item: { id: 'E1' }, profile: 'bruno', ready: true };
  const state = { current, profile: 'bruno', progress: {} }; const sent = []; let release;
  const first = new Promise(resolve => { release = resolve; });
  const save = fn('saveVideo', { navigator: { onLine: true }, dropPending() {}, state, video: { currentTime: 80, duration: 100 }, api: async (route, { data }) => { sent.push(data); if (sent.length === 1) await first; return data; } });
  const regular = save(); current.transitioning = true; const watched = save(true); const pause = save();
  await new Promise(resolve => setImmediate(resolve)); assert.equal(sent.length, 1);
  release(); await Promise.all([regular, watched, pause]);
  assert.equal(sent.length, 2); assert.equal(sent.at(-1).watched, true);
});
