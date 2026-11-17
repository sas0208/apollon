export const EQ_BANDS = [60, 170, 500, 1400, 4000, 11000];
export const EQ_PRESETS = {
  normal: { label: 'Normale', gains: [0, 0, 0, 0, 0, 0] },
  bass: { label: 'Bassi', gains: [5, 3, 0, -1, -1, 0] },
  voice: { label: 'Voci', gains: [-3, -1, 2, 4, 1, -2] },
  night: { label: 'Notte', gains: [-4, -2, 1, 2, 0, -4] },
  acoustic: { label: 'Acustico', gains: [1, 1, 0, 2, 2, 1] },
  custom: { label: 'Personalizzato', gains: [0, 0, 0, 0, 0, 0] }
};
const cleanGains = values => EQ_BANDS.map((_, i) => Number.isFinite(values?.[i]) ? Math.max(-9, Math.min(9, values[i])) : 0);
export function equalizerSettings(value = {}) {
  const preset = Object.hasOwn(EQ_PRESETS, value?.preset) ? value.preset : 'normal';
  const custom = cleanGains(value?.custom ?? (preset === 'custom' ? value?.gains : []));
  return { preset, gains: preset === 'custom' ? [...custom] : [...EQ_PRESETS[preset].gains], custom };
}
export function selectEqualizer(preset, current) {
  const previous = equalizerSettings(current);
  return equalizerSettings({ preset, custom: previous.custom });
}
// Conservative headroom: overlapping boosted filters cannot overload the output.
export const equalizerHeadroom = gains => 10 ** (-gains.reduce((sum, gain) => sum + Math.max(0, gain), 0) / 20);

export class EqualizerGraph {
  constructor(context) {
    this.context = context; this.sources = new Map();
    this.filters = EQ_BANDS.map((frequency, i) => {
      const filter = context.createBiquadFilter();
      filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
      filter.frequency.value = Math.min(frequency, context.sampleRate * .45); filter.Q.value = .85; filter.gain.value = 0;
      return filter;
    });
    this.output = context.createGain();
    this.filters.forEach((filter, i) => filter.connect(this.filters[i + 1] || this.output));
    this.output.connect(context.destination);
  }
  attach(element) {
    if (this.sources.has(element)) return;
    const gain = this.context.createGain(); const level = element.volume;
    gain.gain.value = level;
    const source = this.context.createMediaElementSource(element);
    this.sources.set(element, { source, gain, level });
    source.connect(gain); gain.connect(this.filters[0]); element.volume = 1;
  }
  configure(settings) {
    const { context } = this;
    const ramp = (param, value) => { param.cancelScheduledValues(context.currentTime); param.setTargetAtTime(value, context.currentTime, .015); };
    settings.gains.forEach((gain, i) => ramp(this.filters[i].gain, gain));
    ramp(this.output.gain, equalizerHeadroom(settings.gains));
  }
  level(element) { return this.sources.get(element)?.level ?? element.volume; }
  setLevel(element, level) {
    const entry = this.sources.get(element);
    if (!entry) { element.volume = level; return; }
    entry.level = level; entry.gain.gain.setValueAtTime(level, this.context.currentTime);
  }
  destroy() {
    for (const { source, gain } of this.sources.values()) { source.disconnect(); gain.disconnect(); }
    this.filters.forEach(filter => filter.disconnect()); this.output.disconnect();
    this.context.close().catch(() => {});
  }
}
