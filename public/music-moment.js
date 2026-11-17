import { dailyRandom, similarity } from './music-logic.js';
export function timeSlot(date = new Date(), timeZone = 'Europe/Rome') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('it-IT', { timeZone, hourCycle: 'h23', hour: '2-digit', weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
  const hour = Number(parts.hour);
  const slot = hour >= 5 && hour < 12 ? { id: 'morning', label: 'mattina luminosa', mood: ['Energia', 'In viaggio'], energia: 50 } : hour < 18 && hour >= 12 ? { id: 'afternoon', label: 'pomeriggio in movimento', mood: ['Grinta', 'Concentrazione'], energia: 65 } : hour >= 18 && hour < 22 ? { id: 'evening', label: 'sera tranquillo', mood: ['Relax', 'Soul e jazz'], energia: 30 } : { id: 'night', label: 'notte quieta', mood: ['Notte', 'Relax'], energia: 15 };
  return { ...slot, key: `${parts.year}-${parts.month}-${parts.day}/${slot.id}`, name: `${parts.weekday[0].toUpperCase()}${parts.weekday.slice(1)} ${slot.label}` };
}
export function momentSongs(catalog, date = new Date()) {
  const slot = timeSlot(date); const random = dailyRandom(slot.key); const seen = new Set();
  const songs = catalog.filter(s => !s.problema && !seen.has(s.id) && seen.add(s.id))
    .map(s => ({ song: s, score: similarity(slot, s) + random() * 0.5 }))
    .sort((a, b) => b.score - a.score).slice(0, 40).map(s => s.song);
  return { ...slot, songs };
}
export async function showMoment(c, generation) {
  const result = await c.api('/api/music/moment'); if (generation !== c.state.musicGeneration) return;
  const root = document.querySelector('#music-results');
  root.replaceChildren(c.el('section', { class: 'moment-heading' }, c.el('p', { class: 'welcome' }, 'IL TUO MOMENTO'), c.el('h2', {}, result.name), c.el('p', { class: 'muted' }, 'La musica di casa segue la giornata. Cambia da sola al mattino, al pomeriggio, alla sera e di notte.'), c.el('button', { class: 'primary', disabled: !result.songs.length, onclick: () => c.setQueue(result.songs) }, 'Ascolta il tuo momento')), c.trackList(result.songs));
  clearInterval(momentTimer); const key = timeSlot().key;
  momentTimer = setInterval(() => {
    if (c.state.musicGeneration !== generation) { clearInterval(momentTimer); return; }
    if (timeSlot().key !== key) c.load('moment');
  }, 15000);
}
let momentTimer;
