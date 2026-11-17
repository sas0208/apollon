// Giro E: la forma da app di musica. Copertine, collage, intestazioni a sfumatura, scaffali e griglia rapida.
// Tutto è disegnato qui (forme SVG e colori calcolati): nessuna immagine, icona o testo presi da altre app.
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.4 15.4 20 20',
  library: 'M8 4h12v12M4 8h12v12H4z',
  plus: 'M12 5v14M5 12h14',
  devices: 'M3 6h10v12H3zM16 9h5v9h-5zM18.5 15h0M8 15h0',
  add: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v8M8 12h8',
  added: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12.5l2.7 2.7L16 9.8',
  shuffle: 'M4 7h3.5l9 10H20M4 17h3.5l2.6-2.9M13.9 9.9 16.5 7H20M18 5l2 2-2 2M18 15l2 2-2 2',
  download: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5v8M8.5 12.5 12 16l3.5-3.5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  back: 'M15 5l-7 7 7 7',
  queue: 'M4 6h16M4 12h10M4 18h10M17 14v6l4-3z',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2',
  blend: 'M9 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM15 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  note: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  play: 'M8 5.5v13l11-6.5z',
  sort: 'M4 7h16M7 12h10M10 17h4',
  grid: 'M5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5z',
  list: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  panel: 'M4 5h16v14H4zM14 5v14'
};
export function shellIcon(name, filled = false) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', `music-icon shell-icon icon-${name}`);
  const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', PATHS[name] || PATHS.note);
  const solid = filled || name === 'play';
  path.setAttribute('fill', solid ? 'currentColor' : 'none'); path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', name === 'more' ? '3.2' : '2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path); return svg;
}

// La policy della pagina vieta gli attributi style: le tinte passano dal CSSOM.
export function hued(node, property, value) { node.style.setProperty(property, String(value)); return node; }
export function nameHue(text) { let h = 7; for (const ch of String(text || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h % 230; }
export function initials(name) {
  const words = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return words.length ? (words[0][0] + (words.length > 1 ? words.at(-1)[0] : '')).toLocaleUpperCase('it') : '♪';
}
const unique = ids => [...new Set(ids.filter(id => typeof id === 'string' && id))];

// Copertina: una sola immagine, un collage 2×2 se ci sono almeno due copertine diverse,
// altrimenti una tessera colorata con le iniziali. Mai il simbolo della Mediateca.
export function art(el, image, { ids = [], name = '', round = false, glyph = '', size = 160 } = {}) {
  const box = hued(el('span', { class: `art${round ? ' round' : ''}`, 'aria-hidden': 'true' }), '--art-hue', nameHue(name));
  fillArt(el, box, image, unique(ids), { name, glyph, size });
  return box;
}
function fillArt(el, box, image, ids, { name, glyph, size }) {
  const generated = () => { box.classList.remove('collage'); box.classList.add('generated'); box.replaceChildren(el('span', { class: 'art-glyph' }, glyph || initials(name))); };
  if (!ids.length) { generated(); return; }
  box.classList.remove('generated'); box.classList.toggle('collage', ids.length >= 2);
  const cells = ids.length >= 2 ? [0, 1, 2, 3].map(i => ids[i % ids.length]) : [ids[0]];
  box.replaceChildren(...cells.map(id => el('img', { src: image(id, ids.length >= 2 ? 160 : size), alt: '', loading: 'lazy', decoding: 'async',
    onerror: event => { event.target.remove(); if (!box.querySelector('img')) generated(); } })));
}
export function setArt(el, box, image, ids, options = {}) { fillArt(el, box, image, unique(ids), { name: options.name || '', glyph: options.glyph || '', size: options.size || 160 }); }

// Le copertine di playlist, mood e generi arrivano dai brani: una richiesta alla volta, ricordate per un giorno.
const memo = new Map(); let line = Promise.resolve();
export function coverIds(c, type, name) {
  const id = `${type}:${name}`, scope = c.key(), storeKey = `${scope}:covers`, memoKey = `${scope}/${id}`;
  const saved = c.storage.get(storeKey, {}); const hit = saved && saved[id];
  if (hit && Date.now() - hit.at < 86400000 && Array.isArray(hit.ids)) return Promise.resolve(hit.ids);
  if (memo.has(memoKey)) return memo.get(memoKey);
  const job = line.then(async () => {
    const result = type === 'playlist' ? await c.api(`/api/music/playlist?id=${encodeURIComponent(name)}`)
      : await c.api(`/api/music/collection?type=${type}&name=${encodeURIComponent(name)}`);
    const songs = type === 'playlist' ? result.playlist?.entry || [] : result.songs || [];
    const ids = unique(songs.map(s => s.coverArt || s.albumId)).slice(0, 8);
    const all = c.storage.get(storeKey, {}) || {}; all[id] = { ids, at: Date.now() };
    c.storage.set(storeKey, Object.fromEntries(Object.entries(all).slice(-200)));
    return ids;
  });
  line = job.catch(() => {}); memo.set(memoKey, job);
  // Only pending work belongs here: the persistent cover cache owns the one-day TTL.
  job.then(() => memo.delete(memoKey), () => memo.delete(memoKey));
  return job;
}
export function lazyArt(c, box, type, name, options = {}) {
  coverIds(c, type, name).then(ids => { if (ids.length) setArt(c.el, box, c.image, options.shift ? [...ids.slice(options.shift), ...ids.slice(0, options.shift)] : ids, { name, ...options }); }).catch(() => {});
  return box;
}

// Colore medio della copertina: la base per la sfumatura delle intestazioni e per la scheda del mini-player.
const colors = new Map();
export function coverColor(img) {
  const src = img?.currentSrc || img?.src; if (!src) return Promise.resolve(null);
  if (colors.has(src)) return Promise.resolve(colors.get(src));
  return new Promise(resolve => {
    const read = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 12;
        const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0, 12, 12);
        const data = ctx.getImageData(0, 0, 12, 12).data; const rgb = [0, 0, 0];
        for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) rgb[k] += data[i + k];
        const value = rgb.map(v => Math.round(v / 144)); colors.set(src, value); resolve(value);
      } catch { resolve(null); }
    };
    if (img.complete && img.naturalWidth) read(); else { img.addEventListener('load', read, { once: true }); img.addEventListener('error', () => resolve(null), { once: true }); }
  });
}
// Tinta leggibile sotto il testo bianco: stessa tonalità, luminosità tenuta fra il 18% e il 34%.
export function deepen(rgb, light = .3) {
  const [r, g, b] = rgb.map(v => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0; const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return `hsl(${Math.round((h * 60 + 360) % 360)} ${Math.round(Math.min(s, .7) * 100)}% ${Math.round(Math.max(.18, Math.min(light, l)) * 100)}%)`;
}
export function tint(node, box, property = '--hero-color', light = .34) {
  const img = box?.querySelector('img');
  if (!img) { node.style.setProperty(property, `hsl(${box?.style.getPropertyValue('--art-hue') || 150} 40% ${Math.round(light * 100)}%)`); return; }
  coverColor(img).then(rgb => { if (rgb) node.style.setProperty(property, deepen(rgb, light)); });
}

// Intestazione grande: copertina al centro, titolo, descrizione, azioni a sinistra e il grande play verde a destra.
export function hero(el, { cover, title, kind = '', sub = '', tools = [], play, shuffle, extra = [] }) {
  const node = el('header', { class: 'music-hero' }, el('div', { class: 'hero-cover' }, cover),
    el('div', { class: 'hero-text' }, kind ? el('p', { class: 'hero-kind' }, kind) : null, el('h2', {}, title), sub ? el('p', { class: 'hero-sub' }, sub) : null),
    el('div', { class: 'hero-actions' }, el('div', { class: 'hero-tools' }, ...tools), el('div', { class: 'hero-play' }, shuffle || null, play || null)), ...extra);
  tint(node, cover); return node;
}
export function heroPlay(el, onclick, disabled = false, label = 'Ascolta tutto') {
  return el('button', { class: 'play-big', 'aria-label': label, title: label, disabled, onclick }, shellIcon('play'));
}
export function heroButton(el, icon, label, onclick, extra = {}) {
  return el('button', { class: 'hero-icon', 'aria-label': label, title: label, onclick, ...extra }, shellIcon(icon));
}

// Scaffale orizzontale con titolo; su PC diventa una griglia.
export function shelf(el, title, cards, { kind = 'all', note = '' } = {}) {
  if (!cards.length) return null;
  return el('section', { class: 'shelf', 'data-shelf': kind }, el('div', { class: 'shelf-head' }, el('h2', {}, title), note ? el('p', { class: 'muted' }, note) : null),
    el('div', { class: 'shelf-row' }, ...cards));
}
export function card(el, { cover, title, sub = '', label, onclick, round = false, data = {} }) {
  return el('button', { class: `shelf-card${round ? ' round-card' : ''}`, 'aria-label': label || title, onclick, ...data }, cover,
    el('strong', { class: 'shelf-title' }, title), sub ? el('small', { class: 'shelf-sub' }, sub) : null);
}

// Tessera della griglia rapida: tocco = apre, pulsante o tocco lungo = riproduce.
export function quickTile(el, { cover, title, open, play }) {
  let timer = 0, long = false;
  const opener = el('button', { class: 'quick-open', 'aria-label': `Vai a ${title}`,
    onpointerdown: event => { if (!play || event.button) return; long = false; clearTimeout(timer); timer = setTimeout(() => { long = true; play(); }, 550); },
    onpointerup: () => clearTimeout(timer), onpointerleave: () => clearTimeout(timer), onpointercancel: () => clearTimeout(timer),
    oncontextmenu: event => { if (play) event.preventDefault(); },
    onclick: event => { if (long) { long = false; event.preventDefault(); return; } open(); } }, cover, el('span', { class: 'quick-title' }, title));
  return el('div', { class: 'quick-tile' }, opener, play ? el('button', { class: 'quick-play', 'aria-label': `Riproduci ${title}`, title: 'Riproduci', onclick: play }, shellIcon('play')) : null);
}

// Pressione sulle schede: un leggero rimpicciolimento, anche senza mouse.
export function pressFeedback(root) {
  const selector = '.shelf-card,.quick-open,.mood-card,.library-open,.library-row,.side-row,.chip,#music-nav button,.sheet-item,.play-big';
  root.addEventListener('pointerdown', event => { const target = event.target.closest(selector); if (target) target.classList.add('pressed'); });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'dragstart']) root.addEventListener(type, () => root.querySelectorAll('.pressed').forEach(n => n.classList.remove('pressed')), true);
}

// Immagine locale scelta dal profilo; se il file non è disponibile torna l'iniziale.
export function profileVisual(el, profile) {
  const letter = () => el('span', { 'aria-hidden': 'true' }, initials(profile.name).slice(0, 1));
  if (!/^\/media\/avatar\/[a-f0-9]{24}\.jpg$/.test(profile.avatar || '')) return letter();
  const image = el('img', { class: 'profile-photo', src: profile.avatar, alt: '', decoding: 'async' });
  image.addEventListener('error', () => image.replaceWith(letter()), { once: true });
  return image;
}
// Avatar del profilo: un tocco apre la scelta di chi ascolta.
export function avatar(c) {
  const { el, state } = c; const me = (state.boot?.profiles || []).find(p => p.id === state.profile) || { name: state.profile || '?' };
  return hued(el('button', { class: 'avatar', 'aria-label': `Cambia profilo, ora ascolta ${me.name}`, title: 'Cambia profilo', onclick: () => profileSheet(c) },
    profileVisual(el, me)), '--avatar-hue', nameHue(me.name));
}
export function profileSheet(c) {
  const { el, state } = c; const select = document.querySelector('#profile');
  const sheet = el('dialog', { class: 'music-sheet profile-sheet', 'aria-labelledby': 'profile-sheet-title' },
    el('div', { class: 'dialog-heading' }, el('h2', { id: 'profile-sheet-title' }, 'Chi ascolta?'), el('button', { class: 'close-dialog icon-button', 'aria-label': 'Chiudi la scelta del profilo', onclick: () => sheet.close() }, '×')),
    el('div', { class: 'sheet-list' }, ...(state.boot?.profiles || []).map(p => el('button', { class: 'sheet-item', 'aria-pressed': p.id === state.profile, onclick: () => {
      sheet.close(); if (p.id === state.profile) return; select.value = p.id; select.dispatchEvent(new Event('change'));
    } }, hued(el('span', { class: 'avatar small', 'aria-hidden': 'true' }, profileVisual(el, p)), '--avatar-hue', nameHue(p.name)), el('span', { class: 'sheet-copy' }, el('strong', {}, p.name), el('small', {}, p.id === state.profile ? 'Sta ascoltando ora' : 'Passa a questo profilo')))),
    el('button', { class: 'sheet-item', onclick: () => { sheet.close(); document.querySelector('#add-profile').click(); } }, el('span', { class: 'sheet-mark' }, shellIcon('plus')), el('span', { class: 'sheet-copy' }, el('strong', {}, 'Nuovo profilo'), el('small', {}, 'Ognuno con la sua musica e i suoi preferiti')))));
  sheet.addEventListener('close', () => sheet.remove());
  document.body.append(sheet); c.showModal(sheet);
}
export function sectionTop(c, title, tools = []) {
  return c.el('div', { class: 'section-top' }, avatar(c), c.el('h2', {}, title), c.el('div', { class: 'section-tools' }, ...tools));
}
export function artistArt(c, name, coverArt, size = 160) {
  return art(c.el, c.image, { ids: /^ar-/.test(coverArt || '') ? [coverArt] : [], name, round: true, size });
}
