import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { stat } from 'node:fs/promises';
import { createApp, APP_DIR } from '../server.js';
import { sendFile } from '../lib/media.js';
import { demoPort, listenForTest } from './test-ports.js';
import { prepareDemoMusic, demoLyrics } from './demo-music.js';
import { demoCover } from './demo-covers.js';
import { demoFiles, episodeDescription, DEMO_SEED } from './demo-catalog.js';
import { idFor } from '../lib/util.js';

// Giro F: generi, trame e sigle del catalogo finto, poi un po' di «Continua a guardare» e «La mia lista» per il primo profilo.
// Si rifà a ogni avvio: i test possono sporcare lo stato della demo, la demo riparte sempre uguale.
export async function seedDemo(app) {
  const byId = new Map(demoFiles().map(f => [idFor(`${f.root}/${f.rel}`), f]));
  const changes = app.library.items.map(item => {
    const f = byId.get(item.id); const reset = { imagePath: '', poster: null, backdrop: null };
    if (!f) return { id: item.id, patch: { genres: item.root === 'Anime' ? ['Avventura', 'Famiglia'] : ['Famiglia'], ...reset } };
    const intro = f.test ? { introStart: 1, introEnd: 3 } : f.kind === 'episode' && f.episode > 1 ? (f.root === 'Anime' ? { introStart: 85, introEnd: 175 } : { introStart: 40, introEnd: 95 }) : {};
    return { id: item.id, patch: { genres: f.meta.genres, description: f.kind === 'film' ? f.meta.description : episodeDescription(f),
      ...(f.kind === 'episode' ? { seriesDescription: f.meta.description } : {}), ...intro, ...reset } };
  });
  if (changes.length) await app.store.editMany(changes);
  const find = rel => app.library.items.find(i => i.path === rel);
  for (const [rel, share, watched] of DEMO_SEED.progress) {
    const item = find(rel); if (!item?.duration) continue;
    await app.store.progress('bruno', item.id, { position: Math.round(item.duration * share), duration: item.duration, watched: !!watched });
  }
  for (const key of DEMO_SEED.list) {
    const item = find(key.rel); if (!item) continue;
    await app.store.setListed('bruno', item.series ? `s:${item.root}/${item.series}` : `f:${item.id}`, true);
  }
}

export async function startDemo({ port = 8873, metadata = true } = {}) {
  demoPort(port);
  const base = path.join(APP_DIR, 'demo-data');
  await stat(path.join(base, 'Film')).catch(() => { throw new Error('Prima prepara i file finti: npm run demo:crea'); });
  const songs = await prepareDemoMusic(path.join(base, 'Musica'));
  let playlists = [{ id: 'demo-playlist', name: 'Un momento tranquillo', entry: songs.slice(0, 2), songCount: 2 },
    { id: 'demo-playlist-sera', name: 'Strada di sera', entry: [songs[2], songs[0]], songCount: 2 }, { id: 'demo-playlist-colazione', name: 'Colazione lenta', entry: [songs[1], songs[2], songs[0]], songCount: 3 }];
  const album = { id: 'demo-album', name: 'Una stanza tutta nostra', artist: 'Suoni di prova', artistId: 'demo-artist', coverArt: 'demo-cover', songCount: songs.length, song: songs, year: 2026 };
  const nav = http.createServer((req, res) => {
    (async () => {
      const url = new URL(req.url, 'http://localhost'); const method = url.pathname.split('/').at(-1).replace('.view', '');
      if (req.method === 'POST') { let form = ''; for await (const chunk of req) form += chunk; for (const [key, value] of new URLSearchParams(form)) url.searchParams.append(key, value); }
      if (method === 'stream') return sendFile(req, res, path.join(base, 'Musica', 'Luce di casa.wav'));
      if (method === 'getCoverArt') { res.setHeader('Content-Type', 'image/png'); return res.end(demoCover(url.searchParams.get('id') || 'demo')); }
      const songIds = url.searchParams.getAll('songId'); const id = url.searchParams.get('id'); const playlistId = url.searchParams.get('playlistId');
      if (method === 'createPlaylist') {
        const p = { id: playlistId || `demo-${Date.now()}`, name: url.searchParams.get('name'), entry: songIds.map(s => songs.find(song => song.id === s)).filter(Boolean), songCount: songIds.length };
        playlists = [...playlists.filter(old => old.id !== p.id), p];
      }
      if (method === 'deletePlaylist') playlists = playlists.filter(p => p.id !== id);
      if (method === 'updatePlaylist') {
        const p = playlists.find(p => p.id === playlistId);
        if (p) {
          if (url.searchParams.has('name')) p.name = url.searchParams.get('name');
          const remove = new Set(url.searchParams.getAll('songIndexToRemove').map(Number));
          p.entry = p.entry.filter((_, i) => !remove.has(i));
          p.entry.push(...url.searchParams.getAll('songIdToAdd').map(id => songs.find(s => s.id === id)).filter(Boolean)); p.songCount = p.entry.length;
        }
      }
      if (method === 'star') { const s = songs.find(s => s.id === id); if (s) s.starred = '2026-11-04'; }
      if (method === 'unstar') { const s = songs.find(s => s.id === id); if (s) delete s.starred; }
      const data = { ping: {}, getArtists: { artists: { index: [{ name: 'S', artist: [{ id: 'demo-artist', name: 'Suoni di prova', albumCount: 1 }] }] } },
        getArtist: { artist: { id: 'demo-artist', name: 'Suoni di prova', coverArt: 'demo-cover', album: [album] } }, getAlbum: { album },
        getAlbumList2: { albumList2: { album: Number(url.searchParams.get('offset') || 0) === 0 ? [album] : [] } },
        search3: { searchResult3: { song: songs.slice(Number(url.searchParams.get('songOffset') || 0), Number(url.searchParams.get('songOffset') || 0) + Number(url.searchParams.get('songCount') || 100)), album: [album], artist: [] } },
        getLyricsBySongId: demoLyrics(id), star: {}, unstar: {}, scrobble: {}, updatePlaylist: {}, getStarred2: { starred2: { song: songs.filter(s => s.starred) } },
        getPlaylists: { playlists: { playlist: playlists } }, getPlaylist: { playlist: playlists.find(p => p.id === id) }, createPlaylist: { playlist: playlists.at(-1) }, deletePlaylist: {} };
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ 'subsonic-response': { status: 'ok', version: '1.16.1', ...data[method] } }));
    })().catch(() => { res.statusCode = 500; res.end(); });
  });
  await listenForTest(nav, { exclude: [port] });
  let app;
  const closeNav = async () => { nav.closeAllConnections(); if (nav.listening) await new Promise(resolve => nav.close(resolve)); };
  try {
    app = await createApp({ port, host: '127.0.0.1', mode: 'video', roots: Object.fromEntries(['Film', 'Anime', 'Musica', 'File'].map(name => [name, path.join(base, name)])),
      dataDir: path.join(base, 'state'), adminKey: 'casa-demo', seedProfiles: [{ id: 'bruno', name: 'Bruno' }, { id: 'marta', name: 'Marta' }, { id: 'piero', name: 'Piero' }], navidromeUrl: `http://127.0.0.1:${nav.address().port}`, demo: true, metadata, metadataDelayMs: 1000,
      // La demo è sempre uguale a se stessa: i salti e le copertine automatiche (che usano ffmpeg e fpcalc) si accendono solo a richiesta.
      autoSkips: process.env.MEDIATECA_DEMO_AUTO === '1', autoMusicArt: process.env.MEDIATECA_DEMO_AUTO === '1' });
    await seedDemo(app);
    await app.listen();
    return { app, async close() { try { await app.close(); } finally { await closeNav(); } } };
  } catch (error) { try { await app?.close(); } finally { await closeNav(); } throw error; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const demo = await startDemo({ port: portArg === undefined ? 8873 : Number(portArg), metadata: !process.argv.includes('--no-metadata') });
  console.log(`Demo: http://127.0.0.1:${demo.app.server.address().port}\nChiave finta: casa-demo. Musica: qualsiasi utente/password finti.\nQuesta demo contiene soltanto barre colorate e toni.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await demo.close(); process.exit(0); });
}
