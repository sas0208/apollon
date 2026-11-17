import path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { APP_DIR, createApp } from '../server.js';
import http from 'node:http';
import { listenForTest } from '../scripts/test-ports.js';
import { demoLyrics } from '../scripts/demo-music.js';

// I test simulano una casa già avviata: tre profili esistenti (come le installazioni fatte prima del 6/11/2026).
export const HOME_PROFILES = [{ id: 'bruno', name: 'Bruno' }, { id: 'marta', name: 'Marta' }, { id: 'piero', name: 'Piero' }];
export async function fixture(options = {}) {
  const output = path.join(APP_DIR, 'output', 'tests'); await mkdir(output, { recursive: true });
  const dir = await mkdtemp(path.join(output, 'caso-'));
  const roots = Object.fromEntries(['Film', 'Anime', 'Musica', 'File'].map(n => [n, path.join(dir, n)]));
  for (const root of Object.values(roots)) await mkdir(root);
  const app = await createApp({ dataDir: path.join(dir, 'state'), roots, adminKey: 'chiave-finta-test', metadata: false, autoSkips: false, autoMusicArt: false, smartFrames: false, seedProfiles: HOME_PROFILES, ...options });
  try { await listenForTest(app.server); }
  catch (error) { await app.close(); await rm(dir, { recursive: true, force: true }); throw error; }
  const url = `http://127.0.0.1:${app.server.address().port}`; let cookie = '';
  async function request(route, { method = 'GET', data, headers = {}, raw } = {}) {
    const result = await fetch(url + route, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: raw ?? (data ? JSON.stringify(data) : undefined) });
    const setCookie = result.headers.get('set-cookie'); if (setCookie) cookie = setCookie.split(';')[0];
    return result;
  }
  return { app, dir, roots, url, request, async login() { return request('/api/login', { method: 'POST', data: { key: 'chiave-finta-test' } }); },
    async video(name = 'Film di prova (2026).mp4', root = 'Film', bytes = '0123456789') { await writeFile(path.join(roots[root], name), bytes); await app.library.scan(); return app.library.items.find(i => i.path === name); },
    async close() { await app.close(); await rm(dir, { recursive: true, force: true }); } };
}
export async function fakeNavidrome({ songs: suppliedSongs } = {}) {
  const calls = []; const songs = suppliedSongs || [{ id: 's1', title: 'Luce di casa', path: 'Libreria/Uno.mp3', artist: 'Artista di prova', album: 'Suoni di casa', albumId: 'a1', duration: 8, coverArt: 'a1' }];
  const playlists = [{ id: 'p1', name: 'La sera', songCount: songs.length, entry: songs }];
  const song = playlists[0].entry[0];
  const album = { id: 'a1', name: 'Suoni di casa', artist: 'Artista di prova', artistId: 'r1', coverArt: 'a1', songCount: 1, song: [song] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://local'); const method = url.pathname.split('/').at(-1).replace('.view', '');
    if (req.method === 'POST') { let form = ''; for await (const chunk of req) form += chunk; for (const [key, value] of new URLSearchParams(form)) url.searchParams.append(key, value); }
    calls.push({ method, params: url.searchParams, verb: req.method });
    if (method === 'star') { const song = songs.find(s => s.id === url.searchParams.get('id')); if (song) song.starred = '2026-11-04'; }
    if (method === 'unstar') { const song = songs.find(s => s.id === url.searchParams.get('id')); if (song) delete song.starred; }
    if (method === 'createPlaylist') {
      const id = url.searchParams.get('playlistId') || `p${playlists.length + 1}`;
      const p = { id, name: url.searchParams.get('name'), entry: url.searchParams.getAll('songId').map(id => songs.find(s => s.id === id)).filter(Boolean) };
      p.songCount = p.entry.length; const at = playlists.findIndex(p => p.id === id); if (at >= 0) playlists.splice(at, 1); playlists.push(p);
    }
    if (method === 'updatePlaylist') {
      const p = playlists.find(p => p.id === url.searchParams.get('playlistId'));
      if (p) {
        if (url.searchParams.has('name')) p.name = url.searchParams.get('name');
        const remove = new Set(url.searchParams.getAll('songIndexToRemove').map(Number)); p.entry = p.entry.filter((_, i) => !remove.has(i));
        p.entry.push(...url.searchParams.getAll('songIdToAdd').map(id => songs.find(s => s.id === id)).filter(Boolean)); p.songCount = p.entry.length;
      }
    }
    const payload = {
      ping: {}, star: {}, unstar: {}, scrobble: {}, updatePlaylist: {}, getStarred2: { starred2: { song: songs.filter(s => s.starred) } }, getLyricsBySongId: demoLyrics(url.searchParams.get('id')), getArtists: { artists: { index: [{ name: 'A', artist: [{ id: 'r1', name: 'Artista di prova', albumCount: 1 }] }] } },
      getArtist: { artist: { id: 'r1', name: 'Artista di prova', album: [album] } }, getAlbum: { album },
      getAlbumList2: { albumList2: { album: url.searchParams.get('offset') === '0' ? [album] : [] } },
      search3: { searchResult3: { song: songs.slice(Number(url.searchParams.get('songOffset') || 0), Number(url.searchParams.get('songOffset') || 0) + Number(url.searchParams.get('songCount') || 100)), album: [album], artist: [{ id: 'r1', name: 'Artista di prova' }] } },
      getPlaylists: { playlists: { playlist: playlists } }, getPlaylist: { playlist: playlists.find(p => p.id === url.searchParams.get('id')) || playlists[0] },
      createPlaylist: { playlist: playlists.at(-1) }, deletePlaylist: {}
    };
    if (url.searchParams.get('u') === 'errore') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ 'subsonic-response': { status: 'failed', error: { code: 40 } } })); return; }
    if (['stream', 'getCoverArt'].includes(method)) {
      const data = Buffer.from('0123456789');
      res.writeHead(req.headers.range ? 206 : 200, { 'Content-Type': method === 'stream' ? 'audio/mpeg' : 'image/png', ...(req.headers.range ? { 'Content-Range': 'bytes 0-2/10', 'Content-Length': 3 } : { 'Content-Length': data.length }), 'Accept-Ranges': 'bytes' });
      res.end(req.headers.range ? data.subarray(0, 3) : data); return;
    }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ 'subsonic-response': { status: 'ok', version: '1.16.1', ...payload[method] } }));
  });
  await listenForTest(server);
  return { url: `http://127.0.0.1:${server.address().port}`, calls, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
