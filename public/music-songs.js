// «Tutti i brani»: l'intera raccolta in un elenco virtuale (solo le righe visibili esistono nella pagina).

const many = n => `${n.toLocaleString('it-IT')} ${n === 1 ? 'brano' : 'brani'}`;

export const SORTS = [['title', 'Titolo'], ['artist', 'Artista'], ['album', 'Album'], ['added', 'Aggiunti di recente'], ['duration', 'Durata']];
const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });
const by = key => (a, b) => collator.compare(a[key] || '', b[key] || '') || collator.compare(a.title || '', b.title || '');
const squash = value => String(value || '').toLocaleLowerCase('it').normalize('NFD').replace(/[̀-ͯ]/g, '');
export function sortSongs(songs, sort = 'title', filter = '') {
  const words = squash(filter).split(/\s+/).filter(Boolean);
  const list = words.length ? songs.filter(s => { const hay = squash(`${s.title} ${s.artist} ${s.album}`); return words.every(w => hay.includes(w)); }) : songs.slice();
  const stamp = s => Date.parse(s.created) || 0;
  const order = { title: by('title'), artist: (a, b) => by('artist')(a, b) || (a.track || 0) - (b.track || 0), album: (a, b) => by('album')(a, b) || (a.track || 0) - (b.track || 0),
    added: (a, b) => stamp(b) - stamp(a) || by('title')(a, b), duration: (a, b) => (a.duration || 0) - (b.duration || 0) || by('title')(a, b) };
  return list.sort(order[sort] || order.title);
}
export function shuffled(songs, random = Math.random) {
  const list = songs.slice();
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}
export async function showSongs(c, generation) {
  const { el, api, state, storage } = c; const key = `${c.key()}:songs`;
  const { songs, total } = await api('/api/music/songs'); if (generation !== state.musicGeneration) return;
  const p = storage.get(key, { sort: 'title' }); let filter = '';
  const root = document.querySelector('#music-results');
  const count = el('p', { class: 'muted songs-count', role: 'status' }); const holder = el('div', { class: 'songs-holder' });
  let shown = [];
  const paint = () => {
    shown = sortSongs(songs, p.sort, filter);
    count.textContent = filter ? `${many(shown.length)} su ${total.toLocaleString('it-IT')}` : many(total);
    holder.replaceChildren(shown.length ? c.trackList(shown) : el('p', { class: 'muted' }, filter ? 'Nessun brano con queste parole. Prova a scriverne meno.' : 'Qui non ci sono ancora brani.'));
  };
  const sort = el('select', { 'aria-label': 'Ordina i brani', onchange: e => { p.sort = e.target.value; storage.set(key, p); paint(); } },
    ...SORTS.map(([id, name]) => el('option', { value: id, selected: p.sort === id }, name)));
  let timer; const search = el('input', { type: 'search', id: 'songs-filter', placeholder: 'Cerca fra i brani…', 'aria-label': 'Cerca fra tutti i brani', oninput: e => { clearTimeout(timer); timer = setTimeout(() => { filter = e.target.value; paint(); }, 120); } });
  root.replaceChildren(el('section', { class: 'all-songs' },
    el('div', { class: 'collection-heading' }, el('h2', {}, 'Tutti i brani'), count),
    el('div', { class: 'actions' },
      el('button', { class: 'primary', id: 'songs-play-all', onclick: () => c.setQueue(shown, 0) }, '▶ Riproduci tutto'),
      el('button', { class: 'secondary', id: 'songs-shuffle', onclick: () => c.setQueue(shuffled(shown), 0) }, 'Casuale'), sort),
    el('label', { class: 'search' }, el('span', { class: 'sr-only' }, 'Cerca fra i brani'), search), holder));
  paint();
}
