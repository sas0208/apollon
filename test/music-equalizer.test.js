import test from 'node:test';
import assert from 'node:assert/strict';
import { EQ_BANDS, EQ_PRESETS, equalizerSettings, selectEqualizer, equalizerHeadroom, EqualizerGraph } from '../public/music-equalizer.js';
import { FakeAudioContext } from './audio-fakes.js';

test('equalizzatore: sei bande e preimpostazioni originali, fallback e limiti', () => {
  assert.equal(EQ_BANDS.length, 6); assert.deepEqual(equalizerSettings().gains, [0, 0, 0, 0, 0, 0]);
  for (const preset of Object.keys(EQ_PRESETS)) {
    const settings = selectEqualizer(preset); assert.equal(settings.preset, preset); assert.equal(settings.gains.length, 6);
    assert.ok(settings.gains.every(g => Number.isFinite(g) && Math.abs(g) <= 9));
  }
  assert.equal(equalizerSettings({ preset: '__proto__' }).preset, 'normal'); assert.equal(equalizerSettings(null).preset, 'normal');
  assert.deepEqual(equalizerSettings({ preset: 'custom', gains: [99, -99, NaN, '5', null, 3] }).gains, [9, -9, 0, 0, 0, 3]);
  const custom = equalizerSettings({ preset: 'custom', custom: [1, 2, 3, 4, 5, 6] });
  const bass = selectEqualizer('bass', custom);
  assert.deepEqual(bass.gains, EQ_PRESETS.bass.gains); assert.deepEqual(selectEqualizer('custom', bass).gains, custom.gains);
  custom.gains[0] = 8; assert.equal(EQ_PRESETS.normal.gains[0], 0);
});
test('equalizzatore: ogni sorgente ha una sola strada, sei filtri condivisi e margine di volume', () => {
  const context = new FakeAudioContext(); const graph = new EqualizerGraph(context);
  const a = { volume: .8 }, b = { volume: .4 };
  graph.attach(a); graph.attach(b); graph.attach(a);
  assert.equal(context.media.size, 2); assert.equal(a.volume, 1); assert.equal(graph.level(a), .8);
  for (const { source, gain } of graph.sources.values()) {
    assert.deepEqual(source.connections, [gain]); assert.deepEqual(gain.connections, [graph.filters[0]]);
  }
  graph.filters.forEach((node, i) => assert.deepEqual(node.connections, [graph.filters[i + 1] || graph.output]));
  assert.deepEqual(graph.output.connections, [context.destination]);
  assert.deepEqual(graph.filters.map(f => f.frequency.value), EQ_BANDS);
  graph.configure(selectEqualizer('bass')); assert.equal(graph.filters[0].gain.value, 5);
  assert.equal(graph.output.gain.value, equalizerHeadroom(EQ_PRESETS.bass.gains)); assert.ok(graph.output.gain.value < 1);
  graph.setLevel(a, .2); assert.equal(graph.sources.get(a).gain.gain.value, .2);
  graph.configure(selectEqualizer('normal')); assert.equal(graph.output.gain.value, 1); assert.equal(context.media.size, 2);
  graph.destroy(); assert.equal(context.state, 'closed');
});
