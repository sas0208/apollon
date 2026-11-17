import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fixture } from './helpers.js';

const source = await readFile(new URL('../public/boot.js', import.meta.url), 'utf8');
function boot({ search = '', saved = false, reduced = false, blocked = false } = {}) {
  let now = 100000, next = 0; const timers = new Map(), classes = new Set(); let hidden = false;
  const root = { classList: { add: c => classes.add(c), remove: c => classes.delete(c) }, style: { setProperty() {} } };
  const overlay = { set hidden(v) { hidden = v; }, get hidden() { return hidden; }, classList: { add() {} } };
  const status = { textContent: '' }; const retry = { hidden: true, focus() { this.focused = true; }, addEventListener() {} };
  const document = { documentElement: root, getElementById: id => ({ 'apollon-intro': overlay, 'apollon-boot-status': status, 'apollon-boot-retry': retry })[id], addEventListener() {} };
  const data = new Map(saved ? [['apollon:intro', 'done']] : []);
  const context = vm.createContext({ document, URLSearchParams, Promise, Date: { now: () => now },
    location: { search, pathname: '/', hash: '#home', reload() {} }, history: { state: null, replaceState() {} },
    matchMedia: () => ({ matches: reduced }), sessionStorage: { getItem: k => { if (blocked) throw Error(); return data.get(k); }, setItem: (k, v) => { if (blocked) throw Error(); data.set(k, v); } },
    setTimeout: (fn, delay) => { timers.set(++next, { fn, at: now + delay }); return next; }, clearTimeout: id => timers.delete(id),
    requestAnimationFrame: fn => fn() });
  context.window = context;
  vm.runInContext(source, context);
  async function advance(ms) { now += ms; for (let i = 0; i < 5; i++) { for (const [id, t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } await Promise.resolve(); } }
  return { api: context.ApollonBoot, classes, overlay, retry, status, data, advance };
}
test('intro copre il caricamento e termina entro 2,4 s se il catalogo è pronto', async () => {
  const f = boot(); assert.ok(f.classes.has('booting'));
  let done = false; f.api.ready().then(() => { done = true; });
  await f.advance(1000); assert.equal(done, false); assert.equal(f.overlay.hidden, false);
  await f.advance(1100); await f.advance(240); assert.equal(done, true); assert.equal(f.overlay.hidden, true);
  assert.equal(f.data.get('apollon:intro'), 'done');
});
test('catalogo lento: nessuna scomparsa anticipata, recupero dopo timeout', async () => {
  const f = boot(); await f.advance(12500); assert.equal(f.overlay.hidden, false); assert.equal(f.retry.hidden, false); assert.equal(f.retry.focused, true);
  const ready = f.api.ready(); await f.advance(0); await f.advance(220); await ready; assert.equal(f.overlay.hidden, true);
});
test('timestamp del guscio non riavvia i 2 secondi e una sessione non ripete intro', async () => {
  const f = boot({ search: '?tv=1&apollonStart=97500&apollonLaunch=1' });
  const ready = f.api.ready(); await f.advance(0); await f.advance(240); await ready; assert.equal(f.overlay.hidden, true);
  const second = boot({ saved: true }); await second.api.ready(); assert.equal(second.classes.has('booting'), false);
  const other = boot({ search: '?apollonIntro=done' }); await other.api.ready(); assert.equal(other.classes.has('booting'), false);
});
test('movimento ridotto e storage vietato non impediscono apertura o recupero', async () => {
  const f = boot({ reduced: true, blocked: true }); await f.api.ready(); assert.equal(f.overlay.hidden, true);
});

test('il guscio locale può verificare la rete senza ricevere dati o cookie del catalogo', async t => {
  const f = await fixture(); t.after(() => f.close());
  const response = await f.request('/api/tv-ready', { headers: { Origin: 'null' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual(await response.json(), { ready: true });
  assert.equal(response.headers.get('set-cookie'), null);
});
