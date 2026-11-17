import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

test('testo: centratura ai due estremi e dopo resize senza gonfiare il riquadro', () => {
  let height = 640; let open = true;
  const properties = new Map();
  const style = { setProperty: (key, value) => properties.set(key, value) };
  // Model the padding floor of a border-box flex item. Scroll-content spacers
  // do not impose that floor; native CSS/hit testing is covered by Playwright.
  const inset = side => parseFloat(style[`padding${side}`] || properties.get('--lyric-padding') || 0);
  const box = { style, scrollTop: 0,
    get clientHeight() { return Math.max(height, (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0)); },
    getBoundingClientRect: () => ({ top: 100 }),
    scrollTo({ top, behavior }) {
      assert.equal(behavior, 'instant');
      this.scrollTop = Math.max(0, Math.min(top, inset('Top') + 600 + inset('Bottom') - this.clientHeight));
    }
  };
  box.children = Array.from({ length: 6 }, (_, i) => ({ clientHeight: 80,
    getBoundingClientRect: () => ({ top: 100 + inset('Top') + i * 100 - box.scrollTop }) }));
  const context = vm.createContext({ $: selector => selector === '#lyrics-lines' ? box : { open },
    matchMedia: () => ({ matches: true }) });
  vm.runInContext(source.slice(source.indexOf('function centerLyric('), source.indexOf('function updateLyrics(')), context);
  for (height of [640, 230, 460, 300]) {
    for (const index of [0, 3, 5, 0]) {
      context.centerLyric(index);
      assert.equal(box.clientHeight, height, 'il resize deve ridurre anche il riquadro del testo');
      const row = box.children[index].getBoundingClientRect();
      assert.equal(row.top + 40, 100 + height / 2, 'la riga deve restare centrata');
    }
  }
  const previous = box.scrollTop;
  open = false; context.centerLyric(5);
  assert.equal(box.scrollTop, previous);
  open = true; context.centerLyric(-1);
  assert.equal(box.scrollTop, previous);
  height = 0; context.centerLyric(5);
  assert.equal(box.scrollTop, previous);
});
