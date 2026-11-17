import { setMusicIcon } from './music-feedback.js';
export function deviceBridge(c) {
  const $ = selector => document.querySelector(selector);
  let mirroredId, queueSignature;
  const snapshot = () => ({ queue: c.state.queue, index: c.state.queueIndex, paused: c.getAudio().paused,
    position: Number.isFinite(c.getAudio().currentTime) ? c.getAudio().currentTime : 0, volume: c.playback.volume });
  const mirror = s => {
    c.state.queue = s.queue; c.state.queueIndex = s.index;
    const signature = `${s.index}/${s.queue.map(s => s.id).join('/')}`;
    if (signature !== queueSignature) { queueSignature = signature; c.renderQueue(); }
    const song = s.queue[s.index]; if (!song) { mirroredId = undefined; $('#audio-bar').hidden = true; $('#music-player').close(); document.body.classList.remove('has-audio'); return; }
    if (mirroredId !== song.id) {
      mirroredId = song.id;
      c.trackChanged?.(song);
      for (const id of ['audio-title', 'full-title']) $(`#${id}`).textContent = song.title;
      $('#audio-artist').textContent = song.artist || ''; $('#full-artist').textContent = [song.artist, song.album].filter(Boolean).join(' · ');
      $('#audio-cover').src = c.image(song.coverArt || song.albumId, 80); $('#full-cover').src = c.image(song.coverArt || song.albumId, 'large');
    }
    $('#audio-bar').hidden = false; document.body.classList.add('has-audio');
    for (const prefix of ['audio', 'full']) {
      setMusicIcon($(`#${prefix}-toggle`), s.paused ? 'play' : 'pause'); $(`#${prefix}-toggle`).setAttribute('aria-label', s.paused ? 'Riproduci sul dispositivo scelto' : 'Metti in pausa sul dispositivo scelto');
      $(`#${prefix}-time`).textContent = c.fmtTime(s.position); $(`#${prefix}-duration`).textContent = c.fmtTime(song.duration);
      const seek = $(`#${prefix}-seek`); seek.max = song.duration || 86400; if (document.activeElement !== seek) seek.value = s.position;
    }
    if (document.activeElement !== $('#volume')) $('#volume').value = s.volume; c.measureAudioBar();
    c.updateLyrics?.();
    for (const n of document.querySelectorAll('[data-playing-song]')) { n.hidden = n.dataset.playingSong !== song.id; n.classList.toggle('running', !s.paused); }
  };
  const execute = async (op, p) => {
    mirroredId = undefined;
    const a = c.getAudio(), engine = c.playback;
    if (op === 'transfer' || op === 'queue') {
      const same = c.state.queue[c.state.queueIndex]?.id === p.queue[p.index]?.id;
      const wasPaused = a.paused;
      if (op === 'transfer' || !same) engine.pause();
      c.state.queue = p.queue; c.state.queueIndex = p.index; engine.setQueue(p.queue, p.index); engine.configure({ volume: p.volume });
      if (p.queue.length && (op === 'transfer' || !same)) await c.playSong(p.index, { position: p.position, autoplay: op === 'transfer' ? !p.paused : !wasPaused });
      if (!p.queue.length) { if (c.clearQueue) c.clearQueue(); else engine.clear(); }
    } else if (op === 'enqueue') {
      const empty = !c.state.queue.length; c.state.queue = [...c.state.queue, ...p.songs].slice(0, 2000);
      if (empty) { c.persistQueue(); await c.playSong(0, { autoplay: true }); }
    } else if (op === 'pause') engine.pause();
    else if (op === 'play') { if (!c.state.queue.length) throw new Error('La coda del dispositivo è vuota. Scegli un brano.'); await engine.prepareAudio(); await a.play(); }
    else if (op === 'next') await engine.advance();
    else if (op === 'previous') { if (a.currentTime > 3) a.currentTime = 0; else await c.playSong(Math.max(0, c.state.queueIndex - 1)); }
    else if (op === 'playIndex') await c.playSong(p.index);
    else if (op === 'seek') { if (Number.isFinite(a.duration)) { engine.cancelFade(); a.currentTime = Math.min(p.position, a.duration); } }
    else if (op === 'volume') engine.configure({ volume: p.volume });
    if (typeof document !== 'undefined' && $('#volume')) $('#volume').value = engine.volume;
    c.persistQueue(); c.renderQueue();
    if ((op === 'play' || (op === 'transfer' && !p.paused)) && c.getAudio().paused && c.state.queue.length) throw new Error('Sul dispositivo scelto tocca Riproduci per consentire l’audio.');
  };
  return { ...c, snapshot, mirror, execute, pauseLocal: () => c.playback.pause() };
}
