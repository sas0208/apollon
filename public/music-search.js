import { art, artistArt, lazyArt, shellIcon } from './music-shell.js';
export function recentSearches(previous, query) {
  query = String(query || '').trim().slice(0, 250);
  return query ? [query, ...previous.filter(q => q.toLocaleLowerCase('it') !== query.toLocaleLowerCase('it'))].slice(0, 10) : previous;
}
export function remember(c, query) { const key = `${c.key()}:searches`; c.storage.set(key, recentSearches(c.storage.get(key, []), query)); }
let searchController;
export async function search(c, generation, query) {
  if (generation !== c.state.musicGeneration) return;
  searchController?.abort();
  const controller = searchController = new AbortController();
  const request = route => c.api(route, { signal: controller.signal });
  const { el, api, state, action } = c; const key = `${c.key()}:searches`;
  const root = document.querySelector('#music-results');
  const choose = q => { document.querySelector('#music-search').value = q; remember(c, q); c.load('browse'); };
  if (!query) {
    const home = await request('/api/music/home'); if (generation !== state.musicGeneration) return;
    const draw = () => {
      const recent = c.storage.get(key, []);
      const forget = q => { c.storage.set(key, c.storage.get(key, []).filter(r => r !== q)); draw(); };
      root.replaceChildren(el('div', { class: 'search-browse' },
        recent.length ? el('section', { class: 'search-recent' },
          el('div', { class: 'shelf-head' }, el('h2', {}, 'Ricerche recenti'), el('button', { class: 'quiet', onclick: () => { c.storage.set(key, []); draw(); } }, 'Cancella tutte le ricerche')),
          el('ul', { class: 'recent-list' }, ...recent.map(q => el('li', {}, el('button', { class: 'recent-query', onclick: () => choose(q) }, shellIcon('search'), el('span', {}, q)),
            el('button', { class: 'icon-button', 'aria-label': `Cancella ricerca ${q}`, title: 'Cancella', onclick: () => forget(q) }, shellIcon('close'))))))
          : el('div', { class: 'shelf-head' }, el('h2', {}, 'Ricerche recenti'), el('button', { class: 'quiet', disabled: true }, 'Cancella tutte le ricerche')),
        recent.length ? null : el('p', { class: 'muted' }, 'Le ricerche che scegli compariranno qui.'),
        el('h2', { class: 'browse-title' }, 'Sfoglia tutto'),
        el('div', { class: 'browse-grid' }, ...(home.mood || []).map((m, i) => c.collectionCard(m, 'mood', i)), ...(home.generi || []).map((m, i) => c.collectionCard(m, 'generi', i + 3))),
        !home.available ? el('p', { class: 'muted' }, 'Mood e generi non sono ancora disponibili. Cerca un titolo, un artista o un album.') : null));
    }; draw(); return;
  }
  const result = await request(`/api/music/search?q=${encodeURIComponent(query)}`);
  if (generation !== state.musicGeneration) return;
  const found = result.searchResult3 || {};
  const songs = found.song || [], artists = found.artist || [], albums = found.album || [], playlists = result.playlists?.playlist || [];
  const kinds = { song: 'Brano', album: 'Album', artist: 'Artista', playlist: 'Playlist' };
  const open = item => action(async () => { remember(c, query); if (item.type === 'song') c.setQueue(songs, songs.findIndex(s => s.id === item.id)); else await c.open(item); });
  const cover = (item, size) => item.type === 'artist' ? artistArt(c, item.name, item.coverArt, size)
    : item.type === 'playlist' && !item.coverArt ? lazyArt(c, art(el, c.image, { name: item.name, glyph: '♪', size }), 'playlist', item.id)
      : art(el, c.image, { ids: [item.coverArt || item.albumId], name: item.name, size });
  const needle = query.toLocaleLowerCase('it');
  const ranked = [...artists.map(i => ({ ...i, type: 'artist' })), ...albums.map(i => ({ ...i, type: 'album' })), ...playlists.map(i => ({ ...i, type: 'playlist' })), ...songs.map(i => ({ ...i, type: 'song', name: i.title }))];
  const best = ranked.find(i => (i.name || '').toLocaleLowerCase('it') === needle) || ranked.find(i => (i.name || '').toLocaleLowerCase('it').startsWith(needle)) || ranked[0];
  const tile = item => el('button', { class: `search-result shelf-card${item.type === 'artist' ? ' round-card' : ''}`, onclick: open(item) }, cover(item),
    el('h3', { class: 'shelf-title' }, item.name), el('small', { class: 'shelf-sub' }, [kinds[item.type], item.type === 'artist' ? '' : item.artist || item.owner].filter(Boolean).join(' · ')));
  const group = (title, list, type) => list.length ? el('section', { class: 'shelf search-group', 'data-shelf': type }, el('div', { class: 'shelf-head' }, el('h2', {}, title)),
    el('div', { class: 'shelf-row' }, ...list.map(i => tile({ ...i, type })))) : null;
  root.replaceChildren(el('section', { class: 'search-suggestions', 'aria-label': 'Suggerimenti di ricerca' }, el('h2', { class: 'sr-only' }, `Risultati per “${query}”`),
    best ? el('div', { class: 'search-top' },
      el('section', { class: 'top-result-box' }, el('h2', {}, 'Risultato migliore'),
        el('button', { class: `search-result top-result${best.type === 'artist' ? ' round-card' : ''}`, onclick: open(best) }, cover(best, 400),
          el('strong', {}, best.name), el('small', {}, [kinds[best.type], best.type === 'artist' ? '' : best.artist].filter(Boolean).join(' · ')))),
      songs.length ? el('section', { class: 'search-songs' }, el('h2', {}, 'Brani'), c.trackList(songs.slice(0, 5))) : null) : null,
    group('Artisti', artists, 'artist'), group('Album', albums, 'album'), group('Playlist', playlists, 'playlist'),
    songs.length > 5 ? el('section', { class: 'search-more-songs' }, el('h2', {}, 'Altri brani'), c.trackList(songs.slice(5))) : null,
    !ranked.length ? el('p', { role: 'status' }, 'Nessun risultato. Prova un altro nome.') : null));
}
