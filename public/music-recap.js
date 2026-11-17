const rank = map => [...map.values()].sort((a, b) => b.seconds - a.seconds || b.count - a.count || a.name.localeCompare(b.name, 'it'));
// «2026-11» → «novembre 2026», «2026» → «2026»: per chi legge, non per il server.
export function periodLabel(period) {
  const [year, month] = String(period).split('-');
  if (!month) return year;
  const names = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  return `${names[Number(month) - 1] || month} ${year}`;
}
export function musicRecap(events, catalog, period, timeZone = 'Europe/Rome') {
  if (!/^\d{4}(-(?:0[1-9]|1[0-2]))?$/.test(period)) throw new Error('Scegli un mese o un anno.');
  const songs = new Map(catalog.map(s => [s.id, s])); const seen = new Set();
  const tracks = new Map(), artists = new Map(), genres = new Map(), moods = new Map(), days = new Map(), hours = new Map();
  const add = (map, key, name, seconds) => { if (!key) return; const entry = map.get(key) || { id: key, name, seconds: 0, count: 0 }; entry.seconds += seconds; entry.count++; map.set(key, entry); };
  let seconds = 0, listens = 0;
  for (const e of events) {
    if (!e.playId || seen.has(e.playId) || !(e.seconds > 0) || !Number.isFinite(e.seconds)) continue;
    const date = new Date(e.at); if (!Number.isFinite(+date)) continue;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('it-IT', { timeZone, year: 'numeric', month: '2-digit', weekday: 'long', hour: '2-digit', hourCycle: 'h23' }).formatToParts(date).map(p => [p.type, p.value]));
    if (!`${parts.year}-${parts.month}`.startsWith(period)) continue;
    seen.add(e.playId); seconds += e.seconds; listens++;
    const song = songs.get(e.id) || e.song || { title: 'Brano non più in raccolta' };
    add(tracks, e.id, song.title, e.seconds); add(artists, song.artist, song.artist, e.seconds);
    add(genres, song.genere || song.genre, song.genere || song.genre, e.seconds);
    for (const mood of song.mood || []) add(moods, mood, mood, e.seconds);
    add(days, parts.weekday, parts.weekday, e.seconds); add(hours, parts.hour, `${parts.hour}:00`, e.seconds);
  }
  return { period, seconds, minutes: Math.floor(seconds / 60), listens, trackCount: tracks.size, enough: listens >= 3 && seconds >= 60,
    tracks: rank(tracks), artists: rank(artists), genres: rank(genres), moods: rank(moods), days: rank(days), hours: rank(hours) };
}
export async function showRecap(c, generation) {
  if (generation !== c.state.musicGeneration) return;
  const { el, state, action } = c;
  const now = new Date(); const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const input = el('input', { type: 'month', value: month, 'aria-label': 'Mese da raccontare' });
  const year = el('input', { type: 'number', min: '2000', max: '2100', value: now.getFullYear(), 'aria-label': 'Anno da raccontare' });
  const open = async period => {
    const result = await c.api(`/api/music/recap?profile=${encodeURIComponent(state.profile)}&period=${encodeURIComponent(period)}`);
    if (generation !== state.musicGeneration) return;
    const d = el('dialog', { class: 'recap-dialog', 'aria-label': period.length === 4 ? 'Il tuo anno in musica' : 'Il tuo mese in musica' });
    const content = el('div', { class: 'recap-card', tabindex: '0' }); let index = 0;
    const top = (title, entries) => [title, entries.slice(0, 5).map((e, i) => `${i + 1}. ${e.name}`).join('\n') || 'Nessun dato disponibile.'];
    const cards = result.enough ? [['La tua musica, il tuo tempo', `${result.minutes} minuti ascoltati\n${result.trackCount} brani diversi · ${result.listens} ascolti`], top('I brani più ascoltati', result.tracks), top('Gli artisti che ti accompagnano', result.artists), top('I tuoi generi', result.genres), ['Il tuo umore musicale', result.moods[0]?.name || 'Mood non disponibili nel catalogo.'], ['Quando ascolti', `${result.days[0]?.name || ''}\nLa tua ora: ${result.hours[0]?.name || ''}`]] : [['Il racconto sta iniziando', 'Servono almeno 3 ascolti e un minuto di musica in questo periodo. Ascolta ancora e torna qui. Gli ascolti precedenti senza un profilo riconoscibile non sono inclusi.']];
    const prev = el('button', { class: 'secondary', onclick: () => draw(index - 1) }, 'Indietro');
    const next = el('button', { class: 'primary', onclick: () => draw(index + 1) }, 'Avanti');
    const count = el('span', { role: 'status', 'aria-live': 'polite' });
    const draw = i => { index = Math.max(0, Math.min(cards.length - 1, i)); content.replaceChildren(el('p', { class: 'welcome' }, `${periodLabel(period)} · ${state.boot.profiles.find(p => p.id === state.profile)?.name || ''}`), el('h2', {}, cards[index][0]), el('p', {}, cards[index][1])); prev.disabled = index === 0; next.disabled = index === cards.length - 1; count.textContent = `${index + 1} di ${cards.length}`; };
    d.append(el('button', { class: 'quiet recap-close', onclick: () => d.close(), 'aria-label': 'Chiudi il racconto musicale' }, 'Chiudi'), content, el('div', { class: 'actions recap-nav' }, prev, count, next));
    d.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); draw(index + (e.key === 'ArrowRight' ? 1 : -1)); } });
    let start; content.addEventListener('pointerdown', e => { start = e.clientX; }); content.addEventListener('pointerup', e => { if (Math.abs(e.clientX - start) > 60) draw(index + (e.clientX < start ? 1 : -1)); start = undefined; });
    d.addEventListener('close', () => d.remove(), { once: true }); document.body.append(d); draw(0); c.showModal(d); content.focus();
  };
  document.querySelector('#music-results').replaceChildren(el('section', { class: 'recap-heading' }, el('h2', {}, 'Il tuo mese in musica'), el('p', { class: 'muted' }, 'Solo gli ascolti di questo profilo, registrati in casa.'), el('div', { class: 'actions' }, input, el('button', { class: 'primary', onclick: action(() => open(input.value)) }, 'Racconta il mese')), el('h2', {}, 'Il tuo anno in musica'), el('div', { class: 'actions' }, year, el('button', { class: 'secondary', onclick: action(() => open(String(year.value))) }, 'Racconta l’anno'))));
}
