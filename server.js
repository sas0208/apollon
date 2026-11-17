import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stat, mkdir, readFile } from 'node:fs/promises';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Files } from './lib/files.js';
import { Store } from './lib/store.js';
import { Library } from './lib/library.js';
import { Subsonic } from './lib/subsonic.js';
import { MusicCatalog } from './lib/music-catalog.js';
import { MusicService } from './lib/music-service.js';
import { MusicDevices, homeAddress } from './lib/music-devices.js';
import { MusicSessions } from './lib/music-sessions.js';
import { MusicLink } from './lib/music-link.js';
import { Versions } from './lib/versions.js';
import { Trickplay } from './lib/trickplay.js';
import { previewQueue } from './public/tv/preview.js';
import { MusicTranscode } from './lib/music-transcode.js';
import { MusicArt, coverTarget } from './lib/music-art.js';
import { OnlineArt } from './lib/online-art.js';
import { AvatarChoices } from './lib/avatars.js';
import { SkipService } from './lib/skip-service.js';
import { RemoteVideo, mergeCatalog, ONLY_WATCH, remoteOperation } from './lib/remote-video.js';
import { fail, json, body as readBody, text, secret, readJson, idFor } from './lib/util.js';
import { sendFile, readSubtitles, extractSubtitle, TEXT_SUBTITLES } from './lib/media.js';
import { IMAGE_FILE } from './lib/library.js';

export const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(APP_DIR, 'public');
const STATIC = new Set(['index.html', 'app.js', 'logic.js', 'music-logic.js', 'music-playback.js', 'music-motion.js', 'music-gestures.js', 'music-feedback.js', 'music-equalizer.js', 'virtual-list.js', 'style.css', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'icon-music.svg', 'icon-192.png', 'icon-512.png']);
for (const asset of ['boot.css', 'boot.js', 'tv-controls.css', 'music-premium.css']) STATIC.add(asset);
for (const asset of ['scrub.js', 'focus.js', 'router.js', 'playback.js', 'preview.js']) STATIC.add(`tv/${asset}`);
for (const asset of ['index.html','tv.css','app.js','api.js','ui.js','rail.js','home.js','browse.js']) STATIC.add(`tv/${asset}`);
for (const asset of ['title.js','options.js']) STATIC.add(`tv/${asset}`);
STATIC.add('tv/player.js');
for (const asset of ['keyboard.js','search.js','profiles.js','settings.js']) STATIC.add(`tv/${asset}`);
for (const asset of ['legacy/tv/app.js','legacy/tv/tv.css']) STATIC.add(asset);
export function isOldBrowser(ua = '', url) {
  if (url?.searchParams.get('legacy') === '1') return true;
  if (/Tizen/i.test(ua)) return true;
  const chrome = /Chrome[/]([0-9]+)/.exec(ua); return !!chrome && Number(chrome[1]) < 80;
}
async function legacyIndex() {
  try {
    const html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8'); await stat(path.join(PUBLIC, 'legacy', 'app.js'));
    return html.replace('<script src="/app.js" type="module"></script>', '<script defer src="/legacy/app.js"></script>')
      .replace(/(<link rel="stylesheet" href=")[/]([-a-z]+[.]css">)/g, '$1/legacy/$2')
      .replace('<title>', '<link rel="stylesheet" href="/legacy/tv-legacy.css">' + String.fromCharCode(10) + '  <title>');
  } catch { return null; }
}
const hash = value => createHash('sha256').update(value).digest();
const body = (req, ...args) => req.apollonBody !== undefined ? Promise.resolve(req.apollonBody) : readBody(req, ...args);
for (const asset of ['music-library.js', 'music-library.css', 'music-search.js']) STATIC.add(asset);
STATIC.add('music-recommendations.js');
STATIC.add('music-moment.js');
STATIC.add('music-recap.js');
STATIC.add('music-devices.js');
STATIC.add('music-device-bridge.js'); STATIC.add('music-session.js'); STATIC.add('music-blend.js');
for (const asset of ['music-offline.js', 'music-offline-cache.js', 'music-offline-range.js']) STATIC.add(asset);
for (const asset of ['video-offline.js', 'video-offline-range.js', 'downloads.js', 'downloads.css']) STATIC.add(asset); // Scarica sul telefono
STATIC.add('music-listening.js'); STATIC.add('music-songs.js');
for (const asset of ['fonts/figtree.woff2', 'fonts/nunitosans.woff2']) STATIC.add(asset); // font OFL del telefono (solo sotto i 900 px)
for (const asset of ['music-app.css', 'music-shell.js', 'music-home.js', 'music-cover.svg']) STATIC.add(asset); // Giro E
for (const asset of ['video-app.js', 'video-app.css', 'video-logic.js', 'video-player.js', 'video-manage.js', 'tv-nav.js']) STATIC.add(asset); // Giro F
function cookie(req, name) { return (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`))?.slice(name.length + 1); }
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (origin) {
    let host; try { host = new URL(origin).host; } catch { throw fail(403, 'Richiesta non ammessa.'); }
    if (host !== req.headers.host) throw fail(403, 'Apri Apollon direttamente dal suo indirizzo.');
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'Richiesta non ammessa.');
}
export async function createApp(options = {}) {
  const config = { port: 8787, host: '127.0.0.1', mode: 'video', roots: {}, dataDir: path.join(APP_DIR, 'data'),
    navidromeUrl: 'http://127.0.0.1:4533', ...options };
  config.dataDir = path.resolve(config.dataDir);
  await mkdir(config.dataDir, { recursive: true });
  const store = await new Store(config.dataDir, { seed: config.seedProfiles || [] }).init();
  // 8/11: il catalogo video di un'altra Apollon (PC fisso) si unisce al nostro; nulla viene copiato.
  const remote = config.mode !== 'music' && config.remoteVideoSources?.length ? await new RemoteVideo(config.remoteVideoSources, { dataDir: config.dataDir, timeoutMs: config.remoteTimeoutMs, bodyMs: config.remoteBodyMs, proxyMs: config.remoteProxyMs, streamMs: config.remoteStreamMs, subtitleMs: config.remoteSubtitleMs, idleMs: config.remoteIdleMs, freshMs: config.remoteFreshMs, downMs: config.remoteDownMs }).init() : null;
  const files = new Files(config.roots, store, config.maxUploadGB);
  const library = new Library(config, files, store, options.mediaTools); library.extra = remote; await library.init();
  const skips = await new SkipService(config, library, files, store, options.skipTools).init();
  const versions = await new Versions(config, library, options.mediaTools).init();
  const trickplay = await new Trickplay(config, library, options.trickplayTools).init();
  const onlineArt = await new OnlineArt(config, store, { fetchImpl: options.fetchImpl, ffmpeg: args => library.tools.run('ffmpeg', args, 120000) }).init(); library.onlineArt = onlineArt;
  const avatars = await new AvatarChoices(config, store, library, onlineArt, { fetchImpl: options.fetchImpl, ffmpeg: args => library.tools.run('ffmpeg', args, 120000) }).init();
  // La scansione di library.init() è avvenuta prima che onlineArt esistesse: se l'interruttore è già acceso all'avvio,
  // la firma delle immagini ora cambia (':o') e i titoli vanno rimessi in coda, altrimenti le copertine ufficiali non arrivano mai.
  library.queueArt(); // include le copertine locali anche con le richieste online spente
  if (onlineArt.enabled()) library.genreTask = library.backfillGenres();
  // 7/11: i file nuovi (gli anime che arrivano sull'NAS) entrano da soli nel catalogo, con copertine e salti, senza riavviare.
  if (config.mode !== 'music' && config.autoScanMs !== 0) { const rescan = setInterval(() => library.scan().catch(() => {}), config.autoScanMs || 120000); rescan.unref(); }
  const musicArt = await new MusicArt(config, files, options.mediaTools).init();
  if (config.autoMusicArt !== false && config.roots.Musica && config.mode !== 'video') musicArt.crawl();
  const music = new Subsonic(config.navidromeUrl); const musicTranscode = new MusicTranscode(config, music, options.mediaTools);
  const musicLink = await new MusicLink(config.dataDir, music, { username: config.navidromeUser, password: config.navidromePassword, trustUser: config.navidromeTrustUser }).init();
  const musicCatalog = new MusicCatalog(files, config.musicCatalogPath, config.musicPathPrefix);
  const musicService = new MusicService(music, musicCatalog, store);
  const musicDevices = new MusicDevices(); const musicSessions = new MusicSessions(musicDevices);
  const sweeper = setInterval(() => musicSessions.sweep(), 10000); sweeper.unref();
  const access = options.adminKey ? { hash: hash(options.adminKey).toString('hex') } : await readJson(path.join(config.dataDir, 'access.json'), null);
  const sessions = new Map(); const attempts = new Map();
  let mutationQueue = Promise.resolve();
  const mutate = fn => { const task = mutationQueue.then(fn); mutationQueue = task.catch(() => {}); return task; };
  function session(req, res, create = false) {
    const id = cookie(req, 'mediateca'); let value = sessions.get(id);
    if (value && value.expires < Date.now()) { sessions.delete(id); value = undefined; }
    if (!value && create) {
      if (sessions.size > 1000) for (const [key, s] of sessions) if (s.expires < Date.now()) sessions.delete(key);
      if (sessions.size >= 1000) throw fail(503, 'Troppi dispositivi collegati. Riprova più tardi.');
      const token = secret(); value = { expires: Date.now() + 8 * 3600 * 1000 };
      sessions.set(token, value);
      res.setHeader('Set-Cookie', `mediateca=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${req.socket.encrypted ? '; Secure' : ''}`);
    }
    return value;
  }
  // Le operazioni sui file restano locali; le altre passano al fisso quando ha una chiave.
  const local = (...ids) => { for (const id of ids.flat()) if (remote?.refs.has(id)) throw fail(409, ONLY_WATCH); };
  function admin(req, res) { if (req.apollonRemoteAdmin) return { admin: true }; const s = session(req, res); if (!s?.admin) throw fail(401, 'Per gestire i file serve la chiave di casa.'); return s; }
  const remoteStates = async p => remote ? Promise.all(remote.sources.filter(s => s.key).map(async s => {
    try {
      const row = (await remote.request(s, p, { search: p === '/api/skips' ? 'details=1' : '' })).data;
      if (p === '/api/versions') {
        const signature = `${row.count}:${row.bytes}`;
        if (s.versionSignature !== signature) { s.versionSignature = signature; await remote.refresh(s); }
      }
      return row;
    } catch { return null; }
  })).then(rows => rows.filter(Boolean)) : [];
  function mergeVersions(rows) {
    const workingIds = rows.flatMap(r => r.workingIds || (r.working ? [r.working] : []));
    return { count: rows.reduce((n, r) => n + (r.count || 0), 0), bytes: rows.reduce((n, r) => n + (r.bytes || 0), 0),
      queued: rows.reduce((n, r) => n + (r.queued || 0), 0), working: workingIds[0] || null, workingIds,
      failed: [...new Set(rows.flatMap(r => r.failed || []))] };
  }
  const versionStatus = async () => remote ? mergeVersions([versions.status(), ...await remoteStates('/api/versions')]) : versions.status();
  const mergeSkipStatus = rows => ({ ...rows[0], running: rows.some(r => r.running), pending: rows.reduce((n, r) => n + (r.pending || 0), 0),
    completed: rows.reduce((n, r) => n + (r.completed || 0), 0), failed: rows.reduce((n, r) => n + (r.failed || 0), 0) });
  // Con la musica collegata in Gestisci ogni dispositivo la apre senza login; altrimenti vale il login per sessione.
  function musicAuth(req, res) {
    let s = session(req, res);
    if (musicLink.auth) {
      if (s?.music !== musicLink.auth) { s = session(req, res, true); s.music = musicLink.auth; s.musicLinked = true; }
      req.musicLinked = true;
    } else if (s?.musicLinked) { delete s.music; delete s.musicLinked; }
    return s?.music;
  }
  function authMusic(req, res) { const auth = musicAuth(req, res); if (!auth) throw fail(401, 'Accedi alla musica con il tuo utente Navidrome.'); return auth; }
  function throttle(req) {
    const addr = req.socket.remoteAddress; let a = attempts.get(addr);
    if (!a || a.until < Date.now()) { a = { count: 0, until: Date.now() + 60000 }; attempts.set(addr, a); }
    if (++a.count > 12) throw fail(429, 'Troppi tentativi. Aspetta un minuto.');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.until < Date.now()) attempts.delete(key);
  }
  async function route(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const url = new URL(req.url, 'http://localhost'); const p = url.pathname; const method = req.method;
    const get = (key, fallback = '') => url.searchParams.get(key) ?? fallback;
    if (!['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw fail(405, 'Operazione non ammessa.');
    if (!['GET', 'HEAD'].includes(method) && config.readOnly && /^\/api\/manage\/(?:upload|folder|move|rename|delete|trash|restore|purge)(?:\/|$)/.test(p)) throw fail(403, 'Questa raccolta è in sola lettura.');
    if (!['GET', 'HEAD'].includes(method)) sameOrigin(req);
    if (remoteOperation(p) && req.headers['x-apollon-remote'] !== undefined) {
      const key = req.headers['x-apollon-remote'];
      if (typeof config.remoteKey !== 'string' || !config.remoteKey || typeof key !== 'string' || key.length > 1000 || !timingSafeEqual(hash(key), hash(config.remoteKey))) throw fail(401, 'La chiave del collegamento al fisso non è corretta.');
      req.apollonRemoteAdmin = true;
    }
    // Prima di leggere il corpo nelle singole API scegliamo l'istanza che ha il titolo.
    if (remote && remoteOperation(p) && !(p === '/api/versions' && method === 'POST')) {
      if (p.startsWith('/api/manage/')) admin(req, res);
      const b = ['GET', 'HEAD'].includes(method) ? undefined : (req.apollonBody = await body(req));
      const id = b?.id || get('id'); const ref = remote.refs.get(id);
      if (ref) {
        const answer = await remote.forward(ref.s, p, method, b, url.search, p === '/api/manage/picture');
        if (p === '/api/manage/picture') { res.writeHead(answer.status, answer.headers); return res.end(method === 'HEAD' ? undefined : answer.data); }
        return json(res, answer.data, answer.status);
      }
      local(b?.poster?.source, b?.backdrop?.source);
    }
    if (p === '/api/health' && method === 'GET') return json(res, { ok: true, app: 'Mediateca' });
    if (p === '/api/tv/trickplay' && method === 'POST') {
      const b = await body(req); const fields = ['current','next','continuing','rest'];
      if (fields.some(k => b[k] !== undefined && (['current','next'].includes(k) ? typeof b[k] !== 'string' : !Array.isArray(b[k]) || b[k].some(id => typeof id !== 'string'))) || previewQueue(b).length > 400) throw fail(400, 'Elenco anteprime non valido.');
      const groups = new Map();
      for (const id of previewQueue(b)) { library.get(id); const ref = remote?.refs.get(id); if (ref) { if (!groups.has(ref.s)) groups.set(ref.s, {}); const group = groups.get(ref.s); for (const field of fields) { if (b[field] === id) group[field] = ref.remoteId; else if (Array.isArray(b[field]) && b[field].includes(id)) (group[field] ||= []).push(ref.remoteId); } } }
      const localIds = ids => ids.filter(id => !remote?.refs.has(id));
      for (const [ids,priority] of [[[b.current].filter(Boolean),0],[[b.next].filter(Boolean),1],[b.continuing||[],2],[b.rest||[],3]]) trickplay.enqueue(localIds(ids),priority);
      await Promise.all([...groups].map(([source,data]) => remote.queuePreviews(source,data).catch(() => null)));
      return json(res,{queued:trickplay.queue.size},202);
    }
    // Il widget file:// controlla soltanto la raggiungibilità, senza leggere il catalogo.
    if (p === '/api/tv-ready' && method === 'GET') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return json(res, { ready: true });
    }
    if (p === '/api/bootstrap' && method === 'GET') { await musicLink.ensure(); return json(res, {
      ...library.summary(), profiles: store.data.profiles, roots: Object.keys(config.roots),
      admin: !!session(req, res)?.admin, music: !!musicAuth(req, res), musicLinked: !!musicLink.auth, musicUser: musicAuth(req, res)?.u || '', managementReady: !!access,
      otherLibraryUrl: safeLibraryUrl(config.otherLibraryUrl), demo: !!config.demo
    }); }
    if (p === '/api/library' && method === 'GET') return json(res, { items: remote ? mergeCatalog(library.list(), await remote.list()) : library.list(), ...library.summary(), ...(remote ? { remotes: remote.status() } : {}) });
    if (p === '/api/profiles' && method === 'POST') { const b = await body(req); return json(res, await store.addProfile(b.name), 201); }
    if (p === '/api/profiles/preferences' && method === 'PUT') { const b = await body(req); return json(res, await store.preferences(b.profile, b)); }
    if (p === '/api/profiles/name' && method === 'PUT') { const b = await body(req); return json(res, await store.renameProfile(b.id, b.name)); }
    if (p === '/api/avatar-choices' && method === 'GET') return json(res, await avatars.choices());
    if (p === '/api/profiles/avatar' && method === 'PUT') {
      const b = await body(req); store.profile(b.id);
      if (b.avatar !== null) await avatars.file(b.avatar);
      return json(res, await store.setAvatar(b.id, b.avatar));
    }
    if (p === '/api/mylist' && method === 'GET') return json(res, { items: store.list(get('profile')) });
    if (p === '/api/mylist' && method === 'PUT') { const b = await body(req); return json(res, { items: await store.setListed(b.profile, b.key, b.on) }); }
    if (p === '/api/ratings/summary' && method === 'GET') return json(res, store.ratingSummary());
    if (p === '/api/ratings' && method === 'GET') return json(res, store.ratings(get('key'), get('profile')));
    if (p === '/api/ratings' && method === 'PUT') { const b = await body(req); return json(res, await store.setRating(b.profile, b.key, b.value === undefined ? null : b.value)); }
    if (p === '/api/versions' && method === 'GET') return json(res, await versionStatus());
    if (p === '/api/versions' && method === 'POST') {
      const b = await body(req);
      if (!Array.isArray(b.ids) || !b.ids.length || b.ids.length > 300) throw fail(400, 'Scegli almeno un titolo (al massimo 300 episodi alla volta).');
      const groups = new Map(); const here = [];
      for (const id of b.ids) {
        const ref = remote?.refs.get(id);
        if (ref) { remote.requireKey(ref.s); if (!groups.has(ref.s)) groups.set(ref.s, []); groups.get(ref.s).push(id); }
        else { library.get(id); here.push(id); }
      }
      for (const [s, ids] of groups) await remote.forward(s, p, method, { ...b, ids });
      if (here.length) versions.enqueue(here, { first: b.first === true });
      return json(res, await versionStatus(), 202);
    }
    if (p === '/api/versions/item' && method === 'GET') return json(res, versions.itemStatus(get('id')));
    if (p === '/api/skips' && method === 'GET') {
      if (!remote) return json(res, skips.overview(get('details') === '1'));
      await remote.list();
      const rows = [skips.overview(true), ...await remoteStates('/api/skips')]; const series = {}; const episodes = [];
      const visible = new Set(mergeCatalog(library.list(), remote.sources.flatMap(s => s.items)).map(i => i.id));
      for (const r of rows) {
        if (r.episodes) {
          for (const e of r.episodes) if (visible.has(e.id)) {
            const target = series[`${e.root}/${e.series}`] ||= { total: 0, ready: 0, preparing: false, review: 0 };
            target.total++; target.ready += Number(e.ready); target.review += Number(e.review); target.preparing ||= e.preparing; episodes.push(e);
          }
        } else for (const [key, row] of Object.entries(r.series || {})) {
          const target = series[key] ||= { total: 0, ready: 0, preparing: false, review: 0 };
          target.total += row.total; target.ready += row.ready; target.review += row.review; target.preparing ||= row.preparing;
        }
      }
      for (const row of Object.values(series)) if (row.ready >= row.total) row.preparing = false;
      const { episodes: ownEpisodes, ...status } = mergeSkipStatus(rows);
      return json(res, { ...status, series, ...(get('details') === '1' ? { episodes } : {}) });
    }
    if (p === '/api/progress' && method === 'GET') return json(res, store.profile(get('profile')));
    if (p === '/api/progress' && method === 'PUT') {
      const b = await body(req); library.get(b.id); if ('position' in b) trickplay.noteActivity(); return json(res, await store.progress(b.profile, b.id, b));
    }
    if (p === '/api/progress/batch' && method === 'PUT') {
      const b = await body(req, 512 * 1024); if (!Array.isArray(b.ids)) throw fail(400, 'Elenco di episodi non valido.');
      for (const id of b.ids) library.get(id);
      return json(res, await store.progressMany(b.profile, b.ids, b));
    }
    if (p === '/api/login' && method === 'POST') {
      throttle(req); const b = await body(req);
      if (!access) throw fail(503, 'Prima prepara la chiave di casa con il programma di configurazione.');
      if (typeof b.key !== 'string' || b.key.length > 1000 || !timingSafeEqual(hash(b.key), Buffer.from(access.hash, 'hex'))) throw fail(401, 'La chiave di casa non è corretta.');
      session(req, res, true).admin = true; return json(res, { ok: true });
    }
    if (p === '/api/logout' && method === 'POST') { const id = cookie(req, 'mediateca'); sessions.delete(id); res.setHeader('Set-Cookie', 'mediateca=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return json(res, { ok: true }); }
    if (/^\/media\/avatar\/[a-f0-9]{24}\.jpg$/.test(p) && ['GET', 'HEAD'].includes(method)) {
      return sendFile(req, res, await avatars.file(p), { cache: true });
    }
    const trickMatch = /^\/media\/([a-f0-9]{24})\/trickplay(?:\/(\d+)\.jpg)?$/.exec(p);
    if (trickMatch && ['GET','HEAD'].includes(method)) {
      const [,id,sheet] = trickMatch; library.get(id);
      if (remote?.refs.has(id)) return remote.proxy(req,res,id,`/trickplay${sheet !== undefined ? `/${sheet}.jpg` : ''}`,url.search);
      if (get('playing') === '1') trickplay.noteActivity();
      if (sheet !== undefined) return sendFile(req,res,trickplay.sheet(id,Number(sheet)),{cache:true});
      const index = trickplay.index(id,Number(get('priority','0')), {cachedOnly:get('cached')==='1'}); return json(res,index,index.ready?200:202);
    }
    const mediaMatch = /^\/media\/([a-f0-9]{24})(?:\/(image|subtitle|poster|backdrop|thumb|logo|frame)\/?(s?\d+)?)?$/.exec(p);
    if (mediaMatch && ['GET', 'HEAD'].includes(method)) {
      const [, id, kind, index] = mediaMatch;
      if (!kind) trickplay.noteActivity();
      if (remote?.refs.has(id)) {
        if (kind === 'frame') {
          const ref = remote.refs.get(id); if (!ref.s.key) throw fail(404, 'Fotogramma non disponibile per i titoli del fisso.'); admin(req, res);
          // La chiave autorizza solo le API previste: il fotogramma usa quella delle immagini.
          const answer = await remote.forward(ref.s, '/api/manage/picture', method, undefined, new URLSearchParams({ id, at: get('t') }).toString(), true);
          res.writeHead(answer.status, answer.headers); return res.end(method === 'HEAD' ? undefined : answer.data);
        }
        return remote.proxy(req, res, id, kind ? `/${kind}${index ? `/${index}` : ''}` : '', url.search);
      }
      
      const item = library.get(id);
      if (['poster', 'backdrop', 'thumb'].includes(kind)) return sendFile(req, res, await library.imageFile(id, kind, Number(get('s', '0')) || 0), { cache: true });
      if (kind === 'logo') return sendFile(req, res, await library.logoFile(id, Number(get('s', '0')) || 0), { cache: true });
      if (kind === 'frame') {
        admin(req, res); const bytes = await library.frame(id, Number(get('t')));
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Content-Length': bytes.length }); return res.end(method === 'HEAD' ? undefined : bytes);
      }
      if (kind === 'subtitle' && index?.startsWith('s')) {
        const stream = item.streams?.find(s => s.type === 'subtitle' && s.index === Number(index.slice(1)) && TEXT_SUBTITLES.has(s.codec));
        if (!stream) throw fail(404, 'Sottotitoli non trovati.');
        const output = await extractSubtitle(await library.fileFor(id), stream.index, path.join(config.dataDir, 'sottotitoli', `${id}-${stream.index}-${Math.round(item.mtime)}.vtt`));
        res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(method === 'HEAD' ? undefined : output);
      }
      if (kind === 'image') {
        if (item.imagePath) {
          try { return await sendFile(req, res, await files.resolve(item.root, item.imagePath)); }
          catch (e) { if (e.code !== 'ENOENT' && e.status !== 404) throw e; }
        }
        if (!item.image) return sendFile(req, res, path.join(PUBLIC, 'icon.svg'), { cache: true });
        return sendFile(req, res, path.join(library.cacheDir, `${id}.jpg`), { cache: true });
      }
      if (kind === 'subtitle') {
        const subtitle = item.subtitles[Number(index)]; if (!subtitle) throw fail(404, 'Sottotitoli non trovati.');
        const output = await readSubtitles(await files.resolve(item.root, subtitle.path));
        res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(method === 'HEAD' ? undefined : output);
      }
      // «Risparmio dati»: la versione 480p se è pronta e vale ancora, altrimenti sempre l'originale.
      if (get('q') === '480') { const light = versions.pathFor(id); if (light) return sendFile(req, res, light); }
      return sendFile(req, res, await library.fileFor(id));
    }
    if (p.startsWith('/api/manage/')) {
      admin(req, res);
      if (p === '/api/manage/online-art' && method === 'GET') return json(res, onlineArt.status());
      if (p === '/api/manage/online-art' && method === 'POST') {
        const b = await body(req); const status = await onlineArt.setEnabled(b.enabled);
        if (status.enabled) { library.regenerate(library.items.map(i => i.id)); library.genreTask = library.backfillGenres(); }
        return json(res, status);
      }
      if (p === '/api/manage/versions/clear' && method === 'POST') {
        await body(req); let removed = 0;
        for (const s of remote?.sources.filter(s => s.key) || []) removed += (await remote.request(s, p, { method, data: {} })).data.removed || 0;
        const result = await versions.clear(); removed += result.removed;
        for (const s of remote?.sources.filter(s => s.key) || []) await remote.refresh(s);
        return json(res, { removed, ...await versionStatus() });
      }
      if (p === '/api/manage/skips' && method === 'GET') return json(res, get('id') ? skips.settings(library.get(get('id'))) : mergeSkipStatus([skips.status(), ...await remoteStates(p)]));
      if (p === '/api/manage/skips/analyze' && method === 'POST') { const b = await body(req); local(b.id); return json(res, skips.enqueue(b.id), 202); }
      if (p === '/api/manage/skips/edit' && method === 'POST') { const b = await body(req); local(b.id); return json(res, await mutate(() => skips.edit(b.id, b.salti, b.sameOpening)), 200); }
      if (p === '/api/manage/skips/settings' && method === 'POST') {
        const b = await body(req); const value = await skips.setSettings(b);
        if (!b.id) for (const s of remote?.sources.filter(s => s.key) || []) await remote.request(s, p, { method, data: b });
        return json(res, value);
      }
      if (p === '/api/manage/music' && method === 'GET') return json(res, musicLink.status());
      // Giro F: immagini accanto al video (stessa cartella o cartella della serie) per scegliere locandina e sfondo.
      if (p === '/api/manage/pictures' && method === 'GET') {
        local(get('id')); const item = library.get(get('id')); const here = path.posix.dirname(library.items.find(i => i.id === item.id).path);
        const folders = [...new Set([here, path.posix.dirname(here)])];
        const found = [];
        for (const folder of folders) {
          const rel = folder === '.' ? '' : folder;
          for (const entry of await files.list(item.root, rel).catch(() => [])) if (entry.type !== 'folder' && !entry.directory && IMAGE_FILE.test(entry.name) && found.length < 60) found.push([rel, entry.name].filter(Boolean).join('/'));
        }
        return json(res, { pictures: [...new Set(found)] });
      }
      if (p === '/api/manage/picture' && ['GET', 'HEAD'].includes(method)) {
        local(get('id')); const item = library.get(get('id')); const rel = get('path');
        if (url.searchParams.has('at')) {
          const bytes = await library.frame(item.id, Number(get('at')));
          res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store', 'Content-Length': bytes.length }); return res.end(method === 'HEAD' ? undefined : bytes);
        }
        if (!IMAGE_FILE.test(rel)) throw fail(400, 'Scegli un’immagine JPG, PNG o WebP.');
        return sendFile(req, res, await files.resolve(item.root, rel));
      }
      if (p === '/api/manage/art' && method === 'POST') {
        const b = await body(req); local(b.id); const item = library.get(b.id);
        const ids = b.scope === 'series' && item.series ? library.list().filter(i => i.root === item.root && i.series === item.series).map(i => i.id) : [item.id];
        return json(res, library.regenerate(ids), 202);
      }
      if (p === '/api/manage/music/link' && method === 'POST') {
        throttle(req); const b = await body(req); return json(res, await mutate(() => musicLink.link(b.username, b.password)));
      }
      if (p === '/api/manage/music/unlink' && method === 'POST') { await body(req); return json(res, await mutate(() => musicLink.unlink())); }
      if (p === '/api/manage/files' && method === 'GET') return json(res, await files.list(get('root'), get('path')));
      if (p === '/api/manage/space' && method === 'GET') return json(res, await files.space());
      if (p === '/api/manage/trash' && method === 'GET') return json(res, store.data.trash);
      if (p === '/api/manage/upload' && method === 'POST') return json(res, await mutate(async () => {
        const value = await files.upload(get('root'), get('path'), req); await library.scan(); return value;
      }), 201);
      if (method === 'POST') {
        const b = await body(req);
        const value = await mutate(async () => {
          let result;
          if (p === '/api/manage/folder') result = await files.folder(b.root, b.path);
          else if (p === '/api/manage/move') {
            result = await files.move(b.root, b.from, b.to, b.toRoot || b.root);
            const old = idFor(`${b.root}/${b.from}`); const next = idFor(`${b.toRoot || b.root}/${b.to}`);
            const movedInfo = await stat(await files.resolve(b.toRoot || b.root, b.to));
            await skips.move(old, next, movedInfo);
            await store.change(d => {
              if (d.edits[old]) { d.edits[next] = d.edits[old]; delete d.edits[old];
                if (d.edits[next].saltiSignature) d.edits[next].saltiSignature = `${movedInfo.size}:${movedInfo.mtimeMs}`;
              }
              for (const values of Object.values(d.progress)) if (values[old]) { values[next] = values[old]; delete values[old]; }
            });
          } else if (p === '/api/manage/trash') result = await files.trash(b.root, b.path);
          else if (p === '/api/manage/restore') result = await files.restore(b.id);
          else if (p === '/api/manage/scan') return b.retry ? library.retry() : library.scan();
          else if (p === '/api/manage/edit') {
            local(b.id, b.poster?.source, b.backdrop?.source); const item = library.get(b.id); const scope = b.scope || 'episode';
            const patch = store.validateEdit(b);
            if (!['episode', 'season', 'series'].includes(scope)) throw fail(400, 'Scegli a quali episodi applicare le modifiche.');
            if (patch.imagePath) {
              if (!['.jpg', '.jpeg', '.png'].includes(path.extname(patch.imagePath).toLowerCase())) throw fail(400, 'Scegli un’immagine JPG o PNG della raccolta.');
              if (!(await stat(await files.resolve(item.root, patch.imagePath))).isFile()) throw fail(400, 'Scegli un file immagine.');
            }
            for (const key of ['poster', 'backdrop']) {
              const choice = patch[key];
              if (choice?.path) {
                if (!IMAGE_FILE.test(choice.path)) throw fail(400, 'Scegli un’immagine JPG, PNG o WebP della raccolta.');
                if (!(await stat(await files.resolve(item.root, choice.path))).isFile()) throw fail(400, 'Scegli un file immagine.');
              }
              if (choice?.source) {
                const other = library.get(choice.source);
                if (other.root !== item.root || (other.id !== item.id && (!item.series || other.series !== item.series))) throw fail(400, 'Il fotogramma deve venire dallo stesso titolo o dalla stessa serie.');
                if (other.id === item.id) delete choice.source;
              }
            }
            const shared = Object.fromEntries(['series', 'genres', 'imagePath', 'seriesDescription', ...(scope === 'season' ? ['season'] : [])].filter(k => k in patch).map(k => [k, patch[k]]));
            const targets = scope === 'episode' || !item.series ? [item] : library.list().filter(i => i.root === item.root && i.series === item.series && (scope === 'series' || i.season === item.season));
            const saved = await store.editMany(targets.map(i => ({ id: i.id, patch: i.id === item.id ? patch : shared })));
            library.queueArt(targets.map(i => i.id)); return saved;
          }
          else throw fail(404, 'Operazione non trovata.');
          await library.scan(); return result;
        });
        return json(res, value);
      }
    }
    if (p === '/api/music/login' && method === 'POST') {
      throttle(req); const b = await body(req); const auth = await music.login(b.username, b.password);
      session(req, res, true).music = auth; return json(res, { ok: true });
    }
    if (p.startsWith('/api/music/')) {
      await musicLink.ensure(); const auth = authMusic(req, res); const id = get('id');
      if (p.startsWith('/api/music/devices/')) {
        sameOrigin(req);
        if (!homeAddress(req.socket.remoteAddress)) throw fail(403, 'I dispositivi si collegano soltanto dalla rete di casa.');
        const b = method === 'POST' ? await body(req, 2 * 1024 * 1024) : {};
        const profile = b.profile || get('profile'); store.profile(profile);
        const scope = `${idFor(auth.u)}/${profile}`; const owner = session(req, res);
        if (p.startsWith('/api/music/devices/session/')) {
          const profileName = store.data.profiles.find(x => x.id === profile).name;
          return json(res, musicSessions.handle(p.slice('/api/music/devices/session/'.length), method, { home: idFor(auth.u), scope, owner, profileName }, method === 'POST' ? b : { id }));
        }
        if (p.endsWith('/register') && method === 'POST') return json(res, musicDevices.register(scope, owner, b));
        if (p.endsWith('/command') && method === 'POST') return json(res, musicDevices.command(scope, owner, b));
        if (p.endsWith('/state') && method === 'POST') return json(res, musicDevices.update(scope, owner, b));
        if (p.endsWith('/events') && method === 'GET') {
          musicDevices.get(scope, id, owner);
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          res.write('retry: 1500\n\n');
          const send = event => { if (!res.writableEnded && !res.write(`data: ${JSON.stringify(event)}\n\n`)) res.destroy(); if (['shutdown', 'replaced'].includes(event.type)) res.end(); };
          const disconnect = musicDevices.connect(scope, owner, id, send);
          const heartbeat = setInterval(() => { if (session(req, res) !== owner) res.end(); else if (!res.writableEnded) res.write(': casa\n\n'); }, 15000);
          res.on('close', () => { clearInterval(heartbeat); disconnect(); }); return;
        }
        throw fail(404, 'Comando dispositivo non trovato.');
      }
      if (p === '/api/music/songs' && method === 'GET') return json(res, await musicService.songs(auth));
      if (p === '/api/music/library' && method === 'GET') return json(res, await musicService.library(auth));
      if (p === '/api/music/moment' && method === 'GET') return json(res, await musicService.moment(auth));
      if (p === '/api/music/blend' && method === 'GET') return json(res, await musicService.blend(auth, get('profile'), get('with')));
      if (p === '/api/music/recap' && method === 'GET') return json(res, await musicService.recap(auth, get('profile'), get('period')));
      if (p === '/api/music/played' && method === 'POST') return json(res, await musicService.played(auth, await body(req)));
      if (p === '/api/music/recommendations' && method === 'POST') return json(res, await musicService.recommendations(auth, await body(req)));
      if (p === '/api/music/select' && method === 'POST') return json(res, await musicService.select(auth, await body(req)));
      if (p === '/api/music/activity' && method === 'GET') return json(res, await musicService.activity(auth));
      if (p === '/api/music/liked' && method === 'GET') return json(res, { songs: await musicService.liked(auth) });
      if (p === '/api/music/listen' && method === 'POST') { const b = await body(req); return json(res, await mutate(() => musicService.listen(auth, b))); }
      if (p === '/api/music/star' && method === 'POST') {
        const b = await body(req); if (typeof b.starred !== 'boolean') throw fail(400, 'Preferenza non valida.');
        return json(res, await music.request(b.starred ? 'star' : 'unstar', auth, { id: text(b.id) }));
      }
      if (p === '/api/music/playlist/add' && method === 'POST') { const b = await body(req); return json(res, await mutate(() => music.request('updatePlaylist', auth, { playlistId: text(b.id), songIdToAdd: text(b.song) }))); }
      if (p === '/api/music/search' && method === 'GET') {
        const q = get('q').slice(0, 250); const [found, lists] = await Promise.all([music.request('search3', auth, { query: q, songCount: 100, albumCount: 40, artistCount: 40 }), music.request('getPlaylists', auth)]);
        return json(res, { ...found, playlists: { playlist: (lists.playlists?.playlist || []).filter(p => p.name?.toLocaleLowerCase('it').includes(q.toLocaleLowerCase('it'))) } });
      }
      if (p === '/api/music/home' && method === 'GET') return json(res, await musicCatalog.home());
      if (p === '/api/music/details' && method === 'GET') return json(res, await musicService.details(auth, text(id)));
      if (p === '/api/music/lyrics' && method === 'GET') return json(res, await music.request('getLyricsBySongId', auth, { id: text(id) }));
      if (p === '/api/music/collection' && method === 'GET') return json(res, await musicCatalog.collection(get('type'), get('name'), music, auth));
      if (p === '/api/music/stream' && ['GET', 'HEAD'].includes(method) && get('q') === 'low') return sendFile(req, res, await musicTranscode.ensure(auth, text(id)), { type: 'audio/mp4' });
      if (p === '/api/music/stream' && ['GET', 'HEAD'].includes(method)) return music.proxy(req, res, 'stream', auth, { id: text(id), format: 'raw' });
      if (p === '/api/music/cover' && ['GET', 'HEAD'].includes(method)) {
        // Prima le copertine vere dei file (incorporate o accanto), poi Navidrome, poi quella generata dall'interfaccia.
        const wanted = get('size') === 'large' ? 1000 : ['80', '160', '400'].includes(get('size')) ? Number(get('size')) : 400;
        // Una copertina non deve occupare le connessioni HTTP mentre si indicizza tutta la musica
        // o ffmpeg aspetta la coda: solo immagini già pronte, altrimenti Navidrome subito.
        const local = await musicArt.forRequest(text(id), wanted, musicCatalog.cachedSongs(auth), { cachedOnly: true }).catch(() => null);
        if (local) return sendFile(req, res, local, { cache: true, type: 'image/jpeg' });
      }
      if (p === '/api/music/cover' && ['GET', 'HEAD'].includes(method)) {
        try { return await music.proxy(req, res, 'getCoverArt', auth, { id: text(id), size: get('size') === 'large' ? 1000 : ['80', '160', '400'].includes(get('size')) ? Number(get('size')) : 400 }); }
        catch (error) {
          // Ultimo tentativo prima della copertina generata: quella ufficiale scaricata, solo se l'interruttore in Gestisci è acceso.
          const target = coverTarget(text(id), await musicCatalog.songs(music, auth).catch(() => []));
          const web = target?.type === 'album' && !res.headersSent ? await onlineArt.get('album', { title: target.album, artist: target.artist }) : null;
          if (web) return sendFile(req, res, web, { cache: true });
          throw error;
        }
      }
      if (method === 'GET') {
        const routes = {
          artists: ['getArtists', {}], artist: ['getArtist', { id }], album: ['getAlbum', { id }],
          albums: ['getAlbumList2', { type: 'alphabeticalByName', size: 100, offset: Math.max(0, Math.min(100000, Number(get('offset', '0')) || 0)) }],
          search: ['search3', { query: get('q').slice(0, 250), songCount: 100, albumCount: 40, artistCount: 40 }],
          playlists: ['getPlaylists', {}], playlist: ['getPlaylist', { id }]
        };
        const target = routes[p.slice('/api/music/'.length)];
        if (target) return json(res, await music.request(...[target[0], auth, target[1]]));
      }
      if (p === '/api/music/playlist' && ['POST', 'PUT'].includes(method)) {
        const b = await body(req); const name = text(b.name, 150);
        if (!Array.isArray(b.songs) || b.songs.length > 2000) throw fail(400, 'Playlist troppo grande.');
        const params = { name, songId: b.songs.map(s => text(s)), ...(b.id ? { playlistId: text(b.id) } : {}) };
        return json(res, await mutate(async () => {
          if (b.id && !b.songs.length) {
            const old = await music.request('getPlaylist', auth, { id: text(b.id) });
            return music.request('updatePlaylist', auth, { playlistId: b.id, name, songIndexToRemove: (old.playlist?.entry || []).map((_, i) => i) });
          }
          return music.request('createPlaylist', auth, params);
        }));
      }
      if (p === '/api/music/playlist' && method === 'DELETE') {
        const b = await body(req); return json(res, await music.request('deletePlaylist', auth, { id: text(b.id) }));
      }
    }
    if (['GET', 'HEAD'].includes(method)) {
      if ((p === '/' || p === '/index.html') && get('tv') === '1' && /Tizen|SMART-TV/i.test(req.headers['user-agent'] || '')) {
        const query = new URLSearchParams(url.search); query.delete('tv');
        res.writeHead(302, { Location: `/tv/${query.size ? `?${query}` : ''}`, 'Cache-Control': 'no-store', Vary: 'User-Agent' }); return res.end();
      }
      const name = p === '/' ? 'index.html' : p === '/tv/' || p === '/tv' ? 'tv/index.html' : p.slice(1);
      if (name === 'index.html' && isOldBrowser(req.headers['user-agent'], url)) {
        const page = await legacyIndex(); // TV e browser vecchi: stesso sito, JavaScript e CSS abbassati (npm run build:legacy)
        if (page) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(page) }); return res.end(req.method === 'HEAD' ? undefined : page); }
      }
      if (/^legacy[/][-a-z]+[.](js|css)$/.test(name)) return sendFile(req, res, path.join(PUBLIC, name));
      if (STATIC.has(name)) {
        if (name === 'sw.js') res.setHeader('Service-Worker-Allowed', '/');
        return sendFile(req, res, path.join(PUBLIC, name));
      }
    }
    throw fail(404, 'Pagina o file non trovato.');
  }
  const server = http.createServer((req, res) => {
    route(req, res).catch(e => {
      if (res.headersSent) { res.destroy(); return; }
      const codes = { ENOENT: [404, 'File non trovato.'], EEXIST: [409, 'Esiste già un file con questo nome. Scegli un altro nome.'], ENOSPC: [507, 'Spazio esaurito.'], EACCES: [403, 'Manca il permesso di leggere o scrivere la cartella.'], EPERM: [403, 'Operazione non permessa in questa cartella.'] };
      if (req.musicLinked && e.status === 401 && !req.url.startsWith('/api/manage/')) e.message = 'La musica va ricollegata in Gestisci.';
      const mapped = codes[e.code]; json(res, { error: mapped?.[1] || (e.status ? e.message : 'Operazione non riuscita. Controlla le cartelle e lo spazio libero.') }, mapped?.[0] || e.status || 500);
    });
  });
  server.requestTimeout = 0; server.headersTimeout = 30000;
  return { server, config, store, files, library, remote, skips, versions, trickplay, musicTranscode, musicArt, onlineArt, avatars, sessions, musicLink,
    async listen(port = config.port, host = config.host) { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); return server.address(); },
    async close() { clearInterval(sweeper); musicSessions.stop(); musicDevices.close(); await avatars.close(); await trickplay.close(); await skips.close(); await versions.close(); await musicTranscode.close(); await musicArt.close(); await library.close(); server.closeAllConnections(); if (server.listening) await new Promise(resolve => server.close(resolve)); await store.queue; }
  };
}
function safeLibraryUrl(value) {
  if (!value) return '';
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configFile = process.argv[2] ? path.resolve(process.argv[2]) : path.join(APP_DIR, 'config.json');
  const config = await readJson(configFile, null);
  if (!config) { console.error('Prima esegui: node scripts/setup.js'); process.exitCode = 1; }
  else {
    const app = await createApp({ ...config, dataDir: config.dataDir ? path.resolve(path.dirname(configFile), config.dataDir) : path.join(APP_DIR, 'data') });
    await app.listen(); console.log(`Apollon pronta sulla porta ${app.config.port}. Apri http://INDIRIZZO-DEL-TELEFONO:${app.config.port}`);
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); process.exit(0); });
  }
}
