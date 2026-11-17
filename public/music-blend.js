// "Miscela": playlist di 30 brani con i gusti di due profili della casa. Caricato solo quando si sceglie un profilo.
export const whoLabel = (who, otherName) => ({ mine: 'Piace a te', other: `Piace a ${otherName}`, both: 'Piace a tutti e due' })[who] || '';
export const affinityText = percent => `Siete in sintonia al ${percent}%`;
export const savedName = (r) => `Miscela ${r.profiles.mine} e ${r.profiles.other} · ${r.day.split('-').reverse().join('/')}`;
export function emptyText(r, mineName, otherName) {
  const who = [[mineName, r.mine], [otherName, r.other]].filter(([, n]) => n < r.needed)
    .map(([name, n]) => `${name} ha ${n === 0 ? 'ancora nessun ascolto' : n === 1 ? 'solo 1 ascolto' : `solo ${n} ascolti`}`).join(' e ');
  return `${who}. Per creare la Miscela servono almeno ${r.needed} ascolti a testa: un ascolto conta dopo 20 secondi. Ascoltate un po’ di musica, ognuno dal proprio profilo, e riprovate.`;
}
export function blendView(c, r, other) {
  const { el, action, api, notify } = c;
  if (r.empty) return [el('div', { class: 'empty', role: 'status' }, el('h3', {}, 'La Miscela non è ancora pronta'), el('p', {}, emptyText(r, r.profiles.mine, r.profiles.other)))];
  if (!r.songs.length) return [el('div', { class: 'empty', role: 'status' }, el('h3', {}, 'Nessun brano adatto'), el('p', {}, 'Nel catalogo non ci sono ancora brani da mescolare per voi due. Torna a provare dopo aver aggiunto altra musica.'))];
  let saved = false;
  const save = el('button', { class: 'secondary', onclick: action(async () => {
    if (saved) return; save.disabled = true;
    try { await api('/api/music/playlist', { method: 'POST', data: { name: savedName(r), songs: r.songs.map(s => s.id) } }); saved = true; save.textContent = 'Playlist salvata ✓'; notify('Playlist salvata: la trovi in La tua libreria.'); }
    finally { save.disabled = saved; }
  }) }, 'Salva come playlist');
  return [el('section', { class: 'collection-heading' }, el('p', { class: 'welcome' }, 'MISCELA'), el('h2', {}, `${r.profiles.mine} e ${r.profiles.other}`),
      el('p', { class: 'blend-score', role: 'status' }, affinityText(r.affinity)),
      el('p', { class: 'muted' }, `${r.songs.length} brani · aggiornata oggi · cambia da sola ogni giorno`),
      el('div', { class: 'actions' }, el('button', { class: 'primary', onclick: () => c.setQueue(r.songs, 0) }, '▶ Ascolta la Miscela'), save)),
    el('ol', { class: 'blend-list', 'aria-label': 'Brani della Miscela' }, ...r.songs.map((s, i) => el('li', {},
      el('button', { class: 'blend-play', 'aria-label': `Ascolta ${s.title}`, onclick: () => c.setQueue(r.songs, i) }, el('img', { src: c.image(s.coverArt || s.albumId, 80), alt: '', loading: 'lazy' }),
        el('span', { class: 'track-text' }, el('strong', {}, s.title), el('small', {}, s.artist || 'Artista sconosciuto'))),
      el('span', { class: `blend-who ${s.who}` }, whoLabel(s.who, other.name)))))];
}
export async function showBlend(c, other) {
  const { el, api, state } = c; const generation = ++state.musicGeneration;
  const root = document.querySelector('#music-results'), crumb = document.querySelector('#music-breadcrumb');
  document.querySelector('#more-albums').hidden = true;
  c.visit?.(`blend:${other.id}`, `Miscela con ${other.name}`, () => showBlend(c, other), 'library'); crumb.replaceChildren();
  root.replaceChildren(el('div', { class: 'music-skeleton skeleton-list', role: 'status', 'aria-label': 'Mescolo i vostri gusti' }, el('span', { class: 'skeleton-block hero' })));
  try {
    const result = await api(`/api/music/blend?profile=${encodeURIComponent(state.profile)}&with=${encodeURIComponent(other.id)}`);
    if (generation === state.musicGeneration) root.replaceChildren(...blendView(c, result, other));
  } catch (e) {
    if (generation === state.musicGeneration) root.replaceChildren(el('div', { class: 'empty' }, el('p', {}, e.message), el('button', { class: 'secondary', onclick: () => showBlend(c, other) }, 'Riprova')));
  }
}
