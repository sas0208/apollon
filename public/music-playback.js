import { nextIndex, volumeGain, qualifies } from './music-logic.js';
import { EqualizerGraph, equalizerSettings } from './music-equalizer.js';

// Two native media elements, at most one preloaded successor. Never download a
// whole album or decode it into RAM. Browsers/codecs decide the final boundary.
export class MusicPlayback {
  constructor(nodes, callbacks = {}, { now = Date.now, schedule = true, createAudioContext = () => {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext; return Context ? new Context() : null;
  }, startupMs = 8000 } = {}) {
    this.nodes = nodes; this.active = nodes[0]; this.callbacks = callbacks; this.now = now;
    this.queue = []; this.index = 0; this.repeat = 'off'; this.crossfade = 0; this.normalize = false; this.volume = 0.8;
    this.epoch = 0; this.sleepAt = 0; this.sleepEnd = false; this.startupMs = startupMs;
    this.createAudioContext = createAudioContext; this.equalizer = equalizerSettings();
    this.listeners = [];
    const listen = (node, type, handler) => { node.addEventListener(type, handler); this.listeners.push(() => node.removeEventListener(type, handler)); };
    for (const node of nodes) {
      listen(node, 'loadedmetadata', () => { if (node === this.active && this.resume != null) { node.currentTime = Math.min(this.resume, Math.max(0, node.duration - 0.1)); this.resume = null; } });
      listen(node, 'ended', () => { if (node === this.active) this.advance(true).catch(e => callbacks.error?.(e)); });
      listen(node, 'play', () => { if (node === this.active) { this.running = true; this.lastAt = this.now(); this.lastPosition = node.currentTime; this.sendListen(false); } });
      listen(node, 'pause', () => { if (node === this.active) { this.account(); this.reportActivity(true); this.running = false; this.cancelFade(); } });
      listen(node, 'seeking', () => { if (node === this.active) { this.lastPosition = node.currentTime; this.lastAt = this.now(); } });
      listen(node, 'playing', () => { if (node === this.active) { clearTimeout(this.startTimer); this.loading = false; callbacks.status?.('playing'); callbacks.ready?.(this.song()); } });
      listen(node, 'waiting', () => { if (node === this.active && !node.paused) callbacks.status?.('loading'); });
    }
    if (schedule) this.interval = setInterval(() => this.tick(), 100);
  }
  song() { return this.queue[this.index]; }
  url(song) { return this.callbacks.url?.(song) || `/api/music/stream?id=${encodeURIComponent(song.id)}`; }
  gain(song = this.song()) { return this.volume * (this.normalize ? volumeGain(song) : 1); }
  level(node) { return this.graph ? this.graph.level(node) : node.volume; }
  setLevel(node, value) { if (this.graph) this.graph.setLevel(node, value); else node.volume = value; }
  setEqualizer(value) { this.equalizer = equalizerSettings(value); this.graph?.configure(this.equalizer); return this.equalizer; }
  async prepareAudio() {
    if (!this.graph && this.equalizer.gains.some(g => g !== 0)) {
      try {
        const context = this.createAudioContext(); if (!context) return false;
        this.graph = new EqualizerGraph(context);
        for (const node of this.nodes) this.graph.attach(node);
        this.graph.configure(this.equalizer);
      } catch { return false; }
    }
    if (this.graph && this.graph.context.state !== 'running') {
      try { await this.graph.context.resume(); } catch { return false; }
    }
    return true;
  }
  configure({ repeat = this.repeat, crossfade = this.crossfade, normalize = this.normalize, volume = this.volume } = {}) {
    this.repeat = ['off', 'one', 'all'].includes(repeat) ? repeat : 'off';
    this.crossfade = Math.max(0, Math.min(12, Number(crossfade) || 0)); this.normalize = !!normalize;
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0)); this.cancelFade(); this.preload();
  }
  setQueue(queue, index = this.index, preload = true) { this.queue = queue; this.index = index; if (preload) this.preload(); }
  // Il primo pezzo del brano toccato parte già al pointerdown, sul secondo elemento nativo.
  warm(song) {
    if (!song || this.fading || this.switching || this.destroyed) return;
    const other = this.nodes.find(n => n !== this.active), src = this.url(song);
    if (other.getAttribute('src') === src || this.active.getAttribute('src') === src) return;
    other.pause(); other.preload = 'auto'; other.src = src; other.load();
  }
  candidate(ended = true) { return nextIndex(this.index, this.queue.length, this.repeat, ended); }
  preload() {
    if (this.fading || this.switching) return;
    const other = this.nodes.find(n => n !== this.active); const index = this.candidate(); const song = this.queue[index];
    if (!song) { other.pause(); other.removeAttribute('src'); other.load(); return; }
    const src = this.url(song); if (other.getAttribute('src') === src) return;
    other.pause(); other.src = src; other.preload = 'auto'; other.load(); this.setLevel(other, this.gain(song));
  }
  async play(index = this.index, { position = 0, autoplay = true, buffered = false, fade = 0 } = {}) {
    if (this.destroyed || !this.queue[index]) return;
    this.account(); this.reportActivity(true); this.cancelFade();
    const previous = Object.fromEntries(['index', 'resume', 'listened', 'started', 'submitted', 'running', 'reportedSeconds', 'playId', 'lastAt', 'lastPosition', 'activityStartedAt'].map(key => [key, this[key]]));
    clearTimeout(this.startTimer); this.cancelStart?.();
    const epoch = ++this.epoch; const old = this.active; this.switching = true;
    const src = this.url(this.queue[index]), spare = this.nodes.find(n => n !== old);
    buffered = buffered || spare.getAttribute('src') === src;
    const next = buffered ? spare : old;
    if (!buffered) for (const node of this.nodes) node.pause();
    this.active = next; this.index = index; this.resume = Math.max(0, Number(position) || 0);
    this.listened = 0; this.started = false; this.submitted = false; this.running = false;
    this.reportedSeconds = 0;
    this.playId = `${this.now()}-${Math.random().toString(36).slice(2)}`; this.lastAt = this.now(); this.lastPosition = this.resume;
    this.activityStartedAt = this.now();
    if (old !== next && !fade) old.pause();
    if (!buffered || next.getAttribute('src') !== src) { next.src = src; next.load(); }
    if (next.readyState >= 1) { next.currentTime = Math.min(this.resume, Math.max(0, next.duration - 0.1)); this.resume = null; }
    this.setLevel(next, fade ? 0 : this.gain());
    this.loading = autoplay; this.callbacks.status?.(autoplay ? 'loading' : 'paused');
    // Lo stream precede copertine, testo, rendering della coda e salvataggio locale.
    const prepare = autoplay ? this.prepareAudio() : Promise.resolve();
    this.callbacks.track?.(this.song(), next, index);
    if (autoplay) {
      let timeout;
      const deadline = new Promise((resolve, reject) => { this.cancelStart = resolve; this.startTimer = setTimeout(() => { timeout = true; reject(new Error('La musica non parte. Controlla la connessione e tocca Riproduci per riprovare.')); }, this.startupMs); });
      try { await Promise.race([(async () => { await prepare; if (epoch === this.epoch) await next.play(); })(), deadline]); }
      catch (error) {
        if (epoch === this.epoch) {
          clearTimeout(this.startTimer); this.loading = false; this.callbacks.status?.('error');
          this.switching = false; next.pause();
          if (timeout) { next.removeAttribute('src'); next.load(); }
          if (old !== next && !old.paused && !old.ended) {
            Object.assign(this, previous); this.active = old;
            this.lastAt = this.now(); this.lastPosition = old.currentTime;
            this.setLevel(old, this.gain());
            next.removeAttribute('src'); next.load();
            this.callbacks.track?.(this.song(), old, this.index);
          } else old.pause();
          this.preload(); this.callbacks.error?.(error);
        }
        return;
      }
      clearTimeout(this.startTimer);
    }
    if (epoch !== this.epoch) return;
    if (old !== next) {
      if (fade && autoplay) this.fading = { old, start: this.now(), duration: fade * 1000, volume: this.level(old) };
      else old.pause();
    }
    this.switching = false; this.preload();
  }
  sendListen(submission) {
    if (!this.song() || (submission ? this.submitted : this.started)) return;
    if (submission) this.submitted = true; else this.started = true;
    this.callbacks.listen?.({ id: this.song().id, playId: this.playId, submission });
  }
  account() {
    const now = this.now(); const position = this.active.currentTime; const delta = position - (this.lastPosition || 0);
    if (this.running && !this.active.seeking && delta > 0 && delta <= (now - (this.lastAt ?? now)) / 1000 + 1) this.listened = (this.listened || 0) + delta;
    this.lastAt = now; this.lastPosition = position;
    if (qualifies(this.active.duration, this.listened)) this.sendListen(true);
    this.reportActivity();
  }
  reportActivity(force = false) {
    const seconds = Math.floor(this.listened || 0);
    if (!this.song() || !this.playId || seconds <= (this.reportedSeconds || 0) || (!force && seconds - (this.reportedSeconds || 0) < 15)) return;
    this.reportedSeconds = seconds; this.callbacks.activity?.({ id: this.song().id, playId: this.playId, seconds, at: this.activityStartedAt });
  }
  cancelFade() {
    if (this.fading) { this.fading.old.pause(); this.fading = null; }
    this.setLevel(this.active, this.gain());
  }
  pause() { clearTimeout(this.startTimer); this.cancelStart?.(); this.loading = false; this.callbacks.status?.('paused'); this.account(); this.reportActivity(true); this.running = false; ++this.epoch; this.switching = false; for (const node of this.nodes) node.pause(); this.cancelFade(); this.callbacks.progress?.(); }
  async advance(ended = false) {
    if (this.advancing) return; this.advancing = true; const epoch = this.epoch;
    try {
      this.account();
      if (ended && this.sleepEnd) { this.sleepEnd = false; this.pause(); this.callbacks.sleep?.(); return; }
      let next = this.candidate(ended);
      if (next < 0 && this.callbacks.more) { await this.callbacks.more(); if (epoch !== this.epoch) return; next = this.candidate(ended); }
      if (next < 0) { this.pause(); return; }
      const other = this.nodes.find(n => n !== this.active);
      const buffered = other.getAttribute('src') === this.url(this.queue[next]);
      await this.play(next, { buffered, fade: !ended && !this.active.paused && !this.active.ended && this.crossfade && buffered ? Math.min(this.crossfade, Math.max(0, this.active.duration - this.active.currentTime)) : 0 });
    } finally { this.advancing = false; }
  }
  setSleep(minutes) {
    this.sleepEnd = minutes === 'end'; this.sleepAt = this.sleepEnd ? 0 : this.now() + Math.max(0, Number(minutes) || 0) * 60000;
    if (!Number(minutes)) this.sleepAt = 0;
  }
  tick() {
    if (this.destroyed) return;
    this.account();
    if (this.sleepAt && this.now() >= this.sleepAt) { this.sleepAt = 0; this.pause(); this.callbacks.sleep?.(); }
    if (this.fading) {
      const progress = Math.min(1, (this.now() - this.fading.start) / this.fading.duration);
      this.setLevel(this.active, this.gain() * progress); this.setLevel(this.fading.old, this.fading.volume * (1 - progress));
      if (progress >= 1) { const old = this.fading.old; this.fading = null; old.pause(); this.preload(); }
    }
    const other = this.nodes.find(n => n !== this.active);
    if (this.crossfade && this.repeat !== 'one' && !this.sleepEnd && !this.active.paused && !this.active.seeking && !this.fading && other.readyState >= 3 &&
      this.active.duration > this.crossfade * 2 && this.active.duration - this.active.currentTime <= this.crossfade && this.candidate() >= 0) this.advance().catch(e => this.callbacks.error?.(e));
  }
  clear() { ++this.epoch; this.switching = false; this.pause(); this.queue = []; this.index = 0; for (const n of this.nodes) { n.pause(); n.removeAttribute('src'); n.load(); } }
  destroy() { if (this.destroyed) return; this.destroyed = true; clearInterval(this.interval); for (const remove of this.listeners.splice(0)) remove(); this.clear(); this.graph?.destroy(); }
}
