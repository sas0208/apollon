import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicDevices, deviceState, homeAddress } from '../lib/music-devices.js';
import { fixture, fakeNavidrome } from './helpers.js';
import { deviceBridge } from '../public/music-device-bridge.js';
import { DeviceClient, deviceConnection } from '../public/music-devices.js';
const state = { queue: [{ id: 'finto', title: 'Brano finto' }], index: 0, position: 3, volume: 0.5, paused: false };
test('dispositivi limitati alla rete locale, senza fidarsi di indirizzi pubblici', () => {
  assert.equal(deviceConnection({ getRandomValues: values => values.fill(42) }), '2a'.repeat(16)); // HTTP LAN has getRandomValues, not randomUUID.
  for (const address of ['127.0.0.1', '192.168.0.10', '10.1.1.2', '172.16.0.1', '::ffff:192.168.0.20', '::1', 'fd12::2', 'fe80::3']) assert.equal(homeAddress(address), true, address);
  for (const address of ['8.8.8.8', '172.15.1.1', '172.32.0.1', '2001:db8::1', 'non valido', '192.168.400.1']) assert.equal(homeAddress(address), false, address);
});
test('dispositivi: due client finti, trasferimento comandi conferme e stato ordinato', () => {
  const hub = new MusicDevices(); const ownerA = {}, ownerB = {}; const a = [], b = [];
  const one = hub.register('demo/bruno', ownerA, { name: 'Telefono finto' }); const two = hub.register('demo/bruno', ownerB, { name: 'TV finta' });
  const closeA = hub.connect('demo/bruno', ownerA, one.id, e => a.push(e)); hub.connect('demo/bruno', ownerB, two.id, e => b.push(e));
  const command = hub.command('demo/bruno', ownerA, { from: one.id, target: two.id, op: 'transfer', payload: state });
  assert.equal(b.at(-1).op, 'transfer'); assert.equal(b.at(-1).payload.queue[0].id, 'finto');
  hub.update('demo/bruno', ownerB, { id: two.id, connection: 'tv', sequence: 2, state, commandId: command.commandId });
  assert.equal(a.at(-1).type, 'ack'); assert.equal(a.at(-2).device.state.position, 3);
  hub.update('demo/bruno', ownerB, { id: two.id, connection: 'tv', sequence: 1, state: { ...state, position: 0 } });
  assert.equal(hub.get('demo/bruno', two.id).state.position, 3);
  hub.update('demo/bruno', ownerB, { id: two.id, connection: 'tv', sequence: 3, state: { ...state, queue: undefined, position: 4 } });
  assert.equal(a.at(-1).device.state.queue, undefined); assert.equal(hub.get('demo/bruno', two.id).state.queue[0].id, 'finto');
  for (const op of ['play', 'pause', 'next', 'previous', 'seek', 'volume', 'queue', 'playIndex']) hub.command('demo/bruno', ownerA, { from: one.id, target: two.id, op, payload: { ...state } });
  assert.throws(() => hub.command('demo/marta', ownerA, { from: one.id, target: two.id, op: 'play' }), /profilo/);
  assert.throws(() => hub.connect('demo/bruno', {}, one.id, () => {}), /profilo/);
  closeA(); assert.equal(hub.list('demo/bruno').find(d => d.id === one.id).online, false);
});
test('dispositivi: ricarica, riconnessione, chiusura, comando scaduto e validazione', () => {
  let now = 0; const hub = new MusicDevices({ now: () => now }); const owner = {}; const events = [];
  const a = hub.register('u/p', owner, { name: 'Uno' }), b = hub.register('u/p', owner, { name: 'Due' });
  const close = hub.connect('u/p', owner, b.id, e => events.push(e));
  hub.command('u/p', owner, { from: a.id, target: b.id, op: 'pause' }); close();
  assert.throws(() => hub.command('u/p', owner, { from: a.id, target: b.id, op: 'play' }), /collegato/);
  assert.equal(hub.register('u/p', owner, { id: b.id, name: 'TV salotto' }).id, b.id);
  now = 11000; const later = []; hub.connect('u/p', owner, b.id, e => later.push(e)); assert.equal(later.some(e => e.type === 'command'), false);
  assert.throws(() => deviceState({ ...state, position: -1 })); assert.throws(() => deviceState({ ...state, index: 0.5 })); assert.throws(() => deviceState({ ...state, volume: 2 }));
  hub.close(); assert.equal(hub.devices.size, 0);
});
test('dispositivi HTTP: SSE locale con due client, cookie richiesto e isolamento profili', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close()); const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  const response = await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const post = (path, data) => f.request(`/api/music/devices/${path}`, { method: 'POST', data: { profile: 'bruno', ...data } });
  const a = await (await post('register', { name: 'Finto A', connection: 'a' })).json(), b = await (await post('register', { name: 'Finto B', connection: 'b' })).json();
  assert.equal((await fetch(`${f.url}/api/music/devices/events?id=${a.id}&profile=bruno`)).status, 401);
  assert.equal((await f.request(`/api/music/devices/events?id=${a.id}&profile=marta`)).status, 404);
  const abortA = new AbortController(), abortB = new AbortController();
  const streams = await Promise.all([a, b].map((d, i) => fetch(`${f.url}/api/music/devices/events?id=${d.id}&profile=bruno`, { headers: { Cookie: cookie }, signal: [abortA, abortB][i].signal })));
  const readers = streams.map(s => s.body.getReader()); const decoder = new TextDecoder();
  try {
    assert.match(streams[0].headers.get('content-type'), /text\/event-stream/);
    await readers[1].read();
    const result = await post('command', { from: a.id, target: b.id, op: 'transfer', payload: state }); assert.equal(result.status, 200);
    let data = ''; const deadline = setTimeout(() => abortB.abort(), 2000);
    try { while (!data.includes('"type":"command"')) data += decoder.decode((await readers[1].read()).value || new Uint8Array()); } finally { clearTimeout(deadline); }
    assert.match(data, /Brano finto/);
    assert.equal((await post('state', { id: b.id, connection: 'b', sequence: 0, state })).status, 200);
    assert.equal((await post('state', { id: b.id, connection: 'vecchia', sequence: 100, state })).status, 409);
    const blocked = await f.request('/api/music/devices/command', { method: 'POST', headers: { Origin: 'http://esterno.invalid' }, data: { profile: 'bruno', from: a.id, target: b.id, op: 'play' } }); assert.equal(blocked.status, 403);
  } finally { abortA.abort(); abortB.abort(); await Promise.allSettled(readers.map(r => r.cancel())); }
});
test('ponte dispositivo: volume posizione e coda sul motore ricevente, autoplay negato spiegato', async () => {
  const audio = { paused: true, duration: 100, currentTime: 0, async play() { this.paused = false; } };
  const c = { state: { queue: [], queueIndex: 0 }, getAudio: () => audio, playback: { setQueue() {}, configure(p) { this.volume = p.volume; }, pause() { audio.paused = true; }, cancelFade() {}, prepareAudio: async () => {}, clear() {} },
    playSong: async (i, o = {}) => { audio.currentTime = o.position || 0; audio.paused = !o.autoplay; }, persistQueue() {}, renderQueue() {} };
  const bridge = deviceBridge(c); await bridge.execute('transfer', state); assert.equal(audio.paused, false); assert.equal(audio.currentTime, 3);
  await bridge.execute('seek', { position: 20 }); assert.equal(audio.currentTime, 20);
  const previousDocument = globalThis.document, volumeInput = {};
  try {
    globalThis.document = { querySelector: selector => selector === '#volume' ? volumeInput : null };
    await bridge.execute('volume', { volume: 0.2 }); assert.equal(c.playback.volume, 0.2); assert.equal(volumeInput.value, 0.2);
  } finally { globalThis.document = previousDocument; }
  await bridge.execute('pause', {}); assert.equal(audio.paused, true);
  c.playSong = async () => {}; await assert.rejects(bridge.execute('transfer', state), /tocca Riproduci/);
  let cleared = 0; c.clearQueue = () => { cleared++; }; await bridge.execute('queue', { ...state, queue: [], index: 0, paused: true }); assert.equal(cleared, 1);
});
test('client dispositivo: comandi seriali/idempotenti, nomi e stato tardivo senza richieste di ritorno', async () => {
  const old = globalThis.sessionStorage; const saved = new Map();
  globalThis.sessionStorage = { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) };
  try {
    const executed = [], ack = [], mirrored = [];
    const c = { key: () => 'u:p', state: { profile: 'p' }, execute: async op => { await Promise.resolve(); executed.push(op); }, mirror: s => mirrored.push(s.position), notify() {} };
    const client = new DeviceClient(c); client.id = 'phone'; client.target = 'tv'; client.status = () => {};
    client.devices = [{ id: 'tv', version: 2, state, online: true }];
    client.event({ type: 'state', device: { id: 'tv', version: 1, state: { ...state, position: 0 }, online: true } });
    assert.equal(mirrored.at(-1), 3);
    client.event({ type: 'state', device: { id: 'tv', version: 3, state: { ...state, queue: undefined, position: 8 }, online: true } });
    assert.equal(client.remote().state.queue[0].id, 'finto'); assert.equal(mirrored.at(-1), 8);
    client.publish = async id => ack.push(id);
    for (const [commandId, op] of [['a', 'play'], ['a', 'play'], ['b', 'pause']]) client.event({ type: 'command', commandId, op, payload: {} });
    await client.chain; assert.deepEqual(executed, ['play', 'pause']); assert.deepEqual(ack, ['a', 'a', 'b']);
    const reloaded = new DeviceClient(c); assert.ok(reloaded.seen.has('a'));
  } finally { globalThis.sessionStorage = old; }
});
