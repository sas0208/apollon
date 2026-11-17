import test from 'node:test';
import assert from 'node:assert/strict';
import { timeSlot, momentSongs } from '../public/music-moment.js';
const at = (hour, minute = '00') => new Date(`2026-11-05T${hour}:${minute}:00+01:00`);
test('momento: confini delle quattro fasce, mezzanotte, giorno e ora italiana', () => {
  for (const [hour, id] of [['04', 'night'], ['05', 'morning'], ['11', 'morning'], ['12', 'afternoon'], ['17', 'afternoon'], ['18', 'evening'], ['21', 'evening'], ['22', 'night'], ['00', 'night']]) assert.equal(timeSlot(at(hour)).id, id);
  assert.match(timeSlot(at('19')).name, /Giovedì sera tranquillo/);
  assert.notEqual(timeSlot(at('04')).key, timeSlot(at('05')).key);
  assert.equal(timeSlot(new Date('2026-07-05T03:00:00Z')).id, 'morning');
});
test('momento: affinità della fascia, stabilità, nessun problema o doppione', () => {
  const songs = [{ id: 'quiet', mood: ['Notte', 'Relax'], energia: 15 }, { id: 'fast', mood: ['Grinta'], energia: 65 }, { id: 'bad', problema: true }];
  assert.equal(momentSongs(songs, at('23')).songs[0].id, 'quiet');
  assert.equal(momentSongs(songs, at('14')).songs[0].id, 'fast');
  assert.deepEqual(momentSongs(songs, at('23')), momentSongs(songs, at('23')));
  assert.equal(momentSongs([...songs, songs[0]], at('23')).songs.length, 2);
});
