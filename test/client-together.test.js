import test from 'node:test';
import assert from 'node:assert/strict';
import { DeviceClient } from '../public/music-devices.js';
import { deviceBridge } from '../public/music-device-bridge.js';
import { Together, addedLabel, canControl, endMessage, queueSignature, spacedCode } from '../public/music-session.js';
const song = { id: 'a', title: 'Uno' }, added = { id: 'b', title: 'Due', addedBy: 'Marta' };
const view = (extra = {}) => ({ sid: 's1', code: '0420', host: 'tv', guestsControl: true, max: 8, members: [{ id: 'tv', name: 'Bruno', host: true, online: true }, { id: 'tel', name: 'Marta', host: false, online: true }], ...extra });
function guestClient() {
  const old = globalThis.sessionStorage, saved = new Map(); globalThis.sessionStorage = { getItem: k => saved.get(k) || null, setItem: (k, v) => saved.set(k, v) };
  const log = { mirror: [], notify: [], paused: 0, posts: [] };
  const c = { key: () => 'u:p', state: { profile: 'p', queue: [] }, mirror: s => log.mirror.push(s), notify: (m, bad) => log.notify.push([m, bad]), pauseLocal: () => { log.paused++; }, execute: async () => {} };
  const client = new DeviceClient(c); client.id = 'tel'; client.target = 'tel'; client.profile = 'p'; client.status = () => {};
  client.post = async (path, data) => { log.posts.push([path, data]); return {}; };
  return { client, log, restore: () => { globalThis.sessionStorage = old; } };
}
test('ospite: entra, mette in pausa la musica locale, vede cosa suona e la coda con chi ha aggiunto i brani', async () => {
  const { client, log, restore } = guestClient();
  try {
    assert.equal(client.isRemote(), false);
    client.event({ type: 'session', session: view(), state: { queue: [song, added], index: 1, paused: false, position: 5, volume: 0.6 } });
    assert.equal(client.guestOf, 's1'); assert.equal(client.isRemote(), true);
    const together = await client.loadTogether();
    assert.equal(log.paused, 1); assert.equal(log.mirror.at(-1).queue[1].addedBy, 'Marta'); assert.equal(log.mirror.at(-1).volume, 0.6);
    client.event({ type: 'session-state', sid: 's1', version: 2, state: { index: 0, paused: true, position: 9, volume: 0.6, queue: undefined } });
    await client.togetherReady; await new Promise(r => setTimeout(r));
    assert.equal(together.state.queue.length, 2); assert.equal(log.mirror.at(-1).index, 0); assert.equal(log.mirror.at(-1).paused, true);
    together.event({ type: 'session-state', sid: 'altra', version: 9, state: { index: 1, paused: false, queue: [] } }); assert.equal(together.state.index, 0); // sessione diversa ignorata
    together.event({ type: 'session-state', sid: 's1', version: 1, state: { index: 1, paused: false, queue: undefined } }); assert.equal(together.state.index, 0); // stato vecchio ignorato
    await assert.rejects(client.send('pause'), /Ascoltiamo insieme/); // i comandi fuori dalla sessione non partono
  } finally { restore(); }
});
test('ospite: il lettore comanda la sessione solo con play, pausa e successivo; altri controlli non partono', async () => {
  const { client, log, restore } = guestClient();
  try {
    client.event({ type: 'session', session: view(), state: { queue: [song], index: 0, paused: true, position: 0, volume: 1 } }); await client.loadTogether();
    const press = (id, type = 'click') => { let stopped = 0; client.intercept({ type, target: { id, value: '3', closest: () => ({ id, value: '3' }) }, preventDefault() {}, stopImmediatePropagation() { stopped++; } }); return stopped; };
    assert.equal(press('audio-toggle'), 1); assert.deepEqual(log.posts.at(-1), ['session/control', { id: 'tel', op: 'play' }]);
    client.together.state.paused = false; press('full-toggle'); assert.equal(log.posts.at(-1)[1].op, 'pause');
    assert.equal(press('audio-next'), 1); assert.equal(log.posts.at(-1)[1].op, 'next');
    const before = log.posts.length; assert.equal(press('volume', 'input'), 0); assert.equal(press('audio-seek', 'input'), 0); assert.equal(log.posts.length, before);
    client.event({ type: 'session-end', sid: 's1', reason: 'hostgone' }); await new Promise(r => setTimeout(r));
    assert.equal(client.guestOf, ''); assert.equal(client.isRemote(), false); assert.match(log.notify.at(-1)[0], /rimasto scollegato/); assert.equal(log.mirror.at(-1).queue.length, 0);
  } finally { restore(); }
});
test('chi apre la sessione continua a suonare in locale: nessuno stato da ospite', async () => {
  const { client, log, restore } = guestClient();
  try {
    client.event({ type: 'session', session: view({ host: 'tel' }), state: { queue: [song], index: 0, paused: false, position: 0, volume: 1 } }); await client.loadTogether();
    assert.equal(client.guestOf, ''); assert.equal(client.isRemote(), false); assert.equal(log.paused, 0); assert.equal(log.mirror.length, 0);
  } finally { restore(); }
});
test('aiuti della sessione: messaggi, etichette, permessi e firma della coda', () => {
  assert.match(endMessage('removed'), /tolto/); assert.match(endMessage('boh'), /finita/);
  assert.equal(addedLabel(added), 'Aggiunto da Marta'); assert.equal(addedLabel(song), ''); assert.equal(spacedCode('0420'), '0 4 2 0');
  assert.equal(canControl(view(), 'tel'), true); assert.equal(canControl(view({ guestsControl: false }), 'tel'), false); assert.equal(canControl(view({ guestsControl: false }), 'tv'), true); assert.equal(canControl(null, 'tv'), false);
  assert.notEqual(queueSignature({ index: 0, paused: true, queue: [song] }), queueSignature({ index: 0, paused: true, queue: [added] })); assert.equal(queueSignature(null), '');
  assert.ok(Together);
});
test('ponte: i brani aggiunti dagli ospiti entrano in coda con il loro nome e, a coda vuota, partono', async () => {
  const played = []; const c = { state: { queue: [song], queueIndex: 0 }, getAudio: () => ({ paused: false }), playback: { configure() {}, pause() {} }, playSong: async (i, o) => played.push([i, o]), persistQueue() {}, renderQueue() {} };
  const bridge = deviceBridge(c); await bridge.execute('enqueue', { songs: [added] });
  assert.deepEqual(c.state.queue.map(s => s.addedBy), [undefined, 'Marta']); assert.equal(played.length, 0);
  c.state.queue = []; await bridge.execute('enqueue', { songs: [added] }); assert.deepEqual(played, [[0, { autoplay: true }]]);
});
