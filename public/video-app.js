// Giro F: la parte video come un servizio di streaming. «Chi guarda?», Home con titolo in evidenza e righe,
// scheda del titolo, Novità, Cerca, La mia lista, anteprima al passaggio del mouse (PC) e livelli chiusi con «Indietro».
// La logica senza DOM è in video-logic.js; qui solo il disegno. Le tinte passano dal CSSOM (la policy vieta style="").
import { buildTitles, buildRows, featuredTitle, resumePoint, playLabel, metaParts, kindLabel, episodeCode, durationText, remainingText,
  similarTitles, genreCounts, novitaGroups, searchTitles, sortList, newEpisodeTitles, featuredTitles, shortPlayLabel, shortKind, genreLine, detailLine, aboutInfo } from './video-logic.js';
import { quantity } from './logic.js';
import { hued, nameHue, initials, profileVisual } from './music-shell.js';

export const VIDEO_PAGES = ['home', 'film', 'series', 'anime', 'novita', 'cerca', 'lista', 'scaricati', 'esplora', 'account'];
const KIND_PAGES = ['home', 'film', 'series', 'anime'];
const PAGE_NAMES = { home: 'Home', film: 'Film', series: 'Serie TV', anime: 'Anime' };
const WHO_KEY = 'mediateca:chi-guarda';
const SVG = 'http://www.w3.org/2000/svg';
const ICONS = {
  home: 'M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z',
  new: 'M4 6h16v12H4zM10 9.3v5.4l4.6-2.7z',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.4 15.4 20 20',
  mylist: 'M6 4h12v16l-6-4-6 4z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  info: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5.5M12 7.6h.01',
  play: 'M7.5 4.8v14.4L19.5 12z',
  pause: 'M7 5h3.6v14H7zM13.4 5H17v14h-3.6z',
  close: 'M6 6l12 12M18 6 6 18',
  down: 'M6 9.5l6 6 6-6',
  save: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  back10: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.8v3.4h3.4',
  fwd10: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.8v3.4h-3.4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  morev: 'M12 5h.01M12 12h.01M12 19h.01',
  sortlines: 'M4 7h16M4 12h11M4 17h6',
  star: 'M12 3.4l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.2l-5.4 3 1.1-6.1-4.5-4.3 6.1-.8z',
  starfill: 'M12 3.4l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.2l-5.4 3 1.1-6.1-4.5-4.3 6.1-.8z',
  markon: 'M6 4h12v16l-6-4-6 4z',
  share: 'M18 8.2a3 3 0 1 0 0-6.2 3 3 0 0 0 0 6.2zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6.2 3 3 0 0 0 0 6.2zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  sort: 'M7 4v16M7 20l-3.2-3.4M7 20l3.2-3.4M17 20V4M17 4l-3.2 3.4M17 4l3.2 3.4',
  jump: 'M4 12h13M12 6l6 6-6 6',
  episodes: 'M3 8h14v11H3zM7 5h14v11',
  subtitles: 'M3 5h18v14H3zM6.5 12.5h4M13 12.5h4.5M6.5 15.5h7',
  speed: 'M4.2 16.5A8.5 8.5 0 1 1 19.8 16.5M12 13.5l4.2-4.7M12 13.5h.01',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  lock: 'M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  edit: 'M4 20h4.2L19 9.2 14.8 5 4 15.8zM13.2 6.6l4.2 4.2',
  tv: 'M3 5h18v12H3zM8.5 21h7',
  gear: 'M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z',
  key: 'M8 11.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM10.5 13L20 3.5M17 6.5l3 3M14.5 9.5l2.5 2.5',
  manage: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  help: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6M12 16.6h.01',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2',
  grid: 'M5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5z',
  music: 'M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z'
};
export function vIcon(name) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', `v-icon v-icon-${name}`);
  const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', ICONS[name] || ICONS.info);
  const solid = name === 'play' || name === 'pause' || name === 'markon' || name === 'starfill';
  path.setAttribute('fill', solid ? 'currentColor' : 'none'); path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', name.startsWith('more') ? '3.4' : '2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  if (name === 'back10' || name === 'fwd10') {
    const text = document.createElementNS(SVG, 'text');
    for (const [k, v] of [['x', '12'], ['y', '15.2'], ['text-anchor', 'middle'], ['font-size', '7'], ['font-weight', '700'], ['fill', 'currentColor'], ['stroke', 'none']]) text.setAttribute(k, v);
    text.textContent = '10'; svg.append(text);
  }
  return svg;
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const pct = share => `${(clamp(share, 0, 1) * 100).toFixed(1)}%`;

export function createVideoApp(c) {
  const { el, $, state, api, action, notify, storage } = c;
  const fill = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));
  let titles = []; let list = []; let listFor = null; let listLoading = null;
  const rowScroll = new Map(); const pageScroll = new Map();
  let shown = ''; let lastY = 0; let search = ''; let listOrder = storage.get('list-order', 'aggiunti');
  let open = { key: null, season: null }; let whoEditing = false;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTv = () => document.documentElement.classList.contains('tv');
  const wide = () => matchMedia('(min-width: 900px)').matches;
  const profileOf = id => (state.boot?.profiles || []).find(p => p.id === id) || { id, name: id || '?' };

  // Immagini: preparate dal server in più misure; compaiono con una dissolvenza quando arrivano.
  const ver = item => item?.images?.v || 0;
  const posterSrc = (item, size = 260) => item?.images?.poster ? `/media/${item.id}/poster?s=${size}&v=${ver(item)}` : '';
  // Il titolo scritto sopra la locandina serve solo se l'immagine non ha già il suo testo: un fotogramma o un disegno di ripiego (o origine ancora ignota).
  const backdropSrc = (item, size = 640) => item?.images?.backdrop ? `/media/${item.id}/backdrop?s=${size}&v=${ver(item)}` : '';
  const thumbSrc = item => item?.images?.thumb ? `/media/${item.id}/thumb?v=${ver(item)}` : backdropSrc(item, 640);
  function picture(src, cls = '', eager = false) {
    if (!src) return null;
    const node = el('img', { class: `v-img ${cls}`.trim(), src, alt: '', loading: eager ? 'eager' : 'lazy', decoding: 'async' });
    const done = () => node.classList.add('loaded');
    if (node.complete && node.naturalWidth) done();
    else { node.addEventListener('load', done, { once: true }); node.addEventListener('error', () => node.remove(), { once: true }); }
    return node;
  }
  // Il titolo grande: se il titolo ha un logo (PNG trasparente, art.images.logo) si mostra quello, altrimenti il testo in grassetto.
  const logoSrc = item => item?.images?.logo ? `/media/${item.id}/logo?v=${item.images.lv || ver(item)}` : '';
  // Logo piccolo (320 px) sopra la locandina nelle schede del telefono, come nell'app ufficiale; non per le locandine che hanno già il titolo disegnato.
  const cardLogo = item => item?.images?.logo && !item.images.posterTitle && !wide() ? `/media/${item.id}/logo?s=320&v=${item.images.lv || ver(item)}` : '';
  function titleHeading(t, level, cls, id) {
    const text = el('span', { class: 't-text' }, t.title); const heading = el(level, { class: cls, id }, text); const src = logoSrc(t.art);
    if (src) {
      const img = el('img', { class: 'v-logo', src, alt: t.title, decoding: 'async' });
      img.addEventListener('error', () => { img.remove(); text.hidden = false; }, { once: true }); text.hidden = true; heading.prepend(img);
    }
    return heading;
  }
  const tinted = (node, name) => hued(node, '--hue', nameHue(name));
  const bar = share => hued(el('span', { class: 'c-bar', 'aria-hidden': 'true' }, el('i')), '--p', pct(share));

  // La mia lista e i visti.
  const listed = key => list.some(entry => entry.key === key);
  async function loadList() {
    const profile = state.profile; if (!profile) { list = []; listFor = ''; return; }
    const result = await api(`/api/mylist?profile=${encodeURIComponent(profile)}`);
    if (profile === state.profile) { list = result.items || []; listFor = profile; }
  }
  async function toggleList(t) {
    const profile = state.profile; const on = !listed(t.key);
    const result = await api('/api/mylist', { method: 'PUT', data: { profile, key: t.key, on } });
    if (profile !== state.profile) return;
    list = result.items || [];
    notify(on ? `${t.title} è nella tua lista.` : `${t.title} tolto dalla tua lista.`); render();
  }
  // «Segna visto»: l'interfaccia cambia subito (spunta, barra, Continua), una sola richiesta per tutti gli episodi,
  // e se il server dice di no si torna com'era con un messaggio chiaro. Un secondo tocco mentre sta salvando non fa niente.
  let marking = false;
  async function saveWatched(items, watched) {
    const profile = state.profile; const progress = state.progress;
    const ids = items.map(i => i.id); const before = new Map(ids.map(id => [id, state.progress[id]]));
    state.progressVersion = (state.progressVersion || 0) + 1;
    for (const id of ids) state.progress[id] = { ...state.progress[id], watched, ...(watched ? {} : { position: 0 }), updated: Date.now() };
    render();
    try {
      const saved = await api('/api/progress/batch', { method: 'PUT', data: { ids, profile, watched, ...(watched ? {} : { position: 0 }) } });
      if (profile !== state.profile || progress !== state.progress) return;
      for (const id of ids) state.progress[id] = saved[id];
      state.progressVersion++;
    } catch (error) {
      if (profile !== state.profile || progress !== state.progress) throw error;
      for (const [id, value] of before) { if (value) state.progress[id] = value; else delete state.progress[id]; }
      render(); throw error;
    }
  }
  async function markMany(items, watched, message) {
    if (marking) return; marking = true;
    try { await saveWatched(items, watched); notify(message); } finally { marking = false; }
    render();
  }
  const markOne = (item, watched) => markMany([item], watched, watched ? 'Segnato come visto.' : 'Tolto dai visti.');
  const toggleWatched = t => { const watched = !t.watched; return markMany(t.episodes || [t.item], watched, watched ? `${t.title}: tutto segnato come visto.` : `${t.title}: tolto dai visti.`); };
  async function hideContinue(entry) {
    const profile = state.profile; const progress = state.progress;
    const saved = await api('/api/progress', { method: 'PUT', data: { id: entry.hideId, profile, hidden: true } });
    if (profile !== state.profile || progress !== state.progress) return;
    state.progress[entry.hideId] = saved;
    notify(`${entry.title.title} tolto da Continua a guardare.`); render();
  }

  // Pezzi comuni: riga dati, pulsanti.
  function metaLine(t) {
    return el('p', { class: 'v-meta' }, ...metaParts(t).map(part => el('span', { class: 'v-meta-part' }, part)), ...t.badges.map(b => el('span', { class: 'v-badge' }, b)));
  }
  function playButton(t, point, { big = false, named = false, detail = '', share = 0, label: given = '' } = {}) {
    const label = given || playLabel(t, point);
    return el('button', { class: `v-play${big ? ' big' : ''}`, 'aria-label': named ? `${label}: ${t.title}` : undefined, onclick: action(() => { hideHover(); return c.playItem(point.item); }) },
      vIcon('play'), el('span', { class: 'v-play-text' }, el('span', {}, label), detail ? el('small', {}, detail) : null),
      share > 0.01 ? hued(el('span', { class: 'v-play-bar', 'aria-hidden': 'true' }, el('i')), '--p', pct(share)) : null);
  }
  function listButton(t, named = false) {
    const on = listed(t.key);
    return el('button', { class: 'v-second v-list', 'aria-pressed': on, 'aria-label': named ? `La mia lista: ${t.title}` : undefined, onclick: action(() => toggleList(t)) }, vIcon(on ? 'check' : 'plus'), el('span', {}, 'La mia lista'));
  }
  // Voti a stelle: ogni profilo dà da 1 a 5 stelle a un titolo ogni tocco è un voto nuovo che si somma ai precedenti; la media e il conteggio sono di tutti i voti di tutti i profili.
  const ratingCache = new Map(); const ratingBusy = new Set();
  const ratingKey = t => `${state.profile}|${t.key}`;
  const decimal = n => String(n).replace('.', ',');
  const countText = n => n > 999 ? `${decimal((n / 1000).toFixed(1).replace(/[.]0$/, ''))}K` : String(n);
  function ratingOf(t) {
    const key = ratingKey(t); if (ratingCache.has(key)) return ratingCache.get(key);
    if (!state.offline && state.profile && !ratingBusy.has(key)) {
      ratingBusy.add(key);
      api(`/api/ratings?key=${encodeURIComponent(t.key)}&profile=${encodeURIComponent(state.profile)}`).then(r => { ratingCache.set(key, r); }, () => { ratingCache.set(key, null); })
        .finally(() => { ratingBusy.delete(key); if (ratingKey(t) === key && $('#title-dialog').open && open.key === t.key) paintTitle(); });
    }
    return null;
  }
  async function vote(t, n) {
    ratingCache.set(ratingKey(t), await api('/api/ratings', { method: 'PUT', data: { profile: state.profile, key: t.key, value: n } }));
    open.pulse = true; paintTitle(); open.pulse = false; // le stelle pulsano una volta, nessun altro testo
  }
  function ratingBlock(t) {
    const r = ratingOf(t); if (!r) return null;
    const half = t.score ? Math.round(t.score / 2 * 10) / 10 : null; const level = r.count ? r.average : half; // senza voti: il voto AniList (su 10) diviso 2
    const shown = r.mine || Math.round(level || 0);
    const stars = el('div', { class: `tp-stars${r.mine ? ' mine' : ''}${open.pulse ? ' pulse' : ''}`, role: 'group', 'aria-label': 'Il tuo voto' }, ...[1, 2, 3, 4, 5].map(n =>
      el('button', { class: 'tp-star', 'aria-label': `${n} ${n === 1 ? 'stella' : 'stelle'}`, 'aria-pressed': String(r.mine === n), onclick: action(() => vote(t, n)) }, vIcon(n <= shown ? 'starfill' : 'star'))));
    const label = level ? ['Valutazione media: ', el('b', {}, decimal(Number(level).toFixed(1))), r.count ? ` (${countText(r.count)})` : ''] : ['Nessun voto'];
    const text = r.count
      ? el('button', { class: 'tp-rate-text', 'aria-expanded': String(!!open.ratingOpen), 'aria-label': 'Come hanno votato', onclick: () => { open.ratingOpen = !open.ratingOpen; paintTitle(); } },
        ...label, ' ', el('span', { class: 'tp-tri', 'aria-hidden': 'true' }, '▾'))
      : el('span', { class: 'tp-rate-text' }, ...label);
    const panel = r.count && open.ratingOpen ? el('div', { class: 'tp-dist', role: 'group', 'aria-label': 'Voti per stella' },
      ...[5, 4, 3, 2, 1].map(n => el('div', { class: `tp-dist-row${r.mine === n ? ' mine' : ''}` }, el('span', { class: 'tp-dist-n' }, String(n), vIcon('starfill')),
        hued(el('span', { class: 'tp-dist-bar', 'aria-hidden': 'true' }, el('i')), '--p', pct(r.counts[n - 1] / r.count)), el('span', { class: 'tp-dist-c' }, String(r.counts[n - 1])))),
      r.mine ? el('p', { class: 'tp-mine' }, `Il tuo ultimo voto: ${r.mine} ${r.mine === 1 ? 'stella' : 'stelle'}.`) : null,
      t.score ? el('p', { class: 'tp-score' }, `Su AniList: ${decimal(t.score.toFixed(1))}/10`) : null) : null;
    return el('div', { class: 'tp-rating' }, el('div', { class: 'tp-rate-row' }, stars, text), panel);
  }
  // Telefono: pulsante rotondo col segnalibro, per «La mia lista».
  function bookmarkButton(t) {
    const on = listed(t.key);
    return el('button', { class: 'v-bookmark', 'aria-pressed': on, 'aria-label': on ? `Togli ${t.title} dalla mia lista` : `Aggiungi ${t.title} alla mia lista`, onclick: action(() => toggleList(t)) }, vIcon(on ? 'markon' : 'mylist'));
  }
  // «Condividi»: il foglio di condivisione del telefono; se manca, si copia il link.
  async function shareTitle(t) {
    const url = location.origin + '/';
    if (navigator.share) { try { await navigator.share({ title: t.title, text: `${t.title} su Apollon`, url }); } catch (error) { if (error?.name !== 'AbortError') notify('Non riesco a condividere: riprova.', true); } return; }
    try { await navigator.clipboard.writeText(url); notify('Link copiato.'); } catch { notify(`Copia questo link: ${url}`); }
  }
  function watchedButton(t) {
    return el('button', { class: 'v-second v-seen', 'aria-pressed': t.watched, onclick: action(() => toggleWatched(t)) }, vIcon('check'), el('span', {}, t.watched ? 'Visto' : 'Segna visto'));
  }
  // Salti e versioni leggere: quello che il server sta preparando, aggiornato mentre la scheda è aperta.
  let skipInfo = { series: {} }; let lightInfo = { count: 0, queued: 0, working: null }; let infoTimer = 0; let lightBusy = false;
  const skipRow = t => (t.kind === 'anime' && t.episodes ? skipInfo.series?.[`${t.root}/${t.title}`] : null) || null;
  async function refreshInfo() {
    clearTimeout(infoTimer);
    await Promise.all([api('/api/skips').then(v => { skipInfo = v; }), api('/api/versions').then(v => { lightInfo = v; })]).catch(() => {});
    const busy = !!(lightInfo.working || lightInfo.queued); const finished = lightBusy && !busy; lightBusy = busy;
    if (finished) await c.reloadLibrary().catch(() => {});
    const t = titles.find(x => x.key === open.key);
    if ($('#title-dialog').open) {
      paintTitle();
      if (busy || skipRow(t || {})?.preparing) infoTimer = setTimeout(refreshInfo, 3000);
    }
  }
  // Una riga semplice: i salti sono pronti, si stanno preparando, oppure non ci sono.
  function skipLine(t) {
    const row = skipRow(t); if (!row) return null;
    const text = row.preparing ? `Sto preparando i salti (${row.ready} di ${row.total})`
      : row.ready >= row.total ? `Salti pronti per ${quantity(row.total, 'episodio', 'episodi')}`
        : row.ready > 0 ? `Salti pronti per ${row.ready} episodi su ${row.total}`
          : row.total === 1 ? 'Salti non disponibili per questo episodio' : 'I salti si preparano da soli, non sono ancora pronti';
    const check = row.review > 0 ? el('button', { class: 'tp-skips-check', title: 'Sigla o finale fuori dal solito: da riguardare in Gestisci', onclick: () => {
      const flagged = $('#title-content .ep.flagged'); if (flagged) { flagged.scrollIntoView({ block: 'center', behavior: reduce() ? 'auto' : 'smooth' }); flagged.classList.add('ping'); setTimeout(() => flagged.classList.remove('ping'), 1400); } } },
    quantity(row.review, 'episodio da controllare', 'episodi da controllare')) : null;
    return el('p', { class: `tp-skips${row.preparing ? ' busy' : ''}`, role: 'status' }, el('span', { class: 'tp-skips-dot', 'aria-hidden': 'true' }), el('span', { class: 'tp-skips-text' }, text), check);
  }
  function lightButton(t) {
    const items = t.episodes || [t.item]; const ready = items.every(i => i.light);
    const working = !ready && !!(items.some(i => (lightInfo.workingIds || [lightInfo.working]).includes(i.id)) || (lightInfo.queued && lightBusy && items.some(i => !i.light) && lightMine));
    const failed = !ready && !working && items.some(i => (lightInfo.failed || []).includes(i.id));
    const label = ready ? 'Versione leggera pronta' : working ? 'Preparo la versione leggera…' : failed ? 'Non è riuscita: riprova' : 'Prepara versione leggera';
    const short = ready ? 'Leggera pronta' : working ? 'Preparo…' : failed ? 'Riprova' : 'Versione leggera';
    return el('button', { class: 'v-second v-light', 'aria-pressed': ready, 'aria-busy': working ? 'true' : undefined, disabled: ready || working, 'aria-label': label,
      title: 'Una copia a 480p per guardare con meno dati. L’originale resta com’è.',
      onclick: action(() => lightRun(t)) }, vIcon('down'), el('span', {}, short));
  }
  async function lightRun(t) {
    const ids = (t.episodes || [t.item]).filter(i => !i.light).map(i => i.id).slice(0, 300); if (!ids.length) return;
    lightMine = true; lightInfo = await api('/api/versions', { method: 'POST', data: { ids } }); lightBusy = true;
    notify('Preparo la versione leggera, una alla volta: puoi continuare a usare Apollon.'); refreshInfo();
  }
  let lightMine = false;
  // Scarica sul telefono: il video resta nella memoria dell'app (non nella galleria) e si guarda anche senza rete.
  const dl = id => c.downloads?.state(id) || null;
  function downloadSheet(items, title) {
    const sum = quality => items.reduce((n, i) => n + c.downloads.estimate(i, quality), 0);
    sheet(title, [
      { icon: 'save', label: 'Standard (occupa meno spazio)', sub: `Circa ${c.fmtSize(sum('light'))} · versione leggera a 480p, la preparo io`, run: () => c.downloads.start(items, 'light') },
      { icon: 'save', label: 'Originale', sub: `Circa ${c.fmtSize(sum('original'))} · la qualità del file di casa`, run: () => c.downloads.start(items, 'original') }]);
  }
  function downloadLabel(items) {
    const states = items.map(i => dl(i.id));
    if (states.every(x => x?.kind === 'done')) return { text: 'Scaricato', done: true };
    const active = states.filter(x => x?.kind === 'active'); if (active.length) return { text: `Scarico… ${Math.round(100 * active.reduce((n, x) => n + x.share, 0) / active.length)}%`, busy: true };
    if (states.some(x => x?.kind === 'paused')) return { text: 'Riprendi il download', resume: true };
    return { text: 'Scarica' };
  }
  function downloadButton(t, point) {
    const title = 'Salva nella memoria di Apollon per guardarlo anche senza rete';
    if (t.episodes) {
      const items = nextToDownload(t, point);
      return el('button', { class: 'v-second v-download', title, onclick: action(async () => { if (items.length) downloadSheet(items, 'Scarica i prossimi episodi'); else c.setPage('scaricati'); }) },
        vIcon('save'), el('span', {}, items.length ? `Scarica i prossimi ${items.length === 1 ? 'episodio' : `${items.length} episodi`}` : 'Episodi scaricati'));
    }
    const state = downloadLabel([t.item]);
    return el('button', { class: 'v-second v-download', 'aria-busy': state.busy ? 'true' : undefined, disabled: state.busy, title,
      onclick: action(async () => { if (state.done) return c.setPage('scaricati'); if (state.resume) return c.downloads.start([t.item], dl(t.item.id).quality); downloadSheet([t.item], `Scarica «${t.title}»`); }) },
    vIcon(state.done ? 'check' : 'save'), el('span', {}, state.text));
  }
  const nextToDownload = (t, point) => {
    const from = Math.max(0, t.episodes.findIndex(i => i.id === point.item.id));
    return t.episodes.slice(from).filter(i => !state.progress[i.id]?.watched && !dl(i.id)).slice(0, 3);
  };
  function episodeDownload(item) {
    const state = downloadLabel([item]);
    return el('button', { class: 'ep-save', 'aria-pressed': !!state.done, 'aria-busy': state.busy ? 'true' : undefined, disabled: state.busy, 'aria-label': `${state.text}: episodio ${item.episode}`, title: state.text,
      onclick: action(async () => { if (state.done) return c.setPage('scaricati'); if (state.resume) return c.downloads.start([item], dl(item.id).quality); downloadSheet([item], `Scarica l’episodio ${item.episode}`); }) },
    el('span', { class: 'ep-save-pct', 'aria-hidden': 'true' }, state.done ? '✓' : state.busy ? `${Math.round(100 * dl(item.id).share)}%` : '↓'));
  }
  // «Ricomincia dall'inizio»: il film, o il primo episodio della serie, da zero. I visti degli altri episodi restano.
  function restartButton(t) {
    const first = t.episodes ? t.episodes[0] : t.item;
    return el('button', { class: 'v-second v-restart', 'aria-label': 'Ricomincia dall’inizio', title: 'Ricomincia dall’inizio', onclick: action(() => { hideHover(); return c.playItem(first, false, { fromStart: true }); }) }, vIcon('back10'), el('span', {}, 'Ricomincia'));
  }
  function sheet(title, entries) {
    $('#video-sheet-title').textContent = title;
    $('#video-sheet-body').replaceChildren(...entries.map(x => el('button', { class: 'sheet-item', 'aria-pressed': x.pressed, onclick: action(async () => { $('#video-sheet').close(); await x.run(); }) },
      x.node || el('span', { class: 'sheet-mark' }, vIcon(x.icon || 'info')), el('span', { class: 'sheet-copy' }, el('strong', {}, x.label), x.sub ? el('small', {}, x.sub) : null), x.toggle ? el('span', { class: 'sheet-switch', 'aria-hidden': 'true' }, el('i')) : null)));
    c.showDialog('#video-sheet');
  }
  const face = (p, cls = 'face') => tinted(el('span', { class: `${cls}${p.avatar ? ' photo-face' : ''}`, 'aria-hidden': 'true' }, profileVisual(el, p)), p.name);

  async function changeAvatar(me) {
    const dialog = $('#video-sheet'); const body = $('#video-sheet-body');
    $('#video-sheet-title').textContent = 'Cambia immagine';
    let saving = false;
    const save = async avatar => {
      if (saving) return; saving = true;
      body.querySelectorAll('button').forEach(b => { b.disabled = true; });
      try {
        const updated = await api('/api/profiles/avatar', { method: 'PUT', data: { id: me.id, avatar } });
        Object.assign(me, updated); dialog.close(); render(); notify('Immagine del profilo aggiornata.');
      } catch (error) { notify(error.message, true); }
      finally { saving = false; body.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
    };
    const initial = el('button', { class: 'sheet-item', 'aria-pressed': !me.avatar, onclick: () => save(null) }, face({ name: me.name }, 'face'), el('strong', {}, 'Usa l’iniziale'));
    const status = el('p', { class: 'avatar-status', role: 'status' }, 'Caricamento delle immagini…');
    const grid = el('div', { class: 'avatar-choices', 'aria-label': 'Immagini del profilo' });
    body.replaceChildren(initial, status, grid); c.showDialog('#video-sheet');
    try {
      const choices = await api('/api/avatar-choices');
      if (!grid.isConnected) return;
      status.textContent = choices.length ? 'Scegli il tuo personaggio.' : 'Nessuna immagine disponibile. Aggiungi anime con copertine online alla raccolta.';
      grid.replaceChildren(...choices.map(choice => el('button', { class: 'avatar-choice', 'aria-label': choice.name, 'aria-pressed': me.avatar === choice.url, onclick: () => save(choice.url) },
        el('span', { class: 'avatar-choice-face' }, profileVisual(el, { name: choice.name, avatar: choice.url })), el('span', { class: 'avatar-choice-name' }, choice.name))));
    } catch { if (status.isConnected) status.textContent = 'Immagini non disponibili. Riprova più tardi.'; }
  }

  // Titolo in evidenza: cambia ogni giorno, preferisce quelli mai iniziati.
  function billboard(page) {
    const pool = titles.filter(t => (page === 'home' || t.kind === page) && (!state.genre || t.genres.includes(state.genre)));
    if (!wide()) return billboardPhone(page, pool);
    const t = featuredTitle(pool, Math.floor(Date.now() / 86400000) + KIND_PAGES.indexOf(page) * 7); if (!t) return null;
    const point = resumePoint(t, state.items, state.progress);
    const wideSrc = backdropSrc(t.art, 1280); const tallSrc = posterSrc(t.art, 800);
    const image = picture(tallSrc || wideSrc, 'bb-image', true);
    const art = el('picture', { class: 'bb-picture' }, wideSrc ? el('source', { media: '(min-width: 900px)', srcset: wideSrc }) : null, image);
    const ambient = el('div', { class: 'bb-ambient', 'aria-hidden': 'true' }, picture(posterSrc(t.art, 260), '', true));
    return el('section', { class: 'billboard', 'data-key': t.key, 'aria-label': `In evidenza: ${t.title}` }, ambient,
      tinted(el('div', { class: 'bb-frame' }, art, el('div', { class: 'bb-shade' }),
        el('div', { class: 'bb-copy' },
          el('p', { class: 'bb-kind' }, kindLabel(t)),
          titleHeading(t, 'h1', 'bb-title'),
          el('p', { class: 'bb-genres' }, t.genres.slice(0, 3).join(' • ')),
          metaLine(t),
          t.description ? el('p', { class: 'bb-desc' }, t.description) : null,
          el('div', { class: 'bb-actions' }, playButton(t, point, { big: true }), listButton(t), el('button', { class: 'v-second v-info', onclick: () => openTitle(t.key) }, vIcon('info'), el('span', {}, 'Info'))))), t.title));
  }

  // Telefono: l'immagine a tutta larghezza, il titolo sotto e il tasto grande; cinque o sei titoli che ruotano (si sfoglia col dito,
  // cambiano da soli ogni 8 secondi finché nessuno tocca). Il trattino attivo si riempie: quando è pieno, passa al successivo.
  let hero = { key: '', index: 0, manual: false };
  function billboardPhone(page, pool) {
    const day = Math.floor(Date.now() / 86400000) + KIND_PAGES.indexOf(page) * 7;
    const chosen = featuredTitles(pool, 6, day); if (!chosen.length) return null;
    const key = `${page}|${state.genre}|${day}|${chosen.map(t => t.key).join()}`;
    if (hero.key !== key) hero = { key, index: 0, manual: false };
    const slides = chosen.map((t, n) => {
      const point = resumePoint(t, state.items, state.progress);
      const image = picture(posterSrc(t.art, 800) || backdropSrc(t.art, 1280), 'bb-image', n === 0);
      return el('div', { class: 'bb-slide', 'data-key': t.key, role: 'group', 'aria-label': `In evidenza ${n + 1} di ${chosen.length}: ${t.title}` },
        tinted(el('div', { class: 'bb-frame' }, el('picture', { class: 'bb-picture' }, image), el('div', { class: 'bb-shade' }),
          el('button', { class: 'bb-open', 'aria-label': `Apri la scheda: ${t.title}`, onclick: () => openTitle(t.key) }),
          el('div', { class: 'bb-copy' },
            titleHeading(t, n === 0 ? 'h1' : 'h2', 'bb-title'),
            el('p', { class: 'bb-meta' }, genreLine(t)),
            t.description ? el('p', { class: 'bb-desc' }, t.description) : null,
            el('div', { class: 'bb-actions' }, playButton(t, point, { big: true, label: shortPlayLabel(t, point) }), bookmarkButton(t)))), t.title));
    });
    const track = el('div', { class: 'bb-track' }, ...slides);
    const dots = el('div', { class: `bb-dots${hero.manual ? ' manual' : ''}` }, ...chosen.map((t, n) => el('button', { class: 'bb-dot', 'aria-label': `Mostra ${t.title}`, 'aria-current': n === hero.index ? 'true' : undefined,
      onclick: () => { stop(); go(n); } }, el('i'))));
    const mark = n => { hero.index = n; [...dots.children].forEach((d, i) => { d.classList.toggle('on', i === n); if (i === n) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); }); };
    const go = n => track.scrollTo({ left: n * track.clientWidth, behavior: reduce() ? 'auto' : 'smooth' });
    const stop = () => { hero.manual = true; dots.classList.add('manual'); };
    track.addEventListener('scroll', () => { const n = Math.round(track.scrollLeft / (track.clientWidth || 1)); if (n !== hero.index && n >= 0 && n < chosen.length) mark(n); }, { passive: true });
    for (const type of ['touchstart', 'wheel']) track.addEventListener(type, stop, { passive: true });
    dots.addEventListener('animationend', event => { if (!hero.manual && event.target.matches('i') && track.isConnected) go((hero.index + 1) % chosen.length); });
    mark(hero.index); requestAnimationFrame(() => { if (hero.index) track.scrollLeft = hero.index * track.clientWidth; });
    return el('section', { class: 'billboard bb-phone', 'aria-roledescription': 'carosello', 'aria-label': 'In evidenza' }, track, dots);
  }

  // Righe orizzontali a scatto; frecce sul PC; ognuna ricorda dove era arrivata.
  function posterCard(t, rowId = 'griglia', fresh = false) {
    const mark = cardLogo(t.art);
    const art = tinted(el('span', { class: mark ? 't-art has-logo' : 't-art' }, picture(posterSrc(t.art, 260)), mark ? el('img', { class: 't-logo', src: mark, alt: '', loading: 'lazy', decoding: 'async', onerror: e => e.target.remove() }) : null, el('span', { class: 't-name', 'aria-hidden': 'true' }, t.title),
      fresh ? el('span', { class: 't-flag' }, 'Nuovi episodi') : null, t.remote && t.remoteDown ? el('span', { class: 't-remote' }, 'Fisso spento') : null, listed(t.key) ? el('span', { class: 't-ribbon', 'aria-hidden': 'true' }, vIcon('markon')) : null, t.watched ? el('span', { class: 't-seen', 'aria-hidden': 'true' }, vIcon('check')) : null), t.title);
    const button = el('button', { class: `t-card${t.remoteDown ? ' t-off' : ''}`, 'data-key': t.key, 'data-fk': `${rowId}|${t.key}`, 'aria-label': `Apri ${t.title}`, onclick: () => openTitle(t.key, button) }, art);
    hoverable(button, t);
    if (wide()) return button;
    // Telefono: il titolo sta sotto la locandina (una riga), poi una riga grigia e i tre puntini col menu.
    return el('div', { class: 't-cell' }, button, el('span', { class: 't-title' }, t.title),
      el('span', { class: 't-sub' }, el('span', { class: 't-kind' }, shortKind(t)),
        el('button', { class: 't-more', 'aria-label': `Altro per ${t.title}`, onclick: () => titleMenu(t) }, vIcon('morev'))));
  }
  function titleMenu(t, point = null) {
    const on = listed(t.key); const first = t.episodes ? t.episodes[0] : t.item;
    sheet(t.title, [
      ...(point ? [] : [{ icon: 'info', label: 'Apri la scheda', sub: t.episodes ? 'Episodi e dettagli' : 'Dettagli del film', run: () => openTitle(t.key) }]),
      { icon: on ? 'check' : 'plus', label: on ? 'Togli dalla mia lista' : 'Aggiungi alla mia lista', run: () => toggleList(t) },
      { icon: 'check', label: t.watched ? 'Togli dai visti' : 'Segna visto', run: () => toggleWatched(t) },
      ...(point && (point.resume || t.started) ? [{ icon: 'back10', label: 'Ricomincia dall’inizio', run: () => c.playItem(first, false, { fromStart: true }) }] : []),
      ...(point && c.downloads ? [{ icon: 'save', label: 'Scarica sul telefono', sub: 'Per guardarlo anche senza rete', run: () => downloadRun(t, point) }] : []),
      ...(point ? [{ icon: 'down', label: 'Prepara la versione leggera', sub: 'Una copia a 480p per guardare con meno dati', run: () => lightRun(t) }] : [])]);
  }
  async function downloadRun(t, point) {
    if (t.episodes) { const items = nextToDownload(t, point); if (items.length) downloadSheet(items, 'Scarica i prossimi episodi'); else c.setPage('scaricati'); return; }
    const status = downloadLabel([t.item]);
    if (status.done) return c.setPage('scaricati');
    if (status.resume) return c.downloads.start([t.item], dl(t.item.id).quality);
    if (!status.busy) downloadSheet([t.item], `Scarica «${t.title}»`);
  }
  function continueCard(entry, rowId) {
    const t = entry.title; const share = entry.duration ? entry.position / entry.duration : 0;
    const code = t.episodes ? episodeCode(entry.item) : '';
    const sub = [code, entry.next ? 'Prossimo episodio' : remainingText(entry.position, entry.duration)].filter(Boolean).join(' · ');
    const opener = el('button', { class: 'c-open', 'data-fk': `${rowId}|${t.key}`, 'aria-label': `Riprendi ${t.title}${code ? ` ${code}` : ''}`, onclick: action(() => c.playItem(entry.item)) },
      tinted(el('span', { class: 'c-art' }, picture(thumbSrc(entry.item)), el('span', { class: 'c-play', 'aria-hidden': 'true' }, vIcon('play')), entry.next ? null : bar(share)), t.title));
    const more = el('button', { class: 'c-more', 'aria-label': `Altro per ${t.title}`, onclick: () => continueMenu(entry) }, vIcon('more'));
    return el('div', { class: 'c-card' }, opener, el('div', { class: 'c-info' }, el('span', { class: 'c-text' }, el('strong', {}, t.title), el('small', {}, sub)), more));
  }
  // «Nuovi episodi»: l'ultimo episodio arrivato di ogni serie, con un tocco si guarda subito.
  function freshCard(t, rowId) {
    const latest = [...t.episodes].sort((a, b) => (b.added || 0) - (a.added || 0) || b.episode - a.episode)[0];
    const code = t.kind === 'anime' ? `E${latest.episode}` : episodeCode(latest); const p = state.progress[latest.id];
    const share = p?.watched ? 1 : p?.position && (p.duration || latest.duration) ? p.position / (p.duration || latest.duration) : 0;
    const opener = el('button', { class: 'c-open', 'data-fk': `${rowId}|${t.key}`, 'aria-label': `Guarda ${t.title} ${code}`, onclick: action(() => c.playItem(latest)) },
      tinted(el('span', { class: 'c-art' }, picture(thumbSrc(latest)), el('span', { class: 'c-play', 'aria-hidden': 'true' }, vIcon('play')), el('span', { class: 'c-new', 'aria-hidden': 'true' }, 'Nuovo'), share ? bar(share) : null), t.title));
    const more = el('button', { class: 'c-more', 'aria-label': `Apri ${t.title}`, onclick: event => openTitle(t.key, event.currentTarget.closest('.c-card')?.querySelector('.c-art')) }, vIcon('info'));
    return el('div', { class: 'c-card' }, opener, el('div', { class: 'c-info' }, el('span', { class: 'c-text' }, el('strong', {}, t.title), el('small', {}, `${code} · nuovo`)), more));
  }
  function continueMenu(entry) {
    const t = entry.title;
    sheet(t.title, [
      { icon: 'info', label: 'Apri la scheda', sub: t.episodes ? 'Episodi e dettagli' : 'Dettagli del film', run: () => openTitle(t.key) },
      { icon: 'close', label: 'Togli dalla riga', sub: 'Il punto di ripresa resta salvato', run: () => hideContinue(entry) },
      { icon: 'check', label: 'Segna visto', sub: t.episodes ? `${episodeCode(entry.item)} ${entry.item.title}` : 'Il film passa fra i già visti', run: () => markOne(entry.item, true) }]);
  }
  function slide(track, direction) { track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reduce() ? 'auto' : 'smooth' }); }
  function edges(wrap, track) {
    wrap.classList.toggle('at-start', track.scrollLeft < 8);
    wrap.classList.toggle('at-end', track.scrollLeft + track.clientWidth > track.scrollWidth - 8);
  }
  function row(r, page) {
    const memory = `${page}|${state.genre}|${r.id}`;
    const track = el('div', { class: `v-track ${r.shape === 'fresh' ? 'continue fresh' : r.shape}`, 'data-memory': memory },
      ...(r.shape === 'continue' ? r.entries.map(e => continueCard(e, r.id)) : r.shape === 'fresh' ? r.entries.map(t => freshCard(t, r.id)) : r.entries.map(t => posterCard(t, r.id, false))));
    const wrap = el('div', { class: 'v-track-wrap at-start' },
      el('button', { class: 'row-arrow prev', tabindex: '-1', 'aria-label': `Indietro in ${r.title}`, onclick: () => slide(track, -1) }, vIcon('left')), track,
      el('button', { class: 'row-arrow next', tabindex: '-1', 'aria-label': `Avanti in ${r.title}`, onclick: () => slide(track, 1) }, vIcon('right')));
    track.addEventListener('scroll', () => { rowScroll.set(memory, track.scrollLeft); edges(wrap, track); if (hoverNode) hideHover(); }, { passive: true });
    const heading = r.id === 'recenti' && !wide() ? el('button', { class: 'row-link', onclick: () => c.setPage('novita') }, el('span', {}, 'Novità'), vIcon('right')) : r.title;
    return el('section', { class: `v-row row-${r.shape}`, 'data-row': r.id }, el('h2', { class: 'v-row-title' }, heading), wrap);
  }
  function kindHeader(page) {
    return el('div', { class: 'kind-head' }, el('h1', {}, PAGE_NAMES[page] || 'Home'),
      el('button', { class: 'genre-pick', 'aria-haspopup': 'dialog', 'aria-label': state.genre ? `Genere: ${state.genre}. Cambia genere` : 'Scegli un genere', onclick: genreSheet }, el('span', {}, state.genre || 'Generi'), vIcon('down')),
      state.genre ? el('button', { class: 'genre-clear', 'aria-label': 'Tutti i generi', onclick: () => pickGenre('') }, vIcon('close')) : null);
  }
  function browseView(page) {
    if (!titles.length) return [emptyLibrary()];
    const rows = buildRows(titles, state.items, state.progress, list, { page, genre: state.genre });
    // «Nuovi episodi» come card 16:9 dell'ultimo episodio; nella pagina Anime sta in cima a tutto, nella Home dopo «Continua a guardare».
    const freshAt = rows.findIndex(r => r.id === 'nuovi-episodi');
    if (freshAt >= 0) { const [r] = rows.splice(freshAt, 1); r.shape = 'fresh'; rows.splice(page === 'anime' ? 0 : rows[0]?.id === 'continua' ? 1 : 0, 0, r); }
    const hero = billboard(page);
    if (!hero && !rows.length) return [emptyPage(page)];
    return [page !== 'home' || state.genre ? kindHeader(page) : null, hero, el('div', { class: 'v-rows' }, ...rows.map(r => row(r, page)))].filter(Boolean);
  }
  // Pagina senza titoli (per esempio nessun film): dice cosa manca e come arrivano.
  function emptyPage(page) {
    if (state.genre) return el('div', { class: 'v-empty' }, el('h1', {}, 'Nessun titolo in questo genere'), el('p', {}, `In questa pagina non c’è nulla del genere «${state.genre}».`),
      el('button', { class: 'v-play', onclick: () => pickGenre('') }, el('span', {}, 'Mostra tutti i generi')));
    const how = { film: ['Non ci sono ancora film', 'I film arrivano mettendoli nella cartella Film del server. Appaiono qui da soli entro un paio di minuti.'],
      series: ['Non ci sono ancora serie TV', 'Le serie TV arrivano mettendo una cartella per ogni serie dentro la cartella Serie del server. Appaiono qui da sole entro un paio di minuti.'],
      anime: ['Non ci sono ancora anime', 'Gli anime arrivano mettendoli nella cartella Anime del server. Appaiono qui da soli entro un paio di minuti.'] }[page] || ['Non c’è ancora niente qui', 'I titoli appaiono da soli entro un paio di minuti da quando li metti sul server.'];
    return el('div', { class: 'v-empty' }, el('h1', {}, how[0]), el('p', {}, how[1]), el('button', { class: 'v-play', onclick: () => c.setPage('home') }, el('span', {}, 'Torna alla Home')));
  }
  function emptyLibrary() {
    return el('div', { class: 'v-empty' }, el('h1', {}, 'Qui comincia la tua raccolta'), el('p', {}, 'Aggiungi film o episodi da Gestisci, poi aggiorna la raccolta.'),
      el('button', { class: 'v-play', onclick: () => c.setPage('manage') }, el('span', {}, 'Apri Gestisci')));
  }

  // Esplora: i filtri Film, Serie e Anime e la griglia dei generi.
  // 11/11 (richiesta: «le copertine sono sballate»): ogni genere prendeva il primo titolo dalla A, sempre gli stessi due.
  // Ora ogni riquadro usa un titolo non ancora usato dagli altri generi, e mai uno del fisso spento (immagine assente).
  // 11/11 notte (richiesta: «c'erano i frame dell'episodio come copertina»): senza copertina larga vera il server ne ricava una da un
  // fotogramma. Le copertine locali (images.cv) hanno sempre il disegno largo: si scelgono quelle, i fotogrammi solo se non c'è altro.
  function genreTilesFor(pool, pick) {
    const used = new Set(); const drawn = t => !!t.art?.images?.cv;
    return el('div', { class: 'genre-tiles' }, ...genreCounts(pool).map(g => {
      const fits = pool.filter(t => t.genres.includes(g.name) && t.art?.images?.backdrop && !t.remoteDown);
      const sample = fits.find(t => drawn(t) && !used.has(t.key)) || fits.find(t => drawn(t)) || fits.find(t => !used.has(t.key)) || fits[0];
      if (sample) used.add(sample.key);
      return tinted(el('button', { class: 'genre-tile', onclick: () => pick(g.name) }, picture(sample ? backdropSrc(sample.art, 640) : ''), el('span', {}, g.name), el('small', {}, quantity(g.count, 'titolo', 'titoli'))), g.name);
    }));
  }
  // Esplora come nell'app ufficiale: titolo in alto, schede (Tutti, Anime, Film, Serie TV, Generi) con la riga arancione sotto quella attiva,
  // «Aggiunti di recente» (non abbiamo un dato di popolarità) con il menu per ordinare, griglia a due colonne con titolo, riga grigia e tre puntini.
  const ex = { tab: 'all', genre: '', order: 'recenti' };
  const EX_ORDERS = [['recenti', 'Aggiunti di recente'], ['titolo', 'Titolo A–Z'], ['anno', 'Anno']];
  function exploreList() {
    let pool = ex.tab === 'all' ? titles : titles.filter(t => t.kind === ex.tab);
    if (ex.genre) pool = pool.filter(t => t.genres.includes(ex.genre));
    const byTitle = (a, b) => a.title.localeCompare(b.title, 'it');
    return [...pool].sort({ recenti: (a, b) => b.added - a.added || byTitle(a, b), titolo: byTitle, anno: (a, b) => (b.year || 0) - (a.year || 0) || byTitle(a, b) }[ex.order]);
  }
  function esploraView() {

    const tabs = [['all', 'Tutti i titoli'], ['anime', 'Anime'], ['film', 'Film'], ['series', 'Serie TV'], ...(genreCounts(titles).length ? [['generi', 'Generi']] : [])];
    if (!tabs.some(([id]) => id === ex.tab)) ex.tab = 'all';
    const go = (tab, genre = '') => { ex.tab = tab; ex.genre = genre; render(); };
    const orderName = EX_ORDERS.find(([id]) => id === ex.order)[1];
    const head = el('header', { class: 'page-head ex-head' }, el('h1', {}, 'Esplora'));
    const row = el('div', { class: 'ex-tabs', role: 'tablist', 'aria-label': 'Cosa esplorare' }, ...tabs.map(([id, name]) => el('button', { class: 'ex-tab', role: 'tab', 'aria-selected': String(ex.tab === id), onclick: () => go(id) }, name)));
    if (ex.tab === 'generi') return [head, row, el('section', { class: 'search-block ex-genres' }, genreTilesFor(titles, name => go('all', name)))];
    const shown = exploreList();
    return [head, row,
      el('div', { class: 'ex-sort' }, el('h2', { class: 'ex-sort-name' }, orderName), ex.genre ? el('button', { class: 'v-chip ex-chip', 'aria-label': `Togli il genere ${ex.genre}`, onclick: () => go(ex.tab) }, ex.genre, vIcon('close')) : null,
        el('button', { class: 'ex-sort-btn', 'aria-label': 'Ordina i titoli', 'aria-haspopup': 'dialog', onclick: () => sheet('Ordina', EX_ORDERS.map(([id, name]) => ({ icon: ex.order === id ? 'check' : 'sort', label: name, pressed: ex.order === id, run: () => { ex.order = id; render(); } }))) }, vIcon('sortlines'))),
      shown.length ? el('div', { class: 'ex-grid' }, ...shown.map(t => posterCard(t, 'esplora'))) : el('p', { class: 'muted ex-none' }, 'Nessun titolo qui.')];
  }
  const QUALITY_NAMES = { auto: 'Automatica', original: 'Originale', 480: 'Risparmio dati' };
  function accountView() {
    const me = profileOf(state.profile); const cover = titles.length ? featuredTitle(titles, Math.floor(Date.now() / 86400000) + 3) : null;
    const subsOn = storage.get(`video-subs:${state.profile}`, null) !== 'off'; const quality = c.qualityPreference();
    const link = (label, { value = '', icon = '', run, cls = '' }) => el('button', { class: `ac-row ${cls}`.trim(), onclick: action(async () => { await run(); }) },
      icon ? el('span', { class: 'ac-icon', 'aria-hidden': 'true' }, vIcon(icon)) : null, el('span', { class: 'ac-label' }, label), value ? el('span', { class: 'ac-value' }, value) : null, vIcon('right'));
    const toggle = (label, on, run) => el('button', { class: 'ac-row', role: 'switch', 'aria-checked': String(on), onclick: action(async () => { await run(); render(); }) },
      el('span', { class: 'ac-label' }, label), el('span', { class: 'ac-switch', 'aria-hidden': 'true' }, el('i')));
    return [el('section', { class: 'account' },
      el('div', { class: 'ac-hero' }, tinted(el('div', { class: 'ac-cover', 'aria-hidden': 'true' }, picture(cover ? backdropSrc(cover.art, 1280) || posterSrc(cover.art, 800) : '', '', true)), me.name),
        el('div', { class: 'ac-id' },
          el('div', { class: 'ac-avatar' }, face(me, 'ac-face'),
            el('button', { class: 'ac-edit', 'aria-label': `Cambia il nome di ${me.name}`, onclick: action(() => renameProfile(me)) }, vIcon('edit'))),
          el('h1', { class: 'ac-name' }, me.name))),
      el('div', { class: 'ac-list' },
        link('Cambia immagine', { run: () => changeAvatar(me) }),
        link('Cambia profilo', { run: askWho }),
        toggle('Salta da solo sigle e riassunti', videoPref('autoSkip'), () => setVideoPref('autoSkip')),
        el('h2', { class: 'ac-group' }, 'Riproduzione'),
        link('Qualità video', { value: QUALITY_NAMES[quality] || 'Automatica', run: () => sheet('Qualità video', [
          { icon: 'speed', label: 'Automatica', sub: 'Sceglie da sola in base alla connessione', pressed: quality === 'auto', run: () => c.switchQuality('auto').then(render) },
          { icon: 'tv', label: 'Originale', sub: 'La migliore qualità del file', pressed: quality === 'original', run: () => c.switchQuality('original').then(render) },
          { icon: 'save', label: 'Risparmio dati (480p)', sub: 'Dove la versione leggera è pronta; altrimenti resta l’originale', pressed: quality === '480', run: () => c.switchQuality('480').then(render) }]) }),
        toggle('Sottotitoli', subsOn, async () => { storage.set(`video-subs:${state.profile}`, subsOn ? 'off' : null); notify(`Sottotitoli: ${subsOn ? 'spenti' : 'accesi, come l’ultima volta'}.`); }),
        el('h2', { class: 'ac-group' }, 'Altro'),
        link('Vai alla musica', { icon: 'music', cls: 'ac-music', run: () => c.setPage('music') }),
        link('Guida', { run: () => $('#help-open').click() }),
        el('h2', { class: 'ac-group' }, 'Impostazioni'),
        link('Gestisci la raccolta', { icon: 'key', run: () => c.setPage('manage') }),
        el('p', { class: 'ac-count' }, libraryCount(titles))))];
  }

  // 7/11: in fondo alle impostazioni, in piccolo, quanto c'è nella raccolta.
  function libraryCount(list) {
    const films = list.filter(t => !t.episodes).length;
    const shows = list.filter(t => t.episodes);
    const eps = shows.reduce((n, t) => n + t.episodes.length, 0);
    const fmt = n => n.toLocaleString('it-IT');
    return `Nella raccolta: ${fmt(films)} film e ${fmt(eps)} ${eps === 1 ? 'episodio' : 'episodi'} di ${fmt(shows.length)} serie.`;
  }

  // Generi: un foglio con quanti titoli ha ciascuno.
  function genreSheet() {
    const page = KIND_PAGES.includes(state.page) ? state.page : 'home';
    const pool = page === 'home' ? titles : titles.filter(t => t.kind === page);
    sheet(page === 'home' ? 'Generi' : `Generi · ${PAGE_NAMES[page]}`, [
      { icon: 'grid', label: 'Tutti i generi', sub: quantity(pool.length, 'titolo', 'titoli'), pressed: !state.genre, run: () => pickGenre('') },
      ...genreCounts(pool).map(g => ({ node: tinted(el('span', { class: 'sheet-dot', 'aria-hidden': 'true' }), g.name), label: g.name, sub: quantity(g.count, 'titolo', 'titoli'), pressed: state.genre === g.name, run: () => pickGenre(g.name) }))]);
  }
  function pickGenre(genre) {
    if (!KIND_PAGES.includes(state.page)) c.setPage('home');
    state.genre = genre; render(); window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Novità: per data di arrivo, con le date a lato come nei servizi di streaming.
  function novitaView() {
    const groups = novitaGroups(titles);
    if (!groups.length) return [el('header', { class: 'page-head' }, el('h1', {}, 'Novità')), emptyLibrary()];
    return [el('header', { class: 'page-head' }, el('h1', {}, 'Novità'), el('p', { class: 'muted' }, 'Gli ultimi arrivi nella raccolta di casa.')),
      ...groups.map(g => el('section', { class: 'nv-group' }, el('h2', { class: 'v-row-title' }, g.label), el('div', { class: 'nv-list' }, ...g.entries.map(newsCard))))];
  }
  function newsCard({ title: t, note, item }) {
    const day = new Date(t.added); const point = resumePoint(t, state.items, state.progress);
    const description = t.description || item.description || '';
    return el('article', { class: 'nv-card' },
      el('div', { class: 'nv-date', 'aria-hidden': 'true' }, el('span', {}, day.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')), el('strong', {}, String(day.getDate()))),
      el('div', { class: 'nv-body' },
        el('button', { class: 'nv-art', 'data-fk': `novita|${t.key}`, 'aria-label': `Apri ${t.title}`, onclick: event => openTitle(t.key, event.currentTarget.querySelector('.nv-frame')) },
          tinted(el('span', { class: 'nv-frame' }, picture(backdropSrc(t.art, wide() ? 1280 : 640)), el('span', { class: 'nv-note' }, note)), t.title)),
        el('div', { class: 'nv-head' }, el('h3', {}, t.title), el('div', { class: 'nv-actions' }, playButton(t, point, { named: true }), listButton(t, true))),
        metaLine(t), description ? el('p', { class: 'nv-desc' }, description) : null));
  }

  // Cerca: un campo grande; prima di scrivere, ricerche recenti, generi e anni.
  const recentKey = () => `video-recent:${state.profile}`;
  function remember(query) {
    const q = query.trim(); if (!q) return;
    storage.set(recentKey(), [q, ...storage.get(recentKey(), []).filter(x => x.toLocaleLowerCase('it') !== q.toLocaleLowerCase('it'))].slice(0, 8));
  }
  function setSearch(value) { search = value; const input = $('#video-view .search-input'); if (input) input.value = value; paintResults(); }
  function searchView() {
    const input = el('input', { class: 'search-input', type: 'search', placeholder: 'Titoli, generi, anni', 'aria-label': 'Cerca un titolo', autocomplete: 'off', enterkeyhint: 'search' });
    input.value = search;
    input.addEventListener('input', () => { search = input.value; paintResults(); });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { remember(input.value); input.blur(); } });
    const results = el('div', { class: 'search-results', 'aria-live': 'polite' });
    results.addEventListener('click', event => { if (event.target.closest('.t-card')) remember(search); }, true);
    return [el('header', { class: 'page-head search-head' }, el('h1', { class: 'sr-only' }, 'Cerca'),
      el('div', { class: 'search-bar' }, vIcon('search'), input, el('button', { class: 'search-clear', type: 'button', 'aria-label': 'Svuota la ricerca', onclick: () => { setSearch(''); input.focus(); } }, vIcon('close')))), results];
  }
  function paintResults() {
    const box = $('#video-view .search-results'); if (!box) return;
    const q = search.trim(); $('#video-view .search-bar')?.classList.toggle('filled', !!q);
    if (!q) {
      const recent = storage.get(recentKey(), []);
      const years = [...new Set(titles.map(t => t.year).filter(Boolean))].sort((a, b) => b - a).slice(0, 8);
      fill(box, 
        recent.length ? el('section', { class: 'search-block' }, el('div', { class: 'block-head' }, el('h2', { class: 'v-row-title' }, 'Ricerche recenti'),
          el('button', { class: 'link-button', onclick: () => { storage.set(recentKey(), []); paintResults(); } }, 'Cancella')),
          el('div', { class: 'v-chips' }, ...recent.map(r => el('button', { class: 'v-chip', onclick: () => setSearch(r) }, vIcon('search'), r)))) : null,
        el('section', { class: 'search-block' }, el('h2', { class: 'v-row-title' }, 'Sfoglia per genere'),
          genreTilesFor(titles, setSearch)),
        years.length ? el('section', { class: 'search-block' }, el('h2', { class: 'v-row-title' }, 'Per anno'), el('div', { class: 'v-chips' }, ...years.map(y => el('button', { class: 'v-chip', onclick: () => setSearch(String(y)) }, String(y))))) : null,
        // 11/11: sotto la ricerca si scorre tutto quello che c'è, dalla A alla Z.
        titles.length ? el('section', { class: 'search-block search-all' }, el('h2', { class: 'v-row-title' }, `Tutti i titoli · ${titles.length.toLocaleString('it-IT')}`),
          el('div', { class: 'poster-grid' }, ...titles.slice().sort((a, b) => a.title.localeCompare(b.title, 'it', { numeric: true })).map(t => posterCard(t, 'cerca')))) : null);
      return;
    }
    const found = searchTitles(titles, q);
    fill(box, found.length
      ? el('section', { class: 'search-block' }, el('h2', { class: 'v-row-title' }, `${quantity(found.length, 'titolo', 'titoli')} per «${q}»`), el('div', { class: 'poster-grid' }, ...found.map(t => posterCard(t, 'cerca'))))
      : el('div', { class: 'v-empty' }, el('h2', {}, `Nessun titolo per «${q}»`), el('p', {}, 'Prova con un genere, un anno o una parola del titolo.')));
  }

  // La mia lista: griglia con ordine a scelta e «Togli».
  function listView() {
    const sorted = sortList(titles, list, listOrder);
    const orders = [['aggiunti', 'Aggiunti di recente'], ['titolo', 'Titolo A–Z'], ['anno', 'Anno']];
    return [el('header', { class: 'page-head' }, el('h1', {}, 'La mia lista'),
      el('div', { class: 'v-chips', role: 'group', 'aria-label': 'Ordina la lista' }, ...orders.map(([id, name]) => el('button', { class: 'v-chip', 'aria-pressed': listOrder === id, onclick: () => { listOrder = id; storage.set('list-order', id); render(); } }, name)))),
      sorted.length ? el('div', { class: 'poster-grid list-grid' }, ...sorted.map(t => el('div', { class: 'list-cell' }, posterCard(t, 'lista'),
        el('button', { class: 'list-remove', 'aria-label': `Togli ${t.title} dalla lista`, onclick: action(() => toggleList(t)) }, vIcon('close'), el('span', {}, 'Togli')))))
        : el('div', { class: 'v-empty' }, el('h2', {}, 'La tua lista è vuota'), el('p', {}, 'Tocca «La mia lista» su un titolo per ritrovarlo qui.'), el('button', { class: 'v-play', onclick: () => c.setPage('home') }, el('span', {}, 'Scopri i titoli')))];
  }

  // Scheda del titolo: pagina intera sul telefono, finestra di 850 px sul PC. Si apre dalla card toccata
  // (l'immagine si allarga fino a diventare la testata) quando il browser sa farlo e il movimento non è ridotto.
  const BLOCK = 12;
  function openTitle(key, from) {
    if (!titles.some(t => t.key === key)) return;
    hideHover(); open = { key, season: null, block: null }; ratingCache.delete(ratingKey({ key }));
    const show = () => {
      eager = false; try { paintTitle(); } finally { eager = true; }
      refreshInfo();
      const dialog = $('#title-dialog');
      if (!dialog.open) { c.showDialog('#title-dialog'); pushLayer('title'); }
      dialog.scrollTop = 0; $(isTv() ? '#title-content .v-play' : '#title-content .tp-close')?.focus({ preventScroll: true });
    };
    const node = from?.matches?.('.t-art,.c-art,.nv-frame') ? from : from?.querySelector?.('.t-art,.c-art,.nv-frame') || from;
    if (node && document.startViewTransition && !reduce() && !isTv() && !$('#title-dialog').open) {
      const root = document.documentElement; node.style.viewTransitionName = 'title-art'; root.classList.add('vt-open');
      const done = () => { node.style.viewTransitionName = ''; root.classList.remove('vt-open'); };
      try { const run = document.startViewTransition(() => { node.style.viewTransitionName = ''; show(); }); run.ready.catch(() => {}); run.updateCallbackDone.catch(() => {}); run.finished.then(done, done); } catch { done(); show(); }
    } else show();
  }
  function paintTitle() {
    const dialog = $('#title-dialog');
    // Un aggiornamento dei salti/voti non deve staccare il comando sotto il telecomando,
    // né sostituire l'episodio a cui tornare mentre il lettore è aperto sopra la scheda.
    if (dialog.open && c.activeDialog() !== dialog) return;
    const active = document.activeElement;
    const controls = () => [...dialog.querySelectorAll('button,input,select,a[href],[tabindex="0"]')];
    const key = node => [node.id, node.getAttribute('aria-label'), node.className, node.closest('[data-ep]')?.dataset.ep].join('|');
    const focused = dialog.open && dialog.contains(active) ? key(active) : null;
    paintTitleContent();
    if (focused && dialog.open) {
      const next = controls().find(node => key(node) === focused && !node.disabled && node.getClientRects().length);
      (next || dialog.querySelector('.v-play'))?.focus({ preventScroll: true });
    }
  }
  function paintTitleContent() {
    const dialog = $('#title-dialog'); const t = titles.find(x => x.key === open.key);
    if (!t) { if (dialog.open) dialog.close(); return; }
    const point = resumePoint(t, state.items, state.progress);
    const season = t.episodes ? (t.seasons.includes(open.season) ? open.season : point.item.season) : null;
    open.season = season;
    const saved = state.progress[point.item.id]; const length = saved?.duration || point.item.duration || 0;
    const resumeShare = point.resume && !point.next && length ? point.position / length : 0;
    const scroll = dialog.scrollTop; const phone = !wide();
    $('#title-content').classList.toggle('phone', phone);
    if (phone) { fill($('#title-content'), ...titlePhone(dialog, t, point, season)); dialog.scrollTop = scroll; titleScroll(); return; }
    fill($('#title-content'),
      el('div', { class: 'tp-hero' }, tinted(el('div', { class: 'tp-art' }, el('picture', {}, t.art?.images?.poster ? el('source', { media: '(max-width: 899px)', srcset: posterSrc(t.art, 800) }) : null,
        picture(backdropSrc(t.art, 1280) || posterSrc(t.art, 800), '', true))), t.title),
        el('button', { class: 'tp-close', 'aria-label': 'Chiudi la scheda', onclick: () => dialog.close() }, vIcon('close')),
        el('div', { class: 'tp-head' }, el('p', { class: 'bb-kind' }, kindLabel(t)), el('h2', { id: 'title-name', class: 'tp-title' }, t.title), metaLine(t))),
      el('div', { class: 'tp-body' },
        el('div', { class: 'tp-main' }, playButton(t, point, { big: true, detail: resumeShare ? remainingText(point.position, length) : '', share: resumeShare })),
        el('div', { class: 'tp-actions' }, listButton(t), watchedButton(t), point.resume || t.started ? restartButton(t) : null, lightButton(t), c.downloads ? downloadButton(t, point) : null),
        ratingBlock(t),
        skipLine(t),
        t.description ? el('p', { class: 'tp-desc' }, t.description) : null,
        t.genres.length ? el('p', { class: 'tp-genres' }, ...t.genres.map((g, i) => [i ? ' ' : '', el('button', { class: 'tp-genre', onclick: () => goGenre(g) }, g)])) : null,
        t.episodes ? episodesBlock(t, point, season) : null,
        similarBlock(t)));
    dialog.scrollTop = scroll;
  }
  // «Altre info»: scheda a tutto schermo con X e titolo in alto, trama intera, durata, audio e sottotitoli. La scheda sotto non si muove.
  function openAbout(t) {
    const dialog = $('#about-dialog'); const info = aboutInfo(t);
    const section = (label, text) => text ? el('section', { class: 'ab-sec' }, el('h3', {}, label), el('p', {}, text)) : null;
    fill($('#about-content'),
      el('div', { class: 'ab-head' }, el('button', { class: 'ab-close', 'aria-label': 'Chiudi', onclick: () => dialog.close() }, vIcon('close')), el('h2', { id: 'about-title' }, t.title)),
      el('div', { class: 'ab-body' }, info.description ? el('p', { class: 'ab-syn' }, info.description) : null,
        section('Durata', info.duration), section('Audio', info.audio.join(', ')), section('Sottotitoli', info.subs.join(', '))));
    c.showDialog('#about-dialog'); pushLayer('about'); $('#about-content .ab-body').scrollTop = 0; $('#about-content .ab-close')?.focus({ preventScroll: true });
  }
  // Telefono: la locandina a tutta larghezza con X e tre puntini, poi titolo, riga dati, due azioni, trama su 3 righe,
  // le schede «Episodi | Altri simili» e il pulsante fisso in basso.
  function titlePhone(dialog, t, point, season) {
    const on = listed(t.key); const tab = t.episodes && open.tab !== 'sim' ? 'ep' : 'sim';
    const similar = similarTitles(t, titles, 12).filter(x => !t.genres.length || x.genres.some(g => t.genres.includes(g)));
    const act = (icon, label, run, pressed) => el('button', { class: 'tp-act', 'aria-pressed': pressed, onclick: action(run) }, vIcon(icon), el('span', {}, label));
    const tabButton = (id, label) => el('button', { class: 'tp-tab', role: 'tab', 'aria-selected': String(tab === id), onclick: () => { open.tab = id; paintTitle(); } }, label);
    return [
      el('div', { class: 'tp-top' },
        el('div', { class: 'tp-topbar', 'aria-hidden': 'true' }, logoSrc(t.art) ? el('img', { class: 'tp-topbar-logo', src: logoSrc(t.art), alt: '' }) : null, el('span', {}, t.title)),
        el('button', { class: 'tp-close', 'aria-label': 'Chiudi la scheda', onclick: () => dialog.close() }, vIcon('close')),
        el('button', { class: 'tp-menu', 'aria-label': 'Altro su questo titolo', onclick: () => titleMenu(t, point) }, vIcon('morev'))),
      el('div', { class: 'tp-hero' }, tinted(el('div', { class: 'tp-art' }, el('picture', {}, t.art?.images?.poster ? el('source', { media: '(max-width: 899px)', srcset: posterSrc(t.art, 800) }) : null,
        picture(backdropSrc(t.art, 1280) || posterSrc(t.art, 800), '', true))), t.title), el('div', { class: 'tp-dim', 'aria-hidden': 'true' })),
      el('div', { class: 'tp-body' },
        titleHeading(t, 'h2', 'tp-title', 'title-name'),
        el('p', { class: 'tp-meta' }, detailLine(t)),
        ratingBlock(t),
        el('div', { class: 'tp-acts' }, act(on ? 'check' : 'plus', 'La mia lista', () => toggleList(t), on), act('share', 'Condividi', () => shareTitle(t))),
        t.description ? el('div', { class: 'tp-about' }, el('p', { class: `tp-desc${open.more ? ' open' : ''}` }, t.description),
          el('button', { class: 'tp-info', 'aria-haspopup': 'dialog', onclick: () => openAbout(t) }, 'Altre info')) : null,
        skipLine(t),
        t.episodes || similar.length ? el('div', { class: 'tp-tabs', role: 'tablist' }, t.episodes ? tabButton('ep', 'Episodi') : null, similar.length || t.episodes ? tabButton('sim', 'Altri simili') : null) : null,
        tab === 'ep' ? episodesBlock(t, point, season)
          : similar.length ? el('section', { class: 'tp-similar' }, lazyList(el('div', { class: 'poster-grid compact' }), similar, x => posterCard(x, 'simili'), 4))
            : el('p', { class: 'muted tp-none' }, 'Non ci sono altri titoli con gli stessi generi.')),
      el('div', { class: 'tp-bar' }, playButton(t, point, { big: true, label: shortPlayLabel(t, point, true) }), bookmarkButton(t))];
  }
  // Scorrendo la scheda, l'immagine resta quasi ferma (sale molto più piano del contenuto) e si scurisce; la X, i tre puntini e il tasto in basso non si muovono.
  let titleFrame = 0;
  function titleScroll() {
    const dialog = $('#title-dialog'); const art = $('#title-content .tp-art'); const dim = $('#title-content .tp-dim'); if (!art || !dim) return;
    const y = Math.max(0, dialog.scrollTop); const share = clamp(y / Math.max(1, (art.offsetHeight || 400) * 0.8), 0, 1);
    $('#title-content .tp-top')?.classList.toggle('solid', y > (art.offsetHeight || 400) * 0.62);
    dim.style.opacity = (share * 0.92).toFixed(3); art.style.transform = reduce() ? '' : `translate3d(0,${(-y * 0.16).toFixed(1)}px,0)`;
  }
  const seasonName = s => s === 0 ? 'Episodi speciali' : `Stagione ${s}`;
  // Telefono: cambio stagione sul posto. Si sostituisce solo l'elenco; la scheda non salta (se la fila delle stagioni era incollata sotto la barra, resta lì).
  function pickSeason(t, s) {
    const dialog = $('#title-dialog'); const row = $('#title-content .tp-seasons'); const section = $('#title-content .tp-episodes'); if (!row || !section) return;
    const before = row.getBoundingClientRect().top; const left = row.scrollLeft;
    open.season = s; open.block = null;
    section.replaceWith(episodesBlock(t, resumePoint(t, state.items, state.progress), s));
    const next = $('#title-content .tp-seasons'); if (next) { next.scrollLeft = left; dialog.scrollTop += next.getBoundingClientRect().top - before; }
    titleScroll();
  }
  function episodesBlock(t, point, season) {
    const all = t.episodes.filter(i => i.season === season); const desc = storage.get('ep-order', 'asc') === 'desc';
    const blocks = []; for (let i = 0; i < all.length; i += BLOCK) blocks.push(all.slice(i, i + BLOCK));
    const current = Math.max(0, blocks.findIndex(b => b.some(i => i.id === point.item.id)));
    const at = open.block != null && open.block < blocks.length ? open.block : current;
    const label = b => b.length === 1 ? String(b[0].episode) : `${b[0].episode}–${b.at(-1).episode}`;
    const shown = desc ? [...blocks[at]].reverse() : blocks[at];
    const chipsRow = !wide() && t.seasons.length > 1 ? el('div', { class: 'tp-seasons', role: 'group', 'aria-label': 'Stagioni' }, ...t.seasons.map(s => el('button', { class: 'season-chip', 'aria-pressed': String(s === season), onclick: () => pickSeason(t, s) }, seasonName(s)))) : null;
    const picker = chipsRow ? null : t.seasons.length > 1
      ? el('button', { class: 'season-button', 'aria-haspopup': 'dialog', 'aria-label': `Scegli la stagione, ora ${seasonName(season)}`, onclick: () => sheet(t.title, t.seasons.map(s => ({
        icon: s === season ? 'check' : 'episodes', label: seasonName(s), sub: quantity(t.episodes.filter(i => i.season === s).length, 'episodio', 'episodi'), pressed: s === season, run: () => { open.season = s; open.block = null; paintTitle(); } }))) }, el('span', {}, seasonName(season)), vIcon('down'))
      : el('strong', { class: 'season-single' }, seasonName(season));
    const chips = blocks.length > 1
      ? el('div', { class: 'ep-blocks', role: 'group', 'aria-label': 'Gruppi di episodi' }, ...(desc ? [...blocks.keys()].reverse() : [...blocks.keys()]).map(n => el('button', { class: 'ep-block', 'aria-pressed': n === at, 'aria-label': `Episodi ${label(blocks[n])}`, onclick: () => { open.block = n; paintTitle(); } }, label(blocks[n]))))
      : el('span', { class: 'ep-count' }, quantity(all.length, 'episodio', 'episodi'));
    const tools = el('div', { class: 'ep-tools' },
      all.length > 1 ? el('button', { class: 'ep-tool', 'aria-label': desc ? 'Ordine: dal più recente. Passa al più vecchio' : 'Ordine: dal primo. Passa al più recente', title: desc ? 'Dal più recente' : 'Dal primo', onclick: () => { storage.set('ep-order', desc ? 'asc' : 'desc'); paintTitle(); } }, vIcon('sort')) : null,
      all.length > BLOCK ? el('button', { class: 'ep-tool', 'aria-label': 'Vai all’episodio…', title: 'Vai all’episodio…', onclick: action(() => gotoEpisode(all)) }, vIcon('jump')) : null);
    return el('section', { class: 'tp-episodes', 'aria-labelledby': 'tp-episodes-title' }, chipsRow, el('div', { class: 'tp-ep-head' }, el('h3', { id: 'tp-episodes-title' }, 'Episodi'), picker),
      el('div', { class: 'ep-bar' }, chips, tools),
      lazyList(el('ol', { class: 'ep-list' }), shown, item => episodeRow(t, item, point), 4));
  }
  // Si disegnano subito i primi `now` elementi e gli altri subito dopo il primo fotogramma; con `eager` tutto insieme.
  let eager = true; // solo l'apertura della scheda disegna a tappe; i ridisegni (scorrimento già fatto) sono completi
  function lazyList(list, entries, build, now) {
    const first = eager ? entries.length : now; list.append(...entries.slice(0, first).map(build));
    if (entries.length > first) { const token = list; setTimeout(() => { if (token.isConnected) token.append(...entries.slice(first).map(build)); }, 0); }
    return list;
  }
  async function gotoEpisode(all) {
    const first = all[0].episode; const last = all.at(-1).episode;
    const value = await c.ask('Vai all’episodio', '', `Scrivi un numero da ${first} a ${last}.`); if (!value) return;
    const target = all.find(i => i.episode === parseInt(value, 10));
    if (!target) { notify(`L’episodio ${String(value).trim()} non c’è: vanno dal ${first} al ${last}.`); return; }
    open.block = Math.floor(all.indexOf(target) / BLOCK); paintTitle();
    const node = [...$('#title-content').querySelectorAll('.ep')].find(n => n.dataset.ep === target.id);
    node?.scrollIntoView({ block: 'center', behavior: 'auto' }); node?.classList.add('ping'); setTimeout(() => node?.classList.remove('ping'), 1400);
  }
  function episodeRow(t, item, point) {
    const p = state.progress[item.id]; const watched = !!p?.watched; const length = p?.duration || item.duration || 0;
    const share = watched ? 1 : p?.position && length ? p.position / length : 0;
    const here = point.item.id === item.id; const flagged = (item.controllare || []).length > 0;
    const note = [here && point.resume && !point.next && share ? remainingText(p.position, length) : null, here ? (point.resume ? 'Riprendi da qui' : null) : null, watched ? 'Visto' : null, item.remote && item.remoteDown ? 'Fisso spento' : null, flagged ? 'Salti da controllare' : null].filter(Boolean).join(' · ');
    return el('li', { class: `ep${here ? ' current' : ''}${watched ? ' seen' : ''}${flagged ? ' flagged' : ''}${item.remote && item.remoteDown ? ' ep-off' : ''}`, 'data-ep': item.id, 'aria-current': here ? 'true' : undefined },
      el('button', { class: 'ep-open', 'aria-label': `Riproduci episodio ${item.episode}, ${item.title}`, onclick: action(() => c.playItem(item)) },
        tinted(el('span', { class: 'ep-art' }, picture(thumbSrc(item)), el('span', { class: 'c-play', 'aria-hidden': 'true' }, vIcon('play')),
          item.duration ? el('span', { class: 'ep-time', 'aria-hidden': 'true' }, durationText(item.duration)) : null, share ? bar(share) : null), t.title),
        el('span', { class: 'ep-text' }, el('strong', {}, `${item.episode}. ${item.title}`), note ? el('small', {}, note) : null)),
      c.downloads ? episodeDownload(item) : null,
      el('button', { class: 'ep-seen', 'aria-pressed': watched, 'aria-label': `${watched ? 'Togli visto' : 'Segna visto'}: episodio ${item.episode}`, title: watched ? 'Togli visto' : 'Segna visto', onclick: action(() => markOne(item, !watched)) }, vIcon('check')),
      item.description ? el('p', { class: 'ep-desc' }, item.description) : null);
  }
  function similarBlock(t) {
    const similar = similarTitles(t, titles, 12); if (!similar.length) return null;
    return el('section', { class: 'tp-similar' }, el('h3', {}, 'Titoli simili'), lazyList(el('div', { class: 'poster-grid compact' }), similar, x => posterCard(x, 'simili'), 4));
  }
  function goGenre(genre) { closeThen('#title-dialog', () => { if (!KIND_PAGES.includes(state.page)) c.setPage('home'); state.genre = genre; render(); window.scrollTo({ top: 0, behavior: 'instant' }); }); }

  // Livelli (scheda, lettore): ognuno aggiunge un passo alla cronologia, così «Indietro» chiude e non esce.
  const layers = new Map(); const afterBack = []; let pendingBack = 0; let popping = false;
  function pushLayer(name) {
    if (layers.has(name)) return;
    const depth = (history.state?.depth || 0) + 1; layers.set(name, depth);
    history.pushState({ layer: name, depth }, '');
  }
  function flushAfterBack() { while (afterBack.length) afterBack.shift()(); }
  function trackLayer(name, selector) {
    $(selector).addEventListener('close', () => {
      const depth = layers.get(name); layers.delete(name);
      if (name === 'title') hideHover();
      if (depth && !popping && (history.state?.depth || 0) >= depth) { pendingBack++; history.back(); } else flushAfterBack();
    });
  }
  function closeThen(selector, fn) { const node = $(selector); afterBack.push(fn); if (node.open) node.close(); else flushAfterBack(); }
  window.addEventListener('popstate', () => {
    if (pendingBack) { pendingBack--; flushAfterBack(); return; }
    const depth = history.state?.depth || 0;
    for (const [name, selector] of [['about', '#about-dialog'], ['player', '#video-dialog'], ['title', '#title-dialog']]) {
      if ((layers.get(name) || 0) > depth && $(selector).open) { popping = true; try { $(selector).close(); } finally { popping = false; } }
    }
  });

  // Anteprima al passaggio del mouse (solo PC): dopo 400 ms la locandina si apre in un riquadro 16:9.
  let hoverTimer = 0; let hoverNode = null; let hoverCard = null;
  const canHover = () => matchMedia('(hover: hover) and (pointer: fine) and (min-width: 900px)').matches && !isTv();
  function hoverable(button, t) {
    button.addEventListener('pointerenter', () => {
      if (!canHover() || !button.closest('.v-track') || hoverCard === button) return;
      clearTimeout(hoverTimer); hoverTimer = setTimeout(() => showHover(button, t), 400);
    });
    button.addEventListener('pointerleave', event => { clearTimeout(hoverTimer); if (hoverCard === button && !hoverNode?.contains(event.relatedTarget)) hideHover(); });
  }
  function showHover(card, t) {
    hideHover(); if (!card.isConnected || !card.matches(':hover')) return;
    const r = card.getBoundingClientRect(); if (!r.width) return;
    const width = Math.round(Math.max(r.width * 1.9, 320)); const left = clamp(r.left + r.width / 2 - width / 2, 16, innerWidth - width - 16);
    const point = resumePoint(t, state.items, state.progress); const on = listed(t.key);
    const node = el('div', { class: 'hover-card', role: 'group', 'aria-label': `Anteprima di ${t.title}` },
      el('button', { class: 'hv-art', tabindex: '-1', 'aria-label': `Apri ${t.title}`, onclick: () => openTitle(t.key) },
        tinted(el('span', { class: 'hv-frame' }, picture(backdropSrc(t.art, 640), '', true), el('span', { class: 'hv-name' }, t.title)), t.title)),
      el('div', { class: 'hv-body' },
        el('div', { class: 'hv-actions' },
          el('button', { class: 'round play', 'aria-label': `${playLabel(t, point)}: ${t.title}`, title: playLabel(t, point), onclick: action(() => { hideHover(); return c.playItem(point.item); }) }, vIcon('play')),
          el('button', { class: 'round', 'aria-pressed': on, 'aria-label': on ? 'Togli dalla mia lista' : 'Aggiungi alla mia lista', title: on ? 'Togli dalla mia lista' : 'Aggiungi alla mia lista', onclick: action(async () => { await toggleList(t); hideHover(); }) }, vIcon(on ? 'check' : 'plus')),
          el('button', { class: 'round', 'aria-pressed': t.watched, 'aria-label': t.watched ? 'Togli dai visti' : 'Segna visto', title: t.watched ? 'Togli dai visti' : 'Segna visto', onclick: action(async () => { await toggleWatched(t); hideHover(); }) }, vIcon('check')),
          el('button', { class: 'round push', 'aria-label': `Altre informazioni su ${t.title}`, title: 'Altre informazioni', onclick: () => openTitle(t.key) }, vIcon('down'))),
        metaLine(t), t.genres.length ? el('p', { class: 'hv-genres' }, t.genres.slice(0, 3).join(' • ')) : null));
    hued(node, '--w', `${width}px`); hued(node, '--x', `${Math.round(left)}px`);
    node.addEventListener('pointerleave', event => { if (!card.contains(event.relatedTarget)) hideHover(); });
    document.body.append(node); hoverNode = node; hoverCard = card;
    const height = node.offsetHeight; hued(node, '--y', `${Math.round(clamp(r.top + r.height / 2 - height / 2, 72, innerHeight - height - 12))}px`);
    const cards = [...card.parentElement.children]; const index = cards.indexOf(card); const shift = Math.round((width - r.width) / 5);
    cards.forEach((n, j) => { if (j !== index) hued(n, '--shift', `${j < index ? -shift : shift}px`); });
    card.parentElement.classList.add('hovering'); card.classList.add('hovered');
    requestAnimationFrame(() => node.classList.add('open'));
  }
  function hideHover() {
    clearTimeout(hoverTimer); if (!hoverNode) return;
    const track = hoverCard?.parentElement; track?.classList.remove('hovering'); hoverCard?.classList.remove('hovered');
    for (const n of track?.children || []) n.style.removeProperty('--shift');
    hoverNode.remove(); hoverNode = null; hoverCard = null;
  }

  // «Chi guarda?» all'apertura, e il menu del profilo dall'avatar in alto a destra.
  function paintWho() {
    const profiles = state.boot?.profiles || [];
    $('#who-title').textContent = whoEditing ? 'Gestisci i profili' : profiles.length ? 'Chi guarda?' : 'Crea il primo profilo';
    $('#who-hint').hidden = whoEditing || profiles.length > 0; $('#who-manage').hidden = !profiles.length;
    $('#who-manage').textContent = whoEditing ? 'Fatto' : 'Gestisci profili'; $('#who-manage').setAttribute('aria-pressed', String(whoEditing));
    $('#who-list').replaceChildren(...profiles.map(p => el('button', { class: `who-tile${whoEditing ? ' editing' : ''}`, 'aria-label': whoEditing ? `Rinomina ${p.name}` : p.name, onclick: action(() => whoEditing ? renameProfile(p) : chooseProfile(p)) },
      face(p, 'who-face'), whoEditing ? el('span', { class: 'who-edit', 'aria-hidden': 'true' }, vIcon('edit')) : null, el('span', { class: 'who-name' }, p.name))),
    el('button', { class: 'who-tile who-add', 'aria-label': 'Aggiungi un profilo', onclick: () => $('#add-profile').click() }, el('span', { class: 'who-face', 'aria-hidden': 'true' }, vIcon('plus')), el('span', { class: 'who-name' }, 'Aggiungi')));
  }
  function askWho() { whoEditing = false; paintWho(); if (!$('#who-dialog').open) c.showDialog('#who-dialog'); }
  function maybeAskWho() {
    let seen = false; try { seen = sessionStorage.getItem(WHO_KEY) === '1'; } catch { seen = true; }
    if (!seen && (VIDEO_PAGES.includes(state.page) || !(state.boot?.profiles || []).length)) askWho();
  }
  // Profilo appena creato da «Chi guarda?»: se era il primo (o si stava scegliendo) si entra subito, altrimenti si aggiorna la lista.
  function profileAdded(p) { if (whoEditing) { paintWho(); paintAvatar(); } else chooseProfile(p); }
  function chooseProfile(p) {
    try { sessionStorage.setItem(WHO_KEY, '1'); } catch { /* Navigazione privata: si richiede alla prossima apertura. */ }
    $('#who-dialog').close();
    if (p.id !== state.profile) { const select = $('#profile'); select.value = p.id; select.dispatchEvent(new Event('change')); } else { paintAvatar(); render(); }
  }
  async function renameProfile(p) {
    const name = await c.ask('Nuovo nome del profilo', p.name, 'Il nome si vede in «Chi guarda?» e nel menu del profilo.'); if (!name) return;
    Object.assign(p, await api('/api/profiles/name', { method: 'PUT', data: { id: p.id, name } }));
    c.populateProfiles(); paintWho(); paintAvatar(); notify(`Ora si chiama ${p.name}.`);
  }
  function paintAvatar() {
    const me = profileOf(state.profile); const button = $('#avatar-button');
    button.replaceChildren(profileVisual(el, me)); button.classList.toggle('photo-face', !!me.avatar); tinted(button, me.name);
    button.setAttribute('aria-label', `Profilo di ${me.name} e impostazioni`); button.title = me.name;
    const mark = $('#video-nav [data-page=account] .nav-icon'); if (mark) { mark.replaceChildren(face(me, 'nav-face')); tinted(mark, me.name); }
  }
  // Le due scelte del profilo. Il passaggio all'episodio successivo è acceso di base; il salto automatico è SPENTO
  // di base (12/11): compare il pulsante «Salta» e decide chi guarda. Acceso, salta solo i tratti riconosciuti con certezza.
  const videoPref = key => key === 'autoSkip' ? profileOf(state.profile)[key] === true : profileOf(state.profile)[key] !== false;
  async function setVideoPref(key) {
    const me = profileOf(state.profile); const result = await api('/api/profiles/preferences', { method: 'PUT', data: { profile: state.profile, [key]: !videoPref(key) } });
    Object.assign(me, result); c.syncVideoPreferences(); notify(`${key === 'autoSkip' ? 'Salto automatico' : 'Episodio successivo da solo'}: ${videoPref(key) ? 'acceso' : 'spento'}.`);
  }
  function avatarMenu() {
    const tv = isTv();
    sheet(profileOf(state.profile).name, [
      ...(state.boot?.profiles || []).map(p => ({ node: face(p, 'face small'), label: p.name, sub: p.id === state.profile ? 'Sta guardando ora' : 'Passa a questo profilo', pressed: p.id === state.profile, run: () => chooseProfile(p) })),
      { icon: 'fwd10', toggle: true, label: 'Salta da solo sigle e riassunti', sub: videoPref('autoSkip') ? 'Acceso: salta da solo solo i tratti sicuri; per gli altri resta il pulsante' : 'Spento: compare il pulsante «Salta» e decidi tu', pressed: videoPref('autoSkip'), run: () => setVideoPref('autoSkip') },
      { icon: 'episodes', toggle: true, label: 'Passa da solo all’episodio successivo', sub: videoPref('autoNext') ? 'Acceso' : 'Spento', pressed: videoPref('autoNext'), run: () => setVideoPref('autoNext') },
      { icon: 'speed', toggle: true, label: 'Versione leggera fuori casa o con rete lenta', sub: 'Usa la copia più piccola quando la rete non basta; a casa resta l’originale', pressed: c.lightModeOn(), run: async () => { const on = !c.lightModeOn(); await c.switchQuality(on ? 'auto' : 'original'); notify(`Versione leggera: ${on ? 'accesa' : 'spenta'}.`); } },
      { icon: 'people', label: 'Cambia chi guarda', sub: 'Apri «Chi guarda?» e gestisci i profili', run: askWho },
      { icon: 'save', label: 'Scaricati', sub: 'Video e musica salvati su questo telefono', run: () => c.setPage('scaricati') },
      { icon: 'key', label: 'Gestisci la raccolta', sub: 'File, copertine, descrizioni e sigle', run: () => c.setPage('manage') },
      { icon: 'tv', toggle: true, label: tv ? 'Esci dalla modalità TV' : 'Modalità TV', sub: 'Elementi grandi e comandi con le frecce', pressed: tv, run: () => $('#tv-toggle').click() },
      { icon: 'help', label: 'Come si usa', sub: 'Profili, TV, musica e gestione', run: () => $('#help-open').click() }]);
  }

  // La barra in alto è trasparente sopra l'immagine in evidenza e diventa nera piena quando la si lascia indietro.
  let heroH = 0;
  function syncTop() { document.body.classList.toggle('over-hero', heroH > 0 && window.scrollY < heroH - 64); }
  function measureHero() { const h = wide() ? null : $('#video-view .bb-picture, #video-view .ac-hero'); heroH = h ? h.offsetHeight : 0; syncTop(); }

  // Disegno della pagina. Ricorda lo scorrimento di ogni pagina e di ogni riga, e il fuoco sulla scheda.
  function render() {
    if (!state.boot) return;
    titles = buildTitles(state.items, state.progress);
    if (listFor !== state.profile && !listLoading && !state.offline) {
      list = [];
      const requestedProfile = state.profile;
      listLoading = loadList().catch(() => {}).finally(() => { listLoading = null; if (listFor === state.profile || requestedProfile !== state.profile) render(); });
    }
    paintAvatar();
    $('#video-nav [data-page=esplora]')?.setAttribute('aria-pressed', String(['esplora', 'film', 'series', 'anime'].includes(state.page)));
    $('#genres-open').replaceChildren(el('span', {}, state.genre || 'Generi'), vIcon('down'));
    $('#genres-open').setAttribute('aria-label', state.genre ? `Genere: ${state.genre}. Cambia genere` : 'Generi');
    if ($('#who-dialog').open) paintWho();
    if ($('#title-dialog').open) paintTitle();
    const page = state.page;
    if (!VIDEO_PAGES.includes(page)) { shown = ''; hideHover(); return; }
    const view = $('#video-view'); const key = `${page}|${state.genre}`;
    if (page === 'cerca' && shown === key && view.querySelector('.search-input')) { paintResults(); return; }
    const focused = view.contains(document.activeElement) ? document.activeElement.closest('[data-fk]')?.dataset.fk : null;
    hideHover();
    const nodes = page === 'scaricati' ? c.downloadsView() : page === 'esplora' ? esploraView() : page === 'account' ? accountView() : page === 'novita' ? novitaView() : page === 'cerca' ? searchView() : page === 'lista' ? listView() : browseView(page);
    fill(view, nodes); view.dataset.page = page;
    if (page === 'cerca') paintResults();
    for (const track of view.querySelectorAll('.v-track')) {
      const left = rowScroll.get(track.dataset.memory); if (left) track.scrollLeft = left;
      requestAnimationFrame(() => edges(track.parentElement, track));
    }
    if (shown !== key) {
      window.scrollTo({ top: pageScroll.get(key) || 0, behavior: 'instant' });
      if (!reduce()) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    }
    shown = key; measureHero();
    if (focused) view.querySelector(`[data-fk="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    if (isTv()) requestAnimationFrame(() => {
      if ((!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected) && !c.activeDialog()) c.focusTvStart();
    });
  }

  function init() {
    for (const node of document.querySelectorAll('[data-vicon]')) node.replaceChildren(vIcon(node.dataset.vicon));
    $('#top-search').replaceChildren(vIcon('search'));
    $('#top-search').addEventListener('click', () => { if (state.page !== 'cerca') c.setPage('cerca'); requestAnimationFrame(() => $('#video-view .search-input')?.focus()); });
    $('#genres-open').addEventListener('click', genreSheet);
    $('#avatar-button').addEventListener('click', avatarMenu);
    $('#who-manage').addEventListener('click', () => { whoEditing = !whoEditing; paintWho(); });
    $('#who-dialog').addEventListener('close', () => { try { sessionStorage.setItem(WHO_KEY, '1'); } catch { /* vedi sopra */ } });
    $('#title-dialog').addEventListener('scroll', () => { if (!titleFrame) titleFrame = requestAnimationFrame(() => { titleFrame = 0; titleScroll(); }); }, { passive: true });
    trackLayer('about', '#about-dialog'); trackLayer('title', '#title-dialog'); trackLayer('player', '#video-dialog');
    window.addEventListener('scroll', () => {
      const y = window.scrollY; document.body.classList.toggle('scrolled', y > 8); syncTop();
      if (VIDEO_PAGES.includes(state.page) && shown === `${state.page}|${state.genre}`) pageScroll.set(shown, y);
      if (hoverNode) hideHover();
      if (Math.abs(y - lastY) < 6) return;
      document.body.classList.toggle('chips-hidden', y > lastY && y > 90); lastY = y;
    }, { passive: true });
    window.addEventListener('resize', () => { hideHover(); measureHero(); });
    matchMedia('(min-width: 900px)').addEventListener('change', () => { shown = ''; render(); });
    // TV: lo scorrimento della pagina e delle righe lo fa tv-nav.js. Qui: tenere premuto OK su una locandina apre le opzioni
    // (sulla TV i tastini «⋯» e «i» delle locandine non ci sono). OK premuto e lasciato subito apre come sempre.
    let hold = null;
    const dropHold = () => { if (hold) clearTimeout(hold.timer); hold = null; };
    document.addEventListener('keydown', event => {
      if (!isTv() || event.key !== 'Enter' || c.activeDialog()) return;
      const card = event.target.closest?.('#video-view .c-open,#video-view .t-card'); if (!card) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (hold) return;
      hold = { card, fired: false, timer: setTimeout(() => { if (hold) { hold.fired = true; cardOptions(card); } }, 650) };
    }, true);
    document.addEventListener('keyup', event => {
      if (!hold || event.key !== 'Enter') return;
      const { card, fired } = hold; dropHold(); event.preventDefault();
      if (!fired && card.isConnected) card.click();
    }, true);
    window.addEventListener('blur', dropHold);
  }
  function cardOptions(card) {
    if (card.matches('.c-open')) { card.closest('.c-card')?.querySelector('.c-more')?.click(); return; }
    const t = titles.find(x => x.key === card.dataset.key); if (t) titleMenu(t);
  }

  return { init, render, loadList, openTitle, askWho, maybeAskWho, profileAdded, pushLayer, closeThen, titles: () => titles };
}
