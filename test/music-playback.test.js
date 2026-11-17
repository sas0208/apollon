import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicPlayback } from '../public/music-playback.js';
import { FakeAudioContext } from './audio-fakes.js';
class Media extends EventTarget {
  constructor() { super(); this.currentTime = 0; this.duration = 100; this.readyState = 4; this.paused = true; this.volume = 1; this.loads = 0; }
  load() { this.loads++; this.currentTime = 0; }
  getAttribute(key) { return this[key]; }
  removeAttribute(key) { delete this[key]; }
  play() { this.paused = false; this.dispatchEvent(new Event('play')); return Promise.resolve(); }
  pause() { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } }
}
function fixture(options = {}) {
  let now = 0; const nodes = [new Media(), new Media()]; const listens = []; const tracks = []; let sleeps = 0;
  const player = new MusicPlayback(nodes, { track: (s, n) => tracks.push([s.id, n]), listen: b => listens.push(b), sleep: () => sleeps++ }, { now: () => now, schedule: false, ...options });
  player.setQueue([{ id: 'a', replayGain: { trackGain: -6 } }, { id: 'b' }, { id: 'c' }], 0);
  return { player, nodes, listens, tracks, get sleeps() { return sleeps; }, time: value => { now = value; } };
}

test('tocco su brano precaricato riusa i byte senza ricaricare; warm non anticipa ascolti', async () => {
  const f = fixture(); const p = f.player;
  await p.play(0); const spare = f.nodes[1]; const loads = spare.loads;
  await p.play(1); assert.equal(p.active, spare); assert.equal(spare.loads, loads);
  p.warm({ id:'fuori-coda' }); const warm = f.nodes[0]; const count = warm.loads;
  assert.equal(warm.paused, true);
  p.setQueue([{id:'fuori-coda'}], 0, false); await p.play(0);
  assert.equal(p.active, warm); assert.equal(warm.loads, count); p.destroy();
});

test('stream che non parte: attesa visibile, timeout, nessuna ripartenza dopo pausa', async () => {
  const f = fixture({ startupMs: 25 }); const p = f.player; const status = []; const errors = [];
  p.callbacks.status = s => status.push(s); p.callbacks.error = e => errors.push(e);
  p.active.play = () => new Promise(() => {});
  await p.play(0); assert.equal(errors.length, 1); assert.match(errors[0].message, /connessione/);
  assert.deepEqual(status, ['loading', 'error']); assert.equal(p.switching, false); assert.equal(p.active.getAttribute('src'), undefined);
  const pending = p.play(0); p.pause(); await pending;
  await new Promise(r => setTimeout(r, 40)); assert.equal(errors.length, 1); p.destroy();
});
test('attività reale: secondi alla pausa, seek escluso, invio periodico e nuova sessione al cambio', async () => {
  const f = fixture(), reports = []; const p = f.player; p.callbacks.activity = data => reports.push(data);
  await p.play(0); f.time(6000); p.active.currentTime = 6; p.tick(); assert.equal(reports.length, 0);
  p.pause(); assert.equal(reports[0].seconds, 6); p.pause(); assert.equal(reports.length, 1);
  p.active.currentTime = 90; p.active.dispatchEvent(new Event('seeking')); await p.active.play();
  f.time(21000); p.active.currentTime = 95; p.tick(); p.pause(); assert.equal(reports[1].seconds, 11);
  await p.play(1); f.time(36000); p.active.currentTime = 15; p.tick(); assert.equal(reports[2].seconds, 15);
  assert.notEqual(reports[0].playId, reports[2].playId); p.destroy();
});
test('precarica solo il successivo e passa a fine brano senza ricaricare lo stream pronto', async () => {
  const { player: p, nodes } = fixture(); await p.play(0);
  assert.equal(nodes[1].src, '/api/music/stream?id=b'); const loads = nodes[1].loads;
  await p.advance(true); assert.equal(p.active, nodes[1]); assert.equal(nodes[1].loads, loads);
  assert.equal(nodes[0].src, '/api/music/stream?id=c'); assert.equal(nodes[0].paused, true);
});
test('dissolvenza termina il vecchio audio e pausa/timer fermano entrambi', async () => {
  const f = fixture(); const p = f.player; p.configure({ crossfade: 4 }); await p.play(0);
  p.callbacks.track = () => p.setQueue(p.queue, p.index); // UI saves/re-renders during the switch
  f.time(96000); p.active.currentTime = 96; p.tick(); await new Promise(r => setImmediate(r));
  assert.ok(p.fading); assert.equal(p.active, f.nodes[1]);
  assert.equal(f.nodes[0].paused, false); assert.equal(f.nodes[0].src, '/api/music/stream?id=a');
  f.time(98000); p.tick(); assert.ok(Math.abs(p.active.volume - 0.4) < 0.01);
  p.pause(); assert.ok(f.nodes.every(n => n.paused)); assert.equal(p.fading, null);
  await p.play(0); p.setSleep(1); f.time(158001); p.tick(); assert.equal(f.sleeps, 1); assert.ok(f.nodes.every(n => n.paused));
});
test('ripeti uno, timer fine brano, ripresa senza autoplay, gain e scrobble senza seek', async () => {
  const f = fixture(); const p = f.player; p.configure({ repeat: 'one', normalize: true });
  await p.play(0, { position: 25, autoplay: false }); assert.equal(p.active.currentTime, 25); assert.ok(p.active.paused); assert.equal(f.listens.length, 0); assert.ok(p.active.volume < 0.41);
  await p.active.play(); f.time(1000); p.active.currentTime = 90; p.tick(); assert.equal(f.listens.filter(e => e.submission).length, 0);
  for (let i = 1; i <= 50; i++) { f.time(1000 + i * 1000); p.active.currentTime = i; p.tick(); }
  assert.equal(f.listens.filter(e => e.submission).length, 0); // discontinuity consumes the first second
  f.time(52000); p.active.currentTime = 51; p.tick(); assert.equal(f.listens.filter(e => e.submission).length, 1);
  await p.advance(true); assert.equal(p.index, 0);
  p.setSleep('end'); await p.advance(true); assert.equal(p.index, 0); assert.ok(p.active.paused); assert.equal(f.sleeps, 1);
});
test('coda vuota/cancellata durante radio asincrona non riparte da sola', async () => {
  const f = fixture(); const p = f.player; await p.play(2); let resolve;
  p.callbacks.more = () => new Promise(r => { resolve = r; });
  const next = p.advance(true); p.clear(); resolve(); await next;
  assert.equal(p.queue.length, 0); assert.ok(f.nodes.every(n => n.paused));
});

test('EQ pigro: ripresa senza autoplay e Normale non creano Web Audio; assenza API lascia audio nativo', async () => {
  let contexts = 0;
  const f = fixture({ createAudioContext: () => { contexts++; return null; } });
  await f.player.play(0); assert.equal(contexts, 0);
  f.player.setEqualizer({ preset: 'bass' }); await f.player.play(0, { autoplay: false }); assert.equal(contexts, 0);
  assert.equal(await f.player.prepareAudio(), false); assert.equal(contexts, 1);
  await f.player.play(0); assert.equal(f.player.active.paused, false); assert.equal(f.player.active.volume, .8);
});
test('EQ convive con ReplayGain, crossfade, pausa e gapless senza duplicare le sorgenti', async () => {
  const context = new FakeAudioContext(); let created = 0;
  const f = fixture({ createAudioContext: () => { created++; return context; } }); const p = f.player;
  p.setEqualizer({ preset: 'bass' }); p.configure({ crossfade: 4, normalize: true }); await p.play(0);
  assert.equal(context.media.size, 2); assert.equal(context.resumes, 1); assert.ok(p.level(p.active) < .41);
  assert.ok(f.nodes.every(n => n.volume === 1));
  f.time(96000); p.active.currentTime = 96; p.tick(); await new Promise(r => setImmediate(r));
  assert.ok(p.fading); f.time(98000); p.tick();
  assert.ok(Math.abs(p.level(p.active) - .4) < .01); assert.ok(p.level(p.fading.old) < .21);
  p.setEqualizer({ preset: 'voice' }); assert.ok(p.fading); assert.equal(created, 1); assert.equal(context.media.size, 2);
  p.pause(); assert.ok(f.nodes.every(n => n.paused));
  p.setEqualizer({ preset: 'normal' }); await p.play(1); const buffered = f.nodes.find(n => n !== p.active); const loads = buffered.loads;
  p.configure({ crossfade: 0 }); await p.advance(true);
  assert.equal(p.active, buffered); assert.equal(buffered.loads, loads); assert.equal(created, 1);
  for (const source of context.media.values()) assert.equal(source.connections.length, 1);
  p.destroy(); assert.equal(context.state, 'closed');
});

test('pausa durante il risveglio di Web Audio annulla la partenza pendente', async () => {
  const context = new FakeAudioContext(); let resume;
  context.resume = () => new Promise(resolve => { resume = () => { context.state = 'running'; resolve(); }; });
  const f = fixture({ createAudioContext: () => context });
  f.player.setEqualizer({ preset: 'bass' }); const pending = f.player.play(0);
  f.player.pause(); resume(); await pending;
  assert.ok(f.nodes.every(n => n.paused)); assert.equal(f.player.switching, false);
});
