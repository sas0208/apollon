export function quantity(value, singular, plural = singular) {
  return `${value} ${Number(value) === 1 ? singular : plural}`;
}

export function groupVideos(items, progress = {}) {
  const groups = []; const series = new Map(); const films = new Map();
  // 17/11: due file dello stesso film (es. l'originale 1080p e una copia 720p: stesso titolo, stesso anno) = un titolo solo:
  // resta quello già iniziato, altrimenti il più grande. Senza anno non si unisce niente (titoli uguali di film diversi).
  const better = (a, b) => (!!progress[b.id] - !!progress[a.id]) || ((b.size || 0) - (a.size || 0));
  for (const item of items) {
    if (!item.series) {
      const key = item.year ? `${item.root}/${String(item.title).toLowerCase()}/${item.year}` : null;
      const twin = key ? films.get(key) : null;
      if (twin) { if (better(twin.item, item) > 0) twin.item = item; continue; }
      const group = { title: item.title, item, episodes: null, root: item.root, year: item.year };
      if (key) films.set(key, group);
      groups.push(group);
    }
    else {
      const key = `${item.root}/${item.series}`; let group = series.get(key);
      if (!group) { group = { title: item.series, episodes: [], root: item.root }; series.set(key, group); groups.push(group); }
      group.episodes.push(item);
    }
  }
  for (const group of groups) if (group.episodes) {
    group.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    group.item = group.episodes.find(i => !progress[i.id]?.watched) || group.episodes[0];
  }
  return groups;
}
export function followingEpisode(items, item) {
  if (!item?.series) return null;
  const episodes = items.filter(i => i.root === item.root && i.series === item.series).sort((a, b) => a.season - b.season || a.episode - b.episode);
  const index = episodes.findIndex(i => i.id === item.id);
  return index < 0 ? null : episodes[index + 1] || null;
}
export function playbackAction(item, seconds, duration, hasNext, preferences = {}) {
  if (!item || !Number.isFinite(seconds) || !(duration > 0)) return null;
  const ranges = item.salti || { sigla: [item.introStart, item.introEnd] };
  // 12/11: il server dice quali tratti sono sicuri (saltiSicuri) e da dove la storia è finita (fineStoria).
  // Senza queste due notizie resta solo il pulsante: niente salto da solo, mai «tagliare» una scena.
  const sure = Array.isArray(item.saltiSicuri) ? item.saltiSicuri : [];
  const storyEnd = storyEndOf(item, duration);
  for (const type of ['riassunto', 'sigla', 'finale', 'anteprima']) {
    const range = ranges[type];
    if (!Array.isArray(range) || !(range[0] >= 0 && range[1] > range[0] && range[1] <= duration) || seconds < range[0] || seconds >= range[1]) continue;
    const closing = type === 'finale' || type === 'anteprima';
    const next = hasNext && closing && ((storyEnd !== null && seconds >= storyEnd) || range[1] >= duration - 2);
    return { kind: type, label: next ? 'Prossimo episodio' : { sigla: 'Salta sigla', riassunto: 'Salta riassunto', finale: 'Salta sigla finale', anteprima: 'Salta anteprima' }[type],
      target: range[1], next, certain: sure.includes(type), automatic: preferences.autoSkip === true && sure.includes(type) && (!next || preferences.autoNext === true) };
  }
  return null;
}
// Da che secondo la storia è sicuramente finita (dopo ci sono solo titoli di coda e anteprima). null = non si sa:
// in quel caso nessun conto alla rovescia e nessun passaggio da solo prima della fine vera del file.
export function storyEndOf(item, duration) {
  const at = item?.fineStoria;
  return typeof at === 'number' && Number.isFinite(at) && at > 0 && duration > 0 && at < duration && at >= duration / 2 ? at : null;
}
export function spatialTarget(activeRect, candidates, direction) {
  const valid = r => r && [r.left, r.top, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
  if (!valid(activeRect)) return null;
  const ax = activeRect ? activeRect.left + activeRect.width / 2 : 0;
  const ay = activeRect ? activeRect.top + activeRect.height / 2 : 0;
  let best = null; let score = Infinity; let bestAligned = false;
  for (const candidate of candidates) {
    if (!valid(candidate.rect)) continue;
    const r = candidate.rect; const dx = r.left + r.width / 2 - ax; const dy = r.top + r.height / 2 - ay;
    const horizontal = ['ArrowLeft', 'ArrowRight'].includes(direction);
    const forward = direction === 'ArrowRight' ? dx : direction === 'ArrowLeft' ? -dx : direction === 'ArrowDown' ? dy : -dy;
    if (forward <= 4) continue;
    const aligned = horizontal
      ? r.top < activeRect.top + activeRect.height && r.top + r.height > activeRect.top
      : r.left < activeRect.left + activeRect.width && r.left + r.width > activeRect.left;
    const sideways = Math.abs(horizontal ? dy : dx); const rank = forward + sideways * 3;
    if ((aligned && !bestAligned) || (aligned === bestAligned && rank < score)) { score = rank; best = candidate.value; bestAligned = aligned; }
  }
  return best;
}

// OpenSubsonic already parses .lrc/.txt: keep timestamps in milliseconds.
export function normalizeLyrics(response) {
  const versions = response?.lyricsList?.structuredLyrics;
  if (!Array.isArray(versions)) return { synced: false, lines: [] };
  const choices = versions.slice(0, 50).map(version => {
    const synced = version?.synced === true;
    const lines = (Array.isArray(version?.line) ? version.line : []).slice(0, 5000)
      .filter(line => typeof line?.value === 'string' && (!synced || (Number.isFinite(line.start) && line.start >= 0)))
      .map(line => ({ text: line.value.slice(0, 4000), start: synced ? line.start : null }));
    if (synced) lines.sort((a, b) => a.start - b.start);
    return { synced, lines };
  }).filter(choice => choice.lines.some(line => line.text.trim()));
  return choices.find(choice => choice.synced) || choices[0] || { synced: false, lines: [] };
}
export function currentLyric(lines, seconds) {
  if (!Number.isFinite(seconds)) return -1;
  let low = 0; let high = lines.length - 1; let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].start <= seconds * 1000) { found = mid; low = mid + 1; }
    else high = mid - 1;
  }
  return found;
}

// Server separati (video su uno, musica sull'altro): la pagina dell'altro tipo si apre sull'altro server, non qui dove non c'è.
const VIDEO_PAGE_NAMES = ['home', 'film', 'series', 'anime', 'novita', 'cerca', 'lista', 'scaricati', 'esplora', 'account'];
export function otherServerTarget(page, mode, otherUrl, search = '') {
  if (!otherUrl || !((mode === 'video' && page === 'music') || (mode === 'music' && VIDEO_PAGE_NAMES.includes(page)))) return '';
  let base; try { base = new URL(otherUrl); } catch { return ''; }
  if (!['http:', 'https:'].includes(base.protocol)) return '';
  const params = new URLSearchParams(search); const keep = new URLSearchParams();
  for (const key of ['tv', 'legacy']) if (params.has(key)) keep.set(key, params.get(key));
  const query = String(keep); return `${base.origin}/${query ? '?' + query : ''}#${page}`;
}
