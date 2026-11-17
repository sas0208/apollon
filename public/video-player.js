// Giro F: il lettore video a schermo intero con i nostri comandi (spariscono dopo 3 secondi), ±10 secondi
// (doppio tocco sul telefono), barra del tempo, audio e sottotitoli, velocità, episodi e «Prossimo episodio»
// con il conto alla rovescia. app.js resta il padrone di playItem/saveVideo/performSkip (provati con node --test):
// qui si disegna e si ascolta, e app.js chiama globalThis.mediatecaPlayer.opened(item) a ogni video.
import { vIcon } from './video-app.js';
import { episodeCode, languageName, durationText, qualityOptions, chooseQuality } from './video-logic.js';
import { previewFrame } from './tv/preview.js';

const TEXT_CODECS = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text']);
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Tre tocchi nello stesso lato = due salti. Un cambio di lato comincia un gesto nuovo.
export function tapGesture(previous, x, at) {
  const side = x < 0.4 ? -1 : x > 0.6 ? 1 : 0;
  const continued = side && previous?.side === side && at - previous.at < 320;
  return { side, at, seconds: continued ? side * 10 : 0, total: continued ? (previous.total || 0) + side * 10 : 0 };
}

// 13/11: «quando clicchi Riproduci te lo apre a mezzo schermo intero, poi devi premere Schermo intero».
// Chrome rifiuta lo schermo intero su un <dialog> («Dialog elements are invalid»): si chiede per il riquadro del video,
// lo stesso che usa il tasto Schermo intero, così parte subito a tutto schermo (telefono, tablet, app).
export function playerFullscreen({ tv, coarse, android }) {
  if (tv || !(coarse || android)) return { videoMode: false, fullscreen: false };
  return { videoMode: !!android, fullscreen: true };
}

export function createPlayer(c) {
  const { $, el, state, video, action, storage, fmtTime } = c;
  const dialog = $('#video-dialog'); const stage = $('#video-stage'); const layer = $('#vp-layer');
  let idleTimer = 0; let tapTimer = 0; let lastTap = 0; let dragging = false; let flashTimer = 0;
  let panelOpener = null; let gesture = null; let pointer = null; let lastTouch = 0; let locked = false;
  let loadingTimer; let preview = null; let previewGeneration = 0; let previewAbort;
  const loading = $('#vp-loading'), previewBox = $('#vp-preview');
  const isTv = () => document.documentElement.classList.contains('tv');
  const tool = (node, icon, label) => node.replaceChildren(vIcon(icon), el('span', { class: 'vp-label' }, label));

  $('#close-player').replaceChildren(vIcon('back'));
  $('#vp-back').replaceChildren(vIcon('back10')); $('#vp-forward').replaceChildren(vIcon('fwd10'));
  $('#vp-panel-close').replaceChildren(vIcon('close'));
  tool($('#vp-episodes'), 'episodes', 'Episodi'); tool($('#vp-lang'), 'subtitles', 'Audio e sottotitoli');
  tool($('#vp-speed'), 'speed', 'Velocità'); tool($('#vp-settings'), 'gear', 'Impostazioni'); tool($('#fullscreen'), 'fullscreen', 'Schermo intero');
  tool($('#vp-lock'), 'lock', 'Blocca'); tool($('#vp-next'), 'jump', 'Episodio successivo');
  const flash = el('div', { class: 'vp-flash', 'aria-hidden': 'true' }); stage.append(flash);

  // I comandi spariscono dopo 3 secondi di riproduzione; un movimento, un tocco o un tasto li riporta.
  function wake() {
    layer.classList.remove('idle'); stage.classList.remove('idle'); clearTimeout(idleTimer);
    if (dialog.open && !video.paused && $('#vp-panel').hidden) idleTimer = setTimeout(sleep, 3000);
  }
  function sleep() { if (!dialog.open || video.paused || !$('#vp-panel').hidden) return; clearTimeout(idleTimer); layer.classList.add('idle'); stage.classList.add('idle'); focusToggle(true); }
  // 12/11: dopo «pausa» (e quando i comandi spariscono) il tasto attivo è Riproduci/Pausa, mai ±10 secondi:
  // ripremere Invio/OK/spazio deve far ripartire il video, non spostare la barra del tempo.
  function focusToggle(onlyFromJump = false) {
    if (!dialog.open || locked || !$('#vp-panel').hidden) return;
    const active = document.activeElement; const onJump = active?.id === 'vp-back' || active?.id === 'vp-forward';
    const nowhere = !active || active === document.body || active === video || active === dialog || active === stage;
    if (onJump || (!onlyFromJump && nowhere)) $('#vp-toggle').focus({ preventScroll: true });
  }
  function toggle() { if (video.paused) video.play().catch(() => {}); else video.pause(); }
  function jump(seconds, total = seconds) {
    if (!Number.isFinite(video.duration)) return;
    video.currentTime = clamp(video.currentTime + seconds, 0, Math.max(0, video.duration - 0.3));
    flash.textContent = `${total < 0 ? '−' : '+'}${Math.abs(total)} s`; flash.className = `vp-flash show ${seconds < 0 ? 'left' : 'right'}`;
    clearTimeout(flashTimer); flashTimer = setTimeout(() => { flash.className = 'vp-flash'; }, 650); wake();
  }
  function paint() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!dragging) $('#vp-seek').value = duration ? Math.round(video.currentTime / duration * 1000) : 0;
    $('#vp-seek').setAttribute('aria-valuetext', `${fmtTime(dragging ? Number($('#vp-seek').value) / 1000 * duration : video.currentTime)} di ${fmtTime(duration)}`);
    $('#vp-seek').style.setProperty('--seek', `${duration ? (video.currentTime / duration * 100).toFixed(2) : 0}%`);
    $('#vp-time').textContent = fmtTime(video.currentTime); $('#vp-left').textContent = duration ? `-${fmtTime(duration - video.currentTime)}` : '0:00';
    const playing = !video.paused;
    $('#vp-toggle').replaceChildren(vIcon(playing ? 'pause' : 'play')); $('#vp-toggle').setAttribute('aria-label', playing ? 'Pausa' : 'Riproduci');
    stage.classList.toggle('paused', !playing);
    paintNext();
  }

  // «Prossimo episodio» con il conto alla rovescia: negli ultimi 20 secondi (5 per i video brevi), se è acceso.
  function paintNext() {
    const card = $('#next-card'); const current = state.current;
    const next = current ? c.nextEpisode(current.item) : null; const left = video.duration - video.currentTime;
    const span = video.duration >= 300 ? 20 : 5;
    const show = !!next && !current.stay && !current.transitioning && $('#autonext').checked && $('#next-episode').hidden
      && !video.paused && Number.isFinite(left) && left > 0 && left <= span;
    card.hidden = !show; stage.classList.toggle('has-next', show); if (!show) return;
    $('#next-count').textContent = String(Math.max(1, Math.ceil(left)));
    if (card.dataset.id !== next.id) {
      card.dataset.id = next.id; $('#next-name').textContent = `${episodeCode(next)} ${next.title}`;
      const thumb = $('#next-thumb'); if (next.images?.thumb) { thumb.src = `/media/${next.id}/thumb?v=${next.images.v || 0}`; thumb.hidden = false; } else thumb.hidden = true;
    }
  }
  $('#next-now').addEventListener('click', action(() => c.performSkip({ kind: 'next', next: true, label: 'Prossimo episodio' })));
  $('#next-cancel').addEventListener('click', () => { if (state.current) state.current.stay = true; $('#next-card').hidden = true; stage.classList.remove('has-next'); wake(); });

  // Pannello laterale: episodi, audio e sottotitoli, velocità e salti.
  function openPanel(title, body, prefs = false) {
    if ($('#vp-panel').hidden) panelOpener = document.activeElement;
    $('#vp-panel-title').textContent = title; $('#vp-panel-body').replaceChildren(...body.filter(Boolean)); $('#vp-prefs').hidden = !prefs;
    $('#vp-panel').hidden = false; stage.classList.add('panel-open'); wake();
    ($('#vp-panel-body [aria-pressed=true]') || $('#vp-panel-close')).focus({ preventScroll: true });
  }
  function closePanel() {
    $('#vp-panel').hidden = true; stage.classList.remove('panel-open');
    if (dialog.open && panelOpener?.isConnected && !panelOpener.disabled && panelOpener.getClientRects().length) panelOpener.focus({ preventScroll: true });
    panelOpener = null; wake();
  }
  $('#vp-panel-close').addEventListener('click', closePanel);
  const option = (label, pressed, onclick, sub = '') => el('button', { class: 'vp-option', 'aria-pressed': pressed, onclick }, el('span', {}, label), sub ? el('small', {}, sub) : null);

  function subtitleChoice() { return storage.get(`video-subs:${state.current?.profile || state.profile}`, null); }
  function chooseSubtitle(index, remember = true) {
    [...video.textTracks].forEach((track, i) => { track.mode = i === index ? 'showing' : 'disabled'; });
    const track = video.textTracks[index];
    if (remember) storage.set(`video-subs:${state.current?.profile || state.profile}`, track ? (track.language || track.label) : 'off');
  }
  function audioStreams() { return (state.current?.item.streams || []).filter(s => s.type === 'audio'); }
  function langPanel() {
    const tracks = [...video.textTracks]; const shownIndex = tracks.findIndex(t => t.mode === 'showing');
    const streams = audioStreams(); const native = video.audioTracks;
    const audioIndex = native?.length ? [...native].findIndex(t => t.enabled) : 0;
    openPanel('Audio e sottotitoli', [
      el('h4', {}, 'Audio'),
      ...(streams.length ? streams : [{ language: 'und' }]).map((s, i) => {
        const unavailable = i > 0 && !(native?.length > i);
        const node = option(languageName(s.language), i === Math.max(0, audioIndex), () => {
          if (native?.length > i) { [...native].forEach((t, j) => { t.enabled = j === i; }); langPanel(); }
        }, unavailable ? [s.title, 'Questo browser legge solo la prima lingua: per le altre usa VLC o il lettore della TV'].filter(Boolean).join(' · ') : s.title || '');
        node.disabled = unavailable; return node;
      }),
      el('h4', {}, 'Sottotitoli'),
      option('Nessuno', shownIndex < 0, () => { chooseSubtitle(-1); langPanel(); }),
      ...tracks.map((t, i) => option(languageName(t.language || t.label), i === shownIndex, () => { chooseSubtitle(i); langPanel(); }, t.label && languageName(t.language) !== t.label ? t.label : '')),
      $('#video-info').textContent ? el('p', { class: 'vp-note' }, $('#video-info').textContent) : null]);
  }
  function speedPanel() {
    openPanel('Velocità e salti', [el('h4', {}, 'Velocità'), el('div', { class: 'vp-speeds' }, ...SPEEDS.map(s => el('button', { class: 'vp-chip', 'aria-pressed': video.playbackRate === s,
      onclick: () => { video.playbackRate = s; tool($('#vp-speed'), 'speed', s === 1 ? 'Velocità' : `Velocità ${String(s).replace('.', ',')}×`); speedPanel(); } }, `${String(s).replace('.', ',')}×`))),
    el('h4', {}, 'Salti automatici')], true);
  }
  // ⚙ Impostazioni: qualità del video e salti automatici, nello stesso posto.
  function settingsPanel() {
    const item = state.current?.item; if (!item) return;
    const chosen = c.qualityPreference(); const using = state.current.quality === '480' ? 'Ora: risparmio dati (480p)' : 'Ora: originale';
    openPanel('Impostazioni', [el('h4', {}, 'Qualità'),
      ...qualityOptions(item).map(o => { const node = option(o.label, o.value === chosen, action(async () => { await c.switchQuality(o.value); settingsPanel(); }), o.value === 'auto' ? `${o.sub}. ${using}` : o.sub); node.disabled = !!o.disabled; return node; }),
      el('h4', {}, 'Salti')], true);
  }
  function episodesPanel(season) {
    const item = state.current?.item; if (!item?.series) return;
    const all = state.items.filter(i => i.root === item.root && i.series === item.series).sort((a, b) => a.season - b.season || a.episode - b.episode);
    const seasons = [...new Set(all.map(i => i.season))]; season = seasons.includes(season) ? season : item.season;
    openPanel(item.series, [
      seasons.length > 1 ? el('div', { class: 'vp-speeds' }, ...seasons.map(s => el('button', { class: 'vp-chip', 'aria-pressed': s === season, onclick: () => episodesPanel(s) }, s === 0 ? 'Speciali' : `Stagione ${s}`))) : null,
      ...all.filter(i => i.season === season).map(ep => {
        const p = state.progress[ep.id]; const share = p?.watched ? 1 : p?.position && (p.duration || ep.duration) ? p.position / (p.duration || ep.duration) : 0;
        const thumb = ep.images?.thumb ? el('img', { src: `/media/${ep.id}/thumb?v=${ep.images.v || 0}`, alt: '', loading: 'lazy' }) : el('span', { class: 'vp-ep-blank' });
        const progress = el('span', { class: 'c-bar' }, el('i')); progress.style.setProperty('--p', `${(share * 100).toFixed(1)}%`);
        return el('button', { class: `vp-ep${ep.id === item.id ? ' current' : ''}`, 'aria-current': ep.id === item.id ? 'true' : undefined, 'aria-pressed': ep.id === item.id,
          onclick: action(async () => { closePanel(); if (ep.id !== item.id) await c.playItem(ep); }) },
        el('span', { class: 'vp-ep-art' }, thumb, share ? progress : null), el('span', { class: 'vp-ep-text' }, el('strong', {}, `${ep.episode}. ${ep.title}`), el('small', {}, durationText(ep.duration))));
      })]);
  }
  $('#vp-lang').addEventListener('click', langPanel);
  $('#vp-speed').addEventListener('click', speedPanel);
  $('#vp-settings').addEventListener('click', settingsPanel);
  $('#vp-episodes').addEventListener('click', () => episodesPanel());
  $('#vp-next').addEventListener('click', action(() => c.performSkip({ kind: 'next', next: true, label: 'Prossimo episodio' })));
  function lock(value) {
    locked = value; stage.classList.toggle('locked', value); $('#vp-unlock').hidden = !value;
    layer.inert = value; if (value) { closePanel(); $('#vp-unlock').focus(); } else wake();
  }
  $('#vp-lock').addEventListener('click', () => lock(true));
  $('#vp-unlock').addEventListener('click', () => lock(false));
  $('#close-player').replaceChildren(vIcon('back'));

  // Comandi a schermo.
  $('#vp-toggle').addEventListener('click', () => { toggle(); wake(); });
  // Un clic col mouse o col dito su ±10 non lascia il fuoco lì: lo spazio/Invio successivo deve mettere in pausa, non saltare ancora.
  // Da tastiera o telecomando (event.detail 0) il fuoco resta, così si può premere più volte di fila.
  const afterJump = event => { if (event.detail > 0) $('#vp-toggle').focus({ preventScroll: true }); };
  $('#vp-back').addEventListener('click', event => { jump(-10); afterJump(event); });
  $('#vp-forward').addEventListener('click', event => { jump(10); afterJump(event); });
  $('#vp-seek').addEventListener('input', () => {
    dragging = true; const duration = video.duration || 0; const at = Number($('#vp-seek').value) / 1000 * duration;
    $('#vp-seek').setAttribute('aria-valuetext', `${fmtTime(at)} di ${fmtTime(duration)}`);
    $('#vp-time').textContent = fmtTime(at); $('#vp-seek').style.setProperty('--seek', `${(Number($('#vp-seek').value) / 10).toFixed(2)}%`);
    previewBox.hidden = false; $('#vp-preview-time').textContent = fmtTime(at);
    const frame = previewFrame(preview, at), image = $('#vp-preview-image'); image.hidden = !frame;
    if (frame) {
      image.style.backgroundImage = `url("/media/${state.current.item.id}/trickplay/${frame.sheet}.jpg")`;
      image.style.backgroundPosition = `-${frame.x / 2}px -${frame.y / 2}px`;
      image.style.backgroundSize = `${preview.columns * frame.width / 2}px ${preview.rows * frame.height / 2}px`;
    }
    wake();
  });
  $('#vp-seek').addEventListener('change', () => {
    dragging = false; previewBox.hidden = true; if (Number.isFinite(video.duration)) video.currentTime = Number($('#vp-seek').value) / 1000 * video.duration; wake();
  });
  for (const name of ['timeupdate', 'play', 'pause', 'durationchange', 'seeked', 'loadedmetadata', 'ratechange']) video.addEventListener(name, paint);
  video.addEventListener('play', wake); video.addEventListener('pause', wake); video.addEventListener('pause', () => focusToggle()); layer.addEventListener('focusin', wake); layer.addEventListener('focusout', wake);
  function showLoading() { if (dialog.open && !video.paused) loading.hidden = false; }
  function loaded() { loading.hidden = true; clearTimeout(loadingTimer); }
  video.addEventListener('waiting', showLoading); video.addEventListener('stalled', showLoading);
  video.addEventListener('playing', loaded); video.addEventListener('error', loaded);
  video.addEventListener('loadedmetadata', () => {
    // Sottotitoli: l'ultima scelta del profilo; altrimenti, per un anime in lingua originale, l'italiano.
    const tracks = [...video.textTracks]; if (!tracks.length) return;
    const choice = subtitleChoice(); const original = audioStreams()[0]?.language;
    let index = -1;
    if (choice && choice !== 'off') index = tracks.findIndex(t => [t.language, t.label].some(v => String(v || '').toLowerCase() === String(choice).toLowerCase()));
    else if (!choice && state.current?.item.root === 'Anime' && original && !['ita', 'it', 'und'].includes(String(original).toLowerCase())) index = tracks.findIndex(t => /^it/i.test(t.language || t.label));
    if (index >= 0) chooseSubtitle(index, false);
  });

  // Tocchi: uno mostra o nasconde i comandi, due ai lati saltano di 10 secondi. Col mouse un clic mette in pausa.
  stage.addEventListener('pointermove', event => { if (event.pointerType === 'mouse') wake(); });
  stage.addEventListener('pointerdown', event => { pointer = { x: event.clientX, y: event.clientY }; });
  stage.addEventListener('pointerup', event => {
    if (locked) { if (!event.target.closest('#vp-unlock')) event.preventDefault(); return; }
    if (event.target.closest('button,input,label,a,.vp-panel,.next-card')) return;
    if (!pointer || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 24) return;
    const r = stage.getBoundingClientRect(); const x = (event.clientX - r.left) / r.width;
    if (event.pointerType === 'mouse') { toggle(); wake(); return; }
    event.preventDefault(); event.stopPropagation(); const now = Date.now(); lastTouch = now;
    gesture = tapGesture(gesture, x, now);
    if (gesture.seconds) { clearTimeout(tapTimer); jump(gesture.seconds, gesture.total); return; }
    lastTap = now; clearTimeout(tapTimer);
    tapTimer = setTimeout(() => { if (layer.classList.contains('idle')) wake(); else sleep(); }, 320);
  });
  stage.addEventListener('dblclick', event => {
    event.preventDefault(); event.stopPropagation();
    if (!locked && Date.now() - lastTouch > 600 && !event.sourceCapabilities?.firesTouchEvents && !event.target.closest('button,input,.vp-panel,.next-card')) $('#fullscreen').click();
  });

  // Tastiera e telecomando: spazio/K pausa, frecce ±10 s sul video, F schermo intero, M muto. Invio resta ai salti (TV).
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || !dialog.open || c.activeDialog() !== dialog) return;
    if (locked) { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); lock(false); } return; }
    if (event.key === 'Escape' && !$('#vp-panel').hidden) { event.preventDefault(); event.stopImmediatePropagation(); closePanel(); return; }
    wake();
    const active = document.activeElement; const onControl = active && active !== video && active !== dialog && active !== document.body && active !== stage;
    if (active?.matches?.('input,select,textarea') && active.id !== 'vp-seek') return;
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if ((key === ' ' && !onControl) || key === 'k' || (key === 'enter' && !onControl && !c.activeSkip())) { event.preventDefault(); toggle(); }
    else if (['arrowleft', 'arrowright'].includes(key) && !onControl && active?.id !== 'vp-seek') { event.preventDefault(); jump(key === 'arrowleft' ? -10 : 10); }
    else if (['arrowup', 'arrowdown'].includes(key) && !onControl && isTv()) { event.preventDefault(); $('#vp-toggle').focus(); }
    else if (key === 'f' && !event.ctrlKey && !event.metaKey) { event.preventDefault(); $('#fullscreen').click(); }
    else if (key === 'm') video.muted = !video.muted;
  }, true);

  // Telefono: a schermo intero il video gira in orizzontale (dove il browser lo permette).
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement && matchMedia('(pointer: coarse)').matches) screen.orientation?.lock?.('landscape').catch(() => {});
    else if (!document.fullscreenElement) screen.orientation?.unlock?.();
  });
  function resetInteraction() {
    clearTimeout(idleTimer); clearTimeout(tapTimer); clearTimeout(flashTimer);
    clearTimeout(loadingTimer); previewAbort?.abort(); previewGeneration++; preview = null; previewBox.hidden = true;
    lastTap = 0; gesture = null; pointer = null; dragging = false; flash.className = 'vp-flash'; lock(false);
  }
  dialog.addEventListener('close', () => {
    resetInteraction(); closePanel(); $('#next-card').hidden = true; layer.classList.remove('idle'); stage.classList.remove('idle', 'has-next');
    loading.hidden = true; globalThis.ApollonAndroid?.setVideoMode(false); screen.orientation?.unlock?.();
    if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(error => c.notify?.(error.message, true));
  });

  function opened(item) {
    resetInteraction(); panelOpener = null;
    $('#vp-episodes').hidden = !item.series; $('#vp-panel').hidden = true; stage.classList.remove('panel-open', 'has-next');
    $('#next-card').hidden = true; $('#next-card').dataset.id = '';
    $('#vp-next').hidden = !c.nextEpisode(item);
    loading.hidden = false;
    loadingTimer = setTimeout(() => { if (!dialog.open || loading.hidden) return; loading.hidden = true; $('#video-error').textContent = 'Il video tarda a partire. Controlla la connessione, poi tocca Riproduci per riprovare.'; $('#video-error').hidden = false; }, 15000);
    // Il gesto del tocco è ancora valido: mai aspettare una richiesta di rete prima di entrare.
    const full = playerFullscreen({ tv: isTv(), coarse: matchMedia('(pointer: coarse)').matches, android: !!globalThis.ApollonAndroid });
    if (full.videoMode) globalThis.ApollonAndroid.setVideoMode(true);
    if (full.fullscreen && !document.fullscreenElement) stage.requestFullscreen?.().catch(() => {});
    // Riusa solo anteprime già pronte. Nessuna analisi pesante viene avviata dal player mobile.
    const pg = ++previewGeneration; previewAbort = new AbortController();
    fetch(`/media/${item.id}/trickplay?playing=1&cached=1`, { signal: previewAbort.signal }).then(r => r.ok ? r.json() : null).then(data => { if (pg === previewGeneration && data?.ready) preview = data; }).catch(() => {});
    video.playbackRate = 1; tool($('#vp-speed'), 'speed', 'Velocità');
    // Sottotitoli dentro il file (testo): il server li converte in WebVTT.
    for (const s of (item.streams || []).filter(s => s.type === 'subtitle' && TEXT_CODECS.has(String(s.codec).toLowerCase()))) {
      video.append(el('track', { kind: 'subtitles', label: `${languageName(s.language)}${s.title ? ` · ${s.title}` : ''}`, srclang: /^[a-z]{2,3}$/i.test(s.language || '') ? s.language : 'it', src: `/media/${item.id}/subtitle/s${s.index}` }));
    }
    c.pushLayer('player'); paint(); wake();
  }
  globalThis.mediatecaPlayer = { opened, wake };
  return { opened };
}
