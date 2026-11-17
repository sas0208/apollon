import { quantity } from './logic.js';

// Fixed-height rows keep DOM size bounded with long playlists and queues.
export function windowedList(rows, render, { className = 'track-list', height = 76 } = {}) {
  const list = document.createElement('ol'); list.className = className;
  if (rows.length <= 60) { list.append(...rows.map(render)); return list; }
  list.classList.add('windowed-list'); list.tabIndex = 0; list.setAttribute('aria-label', `${quantity(rows.length, 'brano', 'brani')}, scorri per continuare`);
  let start = -1;
  function paint(force = false) {
    const from = Math.max(0, Math.floor(list.scrollTop / height) - 4);
    if (!force && from === start) return; start = from;
    const focused = document.activeElement;
    const focusedRow = list.contains(focused) ? focused.closest('[aria-posinset]') : null;
    const focusedPosition = focusedRow?.getAttribute('aria-posinset');
    const controls = 'button,a[href],input,select,textarea,[tabindex]';
    const focusedControl = focusedRow ? [...focusedRow.querySelectorAll(controls)].indexOf(focused) : -1;
    const count = Math.ceil((list.clientHeight || 600) / height) + 8; const end = Math.min(rows.length, start + count);
    const spacer = size => { const li = document.createElement('li'); li.style.height = `${size}px`; li.setAttribute('role', 'presentation'); return li; };
    list.replaceChildren(spacer(start * height), ...rows.slice(start, end).map((row, i) => { const node = render(row, start + i); node.style.height = `${height}px`; node.setAttribute('aria-posinset', start + i + 1); node.setAttribute('aria-setsize', rows.length); return node; }), spacer((rows.length - end) * height));
    if (focusedRow) (list.querySelector(`[aria-posinset="${focusedPosition}"]`)?.querySelectorAll(controls)[focusedControl] || list).focus({ preventScroll: true });
  }
  list.addEventListener('scroll', () => paint());
  list.addEventListener('keydown', event => {
    if (event.target.matches('input,select,textarea,[contenteditable=true]') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) return;
    const row = event.target.closest('[aria-posinset]'); if (!row) return;
    const current = Number(row.getAttribute('aria-posinset')) - 1;
    const step = Math.max(1, Math.floor(list.clientHeight / height));
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : current + ({ ArrowDown: 1, ArrowUp: -1, PageDown: step, PageUp: -step }[event.key]);
    const index = Math.max(0, Math.min(rows.length - 1, target));
    if (index < 0 || index >= rows.length) return;
    event.preventDefault(); event.stopPropagation(); list.scrollTop = index * height; paint(true);
    list.querySelector(`[aria-posinset="${index + 1}"] button`)?.focus({ preventScroll: true });
  });
  paint(); return list;
}
