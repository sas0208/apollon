import { followingEpisode, spatialTarget, normalizeLyrics, currentLyric, playbackAction, quantity, otherServerTarget } from './logic.js';
import { smartQueue, moveEntry, removeEntry } from './music-logic.js';
import { MusicPlayback } from './music-playback.js';
import { windowedList } from './virtual-list.js';
import { PlayerMotion } from './music-motion.js';
import { bindPlayerGesture } from './music-gestures.js';
import { watchMarquees, vibrate, musicIcon, setMusicIcon, changeMusicPage } from './music-feedback.js';
import { EQ_BANDS, EQ_PRESETS, equalizerSettings, selectEqualizer } from './music-equalizer.js';
import { shellIcon, art, artistArt, lazyArt, hero, heroPlay, heroButton, coverColor, deepen, pressFeedback, nameHue, sectionTop, hued } from './music-shell.js';
import { createVideoApp, VIDEO_PAGES } from './video-app.js';
import { createTvPageNav } from './tv-nav.js';
import { chooseQuality, mediaUrl } from './video-logic.js';
import { createPlayer } from './video-player.js';
import { createArtEditor } from './video-manage.js';
import { OfflineVideo, playURL, estimateBytes, downloadedBytes } from './video-offline.js';
import { createDownloads, pendingKey, notePending, syncPending, asProgress } from './downloads.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const storage = {
  get(key, fallback = null) { try { return JSON.parse(localStorage.getItem(`mediateca:${key}`)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`mediateca:${key}`, JSON.stringify(value)); } catch { /* Private browsing may disallow local storage. */ } }
};
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if ((key.startsWith('aria-') || key === 'draggable') && typeof value === 'boolean') node.setAttribute(key, String(value));
    else if (value !== undefined && value !== false && value !== null) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
const state = { boot: null, items: [], progress: {}, profile: storage.get('profile', 'bruno'), page: 'home', filter: 'all', query: '', genre: '',
  current: null, filePath: '', root: '', musicTab: 'home', albumsOffset: 0, musicGeneration: 0,
  queue: [], queueIndex: 0, repeat: 'off', saveAt: 0 };
if (!Array.isArray(state.queue)) state.queue = [];
state.queue = state.queue.filter(s => s && typeof s.id === 'string' && typeof s.title === 'string').slice(0, 2000);
if (!Number.isInteger(state.queueIndex) || state.queueIndex < 0 || state.queueIndex >= state.queue.length) state.queueIndex = 0;
let toastTimer; let pollTimer; let searchTimer;
function notify(message, error = false) {
  const node = $('#toast'); node.textContent = message; node.className = `toast${error ? ' error' : ''}`; node.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, error ? 9000 : 4500);
}
async function api(route, { method = 'GET', data, signal } = {}) {
  let response;
  try { response = await fetch(route, { method, signal, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' }); }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error('Il telefono non risponde. Controlla il Wi-Fi e riprova.'); }
  let result;
  try { result = await response.json(); } catch { throw new Error('La risposta del telefono non è valida. Controlla l’indirizzo e riprova.'); }
  if (!response.ok) throw Object.assign(new Error(result.error || 'Operazione non riuscita.'), { status: response.status });
  return result;
}
function action(fn) { return async event => { try { await fn(event); } catch (e) { notify(e.message, true); } }; }
const fmtTime = seconds => {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtSize = size => size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(1)} GB` : `${(size / 1024 ** 2).toFixed(1)} MB`;
const minutes = seconds => seconds ? `${Math.ceil(seconds / 60)} min` : 'Durata da leggere';
const dialogStack = [];
const dialogOpeners = new Map();
// A dialog removed from the page while open (e.g. a re-rendered view) must not keep trapping focus.
const activeDialog = () => dialogStack.filter(node => node.open && node.isConnected !== false).at(-1);
// Controls inside a closed <details> still report boxes in Chromium but cannot take focus: only its summary counts.
function insideClosedDetails(node) {
  for (let d = node.closest?.('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
    if (!(node.parentElement === d && node.matches('summary'))) return true;
  }
  return false;
}
const dialogControls = node => [...node.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')]
  .filter(control => !control.disabled && control.tabIndex >= 0 && !control.closest('[hidden],[inert]') && !insideClosedDetails(control) && control.getClientRects().length);
function showDialog(id) {
  const node = $(id); if (node.open) return;
  dialogOpeners.set(node, document.activeElement);
  const old = dialogStack.indexOf(node); if (old >= 0) dialogStack.splice(old, 1);
  dialogStack.push(node); node.showModal();
  document.documentElement.classList.add('has-dialog');
  (node.querySelector('[autofocus]') || dialogControls(node)[0] || node).focus({ preventScroll: true });
}
function registerDialog(node) { node.addEventListener('close', () => {
  if (node.open) return;
  const index = dialogStack.indexOf(node); if (index >= 0) dialogStack.splice(index, 1);
  const top = activeDialog(); document.documentElement.classList.toggle('has-dialog', !!top);
  let opener = dialogOpeners.get(node); dialogOpeners.delete(node);
  // Il catalogo può aver ricreato la card dopo il salvataggio del video.
  if (opener && !opener.isConnected && opener.dataset?.fk) {
    const key = opener.dataset.fk;
    opener = [...document.querySelectorAll('[data-fk]')].find(candidate => candidate.dataset.fk === key);
  }
  const focused = document.activeElement;
  // A closing dialog must not steal focus from a newly opened one.
  if (opener?.isConnected && !opener.disabled && opener.getClientRects().length && (!top || top.contains(opener)) &&
      (focused === document.body || focused === opener || node.contains(focused))) {
    opener.focus({ preventScroll: true });
    if (document.documentElement.classList.contains?.('tv')) opener.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  } else if (!top && focused === document.body && typeof focusTvStart === 'function') focusTvStart();
}); }
$$('dialog').forEach(registerDialog);
document.addEventListener('keydown', event => {
  const dialog = activeDialog(); if (!dialog || event.key !== 'Tab') return;
  const controls = dialogControls(dialog); const first = controls[0]; const last = controls.at(-1);
  if (!first) { event.preventDefault(); dialog.focus(); return; }
  if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
    event.preventDefault(); (event.shiftKey ? last : first).focus();
  }
});
document.addEventListener('focusin', event => {
  const dialog = activeDialog();
  if (dialog && !dialog.contains(event.target)) (dialogControls(dialog)[0] || dialog).focus({ preventScroll: true });
});
function closeDialogs() { $$('dialog[open]').forEach(d => d.close()); }
$$('.close-dialog').forEach(button => button.addEventListener('click', () => {
  const dialog = button.closest('dialog'); if (dialog.id === 'music-player') closeMusicPlayer(); else dialog.close();
}));
let inputResolve = null;
$('#input-dialog').addEventListener('close', () => { inputResolve?.(null); inputResolve = null; });
$('#input-form').addEventListener('submit', event => {
  event.preventDefault(); let result = $('#input-value').disabled ? true : $('#input-value').value.trim();
  if (!result) return; const resolve = inputResolve; inputResolve = null; $('#input-dialog').close(); resolve?.(result);
});
function ask(title, value = '', description = '', confirm = false, destination = false) {
  $('#input-title').textContent = title; $('#input-description').textContent = description;
  $('#input-label').hidden = confirm; $('#input-value').disabled = confirm; $('#input-value').value = value;
  $('#input-root-label').hidden = !destination;
  if (destination) { $('#input-root').replaceChildren(...state.boot.roots.map(root => el('option', { value: root }, root))); $('#input-root').value = state.root; }
  $('#input-submit').textContent = confirm ? 'Conferma' : 'Salva';
  showDialog('#input-dialog'); if (!confirm) { $('#input-value').focus(); $('#input-value').select(); }
  return new Promise(resolve => { inputResolve = resolve; });
}
function populateProfiles() {
  if (!state.boot.profiles.some(p => p.id === state.profile)) state.profile = state.boot.profiles[0]?.id || '';
  $('#profile').replaceChildren(...state.boot.profiles.map(p => el('option', { value: p.id }, p.name)));
  $('#profile').value = state.profile; storage.set('profile', state.profile);
  syncVideoPreferences();
}
function videoPreferences() { return state.boot?.profiles.find(p => p.id === (state.current?.profile || state.profile)) || {}; }
function syncVideoPreferences() { const p = videoPreferences(); $('#autonext').checked = p.autoNext !== false; $('#autoskip').checked = p.autoSkip === true; syncLightMode(); }
// Versione leggera: acceso = «Automatica» (o 480 scelto a mano), spento = «Originale». Sempre coerente con il menu Qualità.
const lightModeOn = () => qualityPreference() !== 'original';
function syncLightMode() { $('#lightmode').checked = lightModeOn(); }
async function saveVideoPreferences() {
  const profile = state.current?.profile || state.profile;
  const result = await api('/api/profiles/preferences', { method: 'PUT', data: { profile, autoSkip: $('#autoskip').checked, autoNext: $('#autonext').checked } });
  Object.assign(state.boot.profiles.find(p => p.id === profile), result); syncVideoPreferences();
}
async function reloadLibrary() {
  const result = await api('/api/library'); state.items = result.items;
  Object.assign(state.boot, { count: result.count, pending: result.pending, warnings: result.warnings, lastScan: result.lastScan });
  renderCatalog(); populateEdit();
}
// Una risposta partita prima di un «Segna visto» è vecchia: se nel frattempo è cambiato qualcosa in locale, non la applico.
async function refreshProgress() {
  if (!state.profile) { state.progress = {}; return; }
  const profile = state.profile; const version = state.progressVersion || 0; const fresh = await api(`/api/progress?profile=${encodeURIComponent(profile)}`);
  if (state.profile === profile && (state.progressVersion || 0) === version) { state.progress = fresh; cacheProgress(); }
}
const tvPageTrail = [];
let tvReturning = false;
let librarySwitchPending = false;
function resetLibrarySwitch() {
  librarySwitchPending = false; document.body.classList.remove('switching-library');
  $$('[data-library-pending]').forEach(b => { b.disabled = false; b.removeAttribute('aria-busy'); delete b.dataset.libraryPending; });
}
window.addEventListener('pageshow', resetLibrarySwitch); window.addEventListener('apollonresume', resetLibrarySwitch);
function openOtherLibrary(away) {
  if (librarySwitchPending) return;
  librarySwitchPending = true; document.body.classList.add('switching-library');
  const pressed = document.activeElement;
  if (pressed?.matches('button')) { pressed.disabled = true; pressed.dataset.libraryPending = 'true'; pressed.setAttribute('aria-busy', 'true'); }
  const target = new URL(away); target.searchParams.set('apollonIntro', 'done');
  if (globalThis.ApollonAndroid?.openLibrary) globalThis.ApollonAndroid.openLibrary(target.href);
  else location.href = target.href;
  setTimeout(resetLibrarySwitch, 8000);
}
function setPage(page, updateHash = true) {
  const away = state.offline ? '' : otherServerTarget(page, state.boot?.mode, state.boot?.otherLibraryUrl, location.search);
  if (away) { openOtherLibrary(away); return; }
  if (!['home', 'film', 'series', 'anime', 'novita', 'cerca', 'lista', 'scaricati', 'esplora', 'account', 'music', 'manage'].includes(page)) page = 'home';
  if (page !== state.page) { if (!tvReturning) tvPageTrail.push(state.page); state.genre = ''; }
  if (page !== 'manage') state.lastPage = page; // «Indietro» dalla gestione torna da dove si era
  state.page = page;
  document.body.dataset.page = page; document.body.classList.toggle('video-mode', VIDEO_PAGES.includes(page));
  if (updateHash && location.hash !== `#${page}`) history.replaceState(null, '', `#${page}`);
  $$('button[data-page]').forEach(b => b.setAttribute('aria-pressed', b.dataset.page === page));
  $$('.b-music').forEach(n => { n.hidden = page !== 'music'; }); $$('.b-video').forEach(n => { n.hidden = page === 'music'; });
  $('#video-page').hidden = !VIDEO_PAGES.includes(page); $('#music-page').hidden = page !== 'music'; $('#manage-page').hidden = page !== 'manage';
  let pageReady = Promise.resolve();
  if (page === 'music') pageReady = loadMusic().catch(e => notify(e.message, true));
  else if (page === 'manage') pageReady = loadManage().catch(e => notify(e.message, true));
  renderCatalog();
  requestAnimationFrame(() => { if (!tvFocusable(document.activeElement) && !activeDialog()) focusTvStart(); });
  return pageReady.then(() => { if (!tvFocusable(document.activeElement) && !activeDialog()) focusTvStart(); });
}
$$('button[data-page]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));
$('#manage-back').addEventListener('click', () => setPage(state.lastPage || 'home'));
window.addEventListener('hashchange', () => setPage(location.hash.slice(1), false));
$('#profile').addEventListener('change', action(async () => {
  pauseMusic();
  ++state.musicGeneration;
  remoteMusic?.stop(); remoteMusic = null;
  await saveVideo(); state.profile = $('#profile').value; storage.set('profile', state.profile); if (navigator.onLine && !state.offline) await refreshProgress(); else state.progress = offlineProgress(state.profile); syncVideoPreferences(); await restoreMusic(); renderCatalog(); if (state.page === 'music') await loadMusic();
}));
$('#add-profile').addEventListener('click', action(async () => {
  const name = await ask('Come si chiama il nuovo profilo?', '', 'Ogni persona ha il proprio punto di ripresa.'); if (!name) return;
  const profile = await api('/api/profiles', { method: 'POST', data: { name } }); state.boot.profiles.push(profile);
  state.profile = profile.id; populateProfiles(); await refreshProgress(); await videoApp.loadList().catch(() => {}); renderCatalog();
  if ($('#who-dialog').open) videoApp.profileAdded(profile); else notify(`Profilo ${profile.name} pronto.`);
}));
function renderCatalog() {
  if (!state.boot) return;
  videoApp.render();
  $('#scan-note').textContent = [...(state.boot.warnings || []), state.boot.pending ? `Sto preparando ${quantity(state.boot.pending, 'anteprima', 'anteprime')}, una alla volta.` : 'Riproduzione diretta dai file di casa.'].join(' ');
}
async function markWatched(item, watched) {
  const value = await api('/api/progress', { method: 'PUT', data: { id: item.id, profile: state.profile, watched, ...(watched ? {} : { position: 0 }) } });
  state.progress[item.id] = value; renderCatalog();
}
const video = $('#video');
// Giro G: qualità. La scelta si ricorda per profilo e per dispositivo (localStorage); «Automatica» guarda la connessione.
const qualityKey = () => `quality:${state.current?.profile || state.profile}`;
const qualityPreference = () => storage.get(qualityKey(), 'auto');
function connectionInfo() {
  const c = navigator.connection || {}; let measuredKbps = state.measuredKbps;
  if (measuredKbps === undefined) {
    // Prima misura: quanto ci ha messo a scaricare il programma stesso dal server.
    try { const r = performance.getEntriesByType('resource').find(e => e.name.endsWith('/app.js') && e.transferSize > 20000 && e.duration > 30); measuredKbps = r ? r.transferSize * 8 / r.duration : 0; } catch { measuredKbps = 0; }
    state.measuredKbps = measuredKbps;
  }
  return { host: location.hostname, effectiveType: c.effectiveType, downlink: c.downlink, saveData: c.saveData, measuredKbps };
}
// Cambiare qualità mantiene il punto esatto e lo stato di play/pausa.
async function switchQuality(preference) {
  storage.set(qualityKey(), preference); syncLightMode();
  const current = state.current; if (!current || current.quality === 'download') return;
  const next = chooseQuality(preference, current.item, connectionInfo()); current.preference = preference;
  if (next === current.quality) return;
  const at = video.currentTime; const playing = !video.paused;
  current.quality = next; current.resume = at; current.ready = false;
  video.src = mediaUrl(current.item, next); video.load();
  if (playing) await video.play().catch(() => {});
  notify(next === '480' ? 'Qualità: risparmio dati (480p).' : 'Qualità: originale.');
}
function nextEpisode(item) { return followingEpisode(state.items, item); }
let videoPlayRequest = 0;
async function playItem(item, alreadySaved = false, { fromStart = false } = {}) {
  if (item.remote && item.remoteDown) { notify('Il fisso è spento. Accendilo per guardare questo titolo.'); return; }
  const request = ++videoPlayRequest; const profile = state.profile;
  try {
    // Si conserva il vecchio punto senza consumare il gesto necessario allo schermo intero.
    if (!alreadySaved) saveVideo().catch(e => notify(e.message, true));
    if (request !== videoPlayRequest || profile !== state.profile) return;
    pauseMusic();
    // Un video scaricato si guarda sempre dalla copia sul telefono: niente dati, e funziona anche senza rete.
    const local = downloadedIds.has(item.id);
    const quality = local ? 'download' : chooseQuality(storage.get(`quality:${state.profile}`, 'auto'), item, connectionInfo());
    state.current = { item, profile: state.profile, ready: false, skipped: new Set(), quality }; syncVideoPreferences();
    state.saveAt = 0; $('#player-title').textContent = item.series || item.title; $('#vp-episode').textContent = item.series ? `S${item.season}:E${item.episode} ${item.title}` : '';
    $('#video-error').hidden = true; $('#skip-intro').hidden = true; $('#skip-recap').hidden = true; $('#skip-ending').hidden = true; $('#next-episode').hidden = true;
    video.replaceChildren(...(item.subtitles || []).map((s, i) => el('track', { kind: 'subtitles', label: s.language || s.name, srclang: /^[a-z]{2,3}$/.test(s.language) ? s.language : 'it', src: `/media/${item.id}/subtitle/${i}` })));
    const resume = state.progress[item.id]; state.current.resume = fromStart || resume?.watched ? 0 : resume?.position || 0;
    $('#video-info').textContent = `${item.root} · ${minutes(item.duration)} · ${fmtSize(item.size)}. ${quantity(item.subtitles?.length || 0, 'sottotitolo', 'sottotitoli')}. Se il formato non è supportato, usa VLC o il lettore DLNA della TV.`;
    showDialog('#video-dialog');
    globalThis.mediatecaPlayer?.opened(item);
    video.src = local ? playURL(item.id) : mediaUrl(item, quality); video.load(); video.focus();
    await video.play();
  } catch (e) { if (request === videoPlayRequest && profile === state.profile && e.name !== 'AbortError') { $('#video-error').textContent = 'Il browser non riesce a riprodurre questo file. Prova il lettore DLNA/VLC della TV, oppure controlla la connessione.'; $('#video-error').hidden = false; } }
}
video.addEventListener('loadedmetadata', () => {
  if (!state.current) return; const { resume } = state.current;
  if (resume && Number.isFinite(video.duration)) video.currentTime = Math.min(resume, Math.max(0, video.duration - 1));
  state.current.ready = true;
});
const readPending = profile => storage.get(pendingKey(profile), {}) || {};
function dropPending(profile, id) { const all = readPending(profile); if (id in all) { delete all[id]; storage.set(pendingKey(profile), all); } }
function holdProgress(data) {
  const all = readPending(data.profile); notePending(all, data.id, data); storage.set(pendingKey(data.profile), all);
  const old = state.progress[data.id] || {}; return { ...old, position: data.position, duration: data.duration, watched: data.watched ?? (old.watched || all[data.id].watched), updated: all[data.id].at };
}
const offlineProgress = profile => ({ ...storage.get(`progress-cache:${profile}`, {}), ...asProgress(readPending(profile)) });
function cacheProgress() { if (downloadedIds.size) storage.set(`progress-cache:${state.profile}`, Object.fromEntries([...downloadedIds].filter(id => state.progress[id]).map(id => [id, state.progress[id]]))); }
let syncing = null;
function syncPendingProgress() {
  return syncing ||= (async () => {
    for (const p of state.boot?.profiles || []) {
      const pending = readPending(p.id); if (!Object.keys(pending).length) continue;
      try { storage.set(pendingKey(p.id), await syncPending(p.id, pending, api)); } catch { /* si riprova al prossimo collegamento */ }
    }
  })().finally(() => { syncing = null; });
}
async function saveVideo(watched) {
  const current = state.current;
  if (!current?.ready || !Number.isFinite(video.duration) || video.duration <= 0 || (current.transitioning && watched === undefined)) return;
  const data = { profile: current.profile, id: current.item.id, position: video.currentTime, duration: video.duration, ...(watched === undefined ? {} : { watched }) };
  // Senza rete il punto resta sul telefono e parte verso casa appena torna la connessione (syncPendingProgress).
  const task = (current.saveQueue || Promise.resolve()).catch(() => {}).then(async () => {
    if (state.offline || !navigator.onLine) return holdProgress(data);
    try { const saved = await api('/api/progress', { method: 'PUT', data }); dropPending(data.profile, data.id); return saved; }
    catch (error) { if (error.status) throw error; return holdProgress(data); }
  });
  current.saveQueue = task; const result = await task;
  if (state.profile === current.profile) state.progress[current.item.id] = result;
}
function activeSkip() {
  if (!state.current?.ready) return null;
  return playbackAction(state.current.item, video.currentTime, video.duration, !!nextEpisode(state.current.item), { autoSkip: $('#autoskip').checked, autoNext: $('#autonext').checked });
}
async function performSkip(value = activeSkip()) {
  const current = state.current; if (!current || !value || current.transitioning) return;
  current.skipped.add(value.kind);
  if (value.next) {
    const next = nextEpisode(current.item); if (!next) return;
    current.transitioning = true;
    try { await saveVideo(true); if (state.current === current) await playItem(next, true); } finally { current.transitioning = false; }
  } else {
    const from = video.currentTime; video.currentTime = value.target; updateVideoSkips();
    if (value.automatic) showSkipToast(value.kind, from);
  }
}
// «Sigla saltata · Annulla»: due secondi, poi sparisce. Annulla torna dov'era e quel tratto non si salta più in questa visione.
let skipToastTimer = 0;
function showSkipToast(kind, from) {
  const text = { sigla: 'Sigla saltata', riassunto: 'Riassunto saltato', finale: 'Finale saltato', anteprima: 'Anteprima saltata' }[kind] || 'Tratto saltato';
  $('#skip-toast-text').textContent = text; const toast = $('#skip-toast'); toast.hidden = false; toast.dataset.from = String(from);
  toast.classList.remove('run'); void toast.offsetWidth; toast.classList.add('run');
  clearTimeout(skipToastTimer); skipToastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
}
$('#skip-undo').addEventListener('click', () => {
  const toast = $('#skip-toast'); const from = Number(toast.dataset.from); toast.hidden = true; clearTimeout(skipToastTimer);
  if (Number.isFinite(from)) { video.currentTime = from; updateVideoSkips(); }
});
function updateVideoSkips() {
  const value = activeSkip();
  for (const [id, kind] of [['skip-intro', 'sigla'], ['skip-recap', 'riassunto'], ['skip-ending', 'finale'], ['next-episode', 'next']]) {
    const button = document.getElementById(id);
    button.hidden = !value || (kind === 'next' ? !value.next : value.next || value.kind !== kind);
    if (!button.hidden) button.textContent = value.label;
  }
  if (value?.kind === 'anteprima' && !value.next) { $('#skip-ending').hidden = false; $('#skip-ending').textContent = value.label; }
  const current = state.current;
  if (value?.automatic && !video.paused && !video.seeking && current && !current.skipped.has(value.kind)) performSkip(value).catch(e => notify(e.message, true));
}
video.addEventListener('timeupdate', () => {
  if (!state.current) return;
  updateVideoSkips();
  if (Date.now() - state.saveAt > 5000) { state.saveAt = Date.now(); saveVideo().catch(() => {}); }
});
video.addEventListener('seeked', updateVideoSkips);
video.addEventListener('loadedmetadata', updateVideoSkips);
video.addEventListener('pause', () => saveVideo().catch(() => {}));
video.addEventListener('ended', action(async () => {
  const current = state.current; if (!current || current.transitioning) return;
  current.transitioning = true;
  try {
    await saveVideo(true); if (state.current !== current) return;
    renderCatalog(); const next = nextEpisode(current.item);
    if (next && $('#autonext').checked && !current.stay) await playItem(next, true);
  } finally { current.transitioning = false; }
}));
video.addEventListener('error', () => {
  const current = state.current;
  if (current?.quality === 'download' && navigator.onLine && !state.offline) { // la copia sul telefono non c'è più: si guarda da casa
    downloadedIds.delete(current.item.id); current.quality = 'original'; current.resume = video.currentTime || current.resume; current.ready = false;
    video.src = mediaUrl(current.item, 'original'); video.load(); video.play().catch(() => {}); return;
  } $('#video-error').textContent = 'Il browser non legge questo formato oppure il file non è raggiungibile. Prova VLC/DLNA o controlla il Wi-Fi.'; $('#video-error').hidden = false; });
$('#video-dialog').addEventListener('close', () => {
  globalThis.ApollonAndroid?.setVideoMode(false);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  videoPlayRequest++;
  const saving = saveVideo(); state.current = null; video.pause(); video.removeAttribute('src'); video.load();
  saving.catch(e => notify(e.message, true)).finally(renderCatalog);
});
$('#close-player').addEventListener('click', () => $('#video-dialog').close());
for (const selector of ['#skip-intro', '#skip-recap', '#skip-ending', '#next-episode']) $(selector).addEventListener('click', action(() => performSkip()));
$('#fullscreen').addEventListener('click', action(async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else if ($('#video-stage').requestFullscreen) await $('#video-stage').requestFullscreen();
  else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  else notify('Usa il comando schermo intero del lettore.');
}));
document.addEventListener('fullscreenchange', () => { ($('#fullscreen').querySelector('.vp-label') || $('#fullscreen')).textContent = document.fullscreenElement ? 'Esci da schermo intero' : 'Schermo intero'; });
$('#lightmode').addEventListener('change', action(async () => {
  await switchQuality($('#lightmode').checked ? 'auto' : 'original');
  // Il menu ⚙ aperto mostra anche le voci di Qualità: si ridisegnano tenendo il fuoco sull'interruttore.
  if (!$('#vp-panel').hidden && $('#vp-panel-title').textContent === 'Impostazioni') { $('#vp-settings').click(); $('#lightmode').focus({ preventScroll: true }); }
}));
for (const selector of ['#autonext', '#autoskip']) $(selector).addEventListener('change', action(async () => { try { await saveVideoPreferences(); } catch (e) { syncVideoPreferences(); throw e; } updateVideoSkips(); }));
// Chiusura o cambio di app sul telefono: l'ultimo punto parte comunque (keepalive), così la ripresa non perde i secondi finali.
function flushPosition() {
  const current = state.current; if (current?.ready && !current.transitioning && Number.isFinite(video.duration)) fetch('/api/progress', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: current.profile, id: current.item.id, position: video.currentTime, duration: video.duration }), keepalive: true }).catch(() => {});
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPosition(); });
window.addEventListener('pagehide', flushPosition);

// Music is kept outside page rendering, so browsing never recreates the audio element.
let audio = $('#audio');
// The bar can wrap differently with width, font size and safe-area insets.
function measureAudioBar() {
  document.documentElement.style.setProperty('--audio-bar-height', `${$('#audio-bar').getBoundingClientRect().height}px`);
}
if ('ResizeObserver' in window) new ResizeObserver(measureAudioBar).observe($('#audio-bar'));
window.addEventListener('resize', measureAudioBar);
measureAudioBar();
const storedVolume = Number(storage.get('volume', 0.8));
audio.volume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 0.8;
function musicImage(id, size = 160) { return id ? `/api/music/cover?id=${encodeURIComponent(id)}&size=${size}&offline=${encodeURIComponent(`${musicKey()}:${state.profile}`)}` : '/music-cover.svg'; }
let lyrics = { synced: false, lines: [] }; let lyricAt = -2; let lyricRequest; let songGeneration = 0;
function centerLyric(index) {
  const box = $('#lyrics-lines'); const row = box.children[index];
  if (!row || !$('#music-player').open || !box.clientHeight) return;
  box.style.setProperty('--lyric-padding', `${box.clientHeight / 2}px`);
  box.scrollTo({ top: box.scrollTop + row.getBoundingClientRect().top - box.getBoundingClientRect().top - (box.clientHeight - row.clientHeight) / 2,
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function updateLyrics(force = false) {
  if (!lyrics.synced) return;
  const position = typeof remoteMusic !== 'undefined' && remoteMusic?.isRemote() ? remoteMusic.remote()?.state?.position || 0 : audio.currentTime;
  const index = currentLyric(lyrics.lines, position);
  if (!force && index === lyricAt) return;
  lyricAt = index;
  [...$('#lyrics-lines').children].forEach((row, i) => {
    row.classList.toggle('past', i < index); row.classList.toggle('current', i === index);
    if (i === index) row.setAttribute('aria-current', 'true'); else row.removeAttribute('aria-current');
  });
  // Leave the remote's selected line visible while a person chooses where to jump.
  if (force || !$('#lyrics-lines').contains(document.activeElement)) centerLyric(index);
}
async function loadLyrics(song, generation) {
  lyricRequest?.abort(); const request = new AbortController(); lyricRequest = request;
  lyrics = { synced: false, lines: [] }; lyricAt = -2;
  $('#lyrics-note').textContent = 'Cerco il testo…'; $('#lyrics-lines').replaceChildren();
  $('#lyrics-lines').style.removeProperty('--lyric-padding');
  $('#lyrics-preview').textContent = 'Cerco il testo…';
  try {
    const response = await api(`/api/music/lyrics?id=${encodeURIComponent(song.id)}`, { signal: request.signal });
    if (generation !== songGeneration) return;
    lyrics = normalizeLyrics(response);
    $('#lyrics-preview').replaceChildren(...(lyrics.lines.length ? lyrics.lines.filter(l => l.text).slice(0, 3).map(l => el('span', {}, l.text)) : ['Testo non disponibile per questo brano']), el('small', {}, 'Apri il testo'));
    $('#lyrics-note').textContent = !lyrics.lines.length ? 'Testo non disponibile per questo brano' : lyrics.synced ? 'Segui la musica. Tocca una riga per saltare lì.' : 'Solo testo · scorri per leggerlo.';
    $('#lyrics-lines').replaceChildren(...lyrics.lines.map((line, index) => lyrics.synced
      ? el('button', { class: 'lyric-line', 'aria-label': `${line.text || 'Pausa'} · ${fmtTime(line.start / 1000)}`, onclick: () => {
        if (remoteMusic?.isRemote()) { remoteMusic.send('seek', { position: line.start / 1000 }).catch(e => notify(e.message, true)); return; }
        if (!Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.min(audio.duration, line.start / 1000); updateLyrics(true);
      } }, line.text || '♪') : el('p', { class: 'lyric-line plain-line' }, line.text || '\u00a0')));
    $('#lyrics-lines').scrollTop = 0; updateLyrics(true);
  } catch (error) {
    if (request.signal.aborted || generation !== songGeneration) return;
    $('#lyrics-note').textContent = 'Non riesco a caricare il testo. La musica continua.';
    $('#lyrics-preview').textContent = 'Non riesco a caricare il testo. Tocca per riprovare.';
    $('#lyrics-lines').replaceChildren(el('button', { class: 'secondary', onclick: () => loadLyrics(song, generation) }, 'Riprova il testo'));
  }
}
function playerView(words) { $('#music-player').classList.toggle('show-words', words); $('#view-cover').setAttribute('aria-pressed', String(!words)); $('#view-lyrics').setAttribute('aria-pressed', String(words)); $('#music-player').scrollTop = 0; updateLyrics(true); }
const playerMotion = new PlayerMotion($('#music-player'), $('#audio-bar'), $('#full-cover'), $('#audio-cover'));
let playerClosing = false;
function openMusicPlayer(words = false) {
  if (playerClosing) return;
  const wasOpen = $('#music-player').open; showDialog('#music-player'); playerView(words);
  loadPlayerDetails(); renderQueuePreview();
  refreshMarquees();
  if (!wasOpen) { $('#music-player').scrollTop = 0; playerMotion.run(true); }
}
async function closeMusicPlayer(startRect) {
  if (playerClosing || !$('#music-player').open) return;
  playerClosing = true;
  try { await playerMotion.run(false, startRect); $('#music-player').close(); }
  finally { playerClosing = false; }
}
$('#music-player').addEventListener('cancel', event => { event.preventDefault(); closeMusicPlayer(); });
$('#music-player').addEventListener('close', () => playerMotion.cancel());
function performPlayerGesture(name, rect) {
  if (name === 'previous' && state.queueIndex === 0) return false;
  if (name === 'next' && playback.candidate(false) < 0 && !radio) return false;
  if (name === 'open') openMusicPlayer();
  else if (name === 'close') closeMusicPlayer(rect);
  else if (name === 'previous') playSong(Math.max(0, state.queueIndex - 1));
  else nextSong();
}
const gesturesEnabled = () => matchMedia('(max-width:650px)').matches && !document.documentElement.classList.contains('tv') && !playerClosing && !playerMotion.cleanup;
bindPlayerGesture($('#audio-bar'), { mode: 'mini', enabled: gesturesEnabled, perform: performPlayerGesture, feedback: vibrateFeedback });
bindPlayerGesture($('#full-cover'), { mode: 'cover', moving: $('#music-player'), scroller: $('#music-player'), enabled: gesturesEnabled, perform: performPlayerGesture, feedback: vibrateFeedback });
bindPlayerGesture($('#music-player > .dialog-heading'), { mode: 'handle', moving: $('#music-player'), scroller: $('#music-player'), enabled: gesturesEnabled, perform: performPlayerGesture, feedback: vibrateFeedback });
const refreshMarquees = watchMarquees([$('#audio-title'), $('#full-title')]);
const feedbackKey = () => `music-options:${state.boot?.musicUser || 'guest'}:${state.profile}`;
let musicFeedback = { vibration: true };
function restoreMusicFeedback() {
  const saved = storage.get(feedbackKey(), {}); musicFeedback = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  $('#music-vibration').checked = musicFeedback.vibration !== false;
  playback.setEqualizer(equalizerSettings(musicFeedback.equalizer)); paintEqualizer();
}
function vibrateFeedback() { vibrate(musicFeedback.vibration !== false); }
$('#music-vibration').addEventListener('change', () => { musicFeedback.vibration = $('#music-vibration').checked; storage.set(feedbackKey(), musicFeedback); });
for (const [id, name] of [['audio-prev', 'previous'], ['audio-next', 'next'], ['full-prev', 'previous'], ['full-next', 'next'], ['audio-toggle', 'play'], ['full-toggle', 'play']]) setMusicIcon(document.getElementById(id), name);
$('#music-player .close-dialog').replaceChildren(musicIcon('close'));
function songIndicator(song) {
  const current = state.queue[state.queueIndex]?.id === song.id;
  return el('span', { class: `playing-indicator${!audio.paused ? ' running' : ''}`, 'data-playing-song': song.id, hidden: !current,
    role: 'img', 'aria-label': audio.paused ? 'In pausa' : 'In riproduzione' }, musicIcon('bars'));
}
function syncIndicators() {
  const id = state.queue[state.queueIndex]?.id;
  $$('[data-playing-song]').forEach(n => { n.hidden = n.dataset.playingSong !== id; n.classList.toggle('running', !audio.paused); n.setAttribute('aria-label', audio.paused ? 'In pausa' : 'In riproduzione'); });
}
function pulseHearts(id) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const buttons = $$('[data-song-heart]').filter(b => b.dataset.songHeart === id);
  if (state.queue[state.queueIndex]?.id === id) buttons.push($('#full-like'));
  for (const b of buttons) {
    const icon = b.querySelector('svg'); if (!icon?.animate) continue;
    const animation = icon.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: .4 }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
    animation.finished.then(() => animation.cancel(), () => {});
  }
}
function musicPageUpdate(generation, render) {
  return changeMusicPage(() => { if (generation === state.musicGeneration) render(); },
    { enabled: state.page === 'music' && !activeDialog() && !matchMedia('(prefers-reduced-motion: reduce)').matches });
}
$('#equalizer-preset').replaceChildren(...Object.entries(EQ_PRESETS).map(([value, p]) => el('option', { value }, p.label)));
$('#equalizer-bands').replaceChildren(...EQ_BANDS.map((hz, i) => el('label', {}, `${hz < 1000 ? hz + ' Hz' : hz / 1000 + ' kHz'}`,
  el('input', { id: `eq-band-${i}`, 'aria-label': `Equalizzatore ${hz} Hz`, type: 'range', min: -9, max: 9, step: 1, value: 0,
    oninput: event => { const gains = [...playback.equalizer.gains]; gains[i] = Number(event.target.value); applyEqualizer({ preset: 'custom', custom: gains }); } }), el('output', { id: `eq-value-${i}`, for: `eq-band-${i}` }, '0 dB'))));
function paintEqualizer() {
  $('#equalizer-preset').value = playback.equalizer.preset;
  playback.equalizer.gains.forEach((gain, i) => { document.getElementById(`eq-band-${i}`).value = gain; document.getElementById(`eq-value-${i}`).textContent = `${gain > 0 ? '+' : ''}${gain} dB`; });
  const supported = !!(window.AudioContext || window.webkitAudioContext);
  $('#equalizer-controls').disabled = !supported;
  if (!supported) $('#equalizer-note').textContent = 'L’equalizzatore non è disponibile in questo browser. Puoi ascoltare con il suono normale.';
}
async function applyEqualizer(value) {
  playback.setEqualizer(value); musicFeedback.equalizer = playback.equalizer; storage.set(feedbackKey(), musicFeedback); paintEqualizer();
  const ready = await playback.prepareAudio();
  $('#equalizer-note').textContent = ready ? 'Il volume può scendere un po’ per mantenere il suono pulito.' : 'Tocca Riproduci per attivare il suono scelto. Se non parte, usa Normale.';
}
$('#equalizer-preset').addEventListener('change', () => applyEqualizer(selectEqualizer($('#equalizer-preset').value, playback.equalizer)));
$('#open-music-player').addEventListener('click', () => openMusicPlayer());
$('#bar-lyrics').addEventListener('click', () => openMusicPlayer(true));
$('#view-cover').addEventListener('click', () => playerView(false));
$('#view-lyrics').addEventListener('click', () => playerView(true));
$('#lyrics-preview').addEventListener('click', () => { playerView(true); $('#lyrics-lines').focus(); });
$('#player-open-queue').addEventListener('click', () => showDialog('#queue-dialog'));
let detailRequest; let detailSong; let playerArtist;
async function loadPlayerDetails(force = false) {
  const song = state.queue[state.queueIndex];
  const key = `${musicKey()}/${song?.id}`;
  if (!song || !$('#music-player').open || (!force && detailSong === key)) return;
  detailRequest?.abort(); const request = new AbortController(); detailRequest = request; detailSong = key; playerArtist = null;
  $('#track-facts').replaceChildren(el('p', { class: 'muted' }, 'Cerco i dati…'));
  $('#player-artist').textContent = song.artist || 'Artista sconosciuto'; $('#artist-radio').disabled = true; $('#retry-player-details').hidden = true;
  try {
    const result = await api(`/api/music/details?id=${encodeURIComponent(song.id)}`, { signal: request.signal });
    if (request.signal.aborted || `${musicKey()}/${state.queue[state.queueIndex]?.id}` !== key) return;
    const s = result.song; playerArtist = result.artist;
    const rows = [['Album', s.album], ['Anno', s.year], ['Genere', s.genre], ['Mood', s.mood?.join(', ')], ['BPM', s.bpm], ['Tonalità', s.tonalita], ['Energia', s.energia == null ? null : `${s.energia}/100`],
      ['Durata', s.duration == null ? null : fmtTime(s.duration)], ['Formato', s.format], ['Bitrate', s.bitRate ? `${s.bitRate} kb/s` : null]];
    $('#track-facts').replaceChildren(...rows.flatMap(([name, value]) => [el('dt', {}, name), el('dd', {}, value === '' || value == null ? 'Non disponibile' : value)]));
    $('#player-artist').replaceChildren(el('img', { src: musicImage(playerArtist.coverArt, 400), alt: '', loading: 'lazy', onerror: event => { event.target.hidden = true; } }),
      el('h3', {}, playerArtist.name), el('p', { class: 'muted' }, `${quantity(playerArtist.songCount, 'brano', 'brani')} nella tua raccolta`));
    $('#artist-radio').disabled = !playerArtist.id;
  } catch (error) {
    if (request.signal.aborted) return;
    detailSong = null; $('#track-facts').replaceChildren(el('p', { class: 'muted' }, 'I dati non sono disponibili. La musica continua.')); $('#retry-player-details').hidden = false;
  }
}
$('#retry-player-details').addEventListener('click', () => loadPlayerDetails(true));
$('#artist-radio').addEventListener('click', action(() => playerArtist?.id && startSelection({ kind: 'radio', artist: playerArtist.id })));
function renderQueuePreview() {
  const next = state.queue.slice(state.queueIndex + 1, state.queueIndex + 4);
  $('#queue-preview').replaceChildren(...next.map((s, i) => el('li', { class: 'track-row' }, el('button', { class: 'track-main', onclick: () => playSong(state.queueIndex + i + 1), 'aria-label': `Ascolta dalla coda ${s.title}` },
    songIndicator(s), el('img', { class: 'track-cover', src: musicImage(s.coverArt || s.albumId, 80), alt: '', loading: 'lazy' }), el('span', { class: 'track-text' }, el('strong', {}, s.title), el('small', {}, s.artist || ''))))));
  if (!next.length) $('#queue-preview').append(el('li', { class: 'muted' }, 'Non ci sono altri brani in coda.'));
}
if ('ResizeObserver' in window) new ResizeObserver(() => { if (lyrics.synced) centerLyric(lyricAt); }).observe($('#lyrics-lines'));
$('#full-cover').addEventListener('error', () => {
  $('#music-player').style.removeProperty('--cover-color');
  if ($('#full-cover').getAttribute('src') !== '/music-cover.svg') $('#full-cover').src = '/music-cover.svg';
});
$('#full-cover').addEventListener('load', () => {
  try {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage($('#full-cover'), 0, 0, 16, 16);
    const pixels = ctx.getImageData(0, 0, 16, 16).data; const rgb = [0, 0, 0];
    for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) rgb[c] += pixels[i + c];
    $('#music-player').style.setProperty('--cover-color', `rgb(${rgb.map(v => Math.round(v / 256 * 0.48)).join(' ')})`);
  } catch { $('#music-player').style.removeProperty('--cover-color'); }
});
function albumCard(album) {
  return el('button', { class: 'card shelf-card', onclick: action(() => openAlbum(album.id)), 'aria-label': `Apri album ${album.name}` }, art(el, musicImage, { ids: [album.coverArt], name: album.name }),
    el('h3', { class: 'shelf-title' }, album.name || 'Album senza titolo'), el('span', { class: 'meta shelf-sub' }, album.artist || 'Artista sconosciuto'));
}
const moodSymbols = { Energia: '↗', Festa: '✦', Relax: '≈', Concentrazione: '◎', Malinconia: '☂', Notte: '☾', 'Soul e jazz': '♫', Grinta: 'ϟ', 'In viaggio': '➜' };
// Riquadro colorato di mood e generi: nome in alto a sinistra, copertina inclinata nell'angolo.
function musicCollectionCard(group, type, index) {
  const cover = lazyArt(musicContext(), art(el, musicImage, { name: group.nome, glyph: moodSymbols[group.nome] || '♫' }), type, group.nome); cover.classList.add('tilt');
  return hued(el('button', { class: `mood-card${type === 'generi' ? ' genre-card' : ''}`, 'aria-label': `Apri ${type === 'mood' ? 'mood' : 'genere'} ${group.nome}`, onclick: () => openCollection(type, group.nome) },
    el('strong', { class: 'tile-name' }, group.nome), el('small', { class: 'tile-count' }, quantity(group.brani, 'brano', 'brani')), cover), '--tile-hue', (nameHue(group.nome) + index * 7) % 230);
}
// Scheletri grigi al posto delle scritte «Carico…».
function musicSkeleton(kind = 'list') {
  const block = cls => el('span', { class: `skeleton-block ${cls}` });
  return el('div', { class: `music-skeleton skeleton-${kind}`, role: 'status', 'aria-label': 'Carico la musica' },
    kind === 'home' ? [el('div', { class: 'skeleton-quick' }, ...Array.from({ length: 8 }, () => block('quick'))), block('heading'), el('div', { class: 'skeleton-shelf' }, ...Array.from({ length: 4 }, () => block('cover')))]
      : [block('hero'), ...Array.from({ length: 6 }, () => el('div', { class: 'skeleton-row' }, block('thumb'), block('line')))]);
}
function musicLoading(kind) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches || !$('#music-results').children.length) { $('#music-breadcrumb').replaceChildren(); $('#music-results').replaceChildren(musicSkeleton(kind)); }
}
// Menu «⋯» di una raccolta: riusa il foglio delle opzioni brano.
function collectionMenu(title, entries) {
  $('#song-menu-title').textContent = title;
  $('#song-menu-actions').replaceChildren(...entries.filter(Boolean).map(([label, fn]) => el('button', { class: 'secondary', onclick: action(async () => { $('#song-menu').close(); await fn(); }) }, label)));
  showDialog('#song-menu');
}
async function openCollection(type, name) {
  const generation = ++state.musicGeneration;
  musicVisit(`${type}:${name}`, name, () => openCollection(type, name));
  $('#more-albums').hidden = true;
  musicLoading('list');
  try {
    const result = await api(`/api/music/collection?type=${type}&name=${encodeURIComponent(name)}`);
    if (generation !== state.musicGeneration) return;
    const songs = result.songs || [];
    await musicPageUpdate(generation, () => {
      const cover = art(el, musicImage, { ids: songs.map(s => s.coverArt || s.albumId), name, glyph: moodSymbols[name] || '♫', size: 400 });
      $('#music-breadcrumb').replaceChildren(hero(el, { cover, kind: type === 'mood' ? 'Il tuo momento' : 'Il tuo suono', title: name, sub: `${quantity(songs.length, 'brano pronto', 'brani pronti')} da ascoltare`,
        tools: [heroButton(el, 'add', 'Aggiungi alla coda', () => addToQueue(songs), { disabled: !songs.length }),
          el('button', { class: 'hero-text-button', onclick: action(() => startSelection({ kind: 'radio', ...(type === 'mood' ? { mood: name } : { seed: songs[0]?.id }) })) }, 'Avvia radio')],
        shuffle: heroButton(el, 'shuffle', 'Mescola', action(() => shuffleSongs(songs)), { disabled: !songs.length }), play: heroPlay(el, () => setQueue(songs, 0), !songs.length) }));
      $('#music-results').replaceChildren(...[
        result.missing ? el('p', { class: 'catalog-note' }, `${quantity(result.missing, 'brano non è ancora collegato', 'brani non sono ancora collegati')}. Aggiorna l’indice in Navidrome e controlla che i file siano nella cartella del catalogo. Non vengono sostituiti con brani dallo stesso titolo.`) : null,
        songs.length ? trackList(songs) : el('div', { class: 'empty' }, el('h3', {}, 'Nessun brano pronto in questa raccolta'), el('p', {}, 'Puoi ascoltare le playlist Mood e Generi importate da Navidrome.'))].filter(Boolean));
    });
  } catch (e) {
    if (generation === state.musicGeneration) $('#music-results').replaceChildren(el('div', { class: 'empty' }, el('p', {}, e.message), el('button', { class: 'secondary', onclick: () => openCollection(type, name) }, 'Riprova')));
  }
}
// Sezioni e percorso: ogni pagina ricorda dove eri arrivato a scorrere, «‹» torna indietro.
const MUSIC_SECTIONS = { home: 'home', recap: 'home', moment: 'home', browse: 'search', library: 'library', songs: 'library', albums: 'library', artists: 'library', playlists: 'library', liked: 'library', recent: 'library', top: 'library', history: 'library' };
const MUSIC_TITLES = { home: 'Home', recap: 'Il tuo mese', moment: 'Il tuo momento', browse: 'Cerca', library: 'La tua libreria', songs: 'Tutti i brani', albums: 'Tutti gli album', artists: 'Tutti gli artisti', playlists: 'Tutte le playlist', liked: 'Brani che ti piacciono', recent: 'Ascoltati di recente', top: 'I più ascoltati', history: 'Cronologia' };
const musicTrail = []; let musicReturning = false;
function musicSection(section) {
  if (!section) return;
  document.body.dataset.musicSection = section;
  $$('#music-nav [data-section]').forEach(b => { if (b.dataset.section !== 'create') b.setAttribute('aria-pressed', String(b.dataset.section === section)); });
}
function musicVisit(key, title, run, section) {
  musicSection(section || (musicTrail.length ? undefined : 'home'));
  if (!musicReturning && musicTrail.at(-1)?.key !== key) {
    const top = musicTrail.at(-1); if (top) top.scroll = window.scrollY;
    if (['tab:home', 'tab:browse', 'tab:library'].includes(key)) musicTrail.length = 0;
    musicTrail.push({ key, title, run, scroll: 0, section: document.body.dataset.musicSection });
    if (musicTrail.length > 40) musicTrail.splice(1, 1);
    if (state.page === 'music' && window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
  }
  musicTitle(title);
}
function musicTitle(title) {
  const top = musicTrail.at(-1); if (top && title) top.title = title;
  $('#music-top-title').textContent = top?.title || '';
  $('#music-top').hidden = musicTrail.length < 2;
  document.body.classList.toggle('music-subpage', musicTrail.length > 1);
  requestAnimationFrame(musicHeroScroll);
}
async function musicBack() {
  if (musicTrail.length < 2) return;
  musicTrail.pop(); const back = musicTrail.at(-1);
  musicReturning = true; musicSection(back.section);
  try { await back.run(); } finally { musicReturning = false; }
  musicTitle(back.title);
  requestAnimationFrame(() => window.scrollTo({ top: back.scroll || 0, behavior: 'instant' }));
}
// L'intestazione si dissolve scorrendo; il titolo passa nella barra compatta in alto.
function musicHeroScroll() {
  const top = $('#music-top'); const node = $('#music-breadcrumb .music-hero');
  if (!node || state.page !== 'music') { top.classList.toggle('solid', !top.hidden); top.style.removeProperty('--top-color'); return; }
  const rect = node.getBoundingClientRect(); const reach = Math.max(1, rect.height - 140);
  const progress = Math.min(1, Math.max(0, (top.getBoundingClientRect().bottom - rect.top - 56) / reach));
  node.style.setProperty('--hero-fade', (1 - progress).toFixed(3));
  top.classList.toggle('solid', progress > .72);
  const color = node.style.getPropertyValue('--hero-color'); if (color) top.style.setProperty('--top-color', color);
}
let musicScrollFrame = 0;
window.addEventListener('scroll', () => {
  if (state.page !== 'music' || musicScrollFrame) return;
  musicScrollFrame = requestAnimationFrame(() => { musicScrollFrame = 0; musicHeroScroll(); });
}, { passive: true });
$('#music-back').addEventListener('click', action(musicBack));
let libraryModule;
const offlineModules = new Map();
async function musicOffline() {
  const key = `${musicKey()}:${state.profile}`;
  if (!offlineModules.has(key)) offlineModules.set(key, import('./music-offline.js').then(m => m.offlineLibrary({ ...musicContext(), key: () => key, fmtSize, setPage })));
  return offlineModules.get(key);
}
function flushPlayed(profile = state.profile) {
  if (!navigator.onLine || state.offline) return;
  const user = state.boot.musicUser, key = `${musicKey()}:${profile}:pending-listens`;
  if (!Object.keys(storage.get(key, {})).length) return;
  import('./music-listening.js').then(m => m.flushListening(storage, key, event => api('/api/music/played', { method: 'POST', data: { ...event, profile, user } }))).catch(() => {});
}
function recordPlayed(data) {
  const profile = state.listeningProfile || state.profile, key = `${musicKey()}:${profile}:pending-listens`, pending = storage.get(key, {});
  if ((pending[data.playId]?.seconds || 0) < data.seconds) pending[data.playId] = data;
  storage.set(key, Object.fromEntries(Object.entries(pending).slice(-2000))); flushPlayed(profile);
}
let remoteMusic; let devicesStarting;
async function ensureDevices() {
  if (!state.boot?.music || !navigator.onLine) return;
  const key = `${musicKey()}:${state.profile}`;
  if (devicesStarting) return devicesStarting;
  if (remoteMusic?.scope === key && !remoteMusic.stopped) return;
  remoteMusic?.stop(); remoteMusic = null;
  devicesStarting = (async () => {
    const [{ DeviceClient }, { deviceBridge }] = await Promise.all([import('./music-devices.js'), import('./music-device-bridge.js')]);
    if (`${musicKey()}:${state.profile}` !== key) return;
    const client = new DeviceClient(deviceBridge({ ...musicContext(), getAudio: () => audio, playback, playSong, persistQueue, renderQueue, clearQueue, fmtTime, notify, measureAudioBar, updateLyrics,
      trackChanged: song => { loadLyrics(song, ++songGeneration); loadPlayerDetails(); syncHeart(); refreshMarquees(); } }));
    remoteMusic = client;
    try { await client.start(); if (`${musicKey()}:${state.profile}` !== key) { client.stop(); if (remoteMusic === client) remoteMusic = null; } } catch (error) { client.stop(); remoteMusic = null; throw error; }
  })();
  try { await devicesStarting; } finally { devicesStarting = null; if (`${musicKey()}:${state.profile}` !== key) ensureDevices().catch(() => {}); }
}
function extraStyles() { if (!document.querySelector('link[href="/music-library.css"]')) document.head.append(el('link', { rel: 'stylesheet', href: '/music-library.css' })); }
const musicContext = () => (extraStyles(), { el, api, state, storage, action, notify, key: () => `${musicKey()}:${state.profile}`, image: musicImage,
  open: item => item.type === 'playlist' ? openPlaylist(item.id) : item.type === 'album' ? openAlbum(item.id) : openArtist(item),
  collectionCard: musicCollectionCard, albumCard, setQueue, trackList, load: loadMusic, offline: musicOffline, visit: musicVisit,
  showSelection, startSelection, openCollection, hero, heroPlay, heroButton, art,
  showModal: node => { node.id ||= `extra-${Date.now()}-${Math.random().toString(36).slice(2)}`; registerDialog(node); showDialog(`#${node.id}`); } });
let searchModule;
const musicSearch = () => searchModule ||= import('./music-search.js');
async function musicLibrary() {
  if (!libraryModule) {
    libraryModule = import('./music-library.js').then(module => {
      module.init(musicContext());
      return module;
    });
  }
  return libraryModule;
}
async function loadMusic(tab = state.musicTab, append = false) {
  $('#music-login').hidden = state.boot.music; $('#music-content').hidden = !state.boot.music;
  if (!state.boot.music) return;
  ensureDevices().catch(() => {});
  const generation = ++state.musicGeneration; state.musicTab = tab;
  if (!append) musicVisit(`tab:${tab}`, MUSIC_TITLES[tab] || 'Musica', () => loadMusic(tab), MUSIC_SECTIONS[tab] || 'home');
  if (!append) { $('#music-results').classList.remove('album-open'); musicLoading(tab === 'home' ? 'home' : 'list'); $('#music-breadcrumb').replaceChildren(); state.albumsOffset = 0; }
  $('#more-albums').hidden = true;
  paintMusicSide(!append && ['library', 'playlists'].includes(tab));
  try {
    if (!navigator.onLine || state.offline) { await (await musicOffline()).showOffline(generation); return; }
    await ensureLikes();
    const query = $('#music-search').value.trim();
    if (!query && tab === 'recap') { const m = await import('./music-recap.js'); await m.showRecap(musicContext(), generation); return; }
    if (!query && tab === 'moment') { const m = await import('./music-moment.js'); await m.showMoment(musicContext(), generation); return; }
    if (query || tab === 'browse') {
      musicSection('search'); $('#music-search-field .section-top-slot').replaceChildren(sectionTop(musicContext(), 'Cerca'));
      await (await musicSearch()).search(musicContext(), generation, query); return;
    }
    if (!query && tab === 'songs') { await (await import('./music-songs.js')).showSongs(musicContext(), generation); return; }
    if (!query && tab === 'library') { await (await musicLibrary()).library(generation); return; }
    if (!query && ['liked', 'recent', 'top', 'history'].includes(tab)) {
      const result = await api(tab === 'liked' ? '/api/music/liked' : '/api/music/activity');
      if (generation !== state.musicGeneration) return;
      if (tab === 'liked') { likedIds = new Set(result.songs.map(s => s.id)); likesLoaded = true; }
      const songs = result.songs || result[tab] || [];
      await musicPageUpdate(generation, () => {
        const glyph = { liked: '♥', recent: '↺', top: '★', history: '◷' }[tab];
        const cover = art(el, musicImage, { name: MUSIC_TITLES[tab], glyph, size: 400 }); if (tab === 'liked') cover.classList.add('liked-art');
        $('#music-breadcrumb').replaceChildren(hero(el, { cover, kind: tab === 'liked' ? 'Playlist' : 'I tuoi ascolti', title: MUSIC_TITLES[tab], sub: quantity(songs.length, 'brano', 'brani'),
          tools: [heroButton(el, 'add', 'Aggiungi alla coda', () => addToQueue(songs), { disabled: !songs.length })],
          shuffle: heroButton(el, 'shuffle', 'Mescola', action(() => shuffleSongs(songs)), { disabled: !songs.length }), play: heroPlay(el, () => setQueue(songs), !songs.length) }));
        $('#music-results').replaceChildren(songs.length ? trackList(songs) : el('p', { class: 'muted' }, 'Qui ritroverai i tuoi ascolti. Un brano conta dopo metà ascolto, fino a quattro minuti.'));
      }); return;
    }
    if (!query && tab === 'home') {
      const [home, albums, lib, activity, homeView] = await Promise.all([api('/api/music/home'), api('/api/music/albums?offset=0'),
        api(`/api/music/library?profile=${encodeURIComponent(state.profile)}`).catch(() => ({ items: [] })), api('/api/music/activity').catch(() => ({})), import('./music-home.js')]);
      if (generation !== state.musicGeneration) return;
      await musicPageUpdate(generation, () => $('#music-results').replaceChildren(homeView.renderHome(musicContext(), { home, albums: albums.albumList2?.album || [], items: lib.items || [], recent: activity.recent || [] })));
      return;
    }
    const result = await api(`/api/music/${tab}${tab === 'albums' ? `?offset=${state.albumsOffset}` : ''}`);
    if (generation !== state.musicGeneration) return;
    await musicPageUpdate(generation, () => {
    const container = $('#music-results'); if (!append) container.replaceChildren();
    if (!append) $('#music-breadcrumb').replaceChildren(el('h2', { class: 'page-heading' }, MUSIC_TITLES[tab]));
    if (tab === 'albums') {
      const albums = result.albumList2?.album || []; container.append(...albums.map(albumCard));
      $('#more-albums').hidden = albums.length < 100; state.albumsOffset += albums.length;
    } else if (tab === 'artists') {
      container.append(...(result.artists?.index || []).flatMap(index => index.artist || []).map(artistCard));
    } else {
      container.append(...(result.playlists?.playlist || []).map(playlistCard));
      $('#music-breadcrumb').append(el('div', { class: 'actions page-actions' }, el('button', { class: 'secondary pill', onclick: action(createPlaylist) }, 'Nuova playlist'), el('button', { class: 'secondary pill', onclick: () => showDialog('#queue-dialog') }, 'Crea una playlist dalla coda')));
    }
    if (!container.children.length) container.append(el('div', { class: 'empty' }, el('h2', {}, query ? 'Nessun risultato' : 'Qui non ci sono ancora brani'), el('p', {}, 'Controlla i file e l’indice in Navidrome sul telefono della musica.')));
    });
  } catch (e) {
    if (generation !== state.musicGeneration) return;
    if (!e.status && e.message.startsWith('Il telefono non risponde')) { state.offline = true; await (await musicOffline()).showOffline(generation); return; }
    $('#music-results').replaceChildren(el('div', { class: 'empty' }, el('p', {}, e.message), el('button', { class: 'secondary', onclick: () => loadMusic() }, 'Riprova')));
  }
}
async function openArtist(artist) {
  const generation = ++state.musicGeneration;
  musicVisit(`artist:${artist.id}`, artist.name, () => openArtist(artist));
  musicLoading('list');
  const library = await musicLibrary(); if (generation !== state.musicGeneration) return; library.markOpened('artist', artist.id);
  const data = await api(`/api/music/artist?id=${encodeURIComponent(artist.id)}`); if (generation !== state.musicGeneration) return;
  await musicPageUpdate(generation, () => {
    const albums = data.artist?.album || [];
    const radio = () => startSelection({ kind: 'radio', artist: artist.id });
    $('#music-breadcrumb').replaceChildren(hero(el, { cover: artistArt(musicContext(), artist.name, data.artist?.coverArt || artist.coverArt, 400), kind: 'Artista', title: artist.name,
      sub: `${quantity(albums.length, 'album')} nella tua raccolta`, tools: [el('button', { class: 'hero-text-button primary-outline', onclick: action(radio) }, 'Radio artista')],
      play: heroPlay(el, action(radio), false, 'Ascolta la radio dell’artista') }));
    $('#music-results').replaceChildren(el('h3', { class: 'results-heading' }, 'Album'), ...albums.map(albumCard));
    $('#more-albums').hidden = true;
  });
}
function artistCard(artist) {
  return el('button', { class: 'card shelf-card round-card', onclick: action(() => openArtist(artist)) }, artistArt(musicContext(), artist.name, artist.coverArt),
    el('h3', { class: 'shelf-title' }, artist.name), el('span', { class: 'meta shelf-sub' }, quantity(artist.albumCount || 0, 'album')));
}
function trackList(songs, edit) {
  return windowedList(songs, (song, i) => {
    const row = el('li', { class: 'track-row', draggable: !!edit?.editing }, el('button', { class: 'track-main', 'data-n': i + 1, onpointerdown: () => { if (!remoteMusic?.isRemote()) playback.warm(song); }, onclick: () => setQueue(songs, i), 'aria-label': `Ascolta ${song.title}` },
      songIndicator(song), el('img', { class: 'track-cover', src: musicImage(song.coverArt || song.albumId, 80), alt: '', loading: 'lazy' }), el('span', { class: 'track-text' }, el('strong', {}, song.title), el('small', {}, song.artist || 'Artista sconosciuto')), el('span', { class: 'duration' }, fmtTime(song.duration))),
      el('button', { class: 'quiet heart', 'data-song-heart': song.id, 'aria-label': `Mi piace ${song.title}`, 'aria-pressed': likedIds.has(song.id), onclick: action(() => toggleLike(song)) }, musicIcon('heart', likedIds.has(song.id))),
      el('button', { class: 'quiet', 'aria-label': `Aggiungi ${song.title} alla coda`, onclick: () => addToQueue([song]) }, '+'),
      el('button', { class: 'quiet', 'aria-label': `Opzioni ${song.title}`, onclick: () => songMenu(song) }, '⋯'));
    if (edit) {
      row.append(el('button', { class: 'quiet edit-tool', 'aria-label': `Sposta su ${song.title}`, disabled: i === 0, onclick: () => edit.move(i, i - 1) }, '↑'),
        el('button', { class: 'quiet edit-tool', 'aria-label': `Sposta giù ${song.title}`, disabled: i === songs.length - 1, onclick: () => edit.move(i, i + 1) }, '↓'),
        el('button', { class: 'quiet edit-tool', 'aria-label': `Togli ${song.title} dalla playlist`, onclick: () => edit.remove(i) }, '×'));
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(i)); });
      row.addEventListener('dragover', e => e.preventDefault()); row.addEventListener('drop', e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) edit.move(from, i); });
    }
    return row;
  }, { className: `track-list${edit ? ' editable-list' : ''}${edit?.editing ? ' editing' : ''}`, height: edit?.editing ? 112 : 76 });
}
async function openAlbum(id) {
  const generation = ++state.musicGeneration;
  musicVisit(`album:${id}`, '', () => openAlbum(id));
  musicLoading('list');
  const library = await musicLibrary(); if (generation !== state.musicGeneration) return; library.markOpened('album', id);
  if (!navigator.onLine || state.offline) { await (await musicOffline()).showCollection('album', id, generation); return; }
  const result = await api(`/api/music/album?id=${encodeURIComponent(id)}`); if (generation !== state.musicGeneration) return;
  const album = result.album; const songs = album.song || [];
  musicTitle(album.name);
  await musicPageUpdate(generation, () => {
  $('#more-albums').hidden = true;
  const seconds = songs.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  $('#music-breadcrumb').replaceChildren(hero(el, { cover: art(el, musicImage, { ids: [album.coverArt], name: album.name, size: 'large' }), kind: 'Album', title: album.name,
    sub: [album.artist, album.year, quantity(songs.length, 'brano', 'brani'), seconds ? minutes(seconds) : ''].filter(Boolean).join(' · '),
    tools: [heroButton(el, 'add', 'Aggiungi alla coda', () => addToQueue(songs)),
      heroButton(el, 'more', 'Altre azioni dell’album', () => collectionMenu(album.name, [['Aggiungi alla coda', () => addToQueue(songs)], ['Avvia radio', () => startSelection({ kind: 'radio', seed: songs[0]?.id })],
        album.artistId ? ['Vai all’artista', () => openArtist({ id: album.artistId, name: album.artist })] : null]))],
    shuffle: heroButton(el, 'shuffle', 'Mescola', action(() => shuffleSongs(songs))), play: heroPlay(el, () => setQueue(songs, 0)) }));
  $('#music-results').replaceChildren(trackList(songs));
  $('#music-results').classList.add('album-open');
  });
  const offline = await musicOffline(); if (generation === state.musicGeneration) ($('#music-breadcrumb').querySelector('.hero-tools') || $('#music-breadcrumb')).append(offline.downloadButton({ type: 'album', id: album.id, name: album.name, artist: album.artist, songs }));
}
function revealMusicTracks() {
  const list = $('#music-results').querySelector('.track-list'); if (!list) return;
  const rect = list.getBoundingClientRect(); const bar = $('#audio-bar');
  const bottom = bar.hidden ? window.innerHeight : Math.min(window.innerHeight, bar.getBoundingClientRect().top);
  // Wrapped tabs/toolbars can leave the last drop target behind the fixed player.
  // Reveal short playlists together; for long ones, keep the start in view.
  const shift = Math.min(rect.top, rect.bottom - bottom + 16);
  if (shift > 0) window.scrollBy({ top: shift, behavior: 'instant' });
}
async function openPlaylist(id) {
  const generation = ++state.musicGeneration;
  musicVisit(`playlist:${id}`, '', () => openPlaylist(id));
  const library = await musicLibrary(); if (generation !== state.musicGeneration) return; library.markOpened('playlist', id);
  if (!navigator.onLine || state.offline) { await (await musicOffline()).showCollection('playlist', id, generation); return; }
  const result = await api(`/api/music/playlist?id=${encodeURIComponent(id)}`); if (generation !== state.musicGeneration) return;
  const p = result.playlist; let songs = p.entry || []; let dirty = false; let saving = false; let editing = false;
  musicTitle(p.name);
  const suggestions = el('section', { class: 'playlist-recommendations', 'aria-label': 'Brani consigliati' });
  const save = el('button', { class: 'primary', disabled: true, onclick: action(async () => {
    if (saving) return; saving = true; save.disabled = true;
    try { await api('/api/music/playlist', { method: 'PUT', data: { id: p.id, name: p.name, songs: songs.map(s => s.id) } }); dirty = false; notify('Ordine della playlist salvato.'); }
    finally { saving = false; save.disabled = !dirty; }
  }) }, 'Salva ordine e brani');
  const paint = (focusAt, focusLabel) => {
    if (generation !== state.musicGeneration) return;
    const list = trackList(songs, {
      editing,
      move(from, to) { if (saving) return; const label = document.activeElement?.getAttribute('aria-label'); songs = moveEntry(songs, 0, from, to).queue; dirty = true; save.disabled = false; paint(to, label); },
      remove(at) { if (saving) return; songs = songs.filter((_, i) => i !== at); dirty = true; save.disabled = false; paint(Math.min(at, songs.length - 1)); }
    });
    $('#music-results').replaceChildren(list, suggestions);
    if (!songs.length) $('#music-results').append(el('p', { class: 'muted' }, 'Playlist vuota. Aggiungi un brano dal menu ⋯.'));
    if (Number.isInteger(focusAt)) {
      if (list.classList.contains('windowed-list')) { list.scrollTop = Math.max(0, focusAt) * (editing ? 112 : 76); list.dispatchEvent(new Event('scroll')); }
      const row = list.querySelector(`[aria-posinset="${focusAt + 1}"]`) || list.children[focusAt];
      const control = [...(row?.querySelectorAll('button') || [])].find(button => button.getAttribute('aria-label') === focusLabel && !button.disabled);
      (control || row?.querySelector('button') || save).focus({ preventScroll: true });
    }
  };
  // Riordino e rimozione solo in modalità modifica: la pagina normale resta pulita come un lettore musicale.
  const done = el('button', { class: 'secondary', onclick: () => toggleEdit() }, 'Fine');
  const editBar = el('div', { class: 'playlist-edit', hidden: true }, el('span', { class: 'muted' }, 'Trascina i brani oppure usa le frecce, poi salva.'), el('span', { class: 'playlist-edit-actions' }, done, save));
  function toggleEdit() { editing = !editing; editBar.hidden = !editing; paint(); }
  const rename = action(async () => { const name = await ask('Rinomina la playlist', p.name); if (!name) return; await api('/api/music/playlist', { method: 'PUT', data: { id: p.id, name, songs: songs.map(s => s.id) } }); await openPlaylist(p.id); });
  const remove = action(async () => { if (!await ask('Togliere la playlist?', '', `Sarà rimossa soltanto la playlist “${p.name}”. I brani restano nella raccolta.`, true)) return; await api('/api/music/playlist', { method: 'DELETE', data: { id: p.id } }); await loadMusic('playlists'); });
  await musicPageUpdate(generation, () => {
  $('#more-albums').hidden = true;
  const cover = art(el, musicImage, { ids: p.coverArt ? [p.coverArt] : songs.map(s => s.coverArt || s.albumId), name: p.name, glyph: '♪', size: 400 });
  $('#music-breadcrumb').replaceChildren(hero(el, { cover, kind: 'Playlist', title: p.name, sub: [p.owner, quantity(songs.length, 'brano', 'brani')].filter(Boolean).join(' · '),
    tools: [heroButton(el, 'add', 'Aggiungi alla coda', () => addToQueue(songs)),
      heroButton(el, 'more', 'Altre azioni della playlist', () => collectionMenu(p.name, [[editing ? 'Fine modifica' : 'Modifica ordine e brani', toggleEdit], ['Rinomina', rename], ['Togli la playlist', remove]]))],
    shuffle: heroButton(el, 'shuffle', 'Mescola', action(() => shuffleSongs(songs))), play: heroPlay(el, () => setQueue(songs, 0)),
    extra: [editBar] }));
  paint(); revealMusicTracks();
  });
  const offline = await musicOffline();
  if (generation === state.musicGeneration) {
    ($('#music-breadcrumb').querySelector('.hero-tools') || $('#music-breadcrumb')).append(offline.downloadButton({ type: 'playlist', id: p.id, name: p.name, get songs() { return songs; } }));
    revealMusicTracks();
  }
  const { playlistRecommendations } = await import('./music-recommendations.js');
  await playlistRecommendations(musicContext(), suggestions, generation, () => songs, async song => {
    if (saving) throw new Error('Attendi il salvataggio della playlist.');
    if (songs.some(s => s.id === song.id)) return;
    saving = true; save.disabled = true;
    try { const next = [...songs, song]; await api('/api/music/playlist', { method: 'PUT', data: { id: p.id, name: p.name, songs: next.map(s => s.id) } }); songs = next; dirty = false; paint(); notify('Brano aggiunto alla playlist.'); }
    finally { saving = false; save.disabled = !dirty; }
  });
}
$('#music-link').addEventListener('submit', action(async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button.primary'); button.disabled = true;
  try { await api('/api/manage/music/link', { method: 'POST', data: { username: form.elements.username.value, password: form.elements.password.value } }); form.elements.password.value = ''; form.elements.username.value = ''; await paintMusicLink(); notify('Musica collegata. Ora si apre da sola.'); }
  finally { button.disabled = false; }
}));
$('#music-unlink').addEventListener('click', action(async () => {
  pauseMusic(); remoteMusic?.stop(); remoteMusic = null; await api('/api/manage/music/unlink', { method: 'POST', data: {} }); state.boot.music = false; state.boot.musicUser = ''; await paintMusicLink(); notify('Musica scollegata.');
}));
$('#music-login').addEventListener('submit', action(async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); button.disabled = true;
  playback.pause(); remoteMusic?.stop(); remoteMusic = null;
  try { await api('/api/music/login', { method: 'POST', data: { username: form.elements.username.value, password: form.elements.password.value } }); form.elements.password.value = ''; state.boot.music = true; state.boot.musicUser = form.elements.username.value.trim(); await restoreMusic(); await loadMusic(); }
  finally { button.disabled = false; }
}));
// Le scorciatoie [data-music] nascono e cambiano con le pagine: un solo ascoltatore per tutte.
$('#music-page').addEventListener('click', event => { const b = event.target.closest('[data-music]'); if (!b || b.disabled) return; clearTimeout(searchTimer); $('#music-search').value = ''; loadMusic(b.dataset.music); });
$('#music-search').addEventListener('input', () => { ++state.musicGeneration; clearTimeout(searchTimer); searchTimer = setTimeout(() => loadMusic('browse'), 180); });
$('#music-search').addEventListener('focus', () => { if (!$('#music-search').value.trim()) loadMusic('browse'); });
$('#music-search').addEventListener('keydown', action(async event => { if (event.key === 'Enter') { clearTimeout(searchTimer); (await musicSearch()).remember(musicContext(), $('#music-search').value); await loadMusic('browse'); } }));
$('#more-albums').addEventListener('click', () => loadMusic('albums', true));
let likedIds = new Set(); let likesLoaded = false; const likesBusy = new Set();
let radio = null; let radioBusy = false; let radioGeneration = 0; let heard = new Set(); let lastMusicSave = 0; let restoringMusic = false;
const musicKey = () => `music:${state.boot?.musicUser || 'guest'}`;
const playback = new MusicPlayback([audio, $('#audio-buffer')], {
  url: song => `/api/music/stream?id=${encodeURIComponent(song.id)}&offline=${encodeURIComponent(`${musicKey()}:${state.profile}`)}`,
  track(song, node, index) {
    state.listeningProfile = state.profile;
    audio.id = 'audio-buffer'; node.id = 'audio'; audio = node; state.queueIndex = index; heard.add(song.id);
    const generation = ++songGeneration; video.pause();
    $('#audio-title').textContent = song.title; $('#audio-artist').textContent = song.artist || '';
    $('#full-title').textContent = song.title; $('#full-artist').textContent = [song.artist, song.album].filter(Boolean).join(' · ');
    $('#music-player').style.removeProperty('--cover-color');
    syncFullPlayer(); syncHeart();
    $('#audio-bar').hidden = false; document.body.classList.add('has-audio'); measureAudioBar();
    refreshMarquees(); syncIndicators();
    if ('mediaSession' in navigator && 'MediaMetadata' in window) navigator.mediaSession.metadata = new MediaMetadata({ title: song.title, artist: song.artist || '', album: song.album || '', artwork: [{ src: new URL(musicImage(song.coverArt || song.albumId, 400), location.href).href, sizes: '400x400' }] });
    // Solo stato locale: le richieste accessorie aspettano l'evento playing.
    persistQueue(); renderQueue();
  },
  status(value) {
    const message = value === 'loading' ? 'Caricamento del brano…' : value === 'error' ? 'Il brano non parte. Tocca Riproduci per riprovare.' : '';
    for (const id of ['music-load-status', 'mini-load-status']) { const n = document.getElementById(id); n.textContent = message; n.hidden = !message; }
    $('#audio-bar').setAttribute('aria-busy', String(value === 'loading'));
  },
  ready(song) {
    if (!song || song.id !== state.queue[state.queueIndex]?.id) return;
    if (state.musicReadyGeneration === songGeneration) return; state.musicReadyGeneration = songGeneration;
    $('#audio-cover').src = musicImage(song.coverArt || song.albumId, 80);
    $('#full-cover').src = musicImage(song.coverArt || song.albumId, 'large');
    loadLyrics(song, songGeneration); loadPlayerDetails(); fillRadio().catch(e => notify(e.message, true));
  },
  // Senza rete l'ascolto resta nella coda locale (activity → recordPlayed): nessun avviso rosso durante l'ascolto offline.
  listen: data => (!navigator.onLine || state.offline) ? Promise.resolve() : api('/api/music/listen', { method: 'POST', data })
    .catch(e => { if (navigator.onLine && !state.offline) notify(`Cronologia non aggiornata: ${e.message}`, true); }),
  activity: recordPlayed,
  more: () => fillRadio(true), progress: () => persistQueue(),
  sleep: () => { $('#sleep-timer').value = '0'; notify('Timer terminato. Buonanotte.'); },
  error: error => notify(error?.message || 'Tocca Riproduci per avviare il brano. Se non parte, controlla la connessione.', true)
});
function pauseMusic() { if (remoteMusic?.isRemote()) remoteMusic.send('pause').catch(e => notify(e.message, true)); else playback.pause(); }
async function ensureLikes() {
  if (!navigator.onLine || state.offline) return;
  if (likesLoaded || !state.boot?.music) return;
  const result = await api('/api/music/liked'); likedIds = new Set((result.songs || []).map(s => s.id)); likesLoaded = true; syncHeart();
}
function syncHeart() {
  $$('[data-song-heart]').forEach(b => { const liked = likedIds.has(b.dataset.songHeart); b.replaceChildren(musicIcon('heart', liked)); b.setAttribute('aria-pressed', liked); });
  const song = state.queue[state.queueIndex]; const liked = !!song && likedIds.has(song.id);
  $('#full-like').replaceChildren(musicIcon('heart', liked), ' Mi piace'); $('#full-like').setAttribute('aria-pressed', liked);
  syncMiniLike();
}
async function toggleLike(song) {
  if (!song || likesBusy.has(song.id)) return; likesBusy.add(song.id);
  try { await ensureLikes(); const starred = !likedIds.has(song.id); await api('/api/music/star', { method: 'POST', data: { id: song.id, starred } });
    if (starred) likedIds.add(song.id); else likedIds.delete(song.id); syncHeart(); vibrateFeedback(); if (starred) pulseHearts(song.id);
  } finally { likesBusy.delete(song.id); }
}
function playlistCard(p) {
  const cover = p.coverArt ? art(el, musicImage, { ids: [p.coverArt], name: p.name }) : lazyArt(musicContext(), art(el, musicImage, { name: p.name, glyph: '♪' }), 'playlist', p.id);
  return el('button', { class: 'card shelf-card', onclick: action(() => openPlaylist(p.id)) }, cover, el('h3', { class: 'shelf-title' }, p.name), el('span', { class: 'meta shelf-sub' }, `Playlist · ${quantity(p.songCount || 0, 'brano', 'brani')}`));
}
async function createPlaylist(song) {
  const name = await ask('Come chiamiamo la playlist?'); if (!name) return;
  const result = await api('/api/music/playlist', { method: 'POST', data: { name, songs: song ? [song.id] : [] } });
  notify('Playlist creata.'); if (result.playlist?.id) await openPlaylist(result.playlist.id); else await loadMusic('playlists');
}
async function addToPlaylist(song) {
  const lists = await api('/api/music/playlists');
  $('#song-menu-title').textContent = `Aggiungi ${song.title} a una playlist`;
  $('#song-menu-actions').replaceChildren(el('button', { class: 'primary', onclick: action(async () => { $('#song-menu').close(); await createPlaylist(song); }) }, 'Nuova playlist'),
    ...(lists.playlists?.playlist || []).map(p => el('button', { class: 'secondary', onclick: action(async () => { await api('/api/music/playlist/add', { method: 'POST', data: { id: p.id, song: song.id } }); $('#song-menu').close(); notify('Brano aggiunto alla playlist.'); }) }, p.name)));
  showDialog('#song-menu');
}
function songMenu(song) {
  if (!song) return;
  $('#song-menu-title').textContent = song.title;
  const button = (label, fn) => el('button', { class: 'secondary', onclick: action(async () => { $('#song-menu').close(); await fn(); }) }, label);
  $('#song-menu-actions').replaceChildren(button('Riproduci dopo', () => addToQueue([song], true)), button('Aggiungi in coda', () => addToQueue([song])),
    button(likedIds.has(song.id) ? 'Togli Mi piace' : 'Metti Mi piace', () => toggleLike(song)), button('Radio del brano', () => startSelection({ kind: 'radio', seed: song.id })),
    button('Aggiungi a una playlist', () => addToPlaylist(song)),
    ...(song.albumId ? [button('Apri album', () => { setPage('music'); return openAlbum(song.albumId); })] : []));
  showDialog('#song-menu');
}
async function showSelection(options, title) {
  const generation = ++state.musicGeneration;
  musicVisit(`selection:${title}`, title, () => showSelection(options, title));
  musicLoading('list');
  const result = await api('/api/music/select', { method: 'POST', data: options });
  if (generation !== state.musicGeneration) return;
  await musicPageUpdate(generation, () => {
  const songs = result.songs;
  const cover = art(el, musicImage, { ids: songs.map(s => s.coverArt || s.albumId), name: title, glyph: options.mood ? moodSymbols[options.mood] || '♫' : '↺', size: 400 });
  $('#music-breadcrumb').replaceChildren(hero(el, { cover, kind: 'Scelto per te', title, sub: quantity(songs.length, 'brano', 'brani'),
    tools: [heroButton(el, 'add', 'Aggiungi alla coda', () => addToQueue(songs), { disabled: !songs.length })],
    shuffle: heroButton(el, 'shuffle', 'Mescola', action(() => shuffleSongs(songs)), { disabled: !songs.length }), play: heroPlay(el, () => setQueue(songs), !songs.length) }));
  $('#music-results').replaceChildren(songs.length ? trackList(songs) : el('p', { class: 'muted' }, 'Nessun brano da riscoprire oggi. Metti un cuore ai tuoi preferiti e torna più avanti.'));
  });
}
async function startSelection(options) {
  const token = ++radioGeneration; const result = await api('/api/music/select', { method: 'POST', data: options });
  if (token !== radioGeneration) return;
  if (!result.songs.length) { notify('Non ci sono altri brani per questa selezione.'); return; }
  setQueue(result.songs); radio = ['radio', 'shuffle'].includes(options.kind) ? options : null;
  $('#radio-state').textContent = radio ? options.kind === 'radio' ? 'Radio attiva · brani simili, senza ripetizioni' : 'Shuffle intelligente · senza ripetizioni' : 'Ascolto dalla coda';
}
async function fillRadio(force = false) {
  if (!radio || radioBusy || (!force && state.queue.length - state.queueIndex > 5)) return;
  if (heard.size >= 1900) { radio = null; notify('Hai ascoltato una lunga sessione. Avvia una nuova radio per ricominciare.'); return; }
  radioBusy = true; const token = radioGeneration;
  try {
    const result = await api('/api/music/select', { method: 'POST', data: { ...radio, exclude: [...new Set([...heard, ...state.queue.map(s => s.id)])].slice(0, 2000) } });
    if (token !== radioGeneration || !radio) return;
    if (!result.songs.length) { radio = null; $('#radio-state').textContent = 'Hai scoperto tutti i brani della radio'; return; }
    if (state.queueIndex > 60) { const cut = state.queueIndex - 30; state.queue.splice(0, cut); state.queueIndex -= cut; }
    addToQueue(result.songs, false, false);
  } finally { radioBusy = false; }
}
async function shuffleSongs(songs) {
  const result = await api('/api/music/select', { method: 'POST', data: { kind: 'shuffle', ids: songs.map(s => s.id).slice(0, 2000) } });
  if (!result.songs.length) { notify('Non ci sono brani pronti da mescolare.'); return; } setQueue(result.songs);
}
function persistQueue() {
  if (typeof remoteMusic !== 'undefined' && remoteMusic?.isRemote()) { const s = remoteMusic.remote()?.state; if (s) remoteMusic.send('queue', { ...s, queue: state.queue, index: state.queueIndex }).catch(e => notify(e.message, true)); return; }
  if (restoringMusic) return;
  if (state.queue.length > 2000) { state.queue = state.queue.slice(0, 2000); notify('La coda contiene al massimo 2000 brani.'); }
  playback.setQueue(state.queue, state.queueIndex);
  if (state.boot?.musicUser) storage.set(musicKey(), { queue: state.queue, index: state.queueIndex, position: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
    repeat: state.repeat, crossfade: playback.crossfade, normalize: playback.normalize, volume: playback.volume, radio, heard: [...heard].slice(-2000) });
}
function addToQueue(songs, after = false, message = true) {
  if (after) state.queue.splice(state.queue.length ? state.queueIndex + 1 : 0, 0, ...songs);
  else state.queue.push(...songs);
  persistQueue(); renderQueue(); if (message) { if (songs.length) vibrateFeedback(); notify(after ? 'Il brano verrà riprodotto dopo quello in ascolto.' : 'Brani aggiunti alla coda.'); }
}
function setQueue(songs, index = 0) {
  if (typeof remoteMusic !== 'undefined' && remoteMusic?.isRemote()) { remoteMusic.send('transfer', { queue: songs.slice(0, 2000), index, paused: false, position: 0, volume: remoteMusic.remote()?.state?.volume ?? 0.8 }).catch(e => notify(e.message, true)); return; }
  if (!songs.length) { clearQueue(); return; }
  pauseMusic();
  ++radioGeneration; radio = null; heard = new Set(); $('#radio-state').textContent = 'Ascolto dalla coda';
  const start = index >= 2000 ? index : 0; state.queue = songs.slice(start, start + 2000); state.queueIndex = index - start;
  playback.setQueue(state.queue, state.queueIndex, false); playSong(state.queueIndex);
}
async function playSong(index, options = {}) {
  if (typeof remoteMusic !== 'undefined' && remoteMusic?.isRemote()) { await remoteMusic.send('playIndex', { index }); return; }
  if (!state.queue[index]) return;
  if (!state.boot.music) { setPage('music'); notify('Accedi alla musica per riprendere la coda.'); return; }
  playback.setQueue(state.queue, state.queueIndex, false); await playback.play(index, options);
}
async function restoreMusic() {
  restoreMusicFeedback();
  const saved = storage.get(musicKey(), {});
  restoringMusic = true;
  try {
  likesLoaded = false; likedIds = new Set(); ++radioGeneration; radio = null; playback.clear();
  state.queue = Array.isArray(saved.queue) ? saved.queue.filter(s => s && typeof s.id === 'string' && typeof s.title === 'string').slice(0, 2000) : [];
  if (state.offline || (typeof navigator !== 'undefined' && !navigator.onLine)) { const offline = await musicOffline(); const ids = new Set((await offline.manager.collections()).flatMap(c => c.songs.map(s => s.id))); state.queue = state.queue.filter(s => ids.has(s.id)); }
  state.queueIndex = Number.isInteger(saved.index) && saved.index >= 0 && saved.index < state.queue.length ? saved.index : 0;
  state.repeat = ['off', 'one', 'all'].includes(saved.repeat) ? saved.repeat : 'off';
  heard = new Set(Array.isArray(saved.heard) ? saved.heard.filter(id => typeof id === 'string').slice(-2000) : []);
  playback.configure({ repeat: state.repeat, crossfade: saved.crossfade, normalize: saved.normalize, volume: saved.volume ?? storedVolume });
  $('#repeat-queue').value = state.repeat; $('#crossfade').value = playback.crossfade; $('#normalize-volume').checked = playback.normalize; $('#volume').value = playback.volume;
  playback.setQueue(state.queue, state.queueIndex); renderQueue();
  if (!state.queue.length && typeof document !== 'undefined') { $('#audio-bar').hidden = true; document.body.classList.remove('has-audio'); }
  if (state.queue.length) await playback.play(state.queueIndex, { position: saved.position, autoplay: false });
  if (saved.radio && ['radio', 'shuffle'].includes(saved.radio.kind)) { radio = saved.radio; $('#radio-state').textContent = 'La tua selezione è pronta a riprendere'; }
  try { await ensureLikes(); } catch (e) { notify(e.message, true); }
  } finally { restoringMusic = false; }
}
function renderQueue() {
  renderQueuePreview(); paintNowPanel();
  $('#queue-count').textContent = state.queue.length;
  const list = windowedList(state.queue, (song, index) => {
    const move = to => { const result = moveEntry(state.queue, state.queueIndex, index, to); state.queue = result.queue; state.queueIndex = result.index; persistQueue(); renderQueue(); };
    const row = el('li', { class: `track-row${index === state.queueIndex ? ' current' : ''}`, draggable: true },
      el('button', { class: 'track-main', onclick: () => playSong(index) }, songIndicator(song), el('span', { class: 'track-text' }, el('strong', {}, song.title), el('small', {}, song.artist || ''))),
      el('button', { class: 'icon-button', 'aria-label': `Sposta su ${song.title}`, disabled: index === 0, onclick: () => move(index - 1) }, '↑'),
      el('button', { class: 'icon-button', 'aria-label': `Sposta giù ${song.title}`, disabled: index === state.queue.length - 1, onclick: () => move(index + 1) }, '↓'),
      el('button', { class: 'icon-button', 'aria-label': `Togli ${song.title} dalla coda`, onclick: () => {
        if (index === state.queueIndex) pauseMusic();
        const result = removeEntry(state.queue, state.queueIndex, index); state.queue = result.queue; state.queueIndex = result.index;
        persistQueue(); renderQueue(); if (!state.queue.length) clearQueue(); else if (result.currentRemoved) playSong(state.queueIndex);
      } }, '×'), el('button', { class: 'quiet', 'aria-label': `Opzioni ${song.title}`, onclick: () => songMenu(song) }, '⋯'));
    row.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', String(index))); row.addEventListener('dragover', e => e.preventDefault());
    row.addEventListener('drop', e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); const result = moveEntry(state.queue, state.queueIndex, from, index); state.queue = result.queue; state.queueIndex = result.index; persistQueue(); renderQueue(); });
    return row;
  });
  list.id = 'queue-list'; $('#queue-list').replaceWith(list);
  if (!state.queue.length) list.append(el('li', { class: 'muted' }, 'La coda è vuota. Aggiungi un album o un brano.'));
  syncIndicators();
}
function nextSong() { (remoteMusic?.isRemote() ? remoteMusic.send('next') : playback.advance()).catch(e => notify(e.message, true)); }
$('#audio-next').addEventListener('click', nextSong); $('#full-next').addEventListener('click', nextSong);
$('#full-prev').addEventListener('click', () => $('#audio-prev').click()); $('#full-toggle').addEventListener('click', () => $('#audio-toggle').click());
function syncFullPlayer() {
  if (typeof remoteMusic !== 'undefined' && remoteMusic?.isRemote()) { const s = remoteMusic.remote()?.state; if (s) remoteMusic.c.mirror(s); return; }
  setMusicIcon($('#full-toggle'), audio.paused ? 'play' : 'pause'); $('#full-toggle').setAttribute('aria-label', audio.paused ? 'Riproduci nel lettore' : 'Metti in pausa nel lettore');
  $('#full-time').textContent = fmtTime(audio.currentTime); $('#full-duration').textContent = fmtTime(audio.duration);
  $('#full-seek').max = Number.isFinite(audio.duration) ? audio.duration : 100; $('#full-seek').value = audio.currentTime; updateLyrics();
}
for (const node of playback.nodes) {
  for (const event of ['timeupdate', 'seeked', 'loadedmetadata', 'play', 'pause', 'emptied']) node.addEventListener(event, () => {
    if (node !== audio) return; syncFullPlayer();
    setMusicIcon($('#audio-toggle'), audio.paused ? 'play' : 'pause'); $('#audio-toggle').setAttribute('aria-label', audio.paused ? 'Riproduci musica' : 'Metti in pausa la musica');
    if (['play', 'pause', 'emptied'].includes(event)) syncIndicators();
    $('#audio-time').textContent = fmtTime(audio.currentTime); $('#audio-duration').textContent = fmtTime(audio.duration); $('#audio-seek').max = Number.isFinite(audio.duration) ? audio.duration : 100; $('#audio-seek').value = audio.currentTime;
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = audio.paused ? 'paused' : 'playing';
      if (Number.isFinite(audio.duration) && audio.duration > 0) try { navigator.mediaSession.setPositionState?.({ duration: audio.duration, position: Math.min(audio.duration, audio.currentTime), playbackRate: audio.playbackRate }); } catch {}
    }
    if (['pause', 'seeked'].includes(event) || Date.now() - lastMusicSave > 5000) { lastMusicSave = Date.now(); persistQueue(); }
  });
  node.addEventListener('error', () => { if (node === audio) notify('Questo brano non si apre. Controlla Navidrome o prova un formato supportato.', true); });
}
for (const id of ['full-seek', 'audio-seek']) document.getElementById(id).addEventListener('input', event => { if (Number.isFinite(audio.duration)) { playback.cancelFade(); audio.currentTime = Number(event.target.value); } });
$('#audio-prev').addEventListener('click', () => { if (audio.currentTime > 3) { playback.cancelFade(); audio.currentTime = 0; } else playSong(Math.max(0, state.queueIndex - 1)); });
$('#audio-toggle').addEventListener('click', action(async () => { if (audio.paused) { video.pause(); if (!audio.getAttribute('src')) await playSong(state.queueIndex); else { await playback.prepareAudio(); await audio.play(); } } else pauseMusic(); }));
$('#volume').addEventListener('input', () => { playback.configure({ volume: $('#volume').value }); persistQueue(); });
$('#music-queue-open').addEventListener('click', () => showDialog('#queue-dialog')); $('#bar-queue').addEventListener('click', () => showDialog('#queue-dialog'));
$('#music-devices').addEventListener('click', action(async () => { await ensureDevices(); if (!remoteMusic) throw new Error('Collegati al Wi-Fi di casa per scegliere un dispositivo.'); remoteMusic.show(); }));
for (const id of ['#music-together', '#music-together-page']) $(id).addEventListener('click', action(async () => { await ensureDevices(); if (!remoteMusic) throw new Error('Accedi alla musica e collegati al Wi-Fi di casa per ascoltare insieme.'); (await remoteMusic.loadTogether()).open(); }));
function clearQueue() {
  if (remoteMusic?.isRemote()) { remoteMusic.send('queue', { queue: [], index: 0, paused: true, position: 0, volume: remoteMusic.remote()?.state?.volume ?? 0.8 }).catch(e => notify(e.message, true)); return; }
  ++radioGeneration; radio = null; heard = new Set(); ++songGeneration; lyricRequest?.abort(); lyrics = { synced: false, lines: [] }; $('#lyrics-lines').replaceChildren(); $('#music-player').close();
  playback.clear(); state.queue = []; state.queueIndex = 0; persistQueue(); renderQueue(); $('#audio-bar').hidden = true; document.body.classList.remove('has-audio');
}
$('#clear-queue').addEventListener('click', clearQueue);
$('#repeat-queue').addEventListener('change', () => { state.repeat = $('#repeat-queue').value; playback.configure({ repeat: state.repeat }); persistQueue(); });
$('#crossfade').addEventListener('change', () => { playback.configure({ crossfade: $('#crossfade').value }); persistQueue(); });
$('#normalize-volume').addEventListener('change', () => { playback.configure({ normalize: $('#normalize-volume').checked }); persistQueue(); });
$('#sleep-timer').addEventListener('change', () => { playback.setSleep($('#sleep-timer').value); notify($('#sleep-timer').value === '0' ? 'Timer disattivato.' : 'Timer impostato.'); });
$('#full-like').addEventListener('click', action(() => toggleLike(state.queue[state.queueIndex])));
$('#full-menu').addEventListener('click', () => songMenu(state.queue[state.queueIndex]));
$('#stop-radio').addEventListener('click', () => { ++radioGeneration; radio = null; $('#radio-state').textContent = 'Radio fermata · la coda resta pronta'; });
$('#shuffle-queue').addEventListener('click', () => {
  if (!state.queue.length) return; const song = state.queue[state.queueIndex];
  state.queue = [song, ...smartQueue(state.queue, { seed: song, exclude: [...heard, song.id], limit: 1999 })]; state.queueIndex = 0; persistQueue(); renderQueue();
});
$('#save-playlist').addEventListener('click', action(async () => {
  if (!state.queue.length) { notify('Aggiungi prima qualche brano alla coda.'); return; }
  const name = await ask('Come chiamiamo la playlist?'); if (!name) return;
  await api('/api/music/playlist', { method: 'POST', data: { name, songs: state.queue.map(s => s.id) } }); notify('Playlist salvata in Navidrome.');
}));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { playback.account(); persistQueue(); } });
window.addEventListener('pagehide', () => persistQueue());
if ('mediaSession' in navigator) {
  const handlers = { play: () => { video.pause(); playback.prepareAudio().then(() => audio.play()).catch(() => {}); }, pause: pauseMusic, stop: pauseMusic, previoustrack: () => $('#audio-prev').click(), nexttrack: nextSong,
    seekto: d => { if (Number.isFinite(d.seekTime) && Number.isFinite(audio.duration)) { playback.cancelFade(); audio.currentTime = Math.max(0, Math.min(audio.duration, d.seekTime)); } },
    seekbackward: d => { playback.cancelFade(); audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10)); }, seekforward: d => { if (Number.isFinite(audio.duration)) { playback.cancelFade(); audio.currentTime = Math.min(audio.duration, audio.currentTime + (d.seekOffset || 10)); } } };
  for (const [name, fn] of Object.entries(handlers)) try { navigator.mediaSession.setActionHandler(name, fn); } catch {}
}


// Management
async function paintMusicLink() {
  const link = await api('/api/manage/music'); state.boot.musicLinked = link.linked; if (link.linked) { state.boot.music = true; state.boot.musicUser = link.user; }
  $('#music-link-state').textContent = link.linked ? `La musica è collegata (utente ${link.user}). Si apre da sola per tutti i profili.` : 'La musica non è ancora collegata.';
  $('#music-link-fields').hidden = link.linked; $('#music-unlink').hidden = !link.linked;
}
async function loadManage() {
  $('#admin-login').hidden = state.boot.admin; $('#admin-content').hidden = !state.boot.admin; $('#logout').hidden = !state.boot.admin;
  if (!state.boot.admin) return;
  await paintMusicLink();
  if (!state.root) state.root = state.boot.roots[0];
  $('#root').replaceChildren(...state.boot.roots.map(r => el('option', { value: r }, r))); $('#root').value = state.root;
  const spaces = await api('/api/manage/space'); $('#space').replaceChildren(...spaces.map(s => el('div', {}, el('strong', {}, s.name), s.unavailable ? 'Cartella non disponibile' : `${fmtSize(s.free)} liberi`, s.unavailable ? null : el('progress', { value: s.total - s.free, max: s.total, 'aria-label': `Spazio usato ${s.name}` }))));
  await loadFiles(); populateEdit(); loadExtras().catch(() => {});
}
// Versioni leggere, copertine della musica e copertine ufficiali da internet (spente di base).
async function loadExtras() {
  const [light, online] = await Promise.all([api('/api/versions'), api('/api/manage/online-art')]);
  $('#versions-status').textContent = light.count ? `${quantity(light.count, 'versione leggera pronta', 'versioni leggere pronte')}, ${fmtSize(light.bytes)} occupati.` : 'Nessuna versione leggera preparata.';
  if (light.queued || light.working) $('#versions-status').textContent += ` Ne sto preparando altre (${light.queued + (light.working ? 1 : 0)}).`;
  $('#versions-clear').disabled = !light.count;
  $('#online-art-enabled').checked = online.enabled;
  $('#music-art-status').textContent = 'Le copertine della musica si prendono dai file (incorporate o cover.jpg accanto), una cartella alla volta, in sottofondo.';
}
$('#versions-clear').addEventListener('click', action(async () => {
  if (!await ask('Eliminare le versioni leggere?', '', 'Si cancellano solo le copie a 480p: i video originali restano dove sono. Puoi prepararle di nuovo quando vuoi.', true)) return;
  const result = await api('/api/manage/versions/clear', { method: 'POST', data: {} }); await reloadLibrary(); await loadExtras(); notify(`Eliminate ${quantity(result.removed, 'versione leggera', 'versioni leggere')}.`);
}));
$('#versions-prepare').addEventListener('click', action(async () => {
  const item = state.items.find(i => i.id === $('#edit-item').value); if (!item) throw new Error('Scegli prima un titolo in «Sistema titoli».');
  const ids = (item.series ? state.items.filter(i => i.root === item.root && i.series === item.series) : [item]).filter(i => !i.light).map(i => i.id).slice(0, 300);
  if (!ids.length) { notify('Questo titolo ha già la versione leggera.'); return; }
  await api('/api/versions', { method: 'POST', data: { ids } }); await loadExtras(); notify('Preparo la versione leggera, una alla volta: puoi continuare a usare Apollon.');
}));
$('#online-art-enabled').addEventListener('change', action(async () => {
  const wanted = $('#online-art-enabled').checked;
  try {
    if (wanted && !await ask('Cercare le copertine ufficiali su internet?', '', 'Apollon manderà solo i titoli (e gli artisti) ad AniList, iTunes e MusicBrainz e salverà le immagini qui. Non invia mai i tuoi file.', true)) { $('#online-art-enabled').checked = false; return; }
    await api('/api/manage/online-art', { method: 'POST', data: { enabled: wanted } });
    notify(wanted ? 'Acceso. Le copertine ufficiali arrivano pian piano, una alla volta.' : 'Spento. Apollon non chiede più niente a internet.');
  } catch (error) { $('#online-art-enabled').checked = !wanted; throw error; }
}));
async function loadFiles() {
  if (!state.root) return;
  const list = await api(`/api/manage/files?root=${encodeURIComponent(state.root)}&path=${encodeURIComponent(state.filePath)}`);
  $('#current-path').textContent = `${state.root}/${state.filePath}`; $('#parent-folder').disabled = !state.filePath;
  $('#files-list').replaceChildren(...list.map(file => el('tr', {}, el('td', {}, file.directory ? el('button', { class: 'file-name', onclick: action(async () => { state.filePath = file.path; await loadFiles(); }) }, `▸ ${file.name}`) : file.name), el('td', { class: 'muted' }, file.directory ? 'Cartella' : fmtSize(file.size)), el('td', {}, file.directory ? null : [
    el('button', { class: 'quiet', onclick: action(async () => {
      const to = await ask('Rinomina o sposta il file', file.path, 'Scegli la raccolta e scrivi il percorso al suo interno. Esempio: Serie/Stagione 1/Episodio.mp4. Le cartelle devono esistere. I sottotitoli vanno spostati e rinominati a parte.', false, true);
      const toRoot = $('#input-root').value; if (!to || (to === file.path && toRoot === state.root)) return;
      await api('/api/manage/move', { method: 'POST', data: { root: state.root, toRoot, from: file.path, to } }); await afterFiles(); notify('File sistemato.');
    }) }, 'Rinomina / Sposta'),
    el('button', { class: 'quiet danger', onclick: action(async () => {
      if (!await ask('Mettere il file nel cestino?', '', `“${file.name}” resterà recuperabile.`, true)) return;
      await api('/api/manage/trash', { method: 'POST', data: { root: state.root, path: file.path } }); await afterFiles(); notify('File spostato nel cestino.');
    }) }, 'Nel cestino')]))));
  if (!list.length) $('#files-list').append(el('tr', {}, el('td', { colspan: 3, class: 'muted' }, 'La cartella è vuota. Puoi caricare qui i tuoi file.')));
}
async function afterFiles() { await reloadLibrary(); await refreshProgress(); await loadManage(); }
$('#admin-login').addEventListener('submit', action(async event => {
  event.preventDefault(); const form = event.currentTarget;
  await api('/api/login', { method: 'POST', data: { key: form.elements.key.value } }); form.elements.key.value = ''; state.boot.admin = true; await loadManage(); notify('Gestione aperta su questo dispositivo.');
}));
$('#logout').addEventListener('click', action(async () => { pauseMusic(); persistQueue(); await api('/api/logout', { method: 'POST', data: {} }); ++radioGeneration; radio = null; state.boot.admin = false; state.boot.music = false; await loadManage(); notify('Accesso chiuso.'); }));
$('#root').addEventListener('change', action(async () => { state.root = $('#root').value; state.filePath = ''; await loadFiles(); }));
$('#parent-folder').addEventListener('click', action(async () => { state.filePath = state.filePath.split('/').slice(0, -1).join('/'); await loadFiles(); }));
$('#new-folder').addEventListener('click', action(async () => {
  const name = await ask('Nome della nuova cartella'); if (!name) return;
  await api('/api/manage/folder', { method: 'POST', data: { root: state.root, path: [state.filePath, name].filter(Boolean).join('/') } }); await loadFiles();
}));
async function scan(retry = false) { await api('/api/manage/scan', { method: 'POST', data: { retry } }); await afterFiles(); notify('Raccolta aggiornata. Le anteprime arrivano una alla volta.'); }
$('#refresh-index').addEventListener('click', action(() => scan())); $('#retry-metadata').addEventListener('click', action(() => scan(true)));
$('#upload-form').addEventListener('submit', action(async event => {
  event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); const files = [...form.elements.files.files];
  if (!files.length) return; button.disabled = true; $('#upload-progress').hidden = false;
  const root = state.root; const folder = state.filePath;
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]; $('#upload-note').textContent = `Carico ${file.name} (${i + 1} di ${files.length})…`;
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhr.open('POST', `/api/manage/upload?root=${encodeURIComponent(root)}&path=${encodeURIComponent([folder, file.name].filter(Boolean).join('/'))}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
        xhr.upload.onprogress = e => { if (e.lengthComputable) $('#upload-progress').value = 100 * e.loaded / e.total; };
        xhr.onerror = () => reject(new Error('Caricamento interrotto. Controlla il Wi-Fi e riprova.'));
        xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else { let error; try { error = JSON.parse(xhr.responseText).error; } catch { error = 'Caricamento non riuscito.'; } reject(new Error(error)); } };
        xhr.send(file);
      });
    }
    form.reset(); $('#upload-note').textContent = 'Caricamento completato. I nuovi file sono nella raccolta.'; notify('File caricati.');
  } finally { button.disabled = false; $('#upload-progress').hidden = true; await afterFiles(); }
}));
async function loadTrash() {
  const list = await api('/api/manage/trash');
  $('#trash-list').replaceChildren(...list.map(r => el('div', { class: 'trash-row' }, el('div', {}, el('strong', {}, r.path), el('p', { class: 'muted' }, `${r.root} · ${new Date(r.date).toLocaleDateString('it-IT')}`)), el('button', { class: 'secondary', onclick: action(async () => { await api('/api/manage/restore', { method: 'POST', data: { id: r.id } }); await loadTrash(); await afterFiles(); notify('File rimesso al suo posto.'); }) }, 'Ripristina'))));
  if (!list.length) $('#trash-list').append(el('p', { class: 'muted' }, 'Il cestino è vuoto.'));
}
$('#trash-open').addEventListener('click', action(async () => { await loadTrash(); showDialog('#trash-dialog'); }));
function populateEdit() {
  const previous = $('#edit-item').value;
  $('#edit-item').replaceChildren(...state.items.map(i => el('option', { value: i.id }, `${i.series ? `${i.series} S${i.season}E${i.episode} · ` : ''}${i.title}`)));
  if (state.items.some(i => i.id === previous)) $('#edit-item').value = previous;
  fillEdit();
}
function fillEdit() {
  const item = state.items.find(i => i.id === $('#edit-item').value); if (!item) return;
  $('#edit-title').value = item.title; $('#edit-genres').value = (item.genres || []).join(', ');
  $('#edit-series').value = item.series || ''; $('#edit-season').value = item.season ?? 1; $('#edit-episode').value = item.episode ?? 1;
  $('#edit-image').value = item.imagePath || ''; $('#edit-image').placeholder = `Esempio: Copertine/locandina.jpg (dentro ${item.root})`;
  $('#edit-scope').value = 'episode';
  fillSkipEdit(item); artEditor.paint();
}
function fillSkipEdit(item) {
  for (const [type, prefix] of [['riassunto', 'recap'], ['sigla', 'opening'], ['finale', 'ending'], ['anteprima', 'preview']]) {
    const range = item.salti?.[type]; $(`#${prefix}-start`).value = range?.[0] ?? ''; $(`#${prefix}-end`).value = range?.[1] ?? '';
  }
  $('#skip-same-opening').checked = false;
  $('#skip-sources').textContent = Object.entries(item.fontiSalti || {}).map(([type, source]) => `${type}: ${source}`).join(' · ') || 'Nessun tempo trovato. Puoi analizzare la stagione o inserirli qui.';
  if (state.boot?.admin) loadSkipStatus().catch(() => {});
}
async function loadSkipStatus() {
  const id = $('#edit-item').value; const result = await api(`/api/manage/skips${id ? `?id=${encodeURIComponent(id)}` : ''}`);
  if (id !== $('#edit-item').value) return;
  $('#skip-status').textContent = `${result.message} ${result.running ? 'In corso' : ''}${result.pending ? ` · ${quantity(result.pending, 'stagione', 'stagioni')} in attesa` : ''}${result.failed ? ` · ${quantity(result.failed, 'problema', 'problemi')}` : ''}`;
  $('#aniskip-enabled').checked = result.aniskip; $('#aniskip-mal').value = result.malId || '';
}
$('#skip-refresh').addEventListener('click', action(async () => { await reloadLibrary(); await loadSkipStatus(); }));
$('#skip-analyze').addEventListener('click', action(async () => { await api('/api/manage/skips/analyze', { method: 'POST', data: { id: $('#edit-item').value } }); await loadSkipStatus(); notify('Stagione aggiunta alla coda locale. Puoi continuare a usare Apollon.'); }));
$('#skip-settings').addEventListener('submit', action(async event => {
  event.preventDefault(); const id = $('#edit-item').value;
  await api('/api/manage/skips/settings', { method: 'POST', data: { aniskip: $('#aniskip-enabled').checked, ...(id ? { id, malId: $('#aniskip-mal').value ? Number($('#aniskip-mal').value) : null } : {}) } });
  notify('Scelta salvata. Usa Analizza la stagione per cercare i tempi.');
}));
$('#skip-edit-form').addEventListener('submit', action(async event => {
  event.preventDefault(); const salti = {};
  for (const [type, prefix] of [['riassunto', 'recap'], ['sigla', 'opening'], ['finale', 'ending'], ['anteprima', 'preview']]) {
    const start = $(`#${prefix}-start`).value; const end = $(`#${prefix}-end`).value;
    if ((start === '') !== (end === '')) throw new Error('Per ogni tratto inserisci sia inizio sia fine, oppure lascia entrambi vuoti.');
    salti[type] = start === '' ? null : [Number(start), Number(end)];
  }
  const result = await api('/api/manage/skips/edit', { method: 'POST', data: { id: $('#edit-item').value, salti, sameOpening: $('#skip-same-opening').checked } });
  await reloadLibrary(); notify(`Tempi salvati per ${quantity(result.updated, 'episodio', 'episodi')}.`);
}));
$('#edit-item').addEventListener('change', fillEdit);
$('#edit-form').addEventListener('submit', action(async event => {
  event.preventDefault(); const id = $('#edit-item').value; if (!id) return;
  await api('/api/manage/edit', { method: 'POST', data: { id, title: $('#edit-title').value, series: $('#edit-series').value.trim(), season: Number($('#edit-season').value), episode: Number($('#edit-episode').value), imagePath: $('#edit-image').value.trim(), scope: $('#edit-scope').value,
    genres: $('#edit-genres').value.split(',').map(s => s.trim()).filter(Boolean) } });
  await reloadLibrary(); notify('Scheda aggiornata.');
}));

// TV remote: spatial navigation uses actual element positions, including open dialogs.
// Su un telefono la modalità TV rompe tutto (pulsanti schiacciati, schede enormi): vale solo su schermi larghi.
// Un tocco per sbaglio su «TV» dal telefono non deve restare appiccicato.
const wideEnoughForTv = () => Math.max(innerWidth, innerHeight) >= 900 && innerWidth >= 700;
function tvFocusable(node) {
  if (!node || node === document.body || !node.isConnected || node.disabled || node.closest('[hidden],[inert],[aria-disabled="true"]') || insideClosedDetails(node) || node.matches('.skip')) return false;
  const box = node.getBoundingClientRect(); const style = getComputedStyle(node);
  return node.getClientRects().length > 0 && box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.visibility !== 'collapse';
}
// Creato al primo uso: tvFocus può servire prima che il modulo arrivi fin qui.
function tvPage() { if (!tvPage.nav) tvPage.nav = createTvPageNav({ focusable: tvFocusable, spatialTarget, reduce: () => matchMedia('(prefers-reduced-motion: reduce)').matches }); return tvPage.nav; }
function tvFocus(node) {
  if (!node) return;
  node.focus({ preventScroll: true });
  if (node.closest('dialog,.topbar')) node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' }); else tvPage().reveal(node);
}
document.addEventListener('focusin', event => { if (document.documentElement.classList.contains('tv')) tvPage().remember(event.target); });
function focusTvStart() {
  if (!document.documentElement.classList.contains('tv') || activeDialog() || document.documentElement.classList.contains('booting')) return;
  const first = $$('#video-view .c-open, #video-view .t-card').find(tvFocusable)
    || $$('#video-view .billboard .v-play').find(tvFocusable)
    || $$('#music-page button, #manage-page button, #main-nav button').find(tvFocusable);
  tvFocus(first);
}
function applyTv(enabled) { enabled = !!enabled && wideEnoughForTv(); document.documentElement.classList.toggle('tv', enabled); document.documentElement.classList.toggle('remote-input', enabled); $('#tv-toggle').setAttribute('aria-pressed', String(enabled)); storage.set('tv', enabled); }
try { tizen.tvinputdevice.registerKeyBatch(['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaFastForward', 'MediaRewind']); } catch { /* non è la TV Samsung */ }
{ const asked = new URLSearchParams(location.search).get('tv'); applyTv(asked === '1' ? true : asked === '0' ? false : storage.get('tv', false)); }
$('#tv-toggle').addEventListener('click', () => applyTv(!document.documentElement.classList.contains('tv')));
let tvCursorTimer;
document.addEventListener('mousemove', () => {
  if (!document.documentElement.classList.contains('tv')) return;
  document.documentElement.classList.remove('remote-input'); clearTimeout(tvCursorTimer);
  tvCursorTimer = setTimeout(() => document.documentElement.classList.add('remote-input'), 1800);
}, { passive: true });
document.addEventListener('keydown', event => {
  const isTv = document.documentElement.classList.contains('tv'); if (!isTv) return;
  document.documentElement.classList.add('remote-input'); clearTimeout(tvCursorTimer);
  if (event.defaultPrevented) return;
  if (document.documentElement.classList.contains('booting') && event.key.startsWith('Arrow')) {
    event.preventDefault();
    if (!$('#apollon-boot-retry').hidden) $('#apollon-boot-retry').focus();
    return;
  }
  const active = document.activeElement; const dialog = activeDialog();
  if (event.key === 'Enter' && dialog?.id === 'video-dialog' && (active === video || active === dialog || active === document.body) && activeSkip()) { event.preventDefault(); performSkip().catch(e => notify(e.message, true)); return; }
  if (['Escape', 'BrowserBack', 'GoBack'].includes(event.key) || event.keyCode === 10009) {
    if (dialog?.id === 'video-dialog' && !$('#vp-panel').hidden) { event.preventDefault(); $('#vp-panel-close').click(); }
    else if (dialog) { event.preventDefault(); if (dialog.id === 'music-player') closeMusicPlayer(); else dialog.close(); }
    // 7/11 app TV Samsung: senza finestre aperte Indietro torna alla pagina prima; dalla prima pagina esce dall'app.
    else if (document.fullscreenElement) { event.preventDefault(); document.exitFullscreen().catch(() => {}); }
    else if (state.page === 'music' && musicTrail.length > 1) { event.preventDefault(); musicBack().catch(e => notify(e.message, true)); }
    else {
      event.preventDefault(); const previous = tvPageTrail.pop();
      if (previous || state.page !== 'home') { tvReturning = true; try { setPage(previous || 'home'); } finally { tvReturning = false; } }
      else try { tizen.application.getCurrentApplication().exit(); } catch { /* fuori dalla TV */ }
    }
    return;
  }
  // Tasti multimediali del telecomando Samsung (play/pausa, avanti, indietro) sul video aperto.
  const seek = seconds => { if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds)); };
  const media = { MediaPlayPause: v => v.paused ? v.play() : v.pause(), MediaPlay: v => v.play(), MediaPause: v => v.pause(), MediaFastForward: () => seek(10), MediaRewind: () => seek(-10) };
  const mediaKey = { 10252: 'MediaPlayPause', 415: 'MediaPlay', 19: 'MediaPause', 417: 'MediaFastForward', 412: 'MediaRewind' }[event.keyCode] || event.key;
  if (media[mediaKey] && dialog?.id === 'video-dialog') { event.preventDefault(); try { const result = media[mediaKey](video); if (result?.catch) result.catch(() => {}); } catch { /* video non pronto */ } return; }
  if (['MediaPlayPause', 'MediaPlay', 'MediaPause'].includes(mediaKey) && state.page === 'music') { event.preventDefault(); if (mediaKey === 'MediaPlayPause' || (mediaKey === 'MediaPlay' && audio.paused) || (mediaKey === 'MediaPause' && !audio.paused)) $('#audio-toggle').click(); return; }
  if (event.key === 'Enter' && active === document.body) { event.preventDefault(); focusTvStart(); return; }
  if (event.key.startsWith('Arrow') && (!active || active === document.body) && !dialog) {
    event.preventDefault(); focusTvStart(); return;
  }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  if (dialog?.id === 'music-player' && active?.id === 'lyrics-lines' && !lyrics.synced && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); active.scrollBy({ top: active.clientHeight * (event.key === 'ArrowDown' ? 0.6 : -0.6), behavior: 'auto' }); return;
  }
  if (dialog?.id === 'music-player' && event.key === 'ArrowUp' && active?.closest('.full-controls') && lyrics.synced) {
    const index = Math.max(0, lyricAt); const row = $('#lyrics-lines').children[index];
    if (row?.getClientRects().length) { event.preventDefault(); row.focus({ preventScroll: true }); centerLyric(index); return; }
  }
  if (dialog?.id === 'music-player' && ['ArrowUp', 'ArrowDown'].includes(event.key) && active?.matches('.lyric-line')) {
    const next = event.key === 'ArrowDown' ? active.nextElementSibling : active.previousElementSibling;
    if (next) { event.preventDefault(); next.focus({ preventScroll: true }); centerLyric([...next.parentNode.children].indexOf(next)); return; }
  }
  if (active?.matches('textarea,video,audio,[contenteditable]')) return;
  if (active?.matches('select') && ['ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (active?.matches('input') && ['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  // Pagine (nessuna finestra aperta): righe da TV, barra in alto solo salendo dalla cima. Vedi tv-nav.js.
  if (!dialog && active && active !== document.body) { event.preventDefault(); tvPage().move(event.key, active, focusTvStart); return; }
  const scope = dialog || document;
  const candidates = [...scope.querySelectorAll('button,a[href],input,select,summary,[tabindex="0"]')].filter(tvFocusable);
  if (!candidates.length) return;
  const best = spatialTarget(active?.getBoundingClientRect(), candidates.filter(c => c !== active).map(c => ({ value: c, rect: c.getBoundingClientRect() })), event.key);
  if (best) { event.preventDefault(); tvFocus(best); }
});
$('#help-open').addEventListener('click', () => showDialog('#help-dialog'));
let installPrompt;
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#install').hidden = false; });
$('#install').addEventListener('click', action(async () => { if (installPrompt) { await installPrompt.prompt(); installPrompt = null; $('#install').hidden = true; } }));
if ('serviceWorker' in navigator && window.isSecureContext && !window.__legacy) navigator.serviceWorker.register('/sw.js', { type: 'module' }).catch(() => {});
window.addEventListener('offline', () => { remoteMusic?.stop(); remoteMusic = null; notify('Sei senza rete. Puoi ascoltare la musica scaricata.'); if (state.page === 'music') loadMusic('library'); });
// 7/11: fuori casa (Tailscale) l'altra libreria passa dall'NAS: video sulla 8787, musica del telefono musica inoltrata sulla 8788.
function reachableOther(url) {
  if (!url || /^(192\.168\.|10\.|127\.|localhost$)/.test(location.hostname)) return url;
  try { const u = new URL(url); u.hostname = location.hostname; u.port = location.port === '8788' ? '8787' : '8788'; return u.href; } catch { return url; }
}
async function comeBackOnline() {
  if (!state.offline) { syncPendingProgress(); return; }
  try { state.boot = await api('/api/bootstrap'); state.boot.otherLibraryUrl = reachableOther(state.boot.otherLibraryUrl); } catch { return; }
  state.offline = false; populateProfiles(); await syncPendingProgress();
  await Promise.all([reloadLibrary(), refreshProgress(), videoApp.loadList().catch(() => {})]).catch(() => {});
  renderCatalog(); flushPlayed(); if (state.page === 'music') loadMusic('library');
}
window.addEventListener('online', () => { comeBackOnline().catch(() => {}); if (!state.offline) flushPlayed(); });
window.addEventListener('pagehide', () => { playback.account(); playback.reportActivity(true); remoteMusic?.stop(); });
window.addEventListener('pageshow', event => { if (event.persisted) ensureDevices().catch(() => {}); });
window.addEventListener('focus', () => { if (state.boot && !state.current) refreshProgress().then(renderCatalog).catch(() => {}); });
// Giro E: barra delle sezioni, foglio «Crea», libreria a sinistra e «In riproduzione» a destra (PC), mini-player a scheda.
$$('[data-icon]').forEach(node => node.replaceChildren(shellIcon(node.dataset.icon)));
$('#mini-devices').replaceChildren(shellIcon('devices')); $('#bar-now').replaceChildren(shellIcon('panel'));
pressFeedback(document.body);
// Giro F: la parte video come un servizio di streaming (video-app.js), il lettore (video-player.js), le immagini in Gestisci.
// Scarica sul telefono (video): i pezzi stanno nella memoria dell'app; vedi video-offline.js e downloads.js.
const offlineVideo = new OfflineVideo();
let downloadedIds = new Set();
function refreshDownloaded() {
  const before = downloadedIds.size; downloadedIds = new Set(Object.values(offlineVideo.m?.entries || {}).filter(e => e.state === 'done').map(e => e.id));
  if (downloadedIds.size !== before) cacheProgress();
}
const downloadsPage = createDownloads({ el, state, notify, action, fmtSize, manager: offlineVideo, playItem, setPage, ask, repaint: () => { if (state.page === 'scaricati') videoApp.render(); } });
const downloadsApi = {
  state(id) {
    const job = offlineVideo.jobs.get(id); const e = offlineVideo.m?.entries[id]; const share = e?.total ? downloadedBytes(e) / e.total : 0;
    if (job) return { kind: 'active', share, quality: job.quality };
    return e ? { kind: e.state === 'done' ? 'done' : 'paused', share, quality: e.quality } : null;
  },
  estimate: estimateBytes,
  async start(items, quality) {
    if (!window.isSecureContext || !navigator.serviceWorker || !globalThis.caches) throw new Error('Per scaricare serve Apollon aperta con HTTPS (oppure localhost sul PC), con un browser che ha la memoria offline.');
    let timer;
    try { await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('La memoria offline non è pronta. Ricarica la pagina e riprova.')), 15000); })]); } finally { clearTimeout(timer); }
    await offlineVideo.load();
    // Senza rete l'app si apre da questi dati salvati (profili, modalità): li aggiorno a ogni download.
    const saved = storage.get('offline-bootstrap') || {}; const boot = state.boot;
    storage.set('offline-bootstrap', { profiles: boot.profiles, mode: saved.mode || boot.mode || 'video', music: !!saved.music, musicUser: saved.musicUser || '', roots: [], count: 0, pending: false, demo: boot.demo });
    for (const item of items) offlineVideo.enqueue(item, quality);
    notify(items.length === 1 ? 'Download avviato. Lo trovi in Scaricati.' : `Scarico ${items.length} episodi. Li trovi in Scaricati.`);
  }
};
// Le schede non si ridisegnano a ogni pezzo scaricato (un tocco non deve finire su un elemento appena sostituito): al massimo una volta al secondo.
let repaintTimer = 0;
offlineVideo.onchange(() => {
  refreshDownloaded();
  if (repaintTimer || (state.page !== 'scaricati' && !$('#title-dialog').open)) return;
  repaintTimer = setTimeout(() => { repaintTimer = 0; videoApp.render(); }, 1000);
});
const videoApp = createVideoApp({ el, $, state, api, action, notify, storage, ask, showDialog, activeDialog, focusTvStart, populateProfiles, playItem, setPage, reloadLibrary, saveVideoPreferences, syncVideoPreferences, lightModeOn, switchQuality, qualityPreference, fmtSize, downloads: downloadsApi, downloadsView: downloadsPage.view });
videoApp.init();
createPlayer({ $, el, state, video, action, storage, fmtTime, notify, playItem, performSkip, activeSkip, switchQuality, qualityPreference, nextEpisode, activeDialog, pushLayer: name => videoApp.pushLayer(name) });
const artEditor = createArtEditor({ $, el, state, api, action, notify, reloadLibrary });
$('#music-nav').addEventListener('click', event => {
  const button = event.target.closest('[data-section]'); if (!button) return;
  const section = button.dataset.section;
  if (section === 'create') { showDialog('#music-create'); return; }
  const tab = { home: 'home', search: 'browse', library: 'library' }[section];
  // Un secondo tocco sulla sezione aperta riporta in cima e la aggiorna (profilo o preferenze cambiati altrove).
  if (musicTrail.length === 1 && musicTrail[0].key === `tab:${tab}`) window.scrollTo({ top: 0, behavior: 'instant' });
  clearTimeout(searchTimer); $('#music-search').value = ''; loadMusic(tab);
});
// Un tocco su una voce del foglio lo chiude prima di aprire quello che serve.
$('#music-create').addEventListener('click', event => { if (event.target.closest('.sheet-item')) $('#music-create').close(); }, true);
$('#create-playlist').addEventListener('click', action(() => createPlaylist()));
$('#create-from-queue').addEventListener('click', () => showDialog('#queue-dialog'));
$('#create-blend').addEventListener('click', action(async () => {
  const others = (state.boot.profiles || []).filter(o => o.id !== state.profile);
  if (!others.length) throw new Error('Per una Miscela serve un secondo profilo. Aggiungilo con «+» in alto.');
  const blend = async o => { setPage('music'); (await import('./music-blend.js')).showBlend(musicContext(), o); };
  if (others.length === 1) await blend(others[0]); else collectionMenu('Miscela con…', others.map(o => [o.name, () => blend(o)]));
}));
$('#mini-devices').addEventListener('click', () => {
  openMusicPlayer();
  requestAnimationFrame(() => { $('#music-devices').scrollIntoView({ block: 'center', behavior: 'instant' }); $('#music-devices').focus({ preventScroll: true }); });
});
$('#mini-like').addEventListener('click', action(() => toggleLike(state.queue[state.queueIndex])));
function syncMiniLike() {
  const song = state.queue[state.queueIndex]; const liked = !!song && likedIds.has(song.id);
  $('#mini-like').replaceChildren(shellIcon(liked ? 'added' : 'add')); $('#mini-like').setAttribute('aria-pressed', String(liked));
  $('#mini-like').title = liked ? 'Tra i brani che ti piacciono' : 'Aggiungi ai brani che ti piacciono';
}
// Sfondo della scheda: il colore della copertina, scurito.
$('#audio-cover').addEventListener('load', () => coverColor($('#audio-cover')).then(rgb => {
  if (rgb) $('#audio-bar').style.setProperty('--mini-color', deepen(rgb, .27)); else $('#audio-bar').style.removeProperty('--mini-color');
}));
$('#audio-cover').addEventListener('error', () => { if ($('#audio-cover').getAttribute('src') !== '/music-cover.svg') $('#audio-cover').src = '/music-cover.svg'; });
function paintMiniProgress() {
  const seek = $('#audio-seek'); const max = Number(seek.max) || 0;
  $('#mini-progress-fill').style.width = `${max ? Math.min(100, Number(seek.value) / max * 100) : 0}%`;
}
for (const node of [$('#audio'), $('#audio-buffer')]) for (const name of ['timeupdate', 'seeked', 'emptied', 'loadedmetadata']) node.addEventListener(name, () => requestAnimationFrame(paintMiniProgress));
$('#audio-seek').addEventListener('input', paintMiniProgress);

// PC: la libreria resta a sinistra, con i suoi filtri.
let sideFilter = ''; let sideRequest = 0;
async function paintMusicSide(force = false) {
  const side = $('#music-side'); const key = `${musicKey()}:${state.profile}:${sideFilter}`;
  if (!state.boot?.music || state.page !== 'music' || !matchMedia('(min-width:900px)').matches || (!force && side.dataset.key === key)) return;
  side.dataset.key = key; const request = ++sideRequest;
  try {
    const [result, lib] = await Promise.all([api(`/api/music/library?profile=${encodeURIComponent(state.profile)}`), import('./music-library.js')]);
    if (request !== sideRequest) return;
    const prefs = storage.get(`${musicKey()}:${state.profile}:library`, {}) || {};
    const items = lib.libraryItems(result.items || [], { filter: sideFilter, sort: 'recent', pins: prefs.pins || [], recent: prefs.recent || {} });
    const c = musicContext(); const kinds = { playlist: 'Playlist', album: 'Album', artist: 'Artista' };
    const cover = item => item.type === 'artist' ? artistArt(c, item.name, item.coverArt, 80) : item.type === 'playlist' && !item.coverArt
      ? lazyArt(c, art(el, musicImage, { name: item.name, glyph: '♪' }), 'playlist', item.id) : art(el, musicImage, { ids: [item.coverArt], name: item.name, size: 80 });
    const liked = art(el, musicImage, { name: 'Brani che ti piacciono', glyph: '♥' }); liked.classList.add('liked-art');
    side.replaceChildren(el('div', { class: 'side-head' }, el('h2', {}, 'La tua libreria'), el('button', { class: 'icon-button', 'aria-label': 'Crea una playlist o una miscela', title: 'Crea', onclick: () => showDialog('#music-create') }, shellIcon('plus'))),
      el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtra la libreria a sinistra' }, ...[['playlist', 'Playlist'], ['album', 'Album'], ['artist', 'Artisti']].map(([id, name]) =>
        el('button', { class: 'chip', 'aria-label': `Solo ${name.toLocaleLowerCase('it')}`, 'aria-pressed': sideFilter === id, onclick: () => { sideFilter = sideFilter === id ? '' : id; paintMusicSide(true); } }, name))),
      el('div', { class: 'side-list' }, sideFilter ? null : el('button', { class: 'side-row', 'aria-label': 'Brani che ti piacciono, la tua playlist dei preferiti', onclick: () => loadMusic('liked') }, liked, el('span', { class: 'side-copy' }, el('strong', {}, 'Brani che ti piacciono'), el('small', {}, `Playlist · ${likedIds.size} brani`))),
        ...items.slice(0, 60).map(item => el('button', { class: `side-row${item.type === 'artist' ? ' side-artist' : ''}`, 'aria-label': `${item.name}, ${kinds[item.type].toLocaleLowerCase('it')}`, onclick: action(() => c.open(item)) }, cover(item),
          el('span', { class: 'side-copy' }, el('strong', {}, item.name), el('small', {}, [kinds[item.type], item.type === 'playlist' ? quantity(item.songCount || 0, 'brano', 'brani') : item.artist].filter(Boolean).join(' · ')))))));
    if (items.length > 60) side.append(el('button', { class: 'secondary', onclick: () => loadMusic('library') }, 'Apri tutta la libreria'));
  } catch { if (request === sideRequest) { side.dataset.key = ''; side.replaceChildren(el('p', { class: 'muted' }, 'La libreria non si è caricata. Riprova più tardi.')); } }
}
// PC: «In riproduzione» a destra, richiudibile.
function paintNowPanel() {
  const panel = $('#music-now'); const song = state.queue[state.queueIndex]; const open = storage.get('now-panel', true) !== false;
  $('#bar-now').setAttribute('aria-pressed', String(open));
  panel.hidden = !song || !open; document.body.classList.toggle('now-open', !panel.hidden);
  if (panel.hidden) return;
  const next = state.queue.slice(state.queueIndex + 1, state.queueIndex + 6);
  const cover = el('img', { class: 'now-cover', src: musicImage(song.coverArt || song.albumId, 400), alt: '', onerror: event => { event.target.src = '/music-cover.svg'; } });
  coverColor(cover).then(rgb => { if (rgb) panel.style.setProperty('--now-color', deepen(rgb, .3)); });
  const credits = [['Artista', song.artist], ['Album', song.album], ['Anno', song.year], ['Durata', song.duration ? fmtTime(song.duration) : '']].filter(([, value]) => value);
  panel.replaceChildren(el('div', { class: 'now-head' }, el('strong', {}, song.album || 'In riproduzione'), el('button', { class: 'icon-button', 'aria-label': 'Chiudi il pannello In riproduzione', title: 'Chiudi', onclick: () => { storage.set('now-panel', false); paintNowPanel(); } }, shellIcon('close'))),
    cover, el('div', { class: 'now-title' }, el('strong', {}, song.title), el('span', { class: 'muted' }, song.artist || 'Artista sconosciuto')),
    el('section', { class: 'now-card' }, el('h3', {}, 'Crediti'), el('dl', {}, ...credits.flatMap(([name, value]) => [el('dt', {}, name), el('dd', {}, value)]))),
    el('section', { class: 'now-card' }, el('h3', {}, 'Prossimi in coda'), next.length ? el('ol', { class: 'now-queue' }, ...next.map((s, i) => el('li', {}, el('button', { class: 'now-next', 'aria-label': `Salta a ${s.title}`, onclick: () => playSong(state.queueIndex + i + 1) },
      el('img', { src: musicImage(s.coverArt || s.albumId, 80), alt: '', loading: 'lazy' }), el('span', {}, el('strong', {}, s.title), el('small', {}, s.artist || '')))))) : el('p', { class: 'muted' }, 'Non ci sono altri brani in coda.'),
      el('button', { class: 'secondary pill', onclick: () => showDialog('#queue-dialog') }, 'Apri la coda')));
}
$('#bar-now').addEventListener('click', () => { storage.set('now-panel', storage.get('now-panel', true) === false); paintNowPanel(); });
matchMedia('(min-width:900px)').addEventListener?.('change', () => paintMusicSide());
async function init() {
  try {
    try { state.boot = await api('/api/bootstrap'); }
    catch (error) { const saved = storage.get('offline-bootstrap'); if (!saved) throw error; state.boot = saved; state.offline = true; }
    state.boot.otherLibraryUrl = reachableOther(state.boot.otherLibraryUrl);
    $('#demo-notice').hidden = !state.boot.demo; populateProfiles();
    await offlineVideo.load().catch(() => {}); refreshDownloaded();
    if (!state.offline) { await Promise.all([reloadLibrary(), refreshProgress(), videoApp.loadList().catch(() => {})]); syncPendingProgress(); }
    else { state.items = Object.values(offlineVideo.m?.entries || {}).filter(e => e.state === 'done').map(e => e.item); state.progress = offlineProgress(state.profile); }
    if (state.boot.otherLibraryUrl) {
      $('#other-library').href = state.boot.otherLibraryUrl; $('#other-library').hidden = false;
      if (state.boot.mode !== 'music') { $('#music-server-link').href = `${state.boot.otherLibraryUrl.replace(/\/$/, '')}/#music`; $('#music-server-link').hidden = false; }
    }
    $('#loading').hidden = true; renderQueue(); if (state.boot.music) { await restoreMusic(); flushPlayed(); }
    const asked = location.hash.slice(1);
    // Senza rete si apre direttamente Scaricati (la musica, se è quella che si cercava o se i video scaricati non ci sono).
    await setPage(state.offline ? (asked === 'music' || (!downloadedIds.size && state.boot.music) ? 'music' : 'scaricati') : asked || (state.boot.mode === 'music' ? 'music' : 'home'));
    await window.ApollonBoot?.ready();
    focusTvStart();
    if (!document.documentElement.classList.contains('tv') || !state.profile) videoApp.maybeAskWho();
    pollTimer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || state.page === 'manage' || state.current) return;
      try { const boot = await api('/api/bootstrap'); if (state.offline) { comeBackOnline().catch(() => {}); return; } const changed = boot.lastScan !== state.boot.lastScan || boot.pending !== state.boot.pending || boot.count !== state.boot.count; Object.assign(state.boot, boot); if (changed) await reloadLibrary(); } catch { /* Keep the current collection while the phone reconnects. */ }
    }, 15000);
  } catch (e) {
    $('#loading').hidden = false;
    $('#loading').className = 'boot-error';
    $('#loading').replaceChildren(el('h1', {}, 'Non riesco ad aprire la raccolta'), el('p', {}, e.message), el('button', { class: 'primary', onclick: () => location.reload() }, 'Riprova'));
    await window.ApollonBoot?.ready();
    if (document.documentElement.classList.contains('tv')) tvFocus($('#loading button'));
  }
}
init();
