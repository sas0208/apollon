// Telecomando sulle pagine (html.tv, nessuna finestra aperta): come le app da TV, non come un sito.
// - Le righe di titoli sono righe vere: su/giù cambia riga e torna dove eri, sinistra/destra scorre nella riga.
// - La barra in alto si raggiunge solo salendo dalla cima del contenuto, mai «di lato» mentre la pagina è a metà.
// - I tastini dentro le locandine («⋯», «i», frecce delle righe) non sono fermate: le opzioni si aprono tenendo premuto OK.
// - La pagina scorre per tenere in vista la riga attiva sotto la barra.
const SKIP = '.c-more,.t-more,.row-arrow,.bb-dot,.brand';
const CARD = '.c-open,.t-card';
const LINE = '.v-track,.bb-actions,.kind-head';
const ITEMS = 'button,a[href],input,select,summary,[tabindex="0"]';

export function createTvPageNav({ focusable, spatialTarget, reduce }) {
  const memory = new Map(); // riga (data-memory) → ultima locandina (data-fk)
  let lastContent = null;
  const all = (root, selector) => [...root.querySelectorAll(selector)];
  const header = () => document.querySelector('.topbar');
  const content = () => document.querySelector('#main');
  const usable = node => focusable(node) && !node.matches(SKIP);
  const headerItems = () => all(header(), ITEMS).filter(usable);
  const contentItems = () => all(content(), ITEMS).filter(node => usable(node) && !node.closest('.topbar'));
  const lineItems = line => all(line, line.matches('.v-track') ? CARD : ITEMS).filter(usable);
  const lines = () => all(content(), LINE).filter(line => !line.closest('[hidden]') && lineItems(line).length);
  const headerHeight = () => { const bar = header(); if (!bar) return 0; const style = getComputedStyle(bar); return style.position === 'fixed' || style.position === 'sticky' ? bar.getBoundingClientRect().height : 0; };

  function entryOf(line) {
    const items = lineItems(line);
    if (line.matches('.v-track')) {
      const fk = memory.get(line.dataset.memory);
      const kept = fk && items.find(node => node.dataset.fk === fk);
      if (kept) return kept;
      const box = line.getBoundingClientRect();
      return items.find(node => node.getBoundingClientRect().left >= box.left - 2) || items[0];
    }
    return items.find(node => node.getAttribute('aria-pressed') === 'true') || items[0];
  }

  function reveal(node, smooth = true) {
    if (!node || node.closest('.topbar,dialog')) return;
    const behavior = smooth && !reduce() ? 'smooth' : 'auto';
    const track = node.closest('.v-track');
    if (track) {
      const pad = 48; const box = track.getBoundingClientRect(); const card = node.getBoundingClientRect();
      let shift = 0;
      if (card.left < box.left + pad) shift = card.left - box.left - pad;
      else if (card.right > box.right - pad) shift = card.right - box.right + pad;
      if (shift) track.scrollTo({ left: Math.max(0, track.scrollLeft + shift), behavior });
    }
    const list = lines(); const line = node.closest(LINE);
    const top = headerHeight() + 24; const rect = node.getBoundingClientRect();
    let target = null;
    if (line && (list.indexOf(line) === 0 || line.closest('.billboard,.kind-head'))) target = 0;
    else if (line) { const block = line.closest('.v-row') || line; target = scrollY + block.getBoundingClientRect().top - top; }
    else if (rect.top < top) target = scrollY + rect.top - top;
    else if (rect.bottom > innerHeight - 40) target = scrollY + rect.bottom - innerHeight + 40;
    if (target !== null && Math.abs(target - scrollY) > 2) window.scrollTo({ top: Math.max(0, target), behavior });
  }

  function go(node) {
    if (!node) return false;
    node.focus({ preventScroll: true }); reveal(node); return true;
  }

  function remember(node) {
    if (!node || node.closest('.topbar,dialog')) return;
    lastContent = node;
    const track = node.closest('.v-track');
    if (track && node.matches(CARD) && node.dataset.fk) memory.set(track.dataset.memory, node.dataset.fk);
  }

  function toHeader() {
    const items = headerItems();
    return go(items.find(node => node.getAttribute('aria-pressed') === 'true') || items[0]);
  }

  // Ritorna true se ha gestito la freccia.
  function move(key, active, focusStart) {
    const vertical = key === 'ArrowUp' || key === 'ArrowDown';
    if (active?.closest('.topbar')) {
      if (key === 'ArrowUp') return true;
      if (key === 'ArrowDown') {
        if (lastContent?.isConnected && usable(lastContent)) return go(lastContent);
        focusStart(); return true;
      }
      return go(spatialTarget(active.getBoundingClientRect(), headerItems().filter(n => n !== active).map(n => ({ value: n, rect: n.getBoundingClientRect() })), key)) || true;
    }
    const line = active?.closest(LINE);
    if (line && lineItems(line).includes(active)) {
      if (!vertical) {
        const items = lineItems(line); const next = items[items.indexOf(active) + (key === 'ArrowRight' ? 1 : -1)];
        return go(next) || true;
      }
      const list = lines(); const at = list.indexOf(line);
      const next = list[at + (key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        // Fra due righe può esserci altro contenuto (per esempio un riquadro senza righe): lo si visita prima.
        const between = spatialAmong(active, key, node => !node.closest(LINE));
        if (between && isBefore(between, next.getBoundingClientRect(), key)) return go(between);
        return go(entryOf(next));
      }
      const other = spatialAmong(active, key, node => !line.contains(node));
      if (other) return go(other);
      return key === 'ArrowUp' ? toHeader() : true;
    }
    const target = spatialAmong(active, key, () => true);
    if (target) return go(target.closest(LINE)?.matches('.v-track') ? entryOf(target.closest(LINE)) : target);
    return key === 'ArrowUp' ? toHeader() : true;
  }

  function spatialAmong(active, key, accept) {
    const from = active.getBoundingClientRect();
    return spatialTarget(from, contentItems().filter(n => n !== active && accept(n)).map(n => ({ value: n, rect: n.getBoundingClientRect() })), key);
  }
  function isBefore(node, box, key) {
    const r = node.getBoundingClientRect();
    return key === 'ArrowDown' ? r.bottom <= box.top + 2 : r.top >= box.bottom - 2;
  }

  return { move, reveal, remember, entryOf };
}
