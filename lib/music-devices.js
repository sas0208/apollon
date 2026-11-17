import { randomUUID } from 'node:crypto';
import { fail, text, number } from './util.js';
export function homeAddress(address = '') {
  address = address.toLowerCase().replace(/^::ffff:/, '');
  if (address === '::1' || /^f[cd][0-9a-f]{2}:/.test(address) || /^fe[89ab][0-9a-f]:/.test(address)) return true;
  const parts = address.split('.').map(Number); if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return parts[0] === 127 || parts[0] === 10 || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 169 && parts[1] === 254);
}
export function wireSongs(list) {
  return list.map(s => {
    const song = { id: text(s?.id, 250), title: text(s.title, 500) };
    for (const key of ['artist', 'album', 'albumId', 'artistId', 'coverArt', 'addedBy']) if (typeof s[key] === 'string') song[key] = s[key].slice(0, 500);
    if (Number.isFinite(s.duration)) song.duration = Math.max(0, Math.min(86400, s.duration));
    return song;
  });
}
export function deviceState(value) {
  if (!value || !Array.isArray(value.queue) || value.queue.length > 2000 || typeof value.paused !== 'boolean') throw fail(400, 'Stato del lettore non valido.');
  const queue = wireSongs(value.queue);
  const index = number(value.index, 0, Math.max(0, queue.length - 1)); if (!Number.isInteger(index)) throw fail(400, 'Posizione nella coda non valida.');
  return { queue, index, paused: value.paused, position: number(value.position, 0, 86400), volume: number(value.volume, 0, 1) };
}
export class MusicDevices {
  constructor({ now = Date.now } = {}) { this.devices = new Map(); this.now = now; this.watchers = []; }
  notify(kind, d, info) { for (const watcher of this.watchers) watcher(kind, d, info); }
  get(scope, id, owner) {
    const d = this.devices.get(id);
    if (!d || d.scope !== scope || (owner && d.owner !== owner)) throw fail(404, 'Dispositivo non disponibile per questo profilo.');
    return d;
  }
  public(d) { return { id: d.id, name: d.name, online: !!d.send, state: d.state, version: d.version, updated: d.updated }; }
  list(scope) { return [...this.devices.values()].filter(d => d.scope === scope).map(d => this.public(d)); }
  broadcast(scope, event) { for (const d of this.devices.values()) if (d.scope === scope) d.send?.(event); }
  register(scope, owner, b) {
    for (const [id, d] of this.devices) if (!d.send && this.now() - d.updated > 86400000) this.devices.delete(id);
    let d = b.id ? this.devices.get(b.id) : undefined;
    if (d && (d.scope !== scope || d.owner !== owner)) d = undefined;
    if (d?.send && b.connection && b.connection !== d.connection) d = undefined;
    if (!d) {
      if (this.devices.size >= 100) throw fail(503, 'Troppi dispositivi collegati.');
      d = { id: randomUUID(), scope, owner, version: 0, pending: new Map(), updated: this.now() }; this.devices.set(d.id, d);
    }
    d.name = text(b.name || d.name || 'Dispositivo di casa', 50); d.updated = this.now();
    if (b.connection && b.connection !== d.connection) { d.connection = text(b.connection, 100); d.sequence = -1; }
    this.broadcast(scope, { type: 'devices', devices: this.list(scope) }); return this.public(d);
  }
  connect(scope, owner, id, send) {
    const d = this.get(scope, id, owner); d.send?.({ type: 'replaced' }); d.send = send; d.updated = this.now();
    this.broadcast(scope, { type: 'devices', devices: this.list(scope) });
    for (const [key, command] of d.pending) { if (this.now() - command.at < 10000) send(command); else d.pending.delete(key); }
    this.notify('online', d);
    return () => { if (d.send !== send) return; d.send = null; d.updated = this.now(); this.broadcast(scope, { type: 'devices', devices: this.list(scope) }); this.notify('offline', d); };
  }
  command(scope, owner, b) {
    const from = this.get(scope, b.from, owner), target = this.get(scope, b.target);
    if (!target.send) throw fail(409, 'Il dispositivo non è collegato. Scegline un altro o riaprilo.');
    const op = b.op; let payload = {};
    if (['transfer', 'queue'].includes(op)) payload = deviceState(b.payload);
    else if (op === 'seek') payload.position = number(b.payload?.position, 0, 86400);
    else if (op === 'volume') payload.volume = number(b.payload?.volume, 0, 1);
    else if (op === 'playIndex') payload.index = number(b.payload?.index, 0, 1999);
    else if (!['play', 'pause', 'next', 'previous'].includes(op)) throw fail(400, 'Comando non disponibile.');
    return this.dispatch(from.id, target, op, payload);
  }
  dispatch(from, target, op, payload) {
    if (!target.send) throw fail(409, 'Il dispositivo non è collegato. Scegline un altro o riaprilo.');
    for (const [id, command] of target.pending) if (this.now() - command.at > 10000) target.pending.delete(id);
    if (target.pending.size >= 32) throw fail(429, 'Attendi la risposta del dispositivo.');
    const command = { type: 'command', commandId: randomUUID(), from, op, payload, at: this.now() };
    target.pending.set(command.commandId, command); target.send(command); return { commandId: command.commandId };
  }
  update(scope, owner, b) {
    const d = this.get(scope, b.id, owner); const next = deviceState({ ...b.state, queue: b.state?.queue ?? d.state?.queue });
    const queueChanged = !d.state || (b.state?.queue !== undefined && JSON.stringify(d.state.queue) !== JSON.stringify(next.queue));
    if (!Number.isSafeInteger(b.sequence) || b.sequence < 0) throw fail(400, 'Aggiornamento non valido.');
    if (!d.connection) { d.connection = text(b.connection, 100); d.sequence = -1; }
    else if (d.connection !== b.connection) throw fail(409, 'Pagina sostituita da una nuova apertura.');
    if (b.sequence <= d.sequence) return this.public(d);
    d.sequence = b.sequence; d.state = next; d.version++; d.updated = this.now();
    this.broadcast(scope, { type: 'state', device: { ...this.public(d), state: queueChanged ? next : { ...next, queue: undefined } } });
    this.notify('state', d, { queueChanged });
    if (b.commandId && d.pending.has(b.commandId)) {
      const command = d.pending.get(b.commandId); d.pending.delete(b.commandId);
      this.devices.get(command.from)?.send?.({ type: 'ack', commandId: b.commandId, error: typeof b.error === 'string' ? b.error.slice(0, 250) : '' });
    }
    return this.public(d);
  }
  close() { for (const d of this.devices.values()) { d.send?.({ type: 'shutdown' }); d.send = null; } this.devices.clear(); }
}
