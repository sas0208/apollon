export class FakeParam {
  constructor(value = 1) { this.value = value; this.writes = []; }
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; this.writes.push(value); }
  setValueAtTime(value) { this.value = value; this.writes.push(value); }
}
class FakeNode {
  constructor(kind) { this.kind = kind; this.connections = []; this.gain = new FakeParam(); this.frequency = new FakeParam(); this.Q = new FakeParam(); }
  connect(node) { if (this.connections.includes(node)) throw Error('Collegamento duplicato'); this.connections.push(node); return node; }
  disconnect() { this.connections = []; }
}
export class FakeAudioContext {
  constructor() { this.sampleRate = 48000; this.currentTime = 0; this.state = 'suspended'; this.destination = new FakeNode('destination'); this.nodes = []; this.media = new Map(); this.resumes = 0; }
  create(kind) { const node = new FakeNode(kind); this.nodes.push(node); return node; }
  createBiquadFilter() { return this.create('filter'); }
  createGain() { return this.create('gain'); }
  createMediaElementSource(element) { if (this.media.has(element)) throw Error('Sorgente creata due volte'); const source = this.create('source'); this.media.set(element, source); return source; }
  async resume() { this.resumes++; this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
