import { randomInt, randomUUID } from 'node:crypto';
import { fail } from './util.js';
import { wireSongs } from './music-devices.js';
// "Ascoltiamo insieme": sessioni di casa costruite sopra i dispositivi (stesso canale SSE, nessun altro canale).
export const MAX_PEOPLE = 8, GRACE_MS = 120000;
const VERBS = { open: 'open', join: 'join', leave: 'leave', close: 'end', kick: 'kick', setting: 'setting', control: 'control', add: 'add', list: 'list', mine: 'mine' };
const NOT_MEMBER = 'Non fai parte di questa sessione.';
const HOST_ONLY = 'Solo chi ha aperto la sessione può farlo.';
export class MusicSessions {
  constructor(devices, { now = Date.now, pick = () => randomInt(10000) } = {}) {
    Object.assign(this, { devices, now, pick }); this.items = new Map(); this.misses = new WeakMap();
    devices.watchers.push((kind, d, info) => this.watch(kind, d, info));
  }
  handle(verb, method, ctx, b) {
    if (!Object.hasOwn(VERBS, verb) || (method === 'GET') !== ['list', 'mine'].includes(verb)) throw fail(404, 'Comando di sessione non trovato.');
    return this[VERBS[verb]](ctx, b);
  }
  dev(ctx, id) { return this.devices.get(ctx.scope, id, ctx.owner); }
  of(id) { return [...this.items.values()].find(s => s.members.has(id)); }
  view(s) { return { sid: s.sid, code: s.code, host: s.host, guestsControl: s.guestsControl, max: MAX_PEOPLE,
    members: [...s.members].map(([id, m]) => ({ id, name: m.name, host: id === s.host, online: !!this.devices.devices.get(id)?.send })) }; }
  snapshot(s) { return { session: this.view(s), state: this.devices.devices.get(s.host)?.state ?? null }; }
  tell(s, event, except) { for (const id of s.members.keys()) if (id !== except) this.devices.devices.get(id)?.send?.(event); }
  update(s, except) { this.tell(s, { type: 'session', session: this.view(s) }, except); }
  finish(s, reason) { this.tell(s, { type: 'session-end', sid: s.sid, reason }); this.items.delete(s.sid); }
  remove(s, id, reason) { s.members.delete(id); this.devices.devices.get(id)?.send?.({ type: 'session-end', sid: s.sid, reason }); this.update(s); }
  member(ctx, id) { const d = this.dev(ctx, id), s = this.of(d.id); if (!s) throw fail(403, NOT_MEMBER); return { d, s }; }
  hostOnly(ctx, id) { const { d, s } = this.member(ctx, id); if (s.host !== d.id) throw fail(403, HOST_ONLY); return { d, s }; }
  host(s) { const h = this.devices.devices.get(s.host); if (!h?.send) throw fail(409, 'Il dispositivo che suona non è collegato.'); return h; }
  open(ctx, b) {
    const d = this.dev(ctx, b.id);
    if (this.of(d.id)) throw fail(409, 'Sei già in una sessione. Escine prima di aprirne un’altra.');
    if (!d.send) throw fail(409, 'Questo dispositivo non è collegato.');
    if (!d.state?.queue.length) throw fail(409, 'Metti in ascolto un brano, poi apri la sessione.');
    if (this.items.size >= 20) throw fail(503, 'Ci sono già troppe sessioni aperte.');
    const used = new Set([...this.items.values()].map(s => s.code)); let code;
    do code = String(this.pick()).padStart(4, '0'); while (used.has(code));
    const s = { sid: randomUUID(), code, home: ctx.home, host: d.id, guestsControl: true, banned: new Set(), members: new Map([[d.id, { name: ctx.profileName }]]) };
    this.items.set(s.sid, s); return this.snapshot(s);
  }
  join(ctx, b) {
    const d = this.dev(ctx, b.id); let s;
    if (typeof b.sid === 'string') s = this.items.get(b.sid);
    else {
      const code = String(b.code ?? '').trim(); if (!/^\d{4}$/.test(code)) throw fail(400, 'Il codice ha 4 cifre.');
      const misses = (this.misses.get(ctx.owner) || []).filter(t => this.now() - t < 60000);
      if (misses.length >= 5) throw fail(429, 'Troppi codici sbagliati. Aspetta un minuto e riprova.');
      s = [...this.items.values()].find(x => x.code === code);
      if (!s || s.home !== ctx.home) { this.misses.set(ctx.owner, [...misses, this.now()]); throw fail(404, 'Non trovo nessuna sessione con questo codice. Controlla le cifre sul dispositivo che suona.'); }
    }
    if (!s || s.home !== ctx.home) throw fail(404, 'Questa sessione non c’è più.');
    const current = this.of(d.id);
    if (current) { if (current === s) return this.snapshot(s); throw fail(409, 'Sei già in un’altra sessione. Escine prima.'); }
    if (s.banned.has(d.id)) throw fail(403, 'Chi ha aperto la sessione ti ha tolto: non puoi rientrare.');
    if (s.members.size >= MAX_PEOPLE) throw fail(409, `La sessione è piena: ci sono già ${MAX_PEOPLE} persone.`);
    s.members.set(d.id, { name: ctx.profileName }); this.update(s, d.id); return this.snapshot(s);
  }
  leave(ctx, b) {
    const d = this.dev(ctx, b.id), s = this.of(d.id); if (!s) return { ok: true };
    if (s.host === d.id) this.finish(s, 'closed'); else { s.members.delete(d.id); this.update(s); }
    return { ok: true };
  }
  end(ctx, b) { const { s } = this.hostOnly(ctx, b.id); this.finish(s, 'closed'); return { ok: true }; }
  kick(ctx, b) {
    const { s } = this.hostOnly(ctx, b.id);
    if (typeof b.member !== 'string' || b.member === s.host || !s.members.has(b.member)) throw fail(404, 'Questa persona non è nella sessione.');
    s.banned.add(b.member); this.remove(s, b.member, 'removed'); return { ok: true };
  }
  setting(ctx, b) {
    const { s } = this.hostOnly(ctx, b.id); if (typeof b.guestsControl !== 'boolean') throw fail(400, 'Impostazione non valida.');
    s.guestsControl = b.guestsControl; this.update(s); return { ok: true };
  }
  control(ctx, b) {
    const { d, s } = this.member(ctx, b.id);
    if (!['play', 'pause', 'next'].includes(b.op)) throw fail(400, 'Nella sessione puoi usare riproduci, pausa e successivo.');
    if (d.id !== s.host && !s.guestsControl) throw fail(403, 'Chi ha aperto la sessione non permette agli ospiti di comandare la musica.');
    return this.devices.dispatch(d.id, this.host(s), b.op, {});
  }
  add(ctx, b) {
    const { d, s } = this.member(ctx, b.id);
    if (!Array.isArray(b.songs) || !b.songs.length || b.songs.length > 20) throw fail(400, 'Scegli da 1 a 20 brani da aggiungere.');
    const host = this.host(s), by = s.members.get(d.id).name, songs = wireSongs(b.songs).map(song => ({ ...song, addedBy: by }));
    if ((host.state?.queue.length || 0) + songs.length > 2000) throw fail(409, 'La coda comune è piena.');
    return this.devices.dispatch(d.id, host, 'enqueue', { songs });
  }
  list(ctx, b) {
    const d = this.dev(ctx, b.id);
    return { sessions: [...this.items.values()].filter(s => s.home === ctx.home).map(s => ({ sid: s.sid, hostName: s.members.get(s.host).name,
      device: this.devices.devices.get(s.host)?.name || '', people: s.members.size, full: s.members.size >= MAX_PEOPLE, mine: s.members.has(d.id) })) };
  }
  mine(ctx, b) { const s = this.of(this.dev(ctx, b.id).id); return s ? this.snapshot(s) : { session: null }; }
  watch(kind, d, info) {
    const s = this.of(d.id);
    if (kind === 'state') {
      for (const x of this.items.values()) if (x.host === d.id) this.tell(x, { type: 'session-state', sid: x.sid, version: d.version, state: info.queueChanged ? d.state : { ...d.state, queue: undefined } }, d.id);
    } else if (s) {
      s.members.get(d.id).since = kind === 'offline' ? this.now() : null;
      if (kind === 'online') d.send?.({ type: 'session', ...this.snapshot(s) });
      this.update(s, d.id);
    }
  }
  sweep() {
    const now = this.now();
    for (const s of [...this.items.values()]) for (const [id, m] of s.members) {
      if (this.devices.devices.get(id)?.send) { m.since = null; continue; }
      m.since ??= now;
      if (now - m.since <= GRACE_MS) continue;
      if (id === s.host) { this.finish(s, 'hostgone'); break; }
      this.remove(s, id, 'absent');
    }
  }
  stop() { this.items.clear(); }
}
