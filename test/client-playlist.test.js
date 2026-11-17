import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { windowedList } from '../public/virtual-list.js';
import { moveEntry } from '../public/music-logic.js';
import { playlistRecommendations } from '../public/music-recommendations.js';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

// Only DOM geometry/event delivery is simulated; rendering, recommendation loading,
// native drag handlers, arrows, dirty state and the save payload run production code.
async function playlistFixture(run, { downloadShift = 0 } = {}) {
  let scrollY = 0; let toolbarShift = 0;
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.handlers = {}; this.style = {}; this.hidden = false; this.disabled = false; this.classList = { add() {}, remove() {}, contains: name => (this.className || '').split(' ').includes(name) }; }
    setAttribute(k, v) { this.attrs[k] = v; if (k === 'class') this.className = v; if (k === 'disabled') this.disabled = true; }
    removeAttribute(k) { delete this.attrs[k]; }
    append(...children) {
      for (const n of children) {
        n.parent = this; this.children.push(n);
        if (this === nodes.get('#music-breadcrumb') && n.className === 'download-button') toolbarShift = downloadShift;
      }
    }
    replaceChildren(...nodes) { for (const n of this.children) n.parent = null; this.children = []; this.append(...nodes); }
    addEventListener(name, fn) { this.handlers[name] = fn; }
    get textContent() { return this.text ?? this.children.map(n => n.textContent).join(''); }
    set textContent(text) { this.text = text; }
    querySelector(selector) { return this.all(n => selector.startsWith('.') ? (n.className || '').split(' ').includes(selector.slice(1)) : n.tag === selector)[0]; }
    querySelectorAll(selector) { return this.all(n => n.tag === selector); } getAttribute(k) { return this.attrs[k]; } focus() {}
    all(match) { return this.children.flatMap(n => [...(match(n) ? [n] : []), ...n.all(match)]); }
    getBoundingClientRect() {
      const listTop = 750 + toolbarShift - scrollY; // B's wrapped tabs/toolbars, at 1440 x 1000.
      if (this === nodes.get('#audio-bar')) return { top: 908, bottom: 1000, height: 92 };
      if (this.tag === 'ol') return { top: listTop, bottom: listTop + this.children.length * 76 };
      if (this.className === 'track-row') {
        const top = listTop + this.parent.children.indexOf(this) * 76;
        return { top, bottom: top + 76, height: 76 };
      }
      return { top: 0, bottom: 0 };
    }
    dispatch(type, event = {}) {
      event.preventDefault ||= () => {};
      event.currentTarget = this;
      const result = this.handlers[type]?.(event);
      if (type.startsWith('drag') || type === 'drop') this.parent?.dispatch(type, event);
      return result;
    }
  }
  const nodes = new Map(['#music-results', '#music-breadcrumb', '#more-albums', '#audio-bar'].map(id => [id, new Element('div')]));
  const document = { createElement: tag => new Element(tag), createTextNode: text => Object.assign(new Element('#text'), { text }), querySelector: s => nodes.get(s) };
  const entries = [{ id: 'a', title: 'Luce di casa' }, { id: 'b', title: 'Dopo la pioggia' }, { id: 'c', title: 'L’ultima finestra' }];
  const writes = [];
  let respond, requested;
  const pending = new Promise(resolve => { respond = resolve; });
  const recommendationsStarted = new Promise(resolve => { requested = resolve; });
  const context = vm.createContext({ document, Node: Element, window: { innerHeight: 1000, scrollBy: ({ top }) => { scrollY += top; } },
    state: { musicGeneration: 0 }, navigator: { onLine: true }, windowedList, moveEntry,
    $: selector => nodes.get(selector), musicContext: () => context,
    api: async (url, options) => {
      if (url === '/api/music/playlist' && options?.method === 'PUT') { writes.push(JSON.parse(JSON.stringify(options.data))); return {}; }
      if (url === '/api/music/playlist?id=p') return { playlist: { id: 'p', name: 'Prova', entry: entries } };
      if (url === '/api/music/recommendations') { requested(); return pending; }
      throw Error(`Richiesta inattesa: ${url}`);
    },
    musicLibrary: async () => ({ markOpened() {} }),
    musicOffline: async () => ({ downloadButton: () => Object.assign(new Element('button'), { className: 'download-button' }) }),
    musicPageUpdate: async (_, render) => render(),
    loadModule: async name => { assert.equal(name, './music-recommendations.js'); return { playlistRecommendations }; },
    likedIds: new Set(), musicImage: () => '/icon.svg', fmtTime: () => '0:12', songIndicator: () => new Element('span'), musicIcon: () => new Element('svg'), notify() {},
    // Giro E: intestazione grande e percorso; qui contano solo i pulsanti che contiene.
    hero: (_, { tools = [], shuffle, play, extra = [] }) => { const node = new Element('header'); node.append(...[...tools, shuffle, play, ...extra].filter(Boolean)); return node; },
    heroPlay: () => new Element('button'), heroButton: () => new Element('button'), art: () => new Element('span'),
    musicVisit() {}, musicTitle() {}, collectionMenu() {}, quantity: (n, one, many) => `${n} ${n === 1 ? one : many}`, addToQueue() {}, setQueue() {}, shuffleSongs() {}, ask: async () => '', loadMusic: async () => {}
  });
  for (const name of ['el', 'action', 'trackList', 'revealMusicTracks', 'openPlaylist']) {
    const match = source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`));
    if (match) vm.runInContext(match[0].replaceAll('import(', 'loadModule('), context);
  }
  const previous = globalThis.document; globalThis.document = document;
  try {
    const opened = context.openPlaylist('p');
    await recommendationsStarted;
    const root = nodes.get('#music-results');
    const rows = () => root.all(n => n.className === 'track-row');
    const originalRows = rows();
    const finishRecommendations = async () => { respond({ songs: [] }); await opened; };
    const save = () => nodes.get('#music-breadcrumb').all(n => n.tag === 'button').find(n => n.textContent === 'Salva ordine e brani');
    const drag = (from, to) => {
      const data = new Map(); const dataTransfer = { setData: (k, v) => data.set(k, v), getData: k => data.get(k) || '' };
      const before = rows(); before[from].dispatch('dragstart', { dataTransfer });
      const rect = before[to].getBoundingClientRect(), y = (rect.top + rect.bottom) / 2;
      // A fixed player wins native hit testing even when the row is in the viewport.
      const hit = y >= 908 ? nodes.get('#audio-bar') : before[to];
      hit.dispatch('dragover', { dataTransfer }); hit.dispatch('drop', { dataTransfer });
    };
    await run({ rows, originalRows, finishRecommendations, save, drag, writes });
  } finally { respond({ songs: [] }); globalThis.document = previous; }
}

test('playlist B: il rilascio sull’ultima riga raggiunge la lista sopra il mini-player', async () => {
  for (const downloadShift of [0, 56]) {
  await playlistFixture(async ({ rows, originalRows, finishRecommendations, save, drag, writes }) => {
    assert.equal(save().disabled, true);
    drag(0, 2); // Before the asynchronous recommendation response, as in drag_to.
    assert.equal(rows()[2].querySelector('strong').textContent, 'Luce di casa');
    assert.equal(save().disabled, false);
    const reordered = rows();
    await finishRecommendations();
    assert.ok(rows().every((row, i) => row === reordered[i]), 'i consigli non sostituiscono le righe');
    assert.notEqual(rows()[0], originalRows[0]);
    await save().dispatch('click');
    assert.deepEqual(writes, [{ id: 'p', name: 'Prova', songs: ['b', 'c', 'a'] }]);
    assert.equal(save().disabled, true);
  }, { downloadShift });
  }
});

test('playlist B: frecce e salvataggio restano attivi dopo il caricamento dei consigli', async () => {
  await playlistFixture(async ({ rows, originalRows, finishRecommendations, save, drag, writes }) => {
    await finishRecommendations();
    assert.ok(rows().every((row, i) => row === originalRows[i]));
    const arrow = label => rows().flatMap(row => row.children).find(n => n.attrs['aria-label'] === label);
    assert.equal(arrow('Sposta su Luce di casa').disabled, true);
    assert.equal(arrow('Sposta giù L’ultima finestra').disabled, true);
    arrow('Sposta giù Luce di casa').dispatch('click');
    assert.deepEqual(rows().map(row => row.querySelector('strong').textContent), ['Dopo la pioggia', 'Luce di casa', 'L’ultima finestra']);
    arrow('Sposta su L’ultima finestra').dispatch('click');
    assert.equal(save().disabled, false);
    await save().dispatch('click');
    assert.deepEqual(writes[0], { id: 'p', name: 'Prova', songs: ['b', 'c', 'a'] });
    assert.equal(save().disabled, true);
    drag(2, 0);
    assert.equal(rows()[0].querySelector('strong').textContent, 'Luce di casa');
    await save().dispatch('click');
    assert.deepEqual(writes[1].songs, ['a', 'b', 'c']);
  });
});

test('playlist: apertura rispetta altezza reale del player, viewport e liste lunghe', () => {
  const match = source.match(/function revealMusicTracks\([^]*?\n\}/);
  assert.ok(match);
  for (const [rect, viewport, hidden, barTop, expected] of [
    [{ top: 750, bottom: 978 }, 1000, false, 908, 86],
    [{ top: 750, bottom: 978 }, 1000, true, 908, 0],
    [{ top: 500, bottom: 728 }, 844, false, 690, 54],
    [{ top: 200, bottom: 428 }, 1000, false, 908, 0],
    [{ top: 750, bottom: 5310 }, 1000, false, 908, 750],
    [{ top: 500, bottom: 978 }, 900, false, 1000, 94],
    [{ top: -100, bottom: 4460 }, 1000, false, 908, 0]
  ]) {
    let scrolled = 0;
    const bar = { hidden, getBoundingClientRect: () => ({ top: barTop }) };
    const root = { querySelector: () => ({ getBoundingClientRect: () => rect }) };
    const reveal = vm.runInNewContext(`(${match[0]})`, {
      $: selector => selector === '#audio-bar' ? bar : root,
      window: { innerHeight: viewport, scrollBy: ({ top, behavior }) => { assert.equal(behavior, 'instant'); scrolled += top; } }
    });
    reveal(); assert.equal(scrolled, expected);
  }
});
