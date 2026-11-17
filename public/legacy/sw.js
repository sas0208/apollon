(() => {
  // public/music-offline-range.js
  var musicCacheName = (scope) => `mediateca-music-v1:${encodeURIComponent(scope)}`;
  function byteRange(range, size) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range || "");
    if (!m || !m[1] && !m[2] || !size) return null;
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    const end = m[1] && m[2] ? Math.min(size - 1, Number(m[2])) : size - 1;
    if (![start, end].every(Number.isSafeInteger) || start < 0 || start > end || start >= size) return null;
    return { start, end };
  }
  async function cachedRangeResponse(response, range) {
    if (!range) return response;
    const blob = await response.blob();
    const selected = byteRange(range, blob.size);
    if (!selected) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${blob.size}` } });
    const { start, end } = selected;
    return new Response(blob.slice(start, end + 1), { status: 206, headers: { "Content-Type": response.headers.get("Content-Type") || "audio/mpeg", "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${blob.size}`, "Accept-Ranges": "bytes" } });
  }

  // public/video-offline-range.js
  var CHUNK = 4 * 1024 ** 2;
  var MAX_REPLY = 32 * 1024 ** 2;
  var videoCacheName = "mediateca-video-v1";
  var videoManifestURL = "/offline-video-manifest";
  var partURL = (id, n) => `/offline-video-part/${id}/${n}`;
  async function videoRangeResponse(cache, entry, rangeHeader) {
    const { total, chunk } = entry;
    let start = 0, end = total - 1, status = 200;
    if (rangeHeader) {
      const range = byteRange(rangeHeader, total);
      if (!range) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      start = range.start;
      end = Math.min(range.end, start + MAX_REPLY - 1);
      status = 206;
    }
    const blobs = [];
    for (let n = Math.floor(start / chunk); n <= Math.floor(end / chunk); n++) {
      const part = await cache.match(partURL(entry.id, n));
      if (!part) return new Response(null, { status: 404 });
      blobs.push(await part.blob());
    }
    const offset = Math.floor(start / chunk) * chunk;
    const blob = new Blob(blobs).slice(start - offset, end - offset + 1);
    const headers = { "Content-Type": entry.type || "video/mp4", "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" };
    if (status === 206) headers["Content-Range"] = `bytes ${start}-${end}/${total}`;
    return new Response(blob, { status, headers });
  }

  // public/sw.js
  var CACHE = "mediateca-shell-v58";
  var ASSETS = ["/boot.css", "/boot.js", "/tv-controls.css", "/music-premium.css", "/", "/index.html", "/app.js", "/logic.js", "/music-logic.js", "/music-playback.js", "/music-motion.js", "/music-gestures.js", "/music-feedback.js", "/music-equalizer.js", "/virtual-list.js", "/style.css", "/music-app.css", "/video-app.css", "/fonts/figtree.woff2", "/fonts/nunitosans.woff2", "/music-shell.js", "/video-app.js", "/tv-nav.js", "/video-logic.js", "/video-player.js", "/video-manage.js", "/video-offline.js", "/video-offline-range.js", "/music-offline-range.js", "/downloads.js", "/downloads.css", "/music-cover.svg", "/icon.svg", "/icon-music.svg", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];
  var OFFLINE = ["/music-offline.js", "/music-offline-cache.js", "/music-library.js", "/music-library.css", "/music-listening.js"];
  ASSETS.push(...["scrub.js", "focus.js", "router.js", "playback.js", "preview.js"].map((name) => `/tv/${name}`));
  ASSETS.push("/tv/", ...["index.html", "tv.css", "app.js", "api.js", "ui.js", "rail.js", "home.js", "browse.js"].map((name) => `/tv/${name}`), "/legacy/tv/app.js", "/legacy/tv/tv.css");
  ASSETS.push("/tv/title.js", "/tv/options.js");
  ASSETS.push("/tv/player.js");
  ASSETS.push("/tv/keyboard.js", "/tv/search.js", "/tv/profiles.js", "/tv/settings.js");
  var LAZY = [...OFFLINE, "/music-search.js", "/music-recommendations.js", "/music-moment.js", "/music-recap.js", "/music-devices.js", "/music-device-bridge.js", "/music-session.js", "/music-blend.js", "/music-songs.js", "/music-home.js"];
  self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
  self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("mediateca-shell-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/media/")) {
      const id = url.pathname.split("/")[2];
      if (url.searchParams.get("dl") && url.pathname === `/media/${id}`) {
        event.respondWith((async () => {
          var _a;
          const cache = await caches.open(videoCacheName);
          const saved = await cache.match(videoManifestURL);
          const entry = saved && ((_a = (await saved.json()).entries) == null ? void 0 : _a[id]);
          return (entry == null ? void 0 : entry.state) === "done" ? videoRangeResponse(cache, entry, event.request.headers.get("Range")) : new Response(null, { status: 404 });
        })());
        return;
      }
      if (/\/poster$/.test(url.pathname) && !url.searchParams.has("v") || /\/subtitle\/s?\d+$/.test(url.pathname)) {
        event.respondWith(fetch(event.request).catch(async () => await (await caches.open(videoCacheName)).match(event.request.url) || Response.error()));
        return;
      }
      return;
    }
    const scope = url.searchParams.get("offline");
    if (scope && url.pathname === "/api/music/stream") {
      event.respondWith((async () => {
        const cache = await caches.open(musicCacheName(scope));
        const cached = await cache.match(event.request.url);
        if (cached) return cachedRangeResponse(cached, event.request.headers.get("Range"));
        return fetch(event.request);
      })());
      return;
    }
    if (scope && url.pathname === "/api/music/cover") {
      event.respondWith(fetch(event.request).catch(async () => await (await caches.open(musicCacheName(scope))).match(event.request.url) || caches.match("/music-cover.svg")));
      return;
    }
    if (![...ASSETS, ...LAZY].includes(url.pathname)) return;
    event.respondWith(fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then((cache) => cache.put(event.request, copy)));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("/") : Response.error()))));
  });
  self.addEventListener("message", (event) => {
    var _a;
    if (((_a = event.data) == null ? void 0 : _a.type) !== "prepare-music") return;
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...ASSETS, ...OFFLINE])).then(() => {
      var _a2;
      return (_a2 = event.ports[0]) == null ? void 0 : _a2.postMessage({ ok: true });
    }).catch(() => {
      var _a2;
      return (_a2 = event.ports[0]) == null ? void 0 : _a2.postMessage({ ok: false });
    }));
  });
})();
