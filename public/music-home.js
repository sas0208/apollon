// Giro E: la home della musica. Avatar e filtri, griglia rapida 2×4, poi scaffali di copertine.
import { art, lazyArt, shelf, card, quickTile, avatar, artistArt, initials } from './music-shell.js';

export const MOOD_GLYPHS = { Energia: '↗', Festa: '✦', Relax: '≈', Concentrazione: '◎', Malinconia: '☂', Notte: '☾', 'Soul e jazz': '♫', Grinta: 'ϟ', 'In viaggio': '➜' };
let filter = 'all';

function framed(el, box, band) { return el('span', { class: 'art-frame' }, box, el('span', { class: 'art-band' }, band)); }

export function renderHome(c, { home, albums = [], items = [], recent = [] }) {
  const { el, state, storage, image } = c;
  const prefs = storage.get(`${c.key()}:library`, {}) || {};
  const pins = Array.isArray(prefs.pins) ? prefs.pins : [], opened = prefs.recent && typeof prefs.recent === 'object' ? prefs.recent : {};
  const moods = home.available ? home.mood || [] : [], genres = home.available ? home.generi || [] : [];
  const playlists = items.filter(i => i.type === 'playlist');
  const artists = items.filter(i => i.type === 'artist').sort((a, b) => (Date.parse(b.last) || 0) - (Date.parse(a.last) || 0));
  const playlistArt = p => p.coverArt ? art(el, image, { ids: [p.coverArt], name: p.name }) : lazyArt(c, art(el, image, { name: p.name, glyph: '♪' }), 'playlist', p.id);
  const mixArt = m => framed(el, lazyArt(c, art(el, image, { name: `Mix ${m.nome}`, glyph: MOOD_GLYPHS[m.nome] || '♫' }), 'mood', m.nome, { shift: 1 }), m.nome);
  const playSongs = load => c.action(async () => { const songs = await load(); if (!songs.length) throw new Error('Qui non ci sono ancora brani da ascoltare.'); c.setQueue(songs, 0); });

  // Griglia rapida: fissati e aperti di recente prima, poi preferiti, playlist, album e mix.
  const candidates = [
    { key: 'liked', title: 'Brani che ti piacciono', cover: () => art(el, image, { name: 'Brani che ti piacciono', glyph: '♥' }), liked: true,
      open: () => c.load('liked'), play: playSongs(async () => (await c.api('/api/music/liked')).songs || []) },
    ...playlists.map(p => ({ key: `playlist:${p.id}`, title: p.name, cover: () => playlistArt(p), open: c.action(() => c.open(p)),
      play: playSongs(async () => (await c.api(`/api/music/playlist?id=${encodeURIComponent(p.id)}`)).playlist?.entry || []) })),
    ...albums.map(a => ({ key: `album:${a.id}`, title: a.name || 'Album senza titolo', cover: () => art(el, image, { ids: [a.coverArt], name: a.name }), open: c.action(() => c.open({ ...a, type: 'album' })),
      play: playSongs(async () => (await c.api(`/api/music/album?id=${encodeURIComponent(a.id)}`)).album?.song || []) })),
    ...moods.map(m => ({ key: `mix:${m.nome}`, title: `Mix · ${m.nome}`, cover: () => lazyArt(c, art(el, image, { name: `Mix ${m.nome}`, glyph: MOOD_GLYPHS[m.nome] || '♫' }), 'mood', m.nome, { shift: 1 }),
      open: c.action(() => c.showSelection({ kind: 'mix', mood: m.nome }, `Mix del giorno · ${m.nome}`)), play: c.action(() => c.startSelection({ kind: 'mix', mood: m.nome })) })),
    ...artists.filter(a => pins.includes(`artist:${a.id}`) || opened[`artist:${a.id}`]).map(a => ({ key: `artist:${a.id}`, title: a.name, cover: () => artistArt(c, a.name, a.coverArt, 80),
      open: c.action(() => c.open(a)), play: c.action(() => c.startSelection({ kind: 'radio', artist: a.id })) }))
  ];
  const rank = item => { const pin = pins.indexOf(item.key); return pin >= 0 ? 1e15 - pin : Number(opened[item.key]) || 0; };
  const quick = candidates.map((item, order) => ({ item, order, score: rank(item) })).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 8)
    .map(({ item }) => { const tile = quickTile(el, { cover: item.cover(), title: item.title, open: item.open, play: item.play }); if (item.liked) tile.classList.add('liked-tile'); return tile; });

  const others = (state.boot.profiles || []).filter(o => o.id !== state.profile);
  const me = (state.boot.profiles || []).find(p => p.id === state.profile) || { name: state.profile };
  const seen = new Set(); const heard = recent.filter(s => s && !seen.has(s.id) && seen.add(s.id)).slice(0, 12);
  const moment = card(el, { cover: art(el, image, { name: 'Il tuo momento', glyph: '◐' }), title: 'Il tuo momento', sub: 'La musica segue la giornata', label: 'Il tuo momento adesso', data: { 'data-music': 'moment' } });

  const shelves = [
    shelf(el, 'Le tue playlist', playlists.map(p => card(el, { cover: playlistArt(p), title: p.name, sub: `Playlist · ${p.songCount || 0} brani`, label: `Apri playlist ${p.name}`, onclick: c.action(() => c.open(p)) })), { kind: 'playlist' }),
    shelf(el, 'Mix per te', moods.map(m => card(el, { cover: mixArt(m), title: `Mix · ${m.nome}`, sub: m.descrizione || 'Cambia ogni giorno', label: `Mix · ${m.nome}`,
      onclick: c.action(() => c.showSelection({ kind: 'mix', mood: m.nome }, `Mix del giorno · ${m.nome}`)) })), { kind: 'mood' }),
    shelf(el, 'Il tuo momento', [moment, ...moods.map((m, i) => c.collectionCard(m, 'mood', i))], { kind: 'mood' }),
    shelf(el, 'Ascoltati di recente', heard.map((s, i) => card(el, { cover: art(el, image, { ids: [s.coverArt || s.albumId], name: s.album || s.title }), title: s.title, sub: s.artist || '', label: `Ascolta di nuovo ${s.title}`, onclick: () => c.setQueue(heard, i) }))),
    shelf(el, 'I tuoi artisti', artists.slice(0, 14).map(a => card(el, { cover: artistArt(c, a.name, a.coverArt), title: a.name, sub: 'Artista', label: `Apri artista ${a.name}`, round: true, onclick: c.action(() => c.open(a)) }))),
    shelf(el, 'I tuoi album', albums.slice(0, 14).map(c.albumCard), { kind: 'playlist' }),
    shelf(el, 'Generi', genres.map((g, i) => c.collectionCard(g, 'generi', i + 2)), { kind: 'genre' }),
    shelf(el, 'Miscela', others.map(o => card(el, { cover: art(el, image, { name: `${me.name} ${o.name}`, glyph: `${initials(me.name)[0]}+${initials(o.name)[0]}` }), title: `Miscela con ${o.name}`, sub: 'Due gusti, cambia ogni giorno', label: `Miscela con ${o.name}`,
      onclick: c.action(async () => (await import('./music-blend.js')).showBlend(c, o)) }))),
    shelf(el, 'Riscopri', [
      card(el, { cover: art(el, image, { name: 'Riscopri', glyph: '↺' }), title: 'Riscopri', sub: 'Preferiti che non senti da un po’', label: 'Riscopri', onclick: c.action(() => c.showSelection({ kind: 'rediscover' }, 'Riscopri')) }),
      card(el, { cover: art(el, image, { name: 'Mescola tutta la musica', glyph: '⤮' }), title: 'Mescola tutto', sub: 'Tutta la raccolta, in ordine sparso', label: 'Mescola tutta la musica', onclick: c.action(() => c.startSelection({ kind: 'shuffle' })) }),
      card(el, { cover: art(el, image, { name: 'Il tuo mese', glyph: '☼' }), title: 'Il tuo mese', sub: 'Quello che hai ascoltato', label: 'Il tuo mese', data: { 'data-music': 'recap' } })
    ])
  ].filter(Boolean);

  const root = el('div', { class: 'music-home', 'data-filter': filter });
  const chips = el('div', { class: 'chips', role: 'group', 'aria-label': 'Cosa mostrare nella home' }, ...[['all', 'Tutti'], ['mood', 'Mood'], ['genre', 'Generi'], ['playlist', 'Playlist']].map(([key, name]) =>
    el('button', { class: 'chip', 'data-home-filter': key, 'aria-pressed': key === filter, onclick: () => {
      filter = filter === key && key !== 'all' ? 'all' : key; root.dataset.filter = filter;
      chips.querySelectorAll('[data-home-filter]').forEach(b => b.setAttribute('aria-pressed', b.dataset.homeFilter === filter));
    } }, name)));
  root.append(el('div', { class: 'home-top' }, avatar(c), chips));
  if (quick.length) root.append(el('div', { class: 'quick-grid', role: 'group', 'aria-label': 'Ascoltati e fissati di recente' }, ...quick));
  if (!home.available || (!moods.length && !genres.length)) root.append(el('div', { class: 'catalog-note', role: 'status' }, el('strong', {}, 'La musica è tutta qui.'), el('p', {}, home.message || 'Non ci sono ancora mood o generi nel catalogo. Scegli un album o una playlist.')));
  root.append(...shelves);
  if (!albums.length) root.append(el('p', { class: 'muted' }, 'Non ci sono ancora album. Puoi cercare un brano o aprire le playlist.'));
  return root;
}
