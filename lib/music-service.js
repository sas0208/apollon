import { fail, text, idFor } from './util.js';
import { smartQueue, dailyRandom } from '../public/music-logic.js';
import { recommendations } from './music-discovery.js';
import { momentSongs } from '../public/music-moment.js';
import { musicRecap } from '../public/music-recap.js';
import { blend } from './music-blend.js';

export class MusicService {
  constructor(music, catalog, store) { Object.assign(this, { music, catalog, store }); }
  user(auth) { return this.store.data.music?.[idFor(auth.u)] || { stats: {}, history: [], submissions: [] }; }
  async liked(auth) { return (await this.music.request('getStarred2', auth)).starred2?.song || []; }
  async library(auth) {
    const [songs, lists] = await Promise.all([this.catalog.songs(this.music, auth), this.music.request('getPlaylists', auth)]);
    const items = (lists.playlists?.playlist || []).map(p => ({ ...p, type: 'playlist', artist: p.owner || '' }));
    for (const [type, idField, nameField] of [['album', 'albumId', 'album'], ['artist', 'artistId', 'artist']]) {
      const groups = new Map();
      for (const s of songs) if (s[idField]) {
        const old = groups.get(s[idField]);
        if (!old) groups.set(s[idField], { type, id: s[idField], name: s[nameField], artist: type === 'album' ? s.artist : '', coverArt: s.coverArt, created: s.created, last: s.played });
        else { if (Date.parse(s.created) > (Date.parse(old.created) || 0)) old.created = s.created; if (Date.parse(s.played) > (Date.parse(old.last) || 0)) old.last = s.played; }
      }
      items.push(...groups.values());
    }
    return { items, total: songs.length };
  }
  async songs(auth) {
    const all = await this.catalog.songs(this.music, auth); const keep = ['id', 'title', 'artist', 'artistId', 'album', 'albumId', 'coverArt', 'duration', 'created', 'track'];
    return { total: all.length, songs: all.map(s => Object.fromEntries(keep.filter(k => s[k] !== undefined).map(k => [k, s[k]]))) };
  }
  async recommendations(auth, b) {
    for (const key of ['ids', 'exclude']) if (!Array.isArray(b[key]) || b[key].length > 2000 || b[key].some(id => typeof id !== 'string' || id.length > 250)) throw fail(400, 'Selezione di brani non valida.');
    return { songs: recommendations(await this.catalog.enriched(this.music, auth), b.ids, b) };
  }
  async moment(auth) { return momentSongs(await this.catalog.enriched(this.music, auth)); }
  async played(auth, b) {
    if (b.user !== undefined && b.user !== auth.u) throw fail(401, 'Accedi con il profilo musicale degli ascolti salvati.');
    this.store.profile(b.profile); const id = text(b.id), playId = text(b.playId, 100);
    if (!Number.isFinite(b.seconds) || b.seconds < 0 || b.seconds > 86400) throw fail(400, 'Durata di ascolto non valida.');
    const previousEvent = this.store.data.musicActivity?.[`${idFor(auth.u)}/${b.profile}`]?.find(e => e.playId === playId);
    const song = previousEvent?.song || (await this.catalog.enriched(this.music, auth)).find(s => s.id === id); if (!song) throw fail(404, 'Brano non trovato.');
    return this.store.change(d => {
      d.musicActivity ||= {}; const key = `${idFor(auth.u)}/${b.profile}`; const events = d.musicActivity[key] ||= [];
      const previous = events.find(e => e.playId === playId);
      if (previous) { if (previous.id !== id) throw fail(400, 'Ascolto non valido.'); previous.seconds = Math.max(previous.seconds, b.seconds); }
      else events.push({ id, playId, seconds: b.seconds, at: Number.isFinite(b.at) && b.at > Date.now() - 366 * 86400000 && b.at <= Date.now() ? b.at : Date.now(), song: { title: song.title, artist: song.artist, genre: song.genere || song.genre, mood: song.mood } });
      if (events.length > 20000) events.splice(0, events.length - 20000);
      return { ok: true };
    });
  }
  async recap(auth, profile, period) {
    this.store.profile(profile); if (!/^\d{4}(-(?:0[1-9]|1[0-2]))?$/.test(period)) throw fail(400, 'Scegli un mese o un anno.');
    return musicRecap(this.store.data.musicActivity?.[`${idFor(auth.u)}/${profile}`] || [], await this.catalog.enriched(this.music, auth), period);
  }
  async blend(auth, profile, other) {
    this.store.profile(profile); this.store.profile(other);
    if (profile === other) throw fail(400, 'Scegli un altro profilo della casa.');
    const events = id => this.store.data.musicActivity?.[`${idFor(auth.u)}/${id}`] || [];
    const [catalog, liked] = await Promise.all([this.catalog.enriched(this.music, auth), this.liked(auth)]);
    const day = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }), name = id => this.store.data.profiles.find(p => p.id === id).name;
    return { day, profiles: { mine: name(profile), other: name(other) },
      ...blend({ mine: events(profile), other: events(other), catalog, starred: liked.map(s => s.id), seed: `${day}/${[profile, other].sort().join('/')}` }) };
  }
  async details(auth, id) {
    const songs = await this.catalog.enriched(this.music, auth); const song = songs.find(s => s.id === id);
    if (!song) throw fail(404, 'Brano non trovato nella raccolta.');
    let artist;
    if (song.artistId) {
      try { artist = (await this.music.request('getArtist', auth, { id: song.artistId })).artist; }
      catch { /* The track facts remain useful if the artist endpoint is unavailable. */ }
    }
    return { song: { id, album: song.catalogAlbum || song.album, year: song.catalogYear || song.year, genre: song.genere || song.genre,
      mood: song.mood, bpm: song.bpm, tonalita: song.tonalita, energia: song.energia, duration: song.duration,
      format: song.suffix || song.contentType, bitRate: song.bitRate },
      artist: { id: song.artistId, name: artist?.name || song.artist || 'Artista sconosciuto', coverArt: artist?.coverArt || song.coverArt,
        songCount: songs.filter(s => song.artistId ? s.artistId === song.artistId : s.artist === song.artist).length } };
  }
  async select(auth, options) {
    if (!['radio', 'shuffle', 'mix', 'rediscover'].includes(options.kind)) throw fail(400, 'Scegli radio, mix o mescola.');
    if (options.exclude !== undefined && (!Array.isArray(options.exclude) || options.exclude.length > 2000 || options.exclude.some(id => typeof id !== 'string'))) throw fail(400, 'Sessione di ascolto troppo lunga: avviane una nuova.');
    let [songs, liked] = await Promise.all([this.catalog.enriched(this.music, auth), this.liked(auth)]);
    const stars = new Set(liked.map(s => s.id)); songs = songs.map(s => ({ ...s, starred: stars.has(s.id) }));
    const seed = songs.find(s => s.id === options.seed) || (options.artist ? songs.find(s => s.artistId === options.artist || s.artist === options.artist) : undefined); const stats = this.user(auth).stats;
    if ((options.seed || options.artist) && !seed) return { songs: [] };
    if (options.ids !== undefined) {
      if (!Array.isArray(options.ids) || options.ids.length > 2000 || options.ids.some(id => typeof id !== 'string')) throw fail(400, 'Selezione troppo grande.');
      const ids = new Set(options.ids); songs = songs.filter(s => ids.has(s.id));
    }
    if (options.mood) songs = songs.filter(s => s.mood?.includes(options.mood));
    if (options.kind === 'rediscover') songs = songs.filter(s => s.starred && (!stats[s.id]?.last || Date.now() - stats[s.id].last > 14 * 86400000));
    const first = options.kind === 'radio' && seed && songs.some(s => s.id === seed.id) && !(options.exclude || []).includes(seed.id) ? [seed] : [];
    return { songs: [...first, ...smartQueue(songs, { stats, seed, exclude: [...(options.exclude || []), ...first.map(s => s.id)], limit: options.ids ? options.ids.length : 40 - first.length,
      ...(options.kind === 'mix' ? { random: dailyRandom(`${auth.u}/${new Date().toISOString().slice(0, 10)}/${options.mood || ''}`) } : {}) })] };
  }
  async activity(auth) {
    const user = this.user(auth); const songs = await this.catalog.songs(this.music, auth); const byId = new Map(songs.map(s => [s.id, s]));
    const resolve = entries => entries.slice(0, 200).filter(e => byId.has(e.id)).map(e => ({ ...byId.get(e.id), ...e }));
    const unique = new Map(); for (const e of user.history) if (!unique.has(e.id)) unique.set(e.id, e);
    return { recent: resolve([...unique.values()]), history: resolve(user.history),
      top: resolve(Object.entries(user.stats).map(([id, value]) => ({ id, ...value })).sort((a, b) => b.count - a.count || b.last - a.last)) };
  }
  async listen(auth, b) {
    const id = text(b.id); const playId = text(b.playId, 100);
    if (typeof b.submission !== 'boolean') throw fail(400, 'Ascolto non valido.');
    const key = `${playId}/${id}/${b.submission}`;
    if (this.user(auth).submissions.includes(key)) return { ok: true };
    if (!(await this.catalog.songs(this.music, auth)).some(s => s.id === id)) throw fail(404, 'Brano non trovato.');
    await this.music.request('scrobble', auth, { id, submission: b.submission, ...(b.submission ? { time: Date.now() } : {}) });
    await this.store.change(d => {
      d.music ||= {}; const user = d.music[idFor(auth.u)] ||= { stats: {}, history: [], submissions: [] };
      user.submissions = [key, ...user.submissions].slice(0, 2000);
      if (!b.submission) return;
      const last = Date.now(); const previous = user.stats[id]; user.stats[id] = { count: (previous?.count || 0) + 1, last };
      user.history = [{ id, last }, ...user.history].slice(0, 500);
      if (Object.keys(user.stats).length > 5000) { const oldest = Object.keys(user.stats).sort((a, b) => user.stats[a].last - user.stats[b].last)[0]; delete user.stats[oldest]; }
    });
    return { ok: true };
  }
}
