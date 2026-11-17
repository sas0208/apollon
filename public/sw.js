import { musicCacheName, cachedRangeResponse } from './music-offline-range.js';
import { videoCacheName, videoManifestURL, videoRangeResponse } from './video-offline-range.js';
const CACHE = 'mediateca-shell-v58';
const ASSETS = ['/boot.css', '/boot.js', '/tv-controls.css', '/music-premium.css', '/', '/index.html', '/app.js', '/logic.js', '/music-logic.js', '/music-playback.js', '/music-motion.js', '/music-gestures.js', '/music-feedback.js', '/music-equalizer.js', '/virtual-list.js', '/style.css', '/music-app.css', '/video-app.css', '/fonts/figtree.woff2', '/fonts/nunitosans.woff2', '/music-shell.js', '/video-app.js', '/tv-nav.js', '/video-logic.js', '/video-player.js', '/video-manage.js', '/video-offline.js', '/video-offline-range.js', '/music-offline-range.js', '/downloads.js', '/downloads.css', '/music-cover.svg', '/icon.svg', '/icon-music.svg', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
const OFFLINE = ['/music-offline.js', '/music-offline-cache.js', '/music-library.js', '/music-library.css', '/music-listening.js'];
ASSETS.push(...['scrub.js', 'focus.js', 'router.js', 'playback.js', 'preview.js'].map(name => `/tv/${name}`));
ASSETS.push('/tv/', ...['index.html','tv.css','app.js','api.js','ui.js','rail.js','home.js','browse.js'].map(name => `/tv/${name}`), '/legacy/tv/app.js', '/legacy/tv/tv.css');
ASSETS.push('/tv/title.js','/tv/options.js');
ASSETS.push('/tv/player.js');
ASSETS.push('/tv/keyboard.js','/tv/search.js','/tv/profiles.js','/tv/settings.js');
const LAZY = [...OFFLINE, '/music-search.js', '/music-recommendations.js', '/music-moment.js', '/music-recap.js', '/music-devices.js', '/music-device-bridge.js', '/music-session.js', '/music-blend.js', '/music-songs.js', '/music-home.js'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mediateca-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Video scaricati: il lettore chiede /media/<id>?dl=1 e riceve i pezzi salvati nella memoria dell'app (con Range, per poter saltare).
  if (url.pathname.startsWith('/media/')) {
    const id = url.pathname.split('/')[2];
    if (url.searchParams.get('dl') && url.pathname === `/media/${id}`) {
      event.respondWith((async () => {
        const cache = await caches.open(videoCacheName); const saved = await cache.match(videoManifestURL);
        const entry = saved && (await saved.json()).entries?.[id];
        return entry?.state === 'done' ? videoRangeResponse(cache, entry, event.request.headers.get('Range')) : new Response(null, { status: 404 });
      })()); return;
    }
    // Locandina e sottotitoli dei video scaricati: con la rete come sempre, senza rete dalla copia salvata.
    if ((/\/poster$/.test(url.pathname) && !url.searchParams.has('v')) || /\/subtitle\/s?\d+$/.test(url.pathname)) {
      event.respondWith(fetch(event.request).catch(async () => (await (await caches.open(videoCacheName)).match(event.request.url)) || Response.error())); return;
    }
    return;
  }
  const scope = url.searchParams.get('offline');
  if (scope && url.pathname === '/api/music/stream') {
    event.respondWith((async () => {
      const cache = await caches.open(musicCacheName(scope)); const cached = await cache.match(event.request.url);
      if (cached) return cachedRangeResponse(cached, event.request.headers.get('Range'));
      return fetch(event.request);
    })()); return;
  }
  if (scope && url.pathname === '/api/music/cover') { event.respondWith(fetch(event.request).catch(async () => (await (await caches.open(musicCacheName(scope))).match(event.request.url)) || caches.match('/music-cover.svg'))); return; }
  if (![...ASSETS, ...LAZY].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(() => caches.match(event.request).then(cached => cached || (event.request.mode === 'navigate' ? caches.match('/') : Response.error()))));
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'prepare-music') return;
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...ASSETS, ...OFFLINE])).then(() => event.ports[0]?.postMessage({ ok: true })).catch(() => event.ports[0]?.postMessage({ ok: false })));
});
