import test from 'node:test';
import assert from 'node:assert/strict';
import { MusicDevices } from '../lib/music-devices.js';
import { MusicSessions, MAX_PEOPLE, GRACE_MS } from '../lib/music-sessions.js';
import { fixture, fakeNavidrome } from './helpers.js';
const queue = [{ id: 'finto', title: 'Brano finto' }];
const state = { queue, index: 0, position: 3, volume: 0.5, paused: false };
// Casa finta: ogni dispositivo ha il proprio proprietario (cookie) e un profilo diverso o uguale.
function house({ picks = [1234, 4321, 7], home = 'casa' } = {}) {
  let now = 0; const devices = new MusicDevices({ now: () => now }); const codes = [...picks];
  const sessions = new MusicSessions(devices, { now: () => now, pick: () => codes.shift() ?? Math.floor(Math.random() * 10000) });
  const add = (profile, name, extra = {}) => {
    const owner = {}, scope = `${extra.home || home}/${profile}`, events = [];
    const d = devices.register(scope, owner, { name, connection: name });
    let close = devices.connect(scope, owner, d.id, e => events.push(e));
    return { id: d.id, events, owner, scope, ctx: { home: extra.home || home, scope, owner, profileName: profile }, close: () => close?.(), reconnect: () => { close = devices.connect(scope, owner, d.id, e => events.push(e)); }, publish: (s = state, sequence = 1) => devices.update(scope, owner, { id: d.id, connection: name, sequence, state: s }) };
  };
  const call = (who, verb, body = {}, method = 'POST') => sessions.handle(verb, method, who.ctx, { id: who.id, ...body });
  return { devices, sessions, add, call, tick: ms => { now += ms; }, now: () => now };
}
const last = (who, type) => who.events.filter(e => e.type === type).at(-1);
test('sessione: serve un brano in ascolto, codice di 4 cifre unico, chi entra con un altro profilo vede stato e partecipanti', () => {
  const h = house({ picks: [7, 7, 4321] }); const tv = h.add('Bruno', 'TV salotto'), marta = h.add('Marta', 'Telefono'), piero = h.add('Piero', 'Tablet');
  assert.throws(() => h.call(tv, 'open'), /brano/);
  tv.publish();
  const open = h.call(tv, 'open'); assert.equal(open.session.code, '0007'); assert.equal(open.session.guestsControl, true); assert.equal(open.state.queue[0].id, 'finto');
  assert.throws(() => h.call(tv, 'open'), /già in una sessione/);
  const second = h.add('Marta', 'Secondo'); second.publish();
  assert.equal(h.call(second, 'open').session.code, '4321'); // 0007 è già in uso
  const joined = h.call(marta, 'join', { code: '0007' });
  assert.deepEqual(joined.session.members.map(m => [m.name, m.host]), [['Bruno', true], ['Marta', false]]); assert.equal(joined.state.index, 0);
  assert.equal(last(tv, 'session').session.members.length, 2); // il proprietario vede subito chi entra
  assert.deepEqual(h.call(piero, 'list', {}, 'GET').sessions.map(s => [s.hostName, s.device, s.people, s.mine]), [['Bruno', 'TV salotto', 2, false], ['Marta', 'Secondo', 1, false]]);
  assert.equal(h.call(piero, 'join', { sid: open.session.sid }).session.members.length, 3);
  tv.publish({ ...state, position: 9 }, 2); assert.equal(last(marta, 'session-state').state.position, 9); assert.equal(last(marta, 'session-state').state.queue, undefined);
  tv.publish({ ...state, queue: [...queue, { id: 'due', title: 'Due' }] }, 3); assert.equal(last(marta, 'session-state').state.queue.length, 2);
  assert.equal(tv.events.some(e => e.type === 'session-state'), false); // chi suona non riceve il proprio stato
  assert.equal(h.call(marta, 'mine', {}, 'GET').session.code, '0007');
});
test('sessione: codice sbagliato spiegato, altra casa esclusa, troppi tentativi e limite di otto persone', () => {
  const h = house({ picks: [1111] }); const tv = h.add('Bruno', 'TV'); tv.publish(); h.call(tv, 'open');
  const guest = h.add('Marta', 'Telefono'), stranger = h.add('Estraneo', 'Altro', { home: 'altra' });
  assert.throws(() => h.call(guest, 'join', { code: '12' }), /4 cifre/);
  assert.throws(() => h.call(guest, 'join', { code: '9999' }), /Non trovo nessuna sessione con questo codice/);
  assert.throws(() => h.call(stranger, 'join', { code: '1111' }), /Non trovo nessuna sessione/); // il codice giusto di un'altra casa non entra
  assert.throws(() => h.call(stranger, 'join', { sid: [...h.sessions.items.keys()][0] }), /non c’è più/);
  for (let i = 0; i < 3; i++) assert.throws(() => h.call(guest, 'join', { code: '9998' }), /Non trovo/);
  assert.throws(() => h.call(guest, 'join', { code: '9997' }), /Non trovo/);
  assert.throws(() => h.call(guest, 'join', { code: '1111' }), /Troppi codici sbagliati/); // anche il codice giusto aspetta
  h.tick(61000); h.call(guest, 'join', { code: '1111' });
  const others = Array.from({ length: MAX_PEOPLE - 2 }, (_, i) => h.add('Ospite', `Ospite ${i}`));
  for (const o of others) h.call(o, 'join', { code: '1111' });
  assert.equal(h.sessions.items.values().next().value.members.size, MAX_PEOPLE);
  const ninth = h.add('Nono', 'Nono'); assert.throws(() => h.call(ninth, 'join', { code: '1111' }), /piena: ci sono già 8 persone/);
});
test('sessione: permessi lato server, interruttore ospiti, brani con nome di chi li aggiunge', () => {
  const h = house({ picks: [2222] }); const tv = h.add('Bruno', 'TV'); tv.publish(); h.call(tv, 'open');
  const guest = h.add('Marta', 'Telefono'), outsider = h.add('Piero', 'Fuori'); h.call(guest, 'join', { code: '2222' });
  for (const verb of ['control', 'add', 'kick', 'setting', 'close']) assert.throws(() => h.call(outsider, verb, { op: 'pause', songs: [{ id: 'x', title: 'X' }], member: tv.id, guestsControl: false }), /Non fai parte|Solo chi/, verb);
  assert.equal(h.call(outsider, 'mine', {}, 'GET').session, null);
  tv.events.length = 0; h.call(guest, 'control', { op: 'next' }); assert.equal(tv.events.at(-1).op, 'next');
  assert.throws(() => h.call(guest, 'control', { op: 'previous' }), /riproduci, pausa e successivo/);
  assert.throws(() => h.call(guest, 'control', { op: 'transfer' }), /riproduci/);
  for (const verb of ['kick', 'setting', 'close']) assert.throws(() => h.call(guest, verb, { member: tv.id, guestsControl: false }), /Solo chi ha aperto/, verb);
  assert.throws(() => h.call(tv, 'setting', { guestsControl: 'no' }), /non valida/);
  h.call(tv, 'setting', { guestsControl: false }); assert.equal(last(guest, 'session').session.guestsControl, false);
  assert.throws(() => h.call(guest, 'control', { op: 'pause' }), /non permette agli ospiti/);
  h.call(tv, 'control', { op: 'pause' }); // chi ha aperto comanda sempre
  h.call(guest, 'add', { songs: [{ id: 'nuovo', title: 'Nuovo', artist: 'Lei', addedBy: 'Falso', percorso: '/segreto' }] }); // aggiungere resta permesso
  const command = tv.events.at(-1); assert.equal(command.op, 'enqueue'); assert.deepEqual(command.payload.songs, [{ id: 'nuovo', title: 'Nuovo', artist: 'Lei', addedBy: 'Marta' }]);
  assert.throws(() => h.call(guest, 'add', { songs: [] }), /1 a 20/); assert.throws(() => h.call(guest, 'add', { songs: Array(21).fill({ id: 'a', title: 'A' }) }), /1 a 20/);
  // La porta pubblica dei comandi non conosce enqueue: i brani passano solo dalla sessione.
  assert.throws(() => h.devices.command(guest.scope, guest.owner, { from: guest.id, target: guest.id, op: 'enqueue', payload: {} }), /Comando non disponibile/);
});
test('sessione: togliere, uscire, chiudere e rientro negato a chi è stato tolto', () => {
  const h = house({ picks: [3333] }); const tv = h.add('Bruno', 'TV'); tv.publish(); const sid = h.call(tv, 'open').session.sid;
  const a = h.add('Marta', 'A'), b = h.add('Piero', 'B'); h.call(a, 'join', { code: '3333' }); h.call(b, 'join', { code: '3333' });
  assert.throws(() => h.call(tv, 'kick', { member: tv.id }), /non è nella sessione/);
  h.call(tv, 'kick', { member: a.id }); assert.equal(last(a, 'session-end').reason, 'removed'); assert.equal(last(tv, 'session').session.members.length, 2);
  assert.throws(() => h.call(a, 'join', { code: '3333' }), /tolto/); assert.throws(() => h.call(a, 'control', { op: 'pause' }), /Non fai parte/);
  h.call(b, 'leave'); assert.equal(h.sessions.items.get(sid).members.size, 1); h.call(b, 'leave'); // uscire due volte non fa danni
  h.call(b, 'join', { code: '3333' }); h.call(tv, 'close'); assert.equal(last(b, 'session-end').reason, 'closed'); assert.equal(h.sessions.items.size, 0);
  assert.throws(() => h.call(b, 'join', { code: '3333' }), /Non trovo/);
});
test('sessione: si chiude da sola dopo 2 minuti col dispositivo che suona scollegato (orologio finto)', () => {
  const h = house({ picks: [4444] }); const tv = h.add('Bruno', 'TV'); tv.publish(); h.call(tv, 'open');
  const guest = h.add('Marta', 'Telefono'); h.call(guest, 'join', { code: '4444' });
  tv.close(); assert.equal(last(guest, 'session').session.members[0].online, false);
  h.tick(GRACE_MS - 1000); h.sessions.sweep(); assert.equal(h.sessions.items.size, 1);
  tv.reconnect(); assert.equal(last(tv, 'session').session.code, '4444'); // rientra in tempo: la sessione c'è ancora
  h.tick(GRACE_MS * 2); h.sessions.sweep(); assert.equal(h.sessions.items.size, 1);
  tv.close(); h.tick(GRACE_MS - 1); h.sessions.sweep(); assert.equal(h.sessions.items.size, 1);
  h.tick(2); h.sessions.sweep(); assert.equal(h.sessions.items.size, 0); assert.equal(last(guest, 'session-end').reason, 'hostgone');
  assert.equal(h.call(guest, 'mine', {}, 'GET').session, null);
});
test('sessione: un ospite assente da oltre 2 minuti libera il posto', () => {
  const h = house({ picks: [5555] }); const tv = h.add('Bruno', 'TV'); tv.publish(); h.call(tv, 'open');
  const guest = h.add('Marta', 'Telefono'); h.call(guest, 'join', { code: '5555' }); guest.close();
  h.tick(GRACE_MS + 1); h.sessions.sweep(); assert.equal(last(tv, 'session').session.members.length, 1);
});
test('sessione HTTP: stesso canale e cookie, profili diversi nella stessa casa, ospite senza accesso respinto', async t => {
  const nav = await fakeNavidrome(); t.after(() => nav.close()); const f = await fixture({ navidromeUrl: nav.url }); t.after(() => f.close());
  const login = await f.request('/api/music/login', { method: 'POST', data: { username: 'demo', password: 'finta' } }); const cookie = login.headers.get('set-cookie').split(';')[0];
  const post = (path, data, profile = 'bruno') => f.request(`/api/music/devices/${path}`, { method: 'POST', data: { profile, ...data } });
  const tv = await (await post('register', { name: 'TV finta', connection: 'tv' })).json(), phone = await (await post('register', { name: 'Telefono finto', connection: 'ph' }, 'marta')).json();
  const abort = new AbortController(); const stream = await fetch(`${f.url}/api/music/devices/events?id=${phone.id}&profile=marta`, { headers: { Cookie: cookie }, signal: abort.signal });
  const reader = stream.body.getReader(); t.after(() => { abort.abort(); reader.cancel().catch(() => {}); });
  const tvStream = new AbortController(); await fetch(`${f.url}/api/music/devices/events?id=${tv.id}&profile=bruno`, { headers: { Cookie: cookie }, signal: tvStream.signal }); t.after(() => tvStream.abort());
  assert.equal((await post('session/open', { id: tv.id })).status, 409);
  assert.equal((await post('state', { id: tv.id, connection: 'tv', sequence: 0, state })).status, 200);
  const opened = await (await post('session/open', { id: tv.id })).json(); assert.match(opened.session.code, /^\d{4}$/);
  assert.equal((await fetch(`${f.url}/api/music/devices/session/list?id=${phone.id}&profile=marta`)).status, 401); // senza accesso musicale
  const wrong = await post('session/join', { id: phone.id, code: opened.session.code === '0000' ? '0001' : '0000' }, 'marta'); assert.equal(wrong.status, 404); assert.match((await wrong.json()).error, /codice/);
  const list = await (await f.request(`/api/music/devices/session/list?id=${phone.id}&profile=marta`)).json(); assert.equal(list.sessions[0].hostName, 'Bruno');
  assert.equal((await post('session/join', { id: tv.id, code: opened.session.code }, 'marta')).status, 404); // il dispositivo è di un altro profilo
  const joined = await post('session/join', { id: phone.id, code: opened.session.code }, 'marta'); assert.equal(joined.status, 200);
  assert.equal((await post('session/control', { id: phone.id, op: 'pause' }, 'marta')).status, 200);
  assert.equal((await post('session/kick', { id: phone.id, member: tv.id }, 'marta')).status, 403);
  assert.equal((await f.request('/api/music/devices/session/open', { method: 'POST', headers: { Origin: 'http://esterno.invalid' }, data: { profile: 'bruno', id: tv.id } })).status, 403);
  assert.equal((await post('state', { id: tv.id, connection: 'tv', sequence: 1, state: { ...state, queue: undefined, position: 8 } })).status, 200);
  let data = ''; const deadline = setTimeout(() => abort.abort(), 2000);
  try { while (!data.includes('"type":"session-state"')) data += new TextDecoder().decode((await reader.read()).value || new Uint8Array()); } finally { clearTimeout(deadline); }
  assert.match(data, /"type":"session-state"/); assert.doesNotMatch(data, /percorso|\/segreto/);
});
