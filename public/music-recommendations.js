export async function playlistRecommendations(c, host, generation, songs, add) {
  const { el, action, api, state } = c; let shown = []; let busy = false;
  const refresh = async () => {
    if (busy || generation !== state.musicGeneration) return; busy = true;
    host.setAttribute('aria-busy', 'true');
    try {
      const result = await api('/api/music/recommendations', { method: 'POST', data: { ids: songs().map(s => s.id), exclude: shown.slice(-2000) } });
      if (generation !== state.musicGeneration) return;
      shown.push(...result.songs.map(s => s.id));
      host.replaceChildren(el('h2', {}, 'Brani consigliati'), el('p', { class: 'muted' }, 'Scelti dalla musica di casa, vicini al suono della playlist.'),
        el('button', { class: 'secondary', onclick: action(refresh) }, 'Aggiorna consigli'),
        ...result.songs.map(song => el('div', { class: 'actions recommendation' }, el('button', { class: 'quiet', onclick: () => c.setQueue([song]) }, `${song.title} · ${song.artist || ''}`),
          el('button', { class: 'secondary', 'aria-label': `Aggiungi ${song.title} alla playlist`, onclick: action(async e => { const button = e.currentTarget; button.disabled = true; try { await add(song); button.closest('.recommendation')?.remove(); } catch (error) { button.disabled = false; throw error; } }) }, '+'))),
        ...(!result.songs.length ? [el('p', { role: 'status' }, 'Non ci sono altri brani da proporre. I brani già in playlist restano esclusi.')] : []));
    } finally { busy = false; host.removeAttribute('aria-busy'); }
  }; await refresh();
}
