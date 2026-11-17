// Loaded only when opening La tua libreria. Preferences never leave this browser.
import { art, artistArt, lazyArt, sectionTop, shellIcon } from './music-shell.js';
export const entryKey = item => `${item.type}:${item.id}`;
export function pinEntry(pins, key) {
  if (pins.includes(key)) return pins.filter(p => p !== key);
  if (pins.length >= 4) throw new Error('Puoi fissare fino a 4 raccolte. Togli prima una puntina.');
  return [...pins, key];
}
export function libraryItems(items, { filter = '', sort = 'recent', pins = [], recent = {}, downloaded = [] } = {}) {
  const stamp = v => Number(v) || Date.parse(v) || 0;
  return items.filter(i => (!filter || (filter === 'downloaded' ? downloaded.includes(entryKey(i)) : i.type === filter)))
    .sort((a, b) => {
      const pa = pins.indexOf(entryKey(a)), pb = pins.indexOf(entryKey(b));
      if (pa >= 0 || pb >= 0) return pa < 0 ? 1 : pb < 0 ? -1 : pa - pb;
      const name = () => (a.name || '').localeCompare(b.name || '', 'it', { sensitivity: 'base', numeric: true });
      if (sort === 'alpha') return name();
      if (sort === 'author') return (a.artist || a.name || '').localeCompare(b.artist || b.name || '', 'it') || name();
      if (sort === 'added') return stamp(b.created) - stamp(a.created) || name();
      return stamp(recent[entryKey(b)]) - stamp(recent[entryKey(a)]) || stamp(b.last) - stamp(a.last) || name();
    });
}
let c;
export function init(context) { c = context; }
export function preferences() { return c.storage.get(`${c.key()}:library`, { pins: [], recent: {}, view: 'list', sort: 'recent', filter: '' }); }
function save(value) { c.storage.set(`${c.key()}:library`, value); }
export function markOpened(type, id) { const p = preferences(); p.recent ||= {}; p.recent[`${type}:${id}`] = Date.now(); save(p); }
const pin = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', 'M8 3h8l-1 7 4 4H5l4-4zM12 14v7'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '2'); svg.append(path); return svg;
};
export async function library(generation) {
  const { el, api, state, action } = c;
  const result = await api(`/api/music/library?profile=${encodeURIComponent(state.profile)}`);
  const offline = await c.offline(); const downloaded = await offline.manager.collections();
  if (generation !== state.musicGeneration) return;
  const p = preferences(); const root = document.querySelector('#music-results');
  const online = new Set(result.items.map(entryKey)), all = new Map(result.items.map(i => [entryKey(i), i]));
  for (const item of downloaded) if (!all.has(entryKey(item))) all.set(entryKey(item), item);
  let finding = false; let words = '';
  const kinds = { playlist: 'Playlist', album: 'Album', artist: 'Artista' };
  const cover = item => item.type === 'artist' ? artistArt(c, item.name, item.coverArt, 160)
    : item.type === 'playlist' && !item.coverArt ? lazyArt(c, art(el, c.image, { name: item.name, glyph: '♪' }), 'playlist', item.id)
      : art(el, c.image, { ids: [item.coverArt], name: item.name });
  const draw = () => {
    if (generation !== state.musicGeneration) return;
    const change = patch => { Object.assign(p, patch); save(p); draw(); };
    const chip = (id, name) => el('button', { class: 'secondary pill chip', 'aria-pressed': p.filter === id, onclick: () => change({ filter: p.filter === id ? '' : id }) }, name);
    const filters = el('div', { class: 'library-filters chips', role: 'group', 'aria-label': 'Filtra la tua musica' },
      p.filter ? el('button', { class: 'secondary pill chip chip-clear', 'aria-label': 'Tutto', title: 'Mostra tutto', onclick: () => change({ filter: '' }) }, shellIcon('close')) : null,
      chip('playlist', 'Playlist'), chip('album', 'Album'), chip('artist', 'Artisti'),
      el('button', { class: 'secondary pill chip', 'data-music': 'songs' }, 'Brani'), chip('downloaded', 'Scaricati'));
    const sort = el('select', { 'aria-label': 'Ordina la tua musica', onchange: e => change({ sort: e.target.value }) },
      ...[['recent', 'Recenti'], ['added', 'Aggiunti di recente'], ['alpha', 'Alfabetico'], ['author', 'Autore']].map(([id, name]) => el('option', { value: id }, name)));
    sort.value = p.sort;
    const downloads = downloaded.map(entryKey);
    const needle = words.trim().toLocaleLowerCase('it');
    const items = libraryItems([...all.values()], { ...p, downloaded: downloads })
      .filter(i => !needle || `${i.name} ${i.artist || ''}`.toLocaleLowerCase('it').includes(needle));
    const others = (state.boot.profiles || []).filter(o => o.id !== state.profile);
    const blend = others.length ? [el('section', { class: 'blend-entry' }, el('h3', {}, 'Miscela'),
      el('p', { class: 'muted' }, 'Una playlist di 30 brani che mescola i gusti di due persone di casa. Cambia da sola ogni giorno.'),
      el('div', { class: 'actions' }, ...others.map(o => el('button', { class: 'secondary pill', onclick: action(async () => (await import('./music-blend.js')).showBlend(c, o)) }, `Miscela con ${o.name}`))))] : [];
    const liked = art(el, c.image, { name: 'Brani che ti piacciono', glyph: '♥' }); liked.classList.add('liked-art');
    const songs = art(el, c.image, { name: 'Tutti i brani', glyph: '♫' });
    const row = (tab, cover, title, sub) => el('button', { class: 'library-row', 'data-music': tab, 'data-library-browse': tab }, cover,
      el('span', { class: 'library-copy' }, el('strong', {}, title), el('small', {}, sub)));
    const browse = el('div', { class: 'library-browse', role: 'group', 'aria-label': 'Sfoglia tutta la raccolta' },
      p.filter ? null : row('liked', liked, 'Brani che ti piacciono', 'Playlist · i tuoi preferiti'),
      p.filter ? null : row('songs', songs, `Tutti i brani${result.total ? ` · ${result.total.toLocaleString('it-IT')}` : ''}`, 'Tutta la musica di casa'),
      el('div', { class: 'library-links' }, ...[['recent', 'Ascoltati di recente'], ['top', 'Più ascoltati'], ['history', 'Cronologia'], ['albums', 'Tutti gli album'], ['artists', 'Tutti gli artisti'], ['playlists', 'Tutte le playlist']]
        .map(([tab, name]) => el('button', { class: 'secondary pill', 'data-music': tab }, name)),
        el('button', { class: 'secondary pill', 'data-music-downloads': '1', onclick: action(() => offline.showOffline(++state.musicGeneration)) }, 'Gestisci i download')));
    const find = el('input', { type: 'search', class: 'library-find', placeholder: 'Cerca nella tua libreria', 'aria-label': 'Cerca nella tua libreria', value: words,
      oninput: e => { words = e.target.value; const at = e.target.selectionStart; draw(); const again = root.querySelector('.library-find'); again?.focus(); again?.setSelectionRange(at, at); } });
    const tools = [
      el('button', { class: 'icon-button', 'aria-label': 'Cerca nella libreria', title: 'Cerca nella libreria', 'aria-pressed': finding,
        onclick: () => { finding = !finding; if (!finding) words = ''; draw(); if (finding) root.querySelector('.library-find')?.focus(); } }, shellIcon('search')),
      el('button', { class: 'icon-button', 'aria-label': 'Crea una playlist o una miscela', title: 'Crea', onclick: () => document.querySelector('#music-nav [data-section=create]')?.click() }, shellIcon('plus'))];
    root.replaceChildren(el('div', { class: 'library-page' }, sectionTop(c, 'La tua libreria', tools), filters, finding ? find : null,
      el('div', { class: 'library-toolbar' }, el('label', { class: 'library-sort' }, shellIcon('sort'), sort),
        el('div', { class: 'view-toggle', role: 'group', 'aria-label': 'Vista' }, ...[['list', 'Elenco'], ['grid', 'Griglia']].map(([id, name]) =>
          el('button', { class: 'icon-button', 'aria-label': name, title: name, 'aria-pressed': p.view === id, onclick: () => change({ view: id }) }, shellIcon(id))))),
      browse,
      el('div', { class: `library-items library-${p.view}` }, ...items.map(item => {
        const key = entryKey(item); const pinned = p.pins.includes(key);
        const sub = [kinds[item.type], item.type === 'playlist' ? `${item.songCount || 0} brani` : item.type === 'album' ? item.artist : '', downloads.includes(key) ? 'Scaricata ✓' : ''].filter(Boolean).join(' · ');
        return el('article', { class: `library-item${item.type === 'artist' ? ' library-artist' : ''}`, 'data-library-key': key },
          el('button', { class: 'library-open quiet', onclick: action(async () => { markOpened(item.type, item.id); if (online.has(key)) await c.open(item); else await offline.showCollection(item.type, item.id, ++state.musicGeneration); }) },
            cover(item), el('span', { class: 'library-copy' }, el('strong', {}, item.name), el('small', {}, pinned ? el('span', { class: 'pinned-mark', title: 'Fissata in alto' }, pin()) : null, sub))),
          el('button', { class: 'quiet pin-button', 'aria-label': `${pinned ? 'Togli puntina a' : 'Fissa in alto'} ${item.name}`, 'aria-pressed': pinned, onclick: action(() => { p.pins = pinEntry(p.pins, key); save(p); draw(); }) }, pin()));
      })),
      ...(!items.length ? [el('p', { class: 'muted' }, needle ? 'Nessuna raccolta con queste parole.' : 'Nessuna raccolta qui. Scegli un altro filtro.')] : []),
      ...blend));
  }; draw();
}
