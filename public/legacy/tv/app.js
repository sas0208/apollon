(() => {
  // public/legacy-polyfill.js
  window.__legacy = true;
  (function() {
    var def = function(obj, name, fn) {
      if (!obj[name]) Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true });
    };
    var rel = function(i, n) {
      i = Math.trunc(i) || 0;
      return i < 0 ? n + i : i;
    };
    [Array.prototype, String.prototype, Uint8Array.prototype].forEach(function(p) {
      def(p, "at", function(i) {
        i = rel(i, this.length);
        return i < 0 || i >= this.length ? void 0 : this[i];
      });
    });
    def(Array.prototype, "findLast", function(f, t) {
      for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return this[i];
    });
    def(Array.prototype, "findLastIndex", function(f, t) {
      for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return i;
      return -1;
    });
    def(String.prototype, "replaceAll", function(a, b) {
      return this.replace(a instanceof RegExp ? a : new RegExp(String(a).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), b);
    });
    def(Object, "hasOwn", function(o, k) {
      return Object.prototype.hasOwnProperty.call(o, k);
    });
    def(window, "structuredClone", function(v) {
      return v === void 0 ? v : JSON.parse(JSON.stringify(v));
    });
    def(window, "queueMicrotask", function(f) {
      Promise.resolve().then(f);
    });
    def(window, "requestIdleCallback", function(f) {
      return setTimeout(function() {
        f({ didTimeout: false, timeRemaining: function() {
          return 10;
        } });
      }, 1);
    });
    def(window, "cancelIdleCallback", function(id) {
      clearTimeout(id);
    });
    if (window.AbortSignal) {
      def(AbortSignal, "timeout", function(ms) {
        var c2 = new AbortController();
        setTimeout(function() {
          c2.abort();
        }, ms);
        return c2.signal;
      });
      def(AbortSignal, "any", function(list) {
        var c2 = new AbortController();
        list.forEach(function(s) {
          if (s.aborted) c2.abort();
          else s.addEventListener("abort", function() {
            c2.abort();
          });
        });
        return c2.signal;
      });
    }
    def(Promise, "any", function(list) {
      return new Promise(function(ok, no) {
        var errors = [], left = 0, items = Array.from(list);
        if (!items.length) return no(new Error("All promises were rejected"));
        items.forEach(function(p, i) {
          Promise.resolve(p).then(ok, function(e) {
            errors[i] = e;
            if (++left === items.length) {
              var x = new Error("All promises were rejected");
              x.errors = errors;
              no(x);
            }
          });
        });
      });
    });
    def(Promise, "allSettled", function(list) {
      return Promise.all(Array.from(list).map(function(p) {
        return Promise.resolve(p).then(function(value) {
          return { status: "fulfilled", value };
        }, function(reason) {
          return { status: "rejected", reason };
        });
      }));
    });
    def(Promise, "withResolvers", function() {
      var r = {};
      r.promise = new Promise(function(a, b) {
        r.resolve = a;
        r.reject = b;
      });
      return r;
    });
    def(Object, "groupBy", function(items, f) {
      var out = /* @__PURE__ */ Object.create(null), i = 0;
      for (var x of items) (out[f(x, i++)] = out[f(x, i - 1)] || []).push(x);
      return out;
    });
    def(Array.prototype, "flat", function(d) {
      d = d === void 0 ? 1 : d;
      return d < 1 ? this.slice() : this.reduce(function(a, x) {
        return a.concat(Array.isArray(x) ? x.flat(d - 1) : x);
      }, []);
    });
    def(Array.prototype, "flatMap", function(f, t) {
      return this.map(f, t).flat();
    });
    if (window.crypto) def(crypto, "randomUUID", function() {
      var b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = b[6] & 15 | 64;
      b[8] = b[8] & 63 | 128;
      var h = Array.from(b, function(x) {
        return (x + 256).toString(16).slice(1);
      }).join("");
      return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
    });
    var S = Set.prototype, has = function(s, x) {
      return s.has(x);
    };
    def(S, "union", function(o) {
      var r = new Set(this);
      o.forEach(function(x) {
        r.add(x);
      });
      return r;
    });
    def(S, "intersection", function(o) {
      var r = /* @__PURE__ */ new Set();
      this.forEach(function(x) {
        if (has(o, x)) r.add(x);
      });
      return r;
    });
    def(S, "difference", function(o) {
      var r = /* @__PURE__ */ new Set();
      this.forEach(function(x) {
        if (!has(o, x)) r.add(x);
      });
      return r;
    });
    def(S, "isSubsetOf", function(o) {
      return Array.from(this).every(function(x) {
        return has(o, x);
      });
    });
    var E = window.Element && Element.prototype;
    if (E) {
      def(E, "replaceChildren", function() {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append.apply(this, arguments);
      });
      def(E, "toggleAttribute", function(n, force) {
        var on = force === void 0 ? !this.hasAttribute(n) : !!force;
        if (on) this.setAttribute(n, "");
        else this.removeAttribute(n);
        return on;
      });
    }
    [window.Document, window.DocumentFragment].forEach(function(C) {
      if (C) def(C.prototype, "replaceChildren", function() {
        while (this.firstChild) this.removeChild(this.firstChild);
        this.append.apply(this, arguments);
      });
    });
    if (window.HTMLDialogElement === void 0 && window.HTMLElement) {
      var D = HTMLElement.prototype;
      def(D, "showModal", function() {
        this.setAttribute("open", "");
      });
      def(D, "show", function() {
        this.setAttribute("open", "");
      });
      def(D, "close", function() {
        this.removeAttribute("open");
        this.dispatchEvent(new Event("close"));
      });
    }
  })();

  // public/logic.js
  function quantity(value, singular, plural = singular) {
    return `${value} ${Number(value) === 1 ? singular : plural}`;
  }
  function groupVideos(items, progress = {}) {
    const groups = [];
    const series = /* @__PURE__ */ new Map();
    const films = /* @__PURE__ */ new Map();
    const better = (a, b) => !!progress[b.id] - !!progress[a.id] || (b.size || 0) - (a.size || 0);
    for (const item of items) {
      if (!item.series) {
        const key = item.year ? `${item.root}/${String(item.title).toLowerCase()}/${item.year}` : null;
        const twin = key ? films.get(key) : null;
        if (twin) {
          if (better(twin.item, item) > 0) twin.item = item;
          continue;
        }
        const group = { title: item.title, item, episodes: null, root: item.root, year: item.year };
        if (key) films.set(key, group);
        groups.push(group);
      } else {
        const key = `${item.root}/${item.series}`;
        let group = series.get(key);
        if (!group) {
          group = { title: item.series, episodes: [], root: item.root };
          series.set(key, group);
          groups.push(group);
        }
        group.episodes.push(item);
      }
    }
    for (const group of groups) if (group.episodes) {
      group.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
      group.item = group.episodes.find((i) => {
        var _a2;
        return !((_a2 = progress[i.id]) == null ? void 0 : _a2.watched);
      }) || group.episodes[0];
    }
    return groups;
  }
  function followingEpisode(items, item) {
    if (!(item == null ? void 0 : item.series)) return null;
    const episodes = items.filter((i) => i.root === item.root && i.series === item.series).sort((a, b) => a.season - b.season || a.episode - b.episode);
    const index = episodes.findIndex((i) => i.id === item.id);
    return index < 0 ? null : episodes[index + 1] || null;
  }
  function playbackAction(item, seconds, duration, hasNext, preferences = {}) {
    if (!item || !Number.isFinite(seconds) || !(duration > 0)) return null;
    const ranges = item.salti || { sigla: [item.introStart, item.introEnd] };
    const sure = Array.isArray(item.saltiSicuri) ? item.saltiSicuri : [];
    const storyEnd = storyEndOf(item, duration);
    for (const type of ["riassunto", "sigla", "finale", "anteprima"]) {
      const range = ranges[type];
      if (!Array.isArray(range) || !(range[0] >= 0 && range[1] > range[0] && range[1] <= duration) || seconds < range[0] || seconds >= range[1]) continue;
      const closing = type === "finale" || type === "anteprima";
      const next = hasNext && closing && (storyEnd !== null && seconds >= storyEnd || range[1] >= duration - 2);
      return {
        kind: type,
        label: next ? "Prossimo episodio" : { sigla: "Salta sigla", riassunto: "Salta riassunto", finale: "Salta sigla finale", anteprima: "Salta anteprima" }[type],
        target: range[1],
        next,
        certain: sure.includes(type),
        automatic: preferences.autoSkip === true && sure.includes(type) && (!next || preferences.autoNext === true)
      };
    }
    return null;
  }
  function storyEndOf(item, duration) {
    const at = item == null ? void 0 : item.fineStoria;
    return typeof at === "number" && Number.isFinite(at) && at > 0 && duration > 0 && at < duration && at >= duration / 2 ? at : null;
  }

  // public/video-logic.js
  var DAY = 864e5;
  var unique = (values) => [...new Set(values.filter((v) => v !== null && v !== void 0 && v !== ""))];
  var fold = (text) => String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("it");
  var hashText = (text) => [...String(text)].reduce((h, ch) => Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0, 2166136261);
  var LANGUAGES = {
    ita: "Italiano",
    it: "Italiano",
    jpn: "Giapponese",
    ja: "Giapponese",
    jp: "Giapponese",
    eng: "Inglese",
    en: "Inglese",
    fra: "Francese",
    fre: "Francese",
    fr: "Francese",
    spa: "Spagnolo",
    es: "Spagnolo",
    deu: "Tedesco",
    ger: "Tedesco",
    de: "Tedesco",
    kor: "Coreano",
    ko: "Coreano",
    chi: "Cinese",
    zho: "Cinese",
    zh: "Cinese",
    por: "Portoghese",
    pt: "Portoghese"
  };
  function languageName(code) {
    const key = String(code || "").toLowerCase();
    if (!key || key === "und" || key === "sottotitoli") return "Lingua non indicata";
    return LANGUAGES[key] || String(code).charAt(0).toUpperCase() + String(code).slice(1);
  }
  var isItalian = (code) => ["ita", "it"].includes(String(code || "").toLowerCase());
  var episodeCode = (item) => (item == null ? void 0 : item.series) ? `S${item.season}:E${item.episode}` : "";
  function durationText(seconds) {
    if (!(seconds > 0)) return "";
    const m = Math.max(1, Math.round(seconds / 60));
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`;
  }
  function remainingText(position, duration) {
    const left = Math.max(0, (duration || 0) - (position || 0));
    if (!(duration > 0)) return "";
    const m = Math.ceil(left / 60);
    return m >= 60 ? `Mancano ${Math.floor(m / 60)} h ${m % 60} min` : `Mancano ${m} min`;
  }
  function languageBadges(items, anime) {
    const audio = unique(items.flatMap((i) => (i.streams || []).filter((s) => s.type === "audio").map((s) => String(s.language || "").toLowerCase()))).filter((a) => !["und", "zxx"].includes(a));
    const subs = items.some((i) => {
      var _a2;
      return ((_a2 = i.subtitles) == null ? void 0 : _a2.length) || (i.streams || []).some((s) => s.type === "subtitle");
    });
    const height = Math.max(0, ...items.map((i) => Math.max(0, ...(i.streams || []).filter((s) => s.type === "video").map((s) => s.height || 0))));
    const badges = [];
    if (anime && audio.some((a) => !isItalian(a) && a !== "und") && subs) badges.push("SUB");
    if (anime && audio.some(isItalian)) badges.push("DOPPIATO");
    if (height >= 2e3) badges.push("4K");
    else if (height >= 700) badges.push("HD");
    return badges;
  }
  function buildTitles(items, progress = {}) {
    return groupVideos(items, progress).map((group) => {
      var _a2, _b;
      const all = group.episodes || [group.item];
      const kind = group.root === "Anime" ? "anime" : group.episodes ? "series" : "film";
      const key = group.episodes ? `s:${group.root}/${group.title}` : `f:${group.item.id}`;
      const art = [...all].sort((a, b) => artQuality(b) - artQuality(a))[0];
      const added = Math.max(0, ...all.map((i) => i.added || i.mtime || 0));
      const firstAdded = Math.min(...all.map((i) => i.added || i.mtime || 0));
      const years = all.map((i) => i.year).filter(Boolean);
      const description = group.episodes ? ((_a2 = all.find((i) => i.seriesDescription)) == null ? void 0 : _a2.seriesDescription) || "" : group.item.description || "";
      return {
        ...group,
        kind,
        key,
        art,
        added,
        firstAdded,
        year: group.year || (years.length ? Math.min(...years) : null),
        genres: unique(all.flatMap((i) => i.genres || [])),
        tags: unique(all.flatMap((i) => i.tags || [])),
        seasons: group.episodes ? unique(all.map((i) => i.season)).sort((a, b) => a - b) : [],
        subs: all.some((i) => {
          var _a3;
          return ((_a3 = i.subtitles) == null ? void 0 : _a3.length) || (i.streams || []).some((s) => s.type === "subtitle");
        }),
        description,
        score: ((_b = all.find((i) => i.onlineScore)) == null ? void 0 : _b.onlineScore) || null,
        badges: languageBadges(all, kind === "anime"),
        duration: group.episodes ? null : group.item.duration || 0,
        remote: all.every((i) => i.remote) ? all[0].remote : "",
        hasRemote: all.some((i) => i.remote),
        remoteDown: all.every((i) => i.remote && i.remoteDown),
        watched: all.every((i) => {
          var _a3;
          return (_a3 = progress[i.id]) == null ? void 0 : _a3.watched;
        }),
        started: all.some((i) => {
          var _a3, _b2;
          return ((_a3 = progress[i.id]) == null ? void 0 : _a3.position) > 0 || ((_b2 = progress[i.id]) == null ? void 0 : _b2.watched);
        })
      };
    });
  }
  var artQuality = (i) => {
    var _a2, _b, _c;
    return i ? (i.poster || i.backdrop || i.imagePath ? 8 : 0) + (((_a2 = i.images) == null ? void 0 : _a2.backdrop) ? 4 : 0) + (((_b = i.images) == null ? void 0 : _b.poster) ? 2 : 0) + (((_c = i.images) == null ? void 0 : _c.thumb) || i.image ? 1 : 0) : 0;
  };
  function artworkSources(title2 = {}, item, kind = "thumb", size = 640) {
    const sources = [];
    const add = (i, k) => {
      var _a2, _b;
      if ((i == null ? void 0 : i.id) && (((_a2 = i.images) == null ? void 0 : _a2[k]) || k === "thumb" && i.image)) sources.push(`/media/${i.id}/${k}?s=${size}&v=${encodeURIComponent(((_b = i.images) == null ? void 0 : _b.v) || 0)}`);
    };
    if (kind === "thumb") add(item, "thumb");
    for (const k of kind === "poster" ? ["poster", "backdrop", "thumb"] : ["backdrop", "poster", "thumb"]) add(title2.art || title2.item || item, k);
    if (item !== title2.art) for (const k of ["backdrop", "poster", "thumb"]) add(item, k);
    const escape = (s) => String(s).replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c2]);
    const name = escape(String(title2.title || (item == null ? void 0 : item.series) || (item == null ? void 0 : item.title) || "Apollon").slice(0, 85));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#62432d"/><stop offset="1" stop-color="#191715"/></linearGradient></defs><path fill="url(#a)" d="M0 0h640v960H0z"/><circle cx="510" cy="210" r="195" fill="none" stroke="#ff8c42" stroke-width="3"/><circle cx="510" cy="210" r="160" fill="none" stroke="#ff8c42" opacity=".3"/><path d="M230 290a105 105 0 1 0 130 130 95 95 0 0 1-130-130" fill="#ff8c42"/><foreignObject x="48" y="510" width="544" height="360"><div xmlns="http://www.w3.org/1999/xhtml" style="font:600 48px Arial;color:#f5f3ef;line-height:1.18;overflow-wrap:break-word">${name}</div></foreignObject></svg>`;
    return unique([...sources, `data:image/svg+xml,${encodeURIComponent(svg)}`]);
  }
  var kindLabel = (t) => ({ film: "Film", series: "Serie TV", anime: "Anime" })[t.kind];
  var SECTION_OF = { anime: "anime", film: "film-serie", series: "film-serie" };
  var SECTION_NAMES = { anime: "Anime", "film-serie": "Film e Serie TV" };
  function metaParts(t) {
    const length = t.episodes ? t.seasons.length > 1 ? quantity(t.seasons.length, "stagione", "stagioni") : quantity(t.episodes.length, "episodio", "episodi") : durationText(t.duration);
    return [t.year, t.genres[0] || kindLabel(t), length].filter(Boolean).map(String);
  }
  function featuredTitle(titles, day = Math.floor(Date.now() / DAY)) {
    if (!titles.length) return null;
    const quality = (t) => {
      var _a2;
      return (((_a2 = t.description) == null ? void 0 : _a2.trim()) ? 2 : 0) + (artQuality(t.art) > 0 ? 1 : 0);
    };
    const best = Math.max(...titles.map(quality));
    const ready = titles.filter((t) => quality(t) === best);
    const fresh = ready.filter((t) => !t.started);
    const pool = fresh.length ? fresh : ready.filter((t) => !t.watched).length ? ready.filter((t) => !t.watched) : ready;
    const sorted = [...pool].sort((a, b) => a.key.localeCompare(b.key));
    return sorted[hashText(`giorno-${day}`) % sorted.length];
  }
  function resumePoint(title2, items, progress = {}) {
    if (!title2.episodes) {
      const p = progress[title2.item.id];
      return { item: title2.item, position: p && !p.watched ? p.position || 0 : 0, resume: !!((p == null ? void 0 : p.position) > 0 && !p.watched) };
    }
    const ordered = title2.episodes;
    const seen = (i) => {
      var _a2;
      return !!((_a2 = progress[i.id]) == null ? void 0 : _a2.watched);
    };
    const furthest = ordered.reduce((n, i, at) => seen(i) ? at : n, -1);
    const halfway = ordered.filter((i, at) => {
      var _a2;
      return at >= Math.max(0, furthest) && !seen(i) && ((_a2 = progress[i.id]) == null ? void 0 : _a2.position) > 0;
    }).sort((a, b) => (progress[b.id].updated || 0) - (progress[a.id].updated || 0))[0];
    if (halfway) return { item: halfway, position: progress[halfway.id].position, resume: true };
    const next = ordered.slice(furthest + 1).find((i) => !seen(i));
    if (furthest >= 0 && next) return { item: next, position: 0, resume: true, next: true };
    const first = ordered.find((i) => !seen(i)) || ordered[0];
    return { item: first, position: 0, resume: false };
  }
  function playLabel(title2, point) {
    if (!point) return "Riproduci";
    const code = title2.episodes ? ` ${episodeCode(point.item)}` : "";
    return point.resume ? `Riprendi${code}` : `Riproduci${title2.episodes && point.item !== title2.episodes[0] ? code : ""}`;
  }
  function continueEntries(titles, items, progress = {}) {
    const entries = [];
    for (const t of titles) {
      const touched = (t.episodes || [t.item]).filter((i) => {
        var _a2;
        return (_a2 = progress[i.id]) == null ? void 0 : _a2.updated;
      });
      if (!touched.length) continue;
      const latest = touched.sort((a, b) => progress[b.id].updated - progress[a.id].updated)[0];
      const p = progress[latest.id];
      if (p.hidden) continue;
      const point = resumePoint(t, items, progress);
      if (!point.resume) continue;
      const pp = progress[point.item.id] || {};
      entries.push({ title: t, item: point.item, position: point.position, duration: pp.duration || point.item.duration || 0, next: !!point.next, updated: p.updated, hideId: latest.id });
    }
    return entries.sort((a, b) => b.updated - a.updated).slice(0, 20);
  }
  function similarTitles(title2, titles, limit = 12) {
    const genres = new Set(title2.genres);
    return titles.filter((t) => t.key !== title2.key).map((t) => ({ t, score: t.genres.filter((g) => genres.has(g)).length * 3 + (t.kind === title2.kind ? 1 : 0) + (t.watched ? -2 : 0) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title, "it")).slice(0, limit).map((x) => x.t);
  }
  function genreCounts(titles) {
    const counts = /* @__PURE__ */ new Map();
    for (const t of titles) for (const g of t.genres) counts.set(g, (counts.get(g) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "it")).map(([name, count]) => ({ name, count }));
  }
  var ANIME_FAMILIES = [
    ["azione", "Azione e battaglie", ["action", "azione", "martial arts", "battle royale", "swordplay"]],
    ["isekai", "Isekai e altri mondi", ["isekai", "reincarnation", "reincarnazione", "alternate universe", "virtual world"]],
    ["fantasy", "Fantasy", ["fantasy", "magic", "magia"]],
    ["dark-fantasy", "Dark fantasy", ["dark fantasy"]],
    ["avventura", "Avventura", ["adventure", "avventura"]],
    ["soprannaturale", "Soprannaturale", ["supernatural", "soprannaturale", "demons", "demoni", "youkai", "ghost"]],
    ["psicologico", "Psicologico e thriller", ["psychological", "psicologico", "thriller", "mystery", "mistero", "suspense"]],
    ["commedia", "Commedia", ["comedy", "commedia"]],
    ["sport", "Sport", ["sports", "sport"]],
    ["mecha", "Mecha e fantascienza", ["mecha", "sci-fi", "science fiction", "fantascienza", "space", "space opera"]],
    ["romance", "Romance", ["romance", "romantico", "romantica"]],
    ["quotidiano", "Slice of life", ["slice of life", "vita quotidiana"]]
  ];
  var FILM_FAMILIES = [
    ["azione", "Azione", ["action", "azione"]],
    ["avventura", "Avventura", ["adventure", "avventura"]],
    ["commedia", "Commedia", ["comedy", "commedia"]],
    ["drammatico", "Drammatico", ["drama", "drammatico"]],
    ["thriller", "Thriller", ["thriller", "suspense"]],
    ["fantascienza", "Fantascienza", ["sci-fi", "science fiction", "fantascienza"]],
    ["animazione", "Animazione", ["animation", "animazione"]],
    ["famiglia", "Famiglia", ["family", "kids & family", "famiglia"]],
    ["fantasy", "Fantasy", ["fantasy"]],
    ["horror", "Horror", ["horror"]],
    ["poliziesco", "Poliziesco", ["crime", "poliziesco"]],
    ["romantico", "Romantico", ["romance", "romantico", "romantica"]],
    ["documentario", "Documentario", ["documentary", "documentario"]],
    ["storico", "Storico", ["history", "storico"]],
    ["guerra", "Guerra", ["war", "guerra"]],
    ["western", "Western", ["western"]]
  ];
  function catalogCategories(titles, page = "home") {
    const pool = titles.filter((t) => !["anime", "film", "series"].includes(page) || t.kind === page);
    const out = [];
    const add = (id, name, entries) => {
      if (entries.length >= 3) out.push({ id, name, entries });
    };
    if (page === "home" || page === "new" || page === "list") for (const kind of ["anime", "film", "series"]) add(`tipo-${kind}`, { anime: "Anime", film: "Film", series: "Serie TV" }[kind], pool.filter((t) => t.kind === kind));
    const kinds = ["anime", "film", "series"].includes(page) ? [page] : ["anime", "film", "series"];
    for (const kind of kinds) for (const [id, name, aliases] of kind === "anime" ? ANIME_FAMILIES : FILM_FAMILIES) {
      const entries = pool.filter((t) => t.kind === kind && [...t.genres || [], ...kind === "anime" ? t.tags || [] : []].some((g) => aliases.includes(fold(g))));
      add(`${kind}-${id}`, kinds.length > 1 ? `${name} \xB7 ${{ anime: "Anime", film: "Film", series: "Serie TV" }[kind]}` : name, entries);
    }
    return out;
  }
  function rankingScore(title2, rating = {}) {
    const online = Number.isFinite(title2.score) && title2.score > 0 ? Math.min(10, title2.score) : 5;
    const count = Number.isInteger(rating.count) && rating.count > 0 ? rating.count : 0;
    const sum = count && Number.isFinite(rating.sum) ? Math.max(count, Math.min(count * 5, rating.sum)) : 0;
    return count && sum ? (online * 3 + sum * 2) / (3 + count) : online;
  }
  function topTen(titles, ratings = {}) {
    return [...new Map(titles.map((t) => [t.key, t])).values()].sort((a, b) => rankingScore(b, ratings[b.key]) - rankingScore(a, ratings[a.key]) || a.key.localeCompare(b.key)).slice(0, 10);
  }
  var byAdded = (a, b) => b.added - a.added || a.title.localeCompare(b.title, "it");
  function newEpisodeTitles(titles, now = Date.now(), days = 14) {
    return titles.filter((t) => t.episodes && now - t.added < days * DAY && t.added - t.firstAdded > DAY).sort(byAdded);
  }
  function distinctRowLeads(rows) {
    const key = (e) => {
      var _a2;
      return (((_a2 = e.title) == null ? void 0 : _a2.key) ? e.title : e).key;
    };
    const ranking = rows.find((r) => r.shape === "ranking");
    const continuing = rows.find((r) => r.id === "continua");
    const shared = ranking && (continuing == null ? void 0 : continuing.entries.length) === 1 && key(continuing.entries[0]) === key(ranking.entries[0]);
    const ranked = shared ? { ...ranking, entries: [continuing.entries[0], ...ranking.entries.slice(1)] } : ranking;
    const used = new Set(ranked ? [key(ranked.entries[0])] : []);
    const out = [];
    for (const row of rows) {
      if (row === ranking) {
        out.push(ranked);
        continue;
      }
      const leader = row.entries.find((e) => !used.has(key(e)));
      if (!leader) continue;
      used.add(key(leader));
      out.push({ ...row, entries: [leader, ...row.entries.filter((e) => e !== leader)] });
    }
    return out;
  }
  function buildRows(titles, items, progress = {}, list = [], { page = "home", now = Date.now(), genre = "", ratings = {}, tv = false } = {}) {
    var _a2;
    const pool = page === "home" ? titles : titles.filter((t) => t.kind === page);
    const scoped = genre ? pool.filter((t) => t.genres.includes(genre)) : pool;
    const rows = [];
    const add = (id, title2, entries, shape = "poster") => {
      if (entries.length) rows.push({ id, title: title2, entries, shape });
    };
    const keys2 = new Set(scoped.map((t) => t.key));
    add("continua", "Continua a guardare", continueEntries(titles, items, progress).filter((e) => keys2.has(e.title.key)), "continue");
    const listed = list.map((l) => titles.find((t) => t.key === l.key)).filter((t) => t && keys2.has(t.key));
    add("lista", "La mia lista", listed);
    if (tv) add("top10", "I 10 migliori su Apollon", topTen(scoped, ratings), "ranking");
    const newEpisodes = newEpisodeTitles(scoped, now);
    const newKeys = new Set(newEpisodes.map((t) => t.key));
    const additions = tv ? scoped.filter((t) => !newKeys.has(t.key)).sort((a, b) => b.firstAdded - a.firstAdded || a.key.localeCompare(b.key)) : [...scoped].sort(byAdded);
    add("recenti", "Aggiunti di recente", additions.slice(0, 15));
    if (page === "home" || page === "series" || page === "anime") add("nuovi-episodi", "Nuovi episodi", newEpisodes);
    if (page === "home" && !genre) {
      add("anime", "Anime", scoped.filter((t) => t.kind === "anime").sort(byAdded));
      add("film", "Film", scoped.filter((t) => t.kind === "film").sort((a, b) => a.title.localeCompare(b.title, "it")));
      add("serie", "Serie TV", scoped.filter((t) => t.kind === "series").sort((a, b) => a.title.localeCompare(b.title, "it")));
    }
    const recent = (_a2 = titles.filter((t) => t.started && keys2.has(t.key)).map((t) => ({ t, at: Math.max(0, ...(t.episodes || [t.item]).map((i) => {
      var _a3;
      return ((_a3 = progress[i.id]) == null ? void 0 : _a3.updated) || 0;
    })) })).sort((a, b) => b.at - a.at)[0]) == null ? void 0 : _a2.t;
    const because = recent ? similarTitles(recent, scoped).filter((t) => !t.watched) : [];
    const sections = page === "home" ? ["anime", "film-serie"].map((id) => ({ id, pool: scoped.filter((t) => SECTION_OF[t.kind] === id) })).filter((s) => s.pool.length) : [{ id: "", pool: scoped }];
    const split = sections.length > 1;
    const categories = tv ? catalogCategories(scoped, page).map((g) => ({ name: g.name, id: g.id, entries: g.entries })) : sections.flatMap((s) => genreCounts(s.pool).filter((g) => g.count >= 2 && g.name !== genre).slice(0, split ? 5 : 8).map((g) => ({ ...g, name: split ? `${g.name} \xB7 ${SECTION_NAMES[s.id]}` : g.name, id: split ? `${s.id}-${g.name}` : g.name, entries: s.pool.filter((t) => t.genres.includes(g.name)) })));
    for (const [index, g] of categories.entries()) {
      add(`genere-${g.id}`, g.name, [...g.entries].sort((a, b) => Number(a.watched) - Number(b.watched) || (tv ? rankingScore(b, ratings[b.key]) - rankingScore(a, ratings[a.key]) || a.key.localeCompare(b.key) : byAdded(a, b))));
      if (index === 1 && because.length >= 2) add("perche", `Perch\xE9 hai guardato ${recent.title}`, because);
    }
    if (because.length >= 2 && !rows.some((r) => r.id === "perche")) add("perche", `Perch\xE9 hai guardato ${recent.title}`, because);
    add("rivedere", "Da rivedere", scoped.filter((t) => t.watched).sort(byAdded));
    if (genre && !rows.some((r) => r.id === "recenti")) add("tutti", genre, scoped);
    return tv && page === "home" ? distinctRowLeads(rows) : rows;
  }
  function novitaGroups(titles, now = Date.now()) {
    const groups = [{ label: "Questa settimana", entries: [] }, { label: "Questo mese", entries: [] }, { label: "Arrivati prima", entries: [] }];
    for (const t of [...titles].sort(byAdded)) {
      const age = now - t.added;
      const target = age < 7 * DAY ? 0 : age < 31 * DAY ? 1 : 2;
      const latest = t.episodes ? [...t.episodes].sort((a, b) => (b.added || 0) - (a.added || 0))[0] : null;
      const note = !t.episodes ? "Nuovo film" : t.added - t.firstAdded > DAY ? latest.episode === 1 ? `Nuova stagione: stagione ${latest.season}` : "Nuovi episodi" : t.kind === "anime" ? "Nuovo anime" : "Nuova serie";
      groups[target].entries.push({ title: t, note, item: latest || t.item });
    }
    return groups.filter((g) => g.entries.length);
  }
  function searchTitles(titles, query) {
    const q = fold(query).trim();
    if (!q) return [];
    const words = q.split(/\s+/);
    const scored = titles.map((t) => {
      const name = fold(t.title);
      const genres = t.genres.map(fold).join(" ");
      const episodes = (t.episodes || []).map((i) => fold(i.title)).join(" ");
      const haystack = `${name} ${genres} ${episodes} ${t.year || ""} ${fold(kindLabel(t))}`;
      if (!words.every((w) => haystack.includes(w))) return null;
      const score = (name.startsWith(q) ? 100 : 0) + (name.includes(q) ? 50 : 0) + (genres.includes(q) ? 20 : 0) + (String(t.year) === q ? 20 : 0);
      return { t, score };
    }).filter(Boolean);
    return scored.sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title, "it")).map((x) => x.t);
  }
  function sortList(titles, list, order = "aggiunti") {
    const at = new Map(list.map((l) => [l.key, l.added]));
    const listed = list.map((l) => titles.find((t) => t.key === l.key)).filter(Boolean);
    if (order === "titolo") return listed.sort((a, b) => a.title.localeCompare(b.title, "it"));
    if (order === "anno") return listed.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title, "it"));
    return listed.sort((a, b) => (at.get(b.key) || 0) - (at.get(a.key) || 0));
  }
  var HOME_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)|\.local$|^[^.]+$/i;
  function connectionIsSlow({ host: host2 = "", effectiveType, downlink, saveData, measuredKbps } = {}) {
    if (host2 && !HOME_HOST.test(host2)) return true;
    if (saveData === true) return true;
    if (["slow-2g", "2g", "3g"].includes(effectiveType)) return true;
    if (Number.isFinite(downlink) && downlink > 0 && downlink < 1.5) return true;
    return Number.isFinite(measuredKbps) && measuredKbps > 0 && measuredKbps < 1500;
  }
  function chooseQuality(preference, item, connection) {
    const light = !!(item == null ? void 0 : item.light);
    if (preference === "480") return light ? "480" : "original";
    if (preference === "original") return "original";
    return light && connectionIsSlow(connection) ? "480" : "original";
  }
  var mediaUrl = (item, quality) => `/media/${item.id}${quality === "480" && item.light ? "?q=480" : ""}`;

  // public/tv/api.js
  var storage = {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem(`mediateca:${key}`);
        return v === null ? fallback : JSON.parse(v);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(`mediateca:${key}`, JSON.stringify(value));
      } catch {
      }
    }
  };
  async function request(url, data2, method = "PUT") {
    const response = await fetch(url, data2 === void 0 ? {} : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data2) });
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "Non riesco a caricare i dati. Riprova.");
    return value;
  }
  var TVData = class {
    constructor() {
      this.items = [];
      this.titles = [];
      this.progress = {};
      this.list = [];
      this.ratings = {};
      this.profiles = [];
      this.profile = storage.get("profile");
    }
    get person() {
      return this.profiles.find((p) => p.id === this.profile);
    }
    async load() {
      const [boot, library] = await Promise.all([request("/api/bootstrap"), request("/api/library"), this.refreshRatings()]);
      this.boot = boot;
      this.profiles = boot.profiles;
      this.items = library.items.filter((i) => i.root !== "Musica" && i.kind !== "audio" && i.kind !== "image");
      if (!this.person) this.profile = null;
      if (this.profile) await this.selectProfile(this.profile);
      else this.rebuild();
    }
    rebuild() {
      this.titles = buildTitles(this.items, this.progress);
    }
    async selectProfile(id) {
      const [progress, list] = await Promise.all([request(`/api/progress?profile=${encodeURIComponent(id)}`), request(`/api/mylist?profile=${encodeURIComponent(id)}`)]);
      this.profile = id;
      this.progress = progress;
      this.list = list.items;
      storage.set("profile", id);
      this.rebuild();
    }
    async reloadLibrary() {
      const library = await request("/api/library");
      this.items = library.items.filter((i) => i.root !== "Musica" && i.kind !== "audio" && i.kind !== "image");
      this.rebuild();
    }
    async refreshRatings() {
      this.ratings = await request("/api/ratings/summary").catch(() => ({}));
    }
    async refresh() {
      await this.refreshRatings();
      await this.reloadLibrary();
      if (this.profile) await this.selectProfile(this.profile);
    }
    async saveProgress(id, patch, profile = this.profile) {
      const value = await request("/api/progress", { profile, id, ...patch });
      if (profile === this.profile) {
        this.progress[id] = value;
        this.rebuild();
      }
      return value;
    }
    async listed(title2) {
      const on = !this.list.some((i) => i.key === title2.key);
      this.list = (await request("/api/mylist", { profile: this.profile, key: title2.key, on })).items;
      return on;
    }
    async watched(title2, on = !title2.watched) {
      const ids = (title2.episodes || [title2.item]).map((i) => i.id);
      Object.assign(this.progress, await request("/api/progress/batch", { profile: this.profile, ids, watched: on }));
      this.rebuild();
    }
    async preference(patch) {
      const person = await request("/api/profiles/preferences", { profile: this.profile, ...patch });
      Object.assign(this.person, person);
    }
    preferenceValue(key, fallback) {
      return storage.get(`${key}:${this.profile}`, fallback);
    }
    setPreference(key, value) {
      storage.set(`${key}:${this.profile}`, value);
    }
    async primePreviews(current, next) {
      const continuing = continueEntries(this.titles, this.items, this.progress).map((e) => e.item.id);
      const rest = this.items.filter((i) => !i.remoteDown).map((i) => i.id);
      const first = { ...current ? { current } : {}, ...next ? { next } : {}, continuing, rest: rest.slice(0, 350) };
      await request("/api/tv/trickplay", first, "POST").catch(() => {
      });
      for (let n = 350; n < rest.length; n += 350) await request("/api/tv/trickplay", { rest: rest.slice(n, n + 350) }, "POST").catch(() => {
      });
    }
  };

  // public/tv/router.js
  var copy = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  var Router = class {
    constructor() {
      this.stack = [];
    }
    get current() {
      return this.stack[this.stack.length - 1] || null;
    }
    push(name, params = {}, returnState) {
      if (this.current && returnState) this.current.state = copy(returnState);
      const entry = { name, params: copy(params), state: null };
      this.stack.push(entry);
      return entry;
    }
    replace(name, params = {}) {
      this.stack = [];
      return this.push(name, params);
    }
    back() {
      if (this.stack.length < 2) return null;
      this.stack.pop();
      return this.current;
    }
  };

  // public/tv/focus.js
  var acceptRepeat = (key, now, last2, repeat) => !repeat || !last2 || last2.key !== key || now - last2.at >= (key === "up" || key === "down" ? 160 : 110);
  var FocusModel = class {
    constructor(rows = []) {
      this.rows = [];
      this.memory = {};
      this.row = "";
      this.setRows(rows);
    }
    setRows(rows) {
      var _a2;
      this.rows = rows.filter((r) => r.items.length);
      if (!this.rows.some((r) => r.id === this.row)) this.row = ((_a2 = this.rows[0]) == null ? void 0 : _a2.id) || "";
      return this;
    }
    get current() {
      const r = Math.max(0, this.rows.findIndex((row2) => row2.id === this.row));
      const row = this.rows[r];
      if (!row) return { row: "", item: "", r: 0, c: 0 };
      const c2 = Math.max(0, row.items.indexOf(this.memory[row.id]));
      return { row: row.id, item: row.items[c2], r, c: c2 };
    }
    select(row, item) {
      if (this.rows.some((r) => r.id === row)) {
        this.row = row;
        if (item !== void 0) this.memory[row] = item;
      }
      return this.current;
    }
    move(direction) {
      const { r, c: c2 } = this.current;
      const row = this.rows[r];
      if (!row) return;
      if (direction === "left" && c2 === 0) return "rail";
      if (direction === "left" || direction === "right") this.memory[row.id] = row.items[Math.max(0, Math.min(row.items.length - 1, c2 + (direction === "right" ? 1 : -1)))];
      else this.row = this.rows[Math.max(0, Math.min(this.rows.length - 1, r + (direction === "down" ? 1 : -1)))].id;
      return this.current;
    }
    snapshot() {
      return { row: this.row, memory: { ...this.memory } };
    }
    restore(state) {
      if (state) {
        this.memory = { ...state.memory };
        if (this.rows.some((r) => r.id === state.row)) this.row = state.row;
      }
      return this.current;
    }
  };

  // public/tv/ui.js
  function el(tag, cls = "", ...children) {
    const node = document.createElement(tag);
    node.className = cls;
    for (const child of children.flat()) if (child !== null && child !== void 0) node.append(child.nodeType ? child : document.createTextNode(String(child)));
    return node;
  }
  function icon(name) {
    const paths = { search: "M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0", home: "M3 11l9-8 9 8v10h-6v-7H9v7H3z", series: "M3 7h18v14H3z M7 3h10", film: "M3 4h18v17H3z M7 4v17 M17 4v17 M3 9h4 M3 16h4 M17 9h4 M17 16h4", anime: "M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3z", new: "M12 3v18 M3 12h18 M5 5l14 14 M19 5L5 19", list: "M5 3h14v19l-7-5-7 5z", music: "M9 18V5l12-2v12 M9 5l12-2 M9 18c0 4-7 4-7 0s7-4 7 0 M21 15c0 4-7 4-7 0s7-4 7 0", profile: "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10 M3 23v-3c0-7 18-7 18 0v3", settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 2h6l1 4 4 1 2 5-2 5-4 1-1 4H9l-1-4-4-1-2-5 2-5 4-1z", play: "M7 3l14 9-14 9z", pause: "M7 3v18 M17 3v18", moon: "M20 13A9 9 0 1 1 10 2a8 8 0 0 0 10 11", back: "M15 4l-8 8 8 8", next: "M4 4l12 8-12 8z M20 4v16", subtitles: "M2 4h20v16H2z M5 12h5 M14 12h5 M5 16h5 M14 16h5", episodes: "M3 4h18v7H3z M3 15h18v7H3z", plus: "M12 3v18 M3 12h18", check: "M3 12l6 6L21 5" };
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", paths[name] || paths.moon);
    svg.append(path);
    return svg;
  }
  function button(label, id, primary = false, glyph) {
    const node = el("div", `tv-button${primary ? " primary" : ""}`, glyph ? icon(glyph) : null, el("span", "", label));
    node.dataset.id = id;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", label);
    return node;
  }
  function artwork(item, kind = "thumb", size = 640, title2 = {}) {
    const sources = artworkSources(title2, item, kind, size);
    const image = el("img");
    let at = 0;
    image.src = sources[at];
    image.alt = "";
    image.draggable = false;
    image.addEventListener("error", () => {
      if (at < sources.length - 1) image.src = sources[++at];
    });
    return image;
  }
  function cardArtKind(entry, { poster = false, active = false } = {}) {
    var _a2, _b;
    const continuing = ((_a2 = entry.title) == null ? void 0 : _a2.key) && ("position" in entry || entry.next);
    if (poster) return active ? continuing ? "thumb" : "backdrop" : "poster";
    return !((_b = entry.title) == null ? void 0 : _b.key) && entry.kind ? "backdrop" : "thumb";
  }
  function card(entry, active, progress = {}, { poster = false, rank = 0 } = {}) {
    var _a2, _b, _c, _d;
    const title2 = ((_a2 = entry.title) == null ? void 0 : _a2.key) ? entry.title : entry;
    const item = entry.item || title2.art || title2.item;
    const p = progress[item.id] || {};
    const node = el("div", `tv-card${active ? " is-active" : ""}${title2.remoteDown ? " offline" : ""}${poster ? " poster-card" : ""}${poster && active ? " expanded-card" : ""}`);
    node.dataset.id = title2.key;
    node.setAttribute("role", "button");
    node.setAttribute("aria-label", `${rank ? rank + ". " : ""}${title2.title}`);
    const continuing = ((_b = entry.title) == null ? void 0 : _b.key) && ("position" in entry || entry.next);
    const kind = cardArtKind(entry, { poster, active });
    const art = el("div", "card-art", artwork(item, kind, active ? 960 : 480, title2));
    if (poster) {
      const name = el("span", "card-name", title2.title);
      name.hidden = !active;
      if (active) art.append(name);
      const shown = art.firstChild;
      const check = () => {
        if (String(shown.currentSrc || shown.src).startsWith("data:")) name.hidden = true;
      };
      check();
      shown.addEventListener("load", check);
      if (active && ((_d = (_c = title2.art) == null ? void 0 : _c.images) == null ? void 0 : _d.logo)) {
        const logo = el("img", "card-logo");
        logo.src = `/media/${title2.art.id}/logo?s=480&v=${encodeURIComponent(title2.art.images.lv || title2.art.images.v || 0)}`;
        logo.alt = title2.title;
        logo.addEventListener("load", () => name.hidden = true, { once: true });
        logo.addEventListener("error", () => logo.remove(), { once: true });
        art.append(logo);
      }
    }
    if (rank) {
      const number = el("span", `rank-number${rank === 10 ? " double" : ""}`, rank);
      number.setAttribute("aria-hidden", "true");
      node.append(number);
    }
    if (title2.remoteDown) art.append(el("span", "offline-label", "Fisso spento"));
    const share = p.watched ? 1 : (p.position || 0) / (p.duration || item.duration || 1);
    if (share > 0) {
      const bar = el("div", "card-progress", el("i"));
      bar.firstChild.style.transform = `scaleX(${Math.min(1, share)})`;
      art.append(bar);
    }
    node.append(art, el("div", "card-caption", el("strong", "", title2.title), el("span", "", continuing ? [episodeCode(item).replace(":", " "), remainingText(entry.position, entry.duration)].filter(Boolean).join(" \xB7 ") : metaParts(title2).join(" \xB7 "))));
    return node;
  }
  function railLayout(count, index, active = true, ranked = false) {
    var _a2;
    const height = 330, poster = 220, wide = height * 16 / 9, space = 24, numberWidth = ranked ? 140 : 0;
    let x = 0;
    const cards = Array.from({ length: count }, (_, i) => {
      const width = active && i === index ? wide : poster;
      const card2 = { left: x + numberWidth, width };
      x += numberWidth + width + space;
      return card2;
    });
    const offset = Math.min(((_a2 = cards[index]) == null ? void 0 : _a2.left) - numberWidth || 0, Math.max(0, x - space - 1680));
    const visible = cards.map((c2, i) => ({ c: c2, i })).filter(({ c: c2 }) => c2.left + c2.width >= offset - 260 && c2.left - numberWidth <= offset + 1740).map(({ i }) => i);
    return { height, numberWidth, cards, offset, visible };
  }
  function rowDetails(entry) {
    var _a2, _b;
    const t = ((_a2 = entry.title) == null ? void 0 : _a2.key) ? entry.title : entry;
    const item = entry.item || t.item;
    const meta = [kindLabel(t), ...metaParts(t)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" \xB7 ");
    const continuing = ((_b = entry.title) == null ? void 0 : _b.key) && ("position" in entry || entry.next);
    return el(
      "div",
      "row-details",
      el("h3", "", t.title),
      el("p", "row-meta", continuing ? [episodeCode(item).replace(":", " "), item.title].filter(Boolean).join(" \xB7 ") : meta),
      continuing ? el("p", "row-remaining", remainingText(entry.position, entry.duration)) : el("p", "row-description", t.description || "La trama non \xE8 ancora disponibile.")
    );
  }
  function setActive(root, id) {
    for (const n of root.querySelectorAll("[data-id]")) {
      const on = n.dataset.id === id;
      n.classList.toggle("is-active", on);
      n.setAttribute("aria-selected", String(on));
    }
  }
  function hero(title2, data2) {
    const node = el("div", "hero");
    const art = el("div", "hero-art"), second = el("div", "hero-art");
    second.style.opacity = "0";
    const info = el("div", "hero-info");
    node.append(art, second, el("div", "hero-fade"), info);
    let current = "", active = art, revision = 0;
    function update(t) {
      var _a2, _b;
      if (!t || current === t.key) return;
      const first = !current;
      current = t.key;
      const mine = ++revision, next = first ? art : active === art ? second : art;
      next.replaceChildren(artwork(t.art, "backdrop", 1280, t));
      next.style.opacity = ".82";
      if (!first) active.style.opacity = "0";
      active = next;
      info.replaceChildren(el("div", "brand-word", icon("moon"), "Apollon"), el("h1", "", t.title), el("p", "hero-meta", [kindLabel(t), ...metaParts(t)].filter((v, i, a) => a.indexOf(v) === i).concat(t.badges || []).join(" \xB7 ")), el("p", "hero-description", t.description || "La tua prossima storia comincia qui."));
      if ((_b = (_a2 = t.art) == null ? void 0 : _a2.images) == null ? void 0 : _b.logo) {
        const logo = el("img", "title-logo");
        logo.src = `/media/${t.art.id}/logo?s=640&v=${encodeURIComponent(t.art.images.lv || t.art.images.v || 0)}`;
        logo.alt = t.title;
        logo.addEventListener("error", () => logo.replaceWith(el("h1", "", t.title)), { once: true });
        info.querySelector("h1").replaceWith(logo);
      }
    }
    update(title2);
    return { node, update };
  }
  function catalogView(c2, { rows, featured, state, grid = false, heading = "", actions = true, categories = [], page = "home" }) {
    const root = el("section", `catalog-screen${grid ? " grid-screen" : ""}`);
    const visual = hero(featured, c2.data);
    root.append(visual.node);
    if (heading) root.append(el("h2", "section-heading", heading));
    const controls = el("div", "hero-actions");
    if (actions && featured) controls.append(button(c2.playLabel(featured), "play", true, "play"), button("Altre info", "info", false));
    root.append(controls);
    const pills = el("div", "category-pills");
    const pillTrack = el("div", "category-track");
    pills.append(pillTrack);
    for (const g of categories) pillTrack.append(button(g.name, g.id));
    root.append(pills);
    const viewport = el("div", "rows-viewport");
    root.append(viewport);
    if (!rows.length) root.append(el("div", "catalog-empty", el("h2", "", heading === "La mia lista" ? "La tua lista \xE8 ancora vuota" : heading ? `Non ci sono titoli in ${heading}` : "La tua raccolta \xE8 ancora vuota"), el("p", "", heading === "La mia lista" ? "Apri un titolo e scegli La mia lista per ritrovarlo qui." : "Aggiungi film e serie da Apollon sul computer.")));
    const focus = new FocusModel([...actions && featured ? [{ id: "hero", items: ["play", "info"] }] : [], ...categories.length ? [{ id: "categories", items: categories.map((g) => g.id) }] : [], ...rows.map((r) => ({ id: r.id, items: r.entries.map((e) => {
      var _a2;
      return (((_a2 = e.title) == null ? void 0 : _a2.key) ? e.title : e).key;
    }) }))]);
    focus.restore(state);
    let timer, disposed = false;
    const cards = /* @__PURE__ */ new Map();
    function selected() {
      var _a2;
      const row = rows.find((r) => r.id === focus.current.row);
      const entry = row == null ? void 0 : row.entries.find((e) => {
        var _a3;
        return (((_a3 = e.title) == null ? void 0 : _a3.key) ? e.title : e).key === focus.current.item;
      });
      return ((_a2 = entry == null ? void 0 : entry.title) == null ? void 0 : _a2.key) ? entry.title : entry || featured;
    }
    function paint() {
      const current = focus.current, activeRow = rows.findIndex((r) => r.id === current.row);
      const at = Math.max(0, activeRow);
      setActive(pills, current.row === "categories" ? current.item : "");
      if (current.row === "categories" || !pillTrack.dataset.placed) {
        const pill = pillTrack.children[current.row === "categories" ? current.c : 0];
        const pillOffset = pill ? Math.min(pill.offsetLeft, Math.max(0, pillTrack.scrollWidth - 1680)) : 0;
        pillTrack.style.transform = `translate3d(${-pillOffset}px,0,0)`;
        pillTrack.dataset.placed = "1";
      }
      setActive(controls, current.row === "hero" ? current.item : "");
      root.classList.toggle("on-rows", activeRow >= 0);
      root.classList.toggle("on-categories", current.row === "categories");
      viewport.replaceChildren();
      for (let r = at; r < Math.min(rows.length, at + 2); r++) {
        const row = rows[r], remembered = focus.memory[row.id], idx = Math.max(0, row.entries.findIndex((e) => {
          var _a2;
          return (((_a2 = e.title) == null ? void 0 : _a2.key) ? e.title : e).key === remembered;
        }));
        const isActive = r === activeRow;
        const ranked = row.shape === "ranking";
        const section = el("section", `tv-row${isActive ? " active-row" : ""}${ranked ? " ranking-row" : ""}`);
        section.dataset.row = row.id;
        section.style.transform = `translate3d(0,${(r - at) * 640}px,0)`;
        section.append(el("h2", "row-heading", row.title));
        const track = el("div", "card-track");
        const layout = railLayout(row.entries.length, idx, isActive, ranked);
        track.style.transform = `translate3d(${-layout.offset}px,0,0)`;
        for (const j of layout.visible) {
          const geometry = layout.cards[j];
          const wide = isActive && j === idx, cardKey = `${row.id}|${j}|${wide ? 1 : 0}`;
          let node = cards.get(cardKey);
          if (!node) {
            if (cards.size > 600) cards.clear();
            node = card(row.entries[j], wide, c2.data.progress, { poster: true, rank: ranked ? j + 1 : 0 });
            cards.set(cardKey, node);
          }
          node.style.left = `${geometry.left}px`;
          node.style.width = `${geometry.width}px`;
          track.append(node);
        }
        if (isActive) section.append(rowDetails(row.entries[idx]));
        section.append(track);
        viewport.append(section);
      }
      if (current.row === "hero") visual.update(featured);
      c2.reportFocus(current, root);
      return current;
    }
    paint();
    c2.mount(root);
    return {
      root,
      focus,
      snapshot: () => focus.snapshot(),
      selected,
      paint,
      key(key) {
        if (["left", "right", "up", "down"].includes(key)) {
          if (key === "left" && !focus.rows.length || focus.move(key) === "rail") c2.rail.open();
          else paint();
          return true;
        }
        return false;
      },
      activate() {
        if (focus.current.row === "categories") return c2.navigate("browse", { page, category: focus.current.item });
        const t = selected();
        if (!t) return;
        if (t.remoteDown) return c2.notify("Il fisso \xE8 spento. Riprova quando \xE8 acceso.");
        if (focus.current.row === "hero" && focus.current.item === "play") return c2.play(t);
        return c2.navigate("title", { id: t.key });
      },
      longOK() {
        if (!["hero", "categories"].includes(focus.current.row)) c2.options(selected());
      },
      dispose() {
        disposed = true;
        clearTimeout(timer);
      }
    };
  }

  // public/tv/home.js
  function home(c2, params, state) {
    const d = c2.data;
    return catalogView(c2, { rows: buildRows(d.titles, d.items, d.progress, d.list, { tv: true, ratings: d.ratings }), categories: catalogCategories(d.titles), featured: featuredTitle(d.titles), state });
  }

  // public/tv/browse.js
  function browse(c2, { page, category }, state) {
    const d = c2.data;
    let rows, pool, heading = { series: "Serie TV", film: "Film", anime: "Anime", new: "Novit\xE0", list: "La mia lista" }[page];
    if (page === "list") pool = sortList(d.titles, d.list);
    else pool = ["anime", "film", "series"].includes(page) ? d.titles.filter((t) => t.kind === page) : d.titles;
    const categories = catalogCategories(pool, page);
    const picked = categories.find((g) => g.id === category);
    if (picked) {
      pool = picked.entries;
      heading = picked.name;
    }
    if (page === "list" || picked) {
      rows = [];
      for (let i = 0; i < pool.length; i += 4) rows.push({ id: `griglia-${i / 4}`, title: i === 0 ? heading : "", entries: pool.slice(i, i + 4) });
    } else if (page === "new") rows = novitaGroups(pool).map((r, i) => ({ id: `new-${i}`, title: r.label, entries: r.entries }));
    else rows = buildRows(d.titles, d.items, d.progress, d.list, { page, tv: true, ratings: d.ratings });
    return catalogView(c2, { rows, featured: featuredTitle(pool), categories: picked ? [] : categories, state, grid: page === "list" || !!picked, heading, actions: page !== "list" && !picked, page });
  }

  // public/tv/rail.js
  function createRail(c2) {
    const node = document.getElementById("rail");
    const entries = [["search", "Cerca"], ["home", "Home"], ["anime", "Anime"], ["film", "Film"], ["series", "Serie TV"], ["new", "Novit\xE0"], ["list", "La mia lista"], ["music", "Musica"], ["profile", "Profilo"], ["settings", "Impostazioni"]];
    const focus = new FocusModel([{ id: "rail", items: entries.map((e) => e[0]) }]);
    let expanded = false;
    function render2() {
      var _a2, _b;
      node.replaceChildren(el("div", "rail-brand", icon("moon"), el("span", "", "Apollon")));
      for (const [id, label] of entries) {
        let image = icon(id);
        if (id === "profile" && ((_a2 = c2.data.person) == null ? void 0 : _a2.avatar)) {
          image = el("img", "rail-avatar");
          image.src = c2.data.person.avatar;
          image.alt = "";
        }
        const entry = el("div", `rail-item rail-${id}`, image, el("span", "", id === "profile" ? ((_b = c2.data.person) == null ? void 0 : _b.name) || label : label));
        entry.dataset.id = id;
        entry.setAttribute("role", "button");
        entry.setAttribute("aria-label", label);
        if (id === c2.section) entry.classList.add("current");
        node.append(entry);
      }
      setActive(node, expanded ? focus.current.item : "");
      node.classList.toggle("expanded", expanded);
      document.getElementById("rail-shade").classList.toggle("visible", expanded);
    }
    const api = {
      get expanded() {
        return expanded;
      },
      render: render2,
      open() {
        expanded = true;
        focus.select("rail", c2.section || "home");
        render2();
        c2.reportFocus(focus.current, node);
      },
      close() {
        var _a2, _b;
        expanded = false;
        render2();
        (_b = (_a2 = c2.screen) == null ? void 0 : _a2.paint) == null ? void 0 : _b.call(_a2);
      },
      key(key) {
        var _a2;
        if (key === "right") {
          api.close();
          return;
        }
        if (key === "back") {
          if (((_a2 = c2.router.current) == null ? void 0 : _a2.name) === "home") c2.exitPrompt();
          else api.close();
          return;
        }
        if (key === "up" || key === "down") {
          const n = focus.current.c + (key === "down" ? 1 : -1);
          focus.select("rail", entries[Math.max(0, Math.min(entries.length - 1, n))][0]);
          render2();
          c2.reportFocus(focus.current, node);
        }
      },
      activate() {
        const id = focus.current.item;
        api.close();
        if (id === "music") {
          location.href = "/?tv=0#music";
          return;
        }
        if (id === "home") c2.navigate("home", {}, true);
        else if (["film", "series", "anime", "new", "list"].includes(id)) c2.navigate("browse", { page: id }, true);
        else c2.navigate(id === "profile" ? "profiles" : id, {}, true);
      }
    };
    render2();
    return api;
  }

  // public/tv/options.js
  function openOptions(c2, title2, more = false) {
    if (!title2) return;
    const d = c2.data, latest = () => d.titles.find((t) => t.key === title2.key) || title2;
    const update = async (fn) => {
      await fn();
      await d.refresh();
      await c2.refreshScreen();
    };
    const listAction = () => update(async () => {
      const on = await d.listed(latest());
      c2.notify(on ? "Aggiunto alla tua lista" : "Tolto dalla tua lista");
    });
    const watchedAction = () => update(async () => {
      const on = !latest().watched;
      await d.watched(latest(), on);
      c2.notify(on ? "Segnato come visto" : "Tolto dai visti");
    });
    const light = async () => {
      await request("/api/versions", { ids: (title2.episodes || [title2.item]).map((i) => i.id) }, "POST");
      c2.notify("Versione leggera richiesta. Sar\xE0 pronta appena possibile.");
    };
    const choices = more ? [
      { id: "watched", label: title2.watched ? "Segna non visto" : "Segna visto", action: watchedAction },
      { id: "restart", label: "Ricomincia dall\u2019inizio", action: () => c2.play(title2, (title2.episodes || [title2.item])[0], 0) },
      { id: "light", label: "Prepara versione leggera (480p)", action: light },
      { id: "rating", label: "Dai un voto", action: () => c2.openModal("Il tuo voto", [1, 2, 3, 4, 5].map((n) => ({ id: `vote-${n}`, label: "\u2605".repeat(n) + "\u2606".repeat(5 - n), action: async () => {
        var _a2, _b;
        await request("/api/ratings", { profile: d.profile, key: title2.key, value: n });
        await d.refreshRatings();
        c2.notify("Voto salvato");
        (_b = (_a2 = c2.screen) == null ? void 0 : _a2.refreshRating) == null ? void 0 : _b.call(_a2);
      } }))) }
    ] : [
      { id: "open", label: "Apri", action: () => c2.navigate("title", { id: title2.key }) },
      { id: "play", label: c2.playLabel(title2), action: () => c2.play(title2) },
      { id: "list", label: d.list.some((i) => i.key === title2.key) ? "Togli dalla mia lista" : "La mia lista", action: listAction },
      { id: "watched", label: title2.watched ? "Segna non visto" : "Segna visto", action: watchedAction },
      { id: "hide", label: "Nascondi da Continua a guardare", action: () => update(async () => {
        const entry = continueEntries(d.titles, d.items, d.progress).find((e) => e.title.key === title2.key);
        const item = (entry == null ? void 0 : entry.hideId) || resumePoint(title2, d.items, d.progress).item.id;
        await d.saveProgress(item, { hidden: true });
        c2.notify("Nascosto da Continua a guardare");
      }) }
    ];
    c2.openModal(title2.title, choices);
  }

  // public/tv/playback.js
  function nextEpisode(items, item) {
    const next = (item == null ? void 0 : item.series) ? followingEpisode(items, item) : null;
    return next && !next.remoteDown ? next : null;
  }
  var backLayer = (state) => state.panel ? "panel" : state.scrub ? "scrub" : state.overlay ? "overlay" : "exit";
  var nextPrompt = (item, duration, position, hasNext) => {
    const end = Number.isFinite(duration) && duration > 0 ? storyEndOf(item, duration) : null;
    return !!hasNext && end !== null && position >= end && position < duration;
  };

  // public/tv/title.js
  function title(c2, { id }, state) {
    var _a2, _b, _c, _d, _e, _f;
    const d = c2.data;
    let t = d.titles.find((t2) => t2.key === id), disposed = false;
    if (!t) {
      c2.mount(el("section", "error-screen", el("h1", "", "Titolo non disponibile"), el("p", "", "Premi Indietro per tornare alla raccolta.")));
      return { key() {
      } };
    }
    const point = resumePoint(t, d.items, d.progress);
    let season = (_b = (_a2 = state == null ? void 0 : state.season) != null ? _a2 : point.item.season) != null ? _b : 1;
    const episodeBySeason = { ...state == null ? void 0 : state.episodeBySeason };
    if (!episodeBySeason[season]) episodeBySeason[season] = point.item.id;
    const root = el("section", "title-screen");
    root.append(hero(t, d).node);
    const rating = el("div", "title-rating", "\u2606 \u2606 \u2606 \u2606 \u2606");
    root.append(rating);
    let shelfTop = 644;
    const actions = el("div", "title-actions");
    const shelves = el("div", "title-shelves");
    root.append(actions, shelves);
    const focus = new FocusModel();
    let episodes = [], similars = [], actionIds = [];
    function rows() {
      t = d.titles.find((i) => i.key === id) || t;
      actionIds = ["play", ...t.episodes ? ["episodes"] : [], "list", "more"];
      episodes = (t.episodes || []).filter((i) => i.season === season);
      similars = similarTitles(t, d.titles);
      focus.setRows([{ id: "actions", items: actionIds }, ...t.episodes ? [{ id: "seasons", items: t.seasons.map((s) => `season:${s}`) }, { id: "episodes", items: episodes.map((i) => i.id) }] : [], ...similars.length ? [{ id: "similar", items: similars.map((i) => i.key) }] : []]);
    }
    rows();
    focus.restore(state == null ? void 0 : state.focus);
    if (!state) focus.memory.episodes = point.item.id;
    function cards(entries, activeId, ep = false) {
      var _a3;
      const track = el("div", "card-track");
      const idx = Math.max(0, entries.findIndex((i) => (ep ? i.id : i.key) === activeId));
      const offset = Math.min(idx * 408, Math.max(0, entries.length * 408 - 1784));
      track.style.transform = `translate3d(${-offset}px,0,0)`;
      for (let i = Math.max(0, Math.floor(offset / 408) - 1); i < Math.min(entries.length, Math.ceil(offset / 408) + 6); i++) {
        const e = entries[i];
        const entry = ep ? { key: e.id, title: `${e.episode}. ${e.title}`, item: e, art: e, genres: [], duration: e.duration, badges: [] } : e;
        const node = card(entry, (ep ? e.id : e.key) === activeId, d.progress);
        node.style.left = `${i * 408}px`;
        if (ep) {
          node.classList.add("episode-card");
          node.querySelector(".card-caption span").textContent = `${episodeCode(e)} \xB7 ${durationText(e.duration)}${((_a3 = d.progress[e.id]) == null ? void 0 : _a3.watched) ? " \xB7 Visto" : ""}`;
        }
        track.append(node);
      }
      return track;
    }
    function paint() {
      var _a3, _b2;
      rows();
      const f = focus.current;
      if (f.row === "seasons") {
        const selected = Number(f.item.split(":")[1]);
        if (selected !== season) {
          episodeBySeason[season] = focus.memory.episodes;
          season = selected;
          rows();
          focus.memory.episodes = episodeBySeason[season] || ((_a3 = episodes[0]) == null ? void 0 : _a3.id);
        }
      }
      actions.replaceChildren(button(c2.playLabel(t), "play", true, "play"), ...t.episodes ? [button("Episodi", "episodes", false, "episodes")] : [], button(d.list.some((i) => i.key === t.key) ? "Nella mia lista" : "La mia lista", "list", false, "list"), button("Altro", "more", false));
      setActive(actions, f.row === "actions" ? f.item : "");
      shelves.replaceChildren();
      root.classList.toggle("details-deep", f.row !== "actions");
      let shift = 0;
      if (t.episodes) {
        const seasons = el("div", "season-row");
        for (const s of t.seasons) seasons.append(button(s === 0 ? "Speciali" : `Stagione ${s}`, `season:${s}`, false));
        setActive(seasons, f.row === "seasons" ? f.item : "");
        (_b2 = seasons.querySelector(`[data-id="season:${season}"]`)) == null ? void 0 : _b2.classList.add("chosen");
        shelves.append(seasons);
        const ep = el("section", "title-episodes", el("h2", "row-heading", `Stagione ${season} \xB7 Episodi`), cards(episodes, f.row === "episodes" ? f.item : "", true));
        shelves.append(ep);
        if (f.row === "seasons" || f.row === "episodes") shift = 500 - shelfTop;
      }
      if (similars.length) {
        const similar = el("section", `title-similar${t.episodes ? " after-episodes" : ""}`, el("h2", "row-heading", "Titoli simili"), cards(similars, f.row === "similar" ? f.item : ""));
        shelves.append(similar);
        if (f.row === "similar") shift = 620 - shelfTop - (t.episodes ? 532 : 0);
      }
      shelves.style.transform = `translate3d(0,${shift}px,0)`;
      c2.reportFocus(f, root);
    }
    async function refreshRating() {
      const value = await request(`/api/ratings?profile=${encodeURIComponent(d.profile)}&key=${encodeURIComponent(t.key)}`).catch(() => null);
      if (disposed || !value) return;
      rating.textContent = value.count ? `\u2605 ${Number(value.average || value.mean || 0).toFixed(1)} \xB7 ${value.count} voti` : "Nessun voto \xB7 Dai il primo da Altro";
    }
    function layoutIntro() {
      if (disposed) return;
      const box = root.getBoundingClientRect(), scale = box.width / 1920 || 1;
      const bottom = (root.querySelector(".hero-description").getBoundingClientRect().bottom - box.top) / scale + (root.classList.contains("details-deep") ? 30 : 0);
      const ratingTop = Math.max(464, bottom + 24), actionsTop = Math.max(520, ratingTop + 56);
      rating.style.top = `${ratingTop}px`;
      actions.style.top = `${actionsTop}px`;
      shelfTop = actionsTop + 124;
      shelves.style.top = `${shelfTop}px`;
      paint();
    }
    const controller = {
      root,
      focus,
      paint,
      refreshRating,
      snapshot: () => ({ focus: focus.snapshot(), season, episodeBySeason }),
      key(key) {
        if (["left", "right", "up", "down"].includes(key)) {
          if (focus.move(key) === "rail") c2.rail.open();
          else paint();
          return true;
        }
      },
      async activate() {
        var _a3, _b2;
        const f = focus.current;
        if (f.row === "actions") {
          if (f.item === "play") c2.play(t);
          if (f.item === "episodes") {
            focus.select("episodes", episodeBySeason[season] || point.item.id);
            paint();
          }
          if (f.item === "list") {
            await d.listed(t);
            paint();
          }
          if (f.item === "more") openOptions(c2, t, true);
        } else if (f.row === "seasons") {
          focus.select("episodes", episodeBySeason[season] || ((_a3 = episodes[0]) == null ? void 0 : _a3.id));
          paint();
        } else if (f.row === "episodes") {
          const ep = episodes.find((i) => i.id === f.item);
          if (ep.remoteDown) return c2.notify("Il fisso \xE8 spento.");
          c2.play(t, ep, ((_b2 = d.progress[ep.id]) == null ? void 0 : _b2.position) || 0);
        } else if (f.row === "similar") c2.navigate("title", { id: f.item });
      },
      longOK() {
        const selected = focus.current.row === "similar" ? similars.find((i) => i.key === focus.current.item) : t;
        c2.options(selected);
      },
      dispose() {
        disposed = true;
      }
    };
    c2.mount(root);
    layoutIntro();
    (_c = root.querySelector(".title-logo")) == null ? void 0 : _c.addEventListener("load", layoutIntro);
    (_d = root.querySelector(".title-logo")) == null ? void 0 : _d.addEventListener("error", layoutIntro);
    (_e = document.fonts) == null ? void 0 : _e.ready.then(layoutIntro);
    refreshRating();
    d.primePreviews(point.item.id, (_f = nextEpisode(d.items, point.item)) == null ? void 0 : _f.id);
    return controller;
  }

  // public/tv/scrub.js
  function createScrub({ position = 0, duration = 0 } = {}) {
    const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const clamp = (n) => Math.max(0, Math.min(end, n));
    const origin = clamp(position);
    let at = origin, base = origin, started = 0, direction = 0, held = false, released = null, done = false;
    const traversal = 3e3 + Math.min(1, Math.max(0, (end - 1800) / 5400)) * 2e3;
    const api = {
      get position() {
        return at;
      },
      get held() {
        return held;
      },
      press(sign, now) {
        if (done) return at;
        const next = sign < 0 ? -1 : 1;
        if (held && next === direction) return api.tick(now);
        if (held) api.tick(now);
        base = at;
        direction = next;
        started = now;
        held = true;
        released = null;
        at = clamp(base + direction * 10);
        return at;
      },
      tick(now) {
        if (held && !done) {
          const t = Math.max(0, now - started - 160) / (traversal - 160);
          at = clamp(base + direction * (10 + end * Math.pow(t, 2.6)));
        }
        return at;
      },
      release(now) {
        if (!done && held) {
          api.tick(now);
          held = false;
          released = now;
        }
        return at;
      },
      due(now) {
        return !done && released !== null && now - released >= 800;
      },
      confirm() {
        if (done) return null;
        done = true;
        held = false;
        return at;
      },
      cancel() {
        done = true;
        held = false;
        at = origin;
        return origin;
      }
    };
    return api;
  }

  // public/tv/preview.js
  function previewFrame(index, position) {
    if (!(index == null ? void 0 : index.frames) || !(index.interval > 0)) return null;
    const n = Math.max(0, Math.min(index.frames - 1, Math.floor((position || 0) / index.interval)));
    const size = index.columns * index.rows, offset = n % size;
    return { sheet: Math.floor(n / size), x: offset % index.columns * index.width, y: Math.floor(offset / index.columns) * index.height, width: index.width, height: index.height };
  }

  // public/tv/player.js
  var TEXT_CODECS = /* @__PURE__ */ new Set(["subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"]);
  var fmt = (seconds) => {
    const n = Math.max(0, Math.floor(seconds || 0));
    return `${n >= 3600 ? Math.floor(n / 3600) + ":" : ""}${n >= 3600 ? String(Math.floor(n / 60) % 60).padStart(2, "0") : Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
  };
  function player(c2, params) {
    const d = c2.data, profile = d.profile;
    let item = d.items.find((i) => i.id === params.id), title2 = d.titles.find((t) => t.key === params.title);
    let disposed = false, switching = false, generation = 0, overlay = true, panel = null, scrub = null, scrubKey = "", wasPlaying = false, preview = null, idleAt = performance.now(), lastSaved = 0, stay = false, nextElapsed = 0, nextVisible = false, skip = null, ignored = /* @__PURE__ */ new Set(), quality = "original", panelSeason = (item == null ? void 0 : item.season) || 1;
    const root = el("section", "player-screen"), video = el("video");
    video.id = "tv-video";
    video.preload = "auto";
    video.playsInline = true;
    video.controls = false;
    const layer = el("div", "player-overlay visible"), heading = el("div", "player-heading"), bottom = el("div", "player-bottom");
    const timeline = el("div", "player-timeline");
    timeline.dataset.id = "timeline";
    timeline.setAttribute("role", "slider");
    timeline.setAttribute("aria-label", "Posizione nel video");
    const bar = el("div", "timeline-bar", el("i")), cursor = el("i", "timeline-cursor");
    timeline.append(bar, cursor);
    const times = el("div", "player-times", el("span", "", "0:00"), el("span", "", "0:00"));
    const controls = el("div", "player-controls");
    bottom.append(timeline, times, controls);
    layer.append(heading, bottom);
    const previewBox = el("div", "seek-preview", el("div", "seek-image"), el("strong", "", "0:00"), el("span", "", "OK per andare qui \xB7 Indietro annulla"));
    previewBox.hidden = true;
    const context = el("div", "player-context");
    context.hidden = true;
    const panels = el("div", "player-panels");
    const fade = el("div", "episode-fade");
    root.append(video, layer, previewBox, context, panels, fade);
    c2.mount(root);
    const focus = new FocusModel();
    let lastMove = null, lastControls = "", lastHeading = "", lastPanel = "", lastContext = "", lastPreviewPoll = 0, lastLibraryPoll = 0, libraryPollBusy = false, requestedPosition = 0;
    const duration = () => Number.isFinite(video.duration) ? video.duration : (item == null ? void 0 : item.duration) || 0;
    const prefs = () => {
      var _a2, _b;
      return { autoSkip: ((_a2 = d.person) == null ? void 0 : _a2.autoSkip) === true, autoNext: ((_b = d.person) == null ? void 0 : _b.autoNext) !== false };
    };
    function commands() {
      return ["toggle", "back10", "forward10", ...nextEpisode(d.items, item) ? ["next"] : [], ...(item == null ? void 0 : item.series) ? ["episodes"] : [], "languages", "settings"];
    }
    function resetFocus() {
      focus.setRows([{ id: "timeline", items: ["timeline"] }, { id: "controls", items: commands() }]);
      focus.select("controls", "toggle");
    }
    function wake() {
      overlay = true;
      idleAt = performance.now();
      paint();
    }
    function hide() {
      overlay = false;
      paint();
    }
    async function save(watched) {
      if (!item || switching || video.readyState < 1 || !Number.isFinite(video.currentTime) || !(duration() > 0)) return;
      const id = item.id, position = video.currentTime, total = duration();
      lastSaved = performance.now();
      await d.saveProgress(id, { position, duration: total, ...watched === void 0 ? {} : { watched } }, profile);
    }
    function saveQuiet() {
      save().catch(() => c2.notify("Avanzamento non salvato. Controlla la connessione."));
    }
    function subtitles() {
      return [...(item.subtitles || []).map((s, i) => ({ id: String(i), language: s.language || "it", label: s.title || languageName(s.language), src: `/media/${item.id}/subtitle/${i}` })), ...(item.streams || []).filter((s) => s.type === "subtitle" && TEXT_CODECS.has(s.codec)).map((s) => ({ id: `s${s.index}`, language: s.language, label: s.title || languageName(s.language), src: `/media/${item.id}/subtitle/s${s.index}` }))];
    }
    function applyLanguages() {
      const sub = d.preferenceValue("video-subs", "off"), audio = d.preferenceValue("video-audio", "ita");
      Array.from(video.textTracks).forEach((track) => {
        track.mode = sub !== "off" && (track.language === sub || languageName(track.language) === languageName(sub)) ? "showing" : "disabled";
      });
      const native = video.audioTracks;
      if (native == null ? void 0 : native.length) {
        const streams = (item.streams || []).filter((s) => s.type === "audio");
        const n = streams.findIndex((s) => s.language === audio || languageName(s.language) === languageName(audio));
        if (n >= 0) Array.from(native).forEach((track, i) => {
          track.enabled = i === n;
        });
      }
    }
    async function loadItem(next, position = 0) {
      var _a2, _b, _c, _d;
      if (!next || next.remoteDown) {
        c2.notify("Il fisso \xE8 spento. Torna alla raccolta e riprova.");
        return;
      }
      const mine = ++generation;
      switching = true;
      requestedPosition = position;
      video.pause();
      cancelScrub(false);
      panel = null;
      panels.replaceChildren();
      item = next;
      panelSeason = item.season || 1;
      stay = false;
      nextElapsed = 0;
      nextVisible = false;
      skip = null;
      ignored = /* @__PURE__ */ new Set();
      preview = null;
      root.dataset.item = item.id;
      root.dataset.seeking = "false";
      fade.classList.add("visible");
      quality = chooseQuality(d.preferenceValue("quality", "auto"), item, { host: location.hostname, effectiveType: (_a2 = navigator.connection) == null ? void 0 : _a2.effectiveType, downlink: (_b = navigator.connection) == null ? void 0 : _b.downlink, saveData: (_c = navigator.connection) == null ? void 0 : _c.saveData });
      video.replaceChildren();
      for (const s of subtitles()) {
        const track = el("track");
        track.kind = "subtitles";
        track.label = s.label;
        track.srclang = s.language;
        track.src = s.src;
        video.append(track);
      }
      video.onloadedmetadata = () => {
        if (disposed || mine !== generation) return;
        video.currentTime = Math.min(Math.max(0, position), Math.max(0, duration() - 0.1));
        switching = false;
        applyLanguages();
        fade.classList.remove("visible");
        wake();
        video.play().catch(() => {
          overlay = true;
          paint();
        });
        saveQuiet();
      };
      video.src = mediaUrl(item, quality);
      video.load();
      resetFocus();
      wake();
      d.primePreviews(item.id, (_d = nextEpisode(d.items, item)) == null ? void 0 : _d.id);
      pollPreview();
    }
    function pollPreview() {
      const mine = generation, id = item.id;
      lastPreviewPoll = performance.now();
      request(`/media/${id}/trickplay?priority=0${!video.paused ? "&playing=1" : ""}`).then((v) => {
        if (mine === generation && v.frames) preview = v;
      }).catch(() => {
      });
    }
    async function changeItem(next, complete = false) {
      var _a2, _b;
      if (!next) return;
      await save(complete ? true : void 0).catch(() => c2.notify("Avanzamento non salvato. Controlla la connessione."));
      await loadItem(next, complete || ((_a2 = d.progress[next.id]) == null ? void 0 : _a2.watched) ? 0 : ((_b = d.progress[next.id]) == null ? void 0 : _b.position) || 0);
    }
    async function refreshPlayingItem() {
      if (libraryPollBusy) return;
      const mine = generation;
      libraryPollBusy = true;
      lastLibraryPoll = performance.now();
      try {
        await d.reloadLibrary();
        if (!disposed && mine === generation) {
          const fresh = d.items.find((i) => i.id === item.id);
          if (fresh) Object.assign(item, fresh);
          title2 = d.titles.find((t) => t.key === params.title) || title2;
          lastPanel = "";
          paint();
        }
      } catch {
      } finally {
        libraryPollBusy = false;
      }
    }
    function toggle() {
      if (video.paused) video.play().catch(showError);
      else video.pause();
      wake();
    }
    function jump(seconds) {
      if (duration() > 0) video.currentTime = Math.max(0, Math.min(duration(), video.currentTime + seconds));
      wake();
    }
    function startScrub(sign, key) {
      if (switching || !(duration() > 0)) return;
      if (!scrub) {
        wasPlaying = !video.paused;
        scrub = createScrub({ position: video.currentTime, duration: duration() });
        video.pause();
        context.hidden = true;
        root.dataset.seeking = "true";
      }
      scrubKey = key;
      scrub.press(sign, performance.now());
      overlay = true;
      paint();
    }
    function cancelScrub(resume = true) {
      if (!scrub) return;
      scrub.cancel();
      scrub = null;
      previewBox.hidden = true;
      root.dataset.seeking = "false";
      if (resume && wasPlaying) video.play().catch(() => {
      });
      idleAt = performance.now();
      paint();
    }
    function confirmScrub() {
      if (!scrub) return;
      const at = scrub.confirm();
      scrub = null;
      previewBox.hidden = true;
      root.dataset.seeking = "false";
      if (at !== null) video.currentTime = at;
      if (wasPlaying) video.play().catch(() => {
      });
      idleAt = performance.now();
      paint();
    }
    function paintPreview() {
      previewBox.hidden = !scrub;
      if (!scrub) return;
      const at = scrub.position;
      const frame = previewFrame(preview, at);
      const image = previewBox.querySelector(".seek-image");
      image.hidden = !frame;
      if (frame) {
        image.style.backgroundImage = `url("/media/${item.id}/trickplay/${frame.sheet}.jpg?v=${preview.version || 0}")`;
        image.style.backgroundPosition = `-${frame.x}px -${frame.y}px`;
      }
      previewBox.querySelector("strong").textContent = fmt(at);
      previewBox.style.left = `${Math.max(150, Math.min(1450, 120 + (duration() ? at / duration() : 0) * 1680 - 160))}px`;
      previewBox.dataset.position = at.toFixed(2);
    }
    function paint() {
      if (disposed || !item) return;
      layer.classList.toggle("visible", overlay || !!scrub || !!panel);
      root.classList.toggle("panel-open", !!panel);
      if (lastHeading !== item.id) {
        heading.replaceChildren(el("h1", "", item.series || item.title), el("p", "", item.series ? `${episodeCode(item)} \xB7 ${item.title}` : ""));
        lastHeading = item.id;
      }
      const position = scrub ? scrub.position : video.currentTime, total = duration(), share = total ? position / total : 0;
      bar.firstChild.style.transform = `scaleX(${share})`;
      cursor.style.transform = `translate3d(${share * 1680}px,0,0)`;
      timeline.classList.toggle("is-active", focus.current.row === "timeline" && overlay && !panel);
      timeline.setAttribute("aria-valuenow", String(Math.round(position)));
      timeline.setAttribute("aria-valuemax", String(total));
      times.firstChild.textContent = fmt(position);
      times.lastChild.textContent = `\u2212${fmt(total - position)}`;
      const labels = { toggle: video.paused ? "Riproduci" : "Pausa", back10: "\u221210 secondi", forward10: "+10 secondi", next: "Prossimo", episodes: "Episodi", languages: "Audio e sottotitoli", settings: "Impostazioni" };
      const glyphs = { toggle: video.paused ? "play" : "pause", next: "next", episodes: "episodes", languages: "subtitles", settings: "settings" };
      const signature = JSON.stringify([item.id, video.paused, focus.current, !!panel, !!scrub]);
      if (signature !== lastControls) {
        controls.replaceChildren(...commands().map((id) => button(labels[id], id, false, glyphs[id])));
        setActive(controls, focus.current.row === "controls" && !panel && !scrub ? focus.current.item : "");
        lastControls = signature;
      }
      paintPreview();
      if (panel) {
        const ps = JSON.stringify([panel.type, panel.focus.current, quality, prefs(), d.preferenceValue("video-subs"), d.preferenceValue("video-audio")]);
        if (ps !== lastPanel) {
          paintPanel();
          lastPanel = ps;
        }
      } else lastPanel = "";
      c2.reportFocus(panel ? panel.focus.current : scrub ? { row: "scrub", item: "cursor" } : !overlay && context.hidden ? { row: "video", item: "video" } : !overlay ? { row: "context", item: nextVisible ? "next" : "skip" } : focus.current, root);
    }
    function contextPaint(delta) {
      if (switching || scrub || disposed) return;
      const next = nextEpisode(d.items, item), total = duration();
      const action = playbackAction(item, video.currentTime, total, !!next, prefs());
      skip = action && !ignored.has(action.kind) ? action : null;
      if ((skip == null ? void 0 : skip.automatic) && !video.paused) {
        ignored.add(skip.kind);
        if (skip.next && prefs().autoNext) {
          changeItem(next, true).catch(showError);
          return;
        }
        if (!skip.next) {
          video.currentTime = skip.target;
          return;
        }
      }
      nextVisible = nextPrompt(item, total, video.currentTime, !!next) && !stay && prefs().autoNext;
      if (nextVisible && !video.paused) nextElapsed += delta;
      if (!nextVisible) nextElapsed = 0;
      context.hidden = !!panel || !!scrub || !nextVisible && !skip;
      context.classList.toggle("is-active", !overlay);
      const cs = nextVisible ? `next:${next.id}:${Math.floor(nextElapsed / 1e3)}` : (skip == null ? void 0 : skip.kind) || "";
      if (cs !== lastContext) {
        if (nextVisible) {
          context.replaceChildren(artwork(next), el("div", "", el("span", "", "Prossimo episodio"), el("strong", "", `${episodeCode(next)} \xB7 ${next.title}`), el("p", "", `Tra ${Math.max(0, 10 - Math.floor(nextElapsed / 1e3))} secondi \xB7 OK per iniziare`)));
          context.classList.add("next-card");
        } else if (skip) {
          context.classList.remove("next-card");
          context.replaceChildren(el("strong", "", skip.label), el("span", "", "Premi OK"));
        } else context.replaceChildren();
        lastContext = cs;
      }
      if (nextVisible && nextElapsed >= 1e4) {
        stay = true;
        changeItem(next, true).catch(showError);
      }
    }
    function panelRows() {
      if (panel.type === "languages") {
        const audio = (item.streams || []).filter((s) => s.type === "audio");
        panel.audio = audio.length ? audio : [{ language: "und" }];
        panel.subs = subtitles();
        return [{ id: "audio", items: panel.audio.map((s, i) => `audio:${i}`) }, { id: "subs", items: ["subs:off", ...panel.subs.map((s, i) => `subs:${i}`)] }];
      }
      if (panel.type === "episodes") {
        panel.episodes = ((title2 == null ? void 0 : title2.episodes) || []).filter((i) => i.season === panelSeason);
        return [{ id: "seasons", items: ((title2 == null ? void 0 : title2.seasons) || []).map((s) => `season:${s}`) }, { id: "episodes", items: panel.episodes.map((i) => i.id) }];
      }
      return [{ id: "quality", items: ["auto", "original", "480", "prepare", "autoSkip", "autoNext"] }];
    }
    function openPanel(type) {
      panel = { type, focus: new FocusModel() };
      panel.focus.setRows(panelRows());
      if (type === "episodes") {
        panel.focus.memory.seasons = `season:${panelSeason}`;
        panel.focus.select("episodes", item.id);
      }
      overlay = true;
      paint();
      if (type === "settings") refreshPlayingItem();
    }
    function closePanel() {
      panel = null;
      panels.replaceChildren();
      wake();
    }
    function paintPanel() {
      if (!panel) return;
      const { type, focus: pf } = panel;
      if (type === "episodes" && pf.current.row === "seasons") {
        const season = Number(pf.current.item.split(":")[1]);
        if (season !== panelSeason) {
          panelSeason = season;
          pf.setRows(panelRows());
        }
      }
      panels.replaceChildren();
      const content = el("section", `player-panel ${type}-panel`, el("h2", "", type === "languages" ? "Audio e sottotitoli" : type === "episodes" ? "Scegli un episodio" : "Impostazioni"));
      panels.append(content);
      if (type === "languages") {
        const columns = el("div", "language-columns");
        const native = video.audioTracks;
        for (const [col, heading2] of [["audio", "Audio"], ["subs", "Sottotitoli"]]) {
          const node = el("div", "language-column", el("h3", "", heading2));
          const choices = col === "audio" ? panel.audio.map((s, i) => {
            var _a2;
            return { id: `audio:${i}`, label: languageName(s.language), selected: (native == null ? void 0 : native.length) ? (_a2 = native[i]) == null ? void 0 : _a2.enabled : i === 0, disabled: i > 0 && !((native == null ? void 0 : native.length) > i) };
          }) : [{ id: "subs:off", label: "Nessuno", selected: Array.from(video.textTracks).every((t) => t.mode !== "showing") }, ...panel.subs.map((s, i) => {
            var _a2;
            return { id: `subs:${i}`, label: languageName(s.language), selected: ((_a2 = video.textTracks[i]) == null ? void 0 : _a2.mode) === "showing" };
          })];
          const current = pf.current.row === col ? pf.current.c : 0;
          const start2 = Math.max(0, current - 4);
          for (const choice of choices.slice(start2, start2 + 7)) {
            const b = button(`${choice.selected ? "\u2713 " : ""}${choice.label}`, choice.id);
            if (choice.disabled) {
              b.classList.add("unavailable");
              b.append(el("small", "", "Solo la prima lingua \xE8 disponibile"));
            }
            node.append(b);
          }
          columns.append(node);
        }
        content.append(columns);
        setActive(content, pf.current.item);
      } else if (type === "episodes") {
        const seasons = el("div", "season-row", ...(title2.seasons || []).map((s) => button(s === 0 ? "Speciali" : `Stagione ${s}`, `season:${s}`)));
        content.append(seasons);
        const current = pf.current.row === "episodes" ? pf.current.c : Math.max(0, panel.episodes.findIndex((i) => i.id === item.id));
        const track = el("div", "panel-episodes-track");
        for (let i = Math.max(0, current - 1); i < Math.min(panel.episodes.length, current + 5); i++) {
          const ep = panel.episodes[i];
          const node = el("div", "panel-episode", artwork(ep), el("strong", "", `${ep.episode}. ${ep.title}`), el("span", "", durationText(ep.duration)));
          node.dataset.id = ep.id;
          node.style.transform = `translate3d(${(i - current) * 408}px,0,0)`;
          track.append(node);
        }
        content.append(track);
        setActive(content, pf.current.item);
      } else {
        const options = [["auto", "Automatica"], ["original", "Originale"], ["480", `Versione leggera (480p)${item.light ? "" : " \xB7 non ancora pronta"}`], ["prepare", "Prepara versione leggera"], ["autoSkip", `Salta da solo sigle e riassunti sicuri: ${prefs().autoSkip ? "s\xEC" : "no"}`], ["autoNext", `Prossimo episodio automatico: ${prefs().autoNext ? "s\xEC" : "no"}`]];
        for (const [id, label] of options) {
          content.append(button(`${d.preferenceValue("quality", "auto") === id ? "\u2713 " : ""}${label}`, id));
        }
        setActive(content, pf.current.item);
      }
      content.append(el("p", "panel-hint", "Indietro per chiudere"));
    }
    async function panelActivate() {
      var _a2;
      const f = panel.focus.current;
      if (panel.type === "languages") {
        if (f.row === "audio") {
          const index = Number(f.item.split(":")[1]);
          const native = video.audioTracks;
          if (index > 0 && !((native == null ? void 0 : native.length) > index)) {
            c2.notify("Questo audio non \xE8 disponibile sul lettore attuale.");
            return;
          }
          if (native == null ? void 0 : native.length) Array.from(native).forEach((t, i) => {
            t.enabled = i === index;
          });
          d.setPreference("video-audio", panel.audio[index].language);
        } else {
          const selected = f.item === "subs:off" ? -1 : Number(f.item.split(":")[1]);
          Array.from(video.textTracks).forEach((t, i) => {
            t.mode = i === selected ? "showing" : "disabled";
          });
          d.setPreference("video-subs", selected < 0 ? "off" : panel.subs[selected].language);
        }
        paint();
      } else if (panel.type === "episodes") {
        if (f.row === "seasons") {
          panel.focus.select("episodes", (_a2 = panel.episodes[0]) == null ? void 0 : _a2.id);
          paint();
        } else {
          const ep = panel.episodes.find((i) => i.id === f.item);
          closePanel();
          await changeItem(ep);
        }
      } else if (f.item === "prepare") {
        await request("/api/versions", { ids: [item.id] }, "POST");
        c2.notify("Versione leggera richiesta");
      } else if (f.item === "autoSkip" || f.item === "autoNext") {
        await d.preference({ [f.item]: !prefs()[f.item] });
        paint();
      } else {
        if (f.item === "480" && !item.light) {
          c2.notify("Prepara prima la versione leggera con la voce qui sotto.");
          return;
        }
        const position = video.currentTime;
        await save();
        d.setPreference("quality", f.item);
        closePanel();
        await loadItem(item, position);
      }
    }
    function panelKey(key) {
      const f = panel.focus;
      if (key === "ok") return panelActivate();
      if (!["left", "right", "up", "down"].includes(key)) return;
      if (panel.type === "languages") {
        if (key === "left" || key === "right") f.select(key === "right" ? "subs" : "audio");
        else f.move(key === "down" ? "right" : "left");
      } else if (panel.type === "settings") f.move(key === "down" ? "right" : key === "up" ? "left" : key);
      else f.move(key);
      paint();
    }
    function showError() {
      if (disposed) return;
      fade.classList.remove("visible");
      switching = false;
      c2.openModal("La riproduzione si \xE8 interrotta", [{ id: "retry", label: "Riprova", action: () => loadItem(item, video.readyState >= 1 ? video.currentTime : requestedPosition) }, { id: "back", label: "Torna indietro", action: async () => {
        overlay = false;
        panel = null;
        await c2.back();
      } }], { subtitle: "Controlla che il computer con questo video sia acceso e collegato." });
    }
    video.addEventListener("error", showError);
    video.addEventListener("pause", () => {
      if (!switching && !disposed) {
        saveQuiet();
        paint();
      }
    });
    video.addEventListener("play", () => {
      idleAt = performance.now();
      paint();
    });
    video.addEventListener("loadeddata", applyLanguages);
    video.addEventListener("ended", () => {
      if (disposed || switching) return;
      const next = nextEpisode(d.items, item);
      if (next && prefs().autoNext) {
        changeItem(next, true).catch(showError);
      } else {
        save(true).catch(() => c2.notify("Avanzamento non salvato.")).then(() => {
          overlay = false;
          panel = null;
          return c2.back();
        });
      }
    });
    let lastPulse = performance.now();
    const pulse = setInterval(() => {
      if (disposed) return;
      const now = performance.now(), delta = now - lastPulse;
      lastPulse = now;
      if (scrub) {
        scrub.tick(now);
        if (scrub.due(now)) confirmScrub();
      }
      if (!panel && !scrub && !video.paused && now - idleAt >= 4e3) overlay = false;
      if (!video.paused && !switching && now - lastSaved >= 1e4) saveQuiet();
      if (!switching && now - lastPreviewPoll >= 1e4) pollPreview();
      if ((panel == null ? void 0 : panel.type) === "settings" && now - lastLibraryPoll >= 5e3) refreshPlayingItem();
      contextPaint(delta);
      paint();
    }, 50);
    const controller = {
      directKeys: true,
      root,
      paint,
      snapshot: () => ({}),
      async key(key, e = {}) {
        if (key === "back") {
          if (!e.repeat) await c2.back();
          return;
        }
        const seeking = ["forward", "rewind"].includes(key) || ["left", "right"].includes(key) && !panel && (!overlay || scrub || focus.current.row === "timeline");
        if (["up", "down", "left", "right"].includes(key) && !seeking) {
          const now = performance.now();
          if (!acceptRepeat(key, now, lastMove, e.repeat)) return;
          lastMove = { key, at: now };
        }
        if (panel) return panelKey(key);
        if (["toggle", "play", "pause"].includes(key)) {
          if (e.repeat) return;
          focus.select("controls", "toggle");
          if (key === "play") video.play().catch(showError);
          else if (key === "pause") video.pause();
          else toggle();
          wake();
          return;
        }
        if (key === "forward" || key === "rewind" || (key === "left" || key === "right") && (!overlay || scrub || focus.current.row === "timeline")) {
          startScrub(key === "left" || key === "rewind" ? -1 : 1, key);
          return;
        }
        if (scrub) {
          if (key === "ok" && !e.repeat) confirmScrub();
          return;
        }
        if (key === "ok") {
          if (e.repeat) return;
          if (!overlay && (nextVisible || skip)) {
            if (nextVisible) await changeItem(nextEpisode(d.items, item), true);
            else if (skip.next) await changeItem(nextEpisode(d.items, item), true);
            else {
              ignored.add(skip.kind);
              video.currentTime = skip.target;
              context.hidden = true;
            }
            return;
          }
          if (!overlay) {
            focus.select("controls", "toggle");
            toggle();
            return;
          }
          const id = focus.current.item;
          if (id === "toggle") toggle();
          else if (id === "back10") jump(-10);
          else if (id === "forward10") jump(10);
          else if (id === "next") await changeItem(nextEpisode(d.items, item), true);
          else if (id === "episodes") openPanel("episodes");
          else if (id === "languages") openPanel("languages");
          else if (id === "settings") openPanel("settings");
          return;
        }
        if (["up", "down", "left", "right"].includes(key)) {
          if (!overlay) {
            resetFocus();
            wake();
            return;
          }
          if (focus.move(key) === "rail") focus.select("controls", "toggle");
          wake();
        }
      },
      keyup(key) {
        if (scrub && key === scrubKey) scrub.release(performance.now());
      },
      releaseKeys() {
        if (scrub) scrub.release(performance.now());
      },
      async back() {
        const layer2 = backLayer({ panel: !!panel, scrub: !!scrub, overlay });
        if (layer2 === "panel") {
          closePanel();
          return true;
        }
        if (layer2 === "scrub") {
          cancelScrub();
          return true;
        }
        if (layer2 === "overlay") {
          hide();
          return true;
        }
        if (nextVisible || skip) {
          stay = true;
          if (skip) ignored.add(skip.kind);
          context.hidden = true;
          skip = null;
          nextVisible = false;
          return true;
        }
        await save().catch(() => c2.notify("Avanzamento non salvato. Controlla la connessione."));
        video.pause();
        return false;
      },
      dispose() {
        disposed = true;
        generation++;
        clearInterval(pulse);
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    };
    if (item) loadItem(item, params.position || 0).catch(showError);
    else showError();
    return controller;
  }

  // public/tv/keyboard.js
  function keyboardRows() {
    const chars = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"];
    const rows = [];
    for (let i = 0; i < chars.length; i += 6) rows.push({ id: `keys:${i / 6}`, items: chars.slice(i, i + 6).map((ch) => `key:${ch}`) });
    rows.push({ id: "editing", items: ["space", "delete", "clear", "done"] });
    return rows;
  }
  function editText(value, id, maxLength = 80) {
    if (id === "delete") return [...value].slice(0, -1).join("");
    if (id === "clear") return "";
    if (id === "done") return value;
    return [...value + (id === "space" ? " " : id.slice(4).toLocaleLowerCase("it"))].slice(0, maxLength).join("");
  }
  function createKeyboard(c2, { value = "", onChange, onDone, onRight, onLeft, maxLength = 80, state } = {}) {
    const root = el("div", "tv-keyboard");
    const rows = keyboardRows(), focus = new FocusModel(rows);
    focus.restore(state);
    let text = value, active = true;
    const labels = { space: "Spazio", delete: "Cancella", clear: "Svuota", done: "Fine" };
    for (const row of rows) {
      const node = el("div", `keyboard-row${row.id === "editing" ? " editing-row" : ""}`);
      for (const id of row.items) node.append(button(labels[id] || id.slice(4), id));
      root.append(node);
    }
    function paint() {
      setActive(root, active ? focus.current.item : "");
      if (active) c2.reportFocus(focus.current, root);
    }
    const api = {
      root,
      focus,
      get value() {
        return text;
      },
      snapshot: () => focus.snapshot(),
      setActive(on) {
        active = on;
        paint();
      },
      paint,
      key(key) {
        var _a2;
        if (key === "right" && focus.current.c === rows[focus.current.r].items.length - 1 && onRight) {
          onRight();
          return;
        }
        if (["left", "right", "up", "down"].includes(key)) {
          if (focus.move(key) === "rail") {
            if (onLeft) onLeft();
            else if (c2.data.profile) (_a2 = c2.rail) == null ? void 0 : _a2.open();
          }
          paint();
        }
      },
      activate() {
        const id = focus.current.item;
        if (id === "done") {
          return onDone == null ? void 0 : onDone(text);
        }
        text = editText(text, id, maxLength);
        onChange == null ? void 0 : onChange(text);
        paint();
      }
    };
    paint();
    return api;
  }

  // public/tv/search.js
  function search(c2, params, state) {
    const root = el("section", "search-screen", el("h1", "", "Cerca la tua prossima storia"));
    const query = el("div", "search-query", icon("search"), el("span"));
    const resultsHost = el("div", "search-results");
    const summary = el("h2", "search-summary");
    root.append(query, summary, resultsHost);
    let text = (state == null ? void 0 : state.query) || "", zone = (state == null ? void 0 : state.zone) || "keyboard", results = [];
    const focus = new FocusModel();
    function setRows() {
      results = text.trim() ? searchTitles(c2.data.titles, text) : c2.data.titles;
      const columns = zone === "results" ? 4 : 2;
      const rows = [];
      for (let i = 0; i < results.length; i += columns) rows.push({ id: `results:${i / columns}`, items: results.slice(i, i + columns).map((t) => t.key) });
      focus.setRows(rows);
    }
    function enterResults() {
      if (!results.length) return;
      zone = "results";
      const id = focus.current.item;
      setRows();
      const row = focus.rows.find((r) => r.items.includes(id));
      if (row) focus.select(row.id, id);
      paint();
    }
    const keyboard = createKeyboard(c2, { value: text, state: state == null ? void 0 : state.keyboard, onChange: (value) => {
      text = value;
      setRows();
      paint();
    }, onDone: enterResults, onRight: enterResults });
    root.append(keyboard.root);
    setRows();
    focus.restore(state == null ? void 0 : state.results);
    function paint() {
      keyboard.setActive(zone === "keyboard");
      root.classList.toggle("in-results", zone === "results");
      query.lastChild.textContent = text || "Titoli, generi, episodi";
      query.classList.toggle("empty", !text);
      summary.textContent = text.trim() ? `${results.length} ${results.length === 1 ? "risultato" : "risultati"}` : "Da scoprire";
      resultsHost.replaceChildren();
      const current = focus.current, cols = zone === "results" ? 4 : 2, start2 = zone === "results" ? current.r : 0;
      if (!results.length) resultsHost.append(el("p", "empty-message", "Nessun titolo trovato. Prova con un\u2019altra parola."));
      for (let r = start2; r < Math.min(focus.rows.length, start2 + 2); r++) for (let col = 0; col < focus.rows[r].items.length; col++) {
        const key = focus.rows[r].items[col], t = results.find((t2) => t2.key === key), node = card(t, zone === "results" && key === current.item, c2.data.progress);
        node.style.left = `${col * 408}px`;
        node.style.top = `${(r - start2) * 360 + 12}px`;
        resultsHost.append(node);
      }
      if (zone === "results") c2.reportFocus(current, root);
    }
    paint();
    c2.mount(root);
    return {
      root,
      paint,
      snapshot: () => ({ query: text, zone, keyboard: keyboard.snapshot(), results: focus.snapshot() }),
      key(key) {
        if (zone === "keyboard") {
          keyboard.key(key);
          return;
        }
        if (key === "left" && focus.current.c === 0) {
          zone = "keyboard";
          setRows();
          paint();
          return;
        }
        focus.move(key);
        paint();
      },
      activate() {
        if (zone === "keyboard") return keyboard.activate();
        const t = results.find((t2) => t2.key === focus.current.item);
        if (t == null ? void 0 : t.remoteDown) return c2.notify("Il fisso \xE8 spento. Accendilo per aprire questo titolo.");
        if (t) c2.navigate("title", { id: t.key });
      },
      longOK() {
        if (zone === "results") c2.options(results.find((t) => t.key === focus.current.item));
      },
      back() {
        if (zone === "results") {
          zone = "keyboard";
          setRows();
          paint();
          return true;
        }
        return false;
      }
    };
  }

  // public/tv/profiles.js
  function profiles(c2, params, state) {
    const d = c2.data, root = el("section", "profiles-screen");
    let mode = "profiles", editor = null, choices = [], loading = false, disposed = false, editingId = d.profile;
    const focus = new FocusModel();
    function avatar(person) {
      if (person.avatar) {
        const image = el("img");
        image.src = person.avatar;
        image.alt = "";
        return image;
      }
      return el("div", "avatar-initial", icon("moon"), el("strong", "", person.name.slice(0, 1).toLocaleUpperCase("it")));
    }
    function rows() {
      focus.setRows([{ id: "profiles", items: d.profiles.map((p) => p.id) }, { id: "actions", items: ["add", ...d.profile ? ["avatar", "rename"] : []] }]);
    }
    rows();
    focus.restore(state);
    if (d.profile) focus.select("profiles", d.profile);
    function paint() {
      var _a2;
      if (disposed) return;
      root.replaceChildren();
      if (mode === "editor") {
        const field = el("div", "profile-name", editor.value || "Il tuo nome");
        root.append(el("h1", "", editingId ? "Cambia nome" : "Come ti chiami?"), field, editor.root);
        editor.paint();
        return;
      }
      if (mode === "avatars") {
        root.append(el("h1", "", "Scegli la tua immagine"), el("p", "profiles-note", loading ? "Carico le immagini\u2026" : "Un volto per le tue storie"));
        const pf = avatarFocus.current;
        const grid = el("div", "avatar-grid");
        const start2 = Math.max(0, pf.r - 1);
        for (let r = start2; r < Math.min(avatarFocus.rows.length, start2 + 3); r++) for (let col = 0; col < avatarFocus.rows[r].items.length; col++) {
          const id = avatarFocus.rows[r].items[col], choice = choices.find((v) => v.id === id);
          const person = { name: ((_a2 = d.person) == null ? void 0 : _a2.name) || "A", avatar: choice == null ? void 0 : choice.url };
          const n = el("div", "avatar-choice", avatar(person), el("span", "", (choice == null ? void 0 : choice.name) || "Iniziale"));
          n.dataset.id = id;
          n.style.transform = `translate3d(${col * 280}px,${(r - start2) * 260}px,0)`;
          grid.append(n);
        }
        root.append(grid);
        if (!loading && choices.length === 1) root.append(el("p", "avatar-empty", "Non ci sono altre immagini disponibili."));
        setActive(grid, pf.item);
        c2.reportFocus(pf, root);
        return;
      }
      rows();
      root.append(el("h1", "", "Chi guarda?"), el("p", "profiles-note", "Le tue storie, al punto in cui le hai lasciate"));
      const f = focus.current, idx = f.row === "profiles" ? f.c : Math.max(0, d.profiles.findIndex((p) => p.id === d.profile));
      const row = el("div", "profiles-row");
      row.style.left = `${Math.max(240, (1920 - Math.min(5, d.profiles.length) * 280 + 64) / 2)}px`;
      const offset = Math.max(0, idx - 2);
      for (let i = Math.max(0, offset - 1); i < Math.min(d.profiles.length, offset + 6); i++) {
        const p = d.profiles[i];
        const n = el("div", "profile-card", avatar(p), el("strong", "", p.name));
        n.dataset.id = p.id;
        n.setAttribute("role", "button");
        n.setAttribute("aria-label", p.name);
        n.style.transform = `translate3d(${(i - offset) * 280}px,0,0)`;
        row.append(n);
      }
      const actions = el("div", "profile-actions", button("Aggiungi profilo", "add", false, "plus"), ...d.profile ? [button("Cambia avatar", "avatar"), button("Cambia nome", "rename")] : []);
      root.append(row, actions);
      setActive(root, f.item);
      c2.reportFocus(f, root);
      if (!d.profiles.length) root.append(el("p", "profiles-empty", "Crea il primo profilo per iniziare."));
    }
    function edit(id) {
      mode = "editor";
      editingId = id;
      const person = d.profiles.find((p) => p.id === id);
      editor = createKeyboard(c2, { value: (person == null ? void 0 : person.name) || "", maxLength: 35, onLeft: () => {
      }, onChange: paint, onDone: async (value) => {
        const name = value.trim();
        if (!name) {
          c2.notify("Scrivi un nome prima di continuare.");
          return;
        }
        if (id) {
          const updated = await request("/api/profiles/name", { id, name });
          Object.assign(person, updated);
          mode = "profiles";
          paint();
          c2.rail.render();
        } else {
          const person2 = await request("/api/profiles", { name }, "POST");
          d.profiles.push(person2);
          await select(person2.id);
        }
      } });
      paint();
    }
    async function select(id) {
      await d.selectProfile(id);
      c2.applyPreferences();
      await c2.navigate("home", {}, true);
      d.primePreviews();
    }
    const avatarFocus = new FocusModel();
    function openAvatars() {
      mode = "avatars";
      loading = true;
      choices = [{ id: "initial", name: "Iniziale", url: null }];
      avatarFocus.setRows([{ id: "avatars:0", items: ["initial"] }]);
      paint();
      request("/api/avatar-choices").then((values) => {
        if (disposed || mode !== "avatars") return;
        choices.push(...values.map((v, i) => ({ ...v, id: `avatar:${i}` })));
        const rows2 = [];
        for (let i = 0; i < choices.length; i += 5) rows2.push({ id: `avatars:${i / 5}`, items: choices.slice(i, i + 5).map((v) => v.id) });
        avatarFocus.setRows(rows2);
        loading = false;
        paint();
      }).catch(() => {
        loading = false;
        if (mode === "avatars") paint();
      });
    }
    paint();
    c2.mount(root);
    return {
      root,
      paint,
      snapshot: () => focus.snapshot(),
      key(key) {
        if (mode === "editor") {
          editor.key(key);
          return;
        }
        if (mode === "avatars") {
          avatarFocus.move(key);
          paint();
          return;
        }
        focus.move(key);
        paint();
      },
      async activate() {
        if (mode === "editor") return editor.activate();
        if (mode === "avatars") {
          const choice = choices.find((v) => v.id === avatarFocus.current.item);
          const updated = await request("/api/profiles/avatar", { id: d.profile, avatar: choice.url });
          Object.assign(d.person, updated);
          mode = "profiles";
          paint();
          c2.rail.render();
          return;
        }
        const f = focus.current;
        if (f.row === "profiles") await select(f.item);
        else if (f.item === "add") edit(null);
        else if (f.item === "rename") edit(d.profile);
        else openAvatars();
      },
      longOK() {
        if (mode === "profiles" && focus.current.row === "profiles") {
          const id = focus.current.item;
          c2.openModal(d.profiles.find((p) => p.id === id).name, [{ id: "select", label: "Guarda con questo profilo", action: () => select(id) }, { id: "rename", label: "Cambia nome", action: () => edit(id) }]);
        }
      },
      back() {
        if (mode !== "profiles") {
          mode = "profiles";
          paint();
          return true;
        }
        if (!d.profile) {
          c2.exitPrompt();
          return true;
        }
        return false;
      },
      dispose() {
        disposed = true;
      }
    };
  }

  // public/tv/settings.js
  function settings(c2, params, state) {
    const d = c2.data, root = el("section", "settings-screen", el("h1", "", "Impostazioni"));
    const categories = [["quality", "Qualit\xE0 del video"], ["autoSkip", "Salti automatici"], ["autoNext", "Prossimo episodio"], ["audio", "Lingua audio"], ["subs", "Sottotitoli"], ["motion", "Movimento ridotto"], ["pc", "Versione PC"], ["info", "Informazioni"]];
    const focus = new FocusModel([{ id: "categories", items: categories.map((v) => v[0]) }]);
    focus.restore(state);
    let category = (state == null ? void 0 : state.category) || "quality";
    const descriptions = { quality: "Scegli come guardare i video. La versione leggera usa meno dati quando \xE8 pronta.", autoSkip: "Salta sigle, riassunti e anteprime quando i tempi sono disponibili.", autoNext: "Inizia il prossimo episodio dopo il conto alla rovescia.", audio: "La lingua preferita viene scelta quando \xE8 disponibile nel video.", subs: "Sottotitoli leggibili da lontano, nella lingua che preferisci.", motion: "Riduci i movimenti delle schermate e delle card.", pc: "Apri l\u2019interfaccia completa di Apollon.", info: "Tutte le tue storie, nella rete di casa." };
    const languages = [["ita", "Italiano"], ["jpn", "Giapponese"], ["eng", "Inglese"], ["fra", "Francese"], ["deu", "Tedesco"], ["spa", "Spagnolo"]];
    function values() {
      if (category === "quality") return [["auto", "Automatica"], ["original", "Originale"], ["480", "Versione leggera (480p)"]];
      if (["autoSkip", "autoNext", "motion"].includes(category)) return [["on", "Attivato"], ["off", "Disattivato"]];
      if (category === "audio") return languages;
      if (category === "subs") return [["off", "Nessuno"], ...languages];
      if (category === "pc") return [["open", "Apri versione PC"]];
      return [["about", "Apollon TV"]];
    }
    function chosen() {
      var _a2, _b;
      if (category === "quality") return d.preferenceValue("quality", "auto");
      if (category === "autoSkip") return ((_a2 = d.person) == null ? void 0 : _a2.autoSkip) === true ? "on" : "off";
      if (category === "autoNext") return ((_b = d.person) == null ? void 0 : _b.autoNext) !== false ? "on" : "off";
      if (category === "motion") return d.preferenceValue("tv-motion", false) ? "on" : "off";
      if (category === "audio") return d.preferenceValue("video-audio", "ita");
      if (category === "subs") return d.preferenceValue("video-subs", "off");
      return category === "pc" ? "open" : "about";
    }
    function paint() {
      var _a2, _b, _c;
      if (focus.current.row === "categories") category = focus.current.item;
      const options = values();
      focus.setRows([{ id: "categories", items: categories.map((v) => v[0]) }, { id: "values", items: options.map((v) => v[0]) }]);
      (_a2 = root.querySelector(".settings-menu")) == null ? void 0 : _a2.remove();
      (_b = root.querySelector(".settings-detail")) == null ? void 0 : _b.remove();
      const menu = el("div", "settings-menu", ...categories.map(([id, label]) => button(label, id)));
      setActive(menu, focus.current.row === "categories" ? category : "");
      (_c = menu.querySelector(`[data-id="${category}"]`)) == null ? void 0 : _c.classList.add("chosen");
      const detail = el("div", "settings-detail", el("h2", "", categories.find((v) => v[0] === category)[1]), el("p", "", descriptions[category]));
      for (const [id, label] of options) {
        const b = button(`${id === chosen() ? "\u2713 " : ""}${label}`, id);
        detail.append(b);
      }
      setActive(detail, focus.current.row === "values" ? focus.current.item : "");
      if (category === "info") detail.append(el("p", "settings-about", "Apollon TV \xB7 Per il tuo televisore\nCatalogo, profili e avanzamenti condivisi con Apollon."));
      root.append(menu, detail);
      c2.reportFocus(focus.current, root);
    }
    function enter() {
      focus.select("values", chosen());
      paint();
    }
    paint();
    c2.mount(root);
    return {
      root,
      paint,
      snapshot: () => ({ ...focus.snapshot(), category }),
      key(key) {
        if (key === "right" && focus.current.row === "categories") {
          enter();
          return;
        }
        if (key === "left") {
          if (focus.current.row === "values") {
            focus.select("categories", category);
            paint();
          } else c2.rail.open();
          return;
        }
        if (key === "up" || key === "down") {
          focus.move(key === "up" ? "left" : "right");
          paint();
        }
      },
      async activate() {
        if (focus.current.row === "categories") {
          enter();
          return;
        }
        const value = focus.current.item;
        if (category === "quality") d.setPreference("quality", value);
        if (category === "autoSkip" || category === "autoNext") await d.preference({ [category]: value === "on" });
        if (category === "audio") d.setPreference("video-audio", value);
        if (category === "subs") d.setPreference("video-subs", value);
        if (category === "motion") {
          d.setPreference("tv-motion", value === "on");
          c2.applyPreferences();
        }
        if (category === "pc") {
          location.href = "/?tv=0&apollonIntro=done";
          return;
        }
        paint();
      },
      back() {
        if (focus.current.row === "values") {
          focus.select("categories", category);
          paint();
          return true;
        }
        return false;
      }
    };
  }

  // public/tv/app.js
  var data = new TVData();
  var router = new Router();
  var host = document.getElementById("screen");
  var modalHost = document.getElementById("modal-root");
  var toastTimer;
  var modal = null;
  var heldOK = false;
  var longOK = false;
  var okTimer;
  var last = null;
  var busy = false;
  var factories = { home, browse, title, player, search, profiles, settings };
  var sectionStates = /* @__PURE__ */ new Map();
  var stateKey = (entry) => `${entry.owner || ""}|${entry.name}|${entry.params.page || ""}|${entry.params.category || ""}`;
  var c = {
    data,
    router,
    screen: null,
    section: "home",
    mount(node) {
      var _a2;
      node.classList.add("screen-enter");
      host.replaceChildren(node);
      host.dataset.ready = "true";
      host.dataset.screen = ((_a2 = router.current) == null ? void 0 : _a2.name) || "home";
    },
    reportFocus(f, root) {
      host.dataset.focus = f.item;
      host.dataset.row = f.row;
      root == null ? void 0 : root.setAttribute("data-focus", f.item);
    },
    notify(message) {
      const n = document.getElementById("toast");
      n.textContent = message;
      n.classList.add("visible");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => n.classList.remove("visible"), 3500);
    },
    async refreshScreen() {
      var _a2, _b;
      router.current.state = (_b = (_a2 = c.screen) == null ? void 0 : _a2.snapshot) == null ? void 0 : _b.call(_a2);
      await render();
    },
    applyPreferences() {
      document.getElementById("tv-stage").classList.toggle("reduce-motion", data.preferenceValue("tv-motion", false));
    },
    playLabel: (t) => playLabel(t, resumePoint(t, data.items, data.progress)),
    async navigate(name, params = {}, replace = false) {
      var _a2, _b, _c, _d, _e;
      if (!factories[name]) return c.notify("Non riesco ad aprire questa schermata. Torna alla home e riprova.");
      c.closeModal();
      (_a2 = c.rail) == null ? void 0 : _a2.close();
      let entry;
      if (replace) {
        if (router.current) router.current.state = (_c = (_b = c.screen) == null ? void 0 : _b.snapshot) == null ? void 0 : _c.call(_b);
        for (const old of router.stack) sectionStates.set(stateKey(old), old.state);
        entry = router.replace(name, params);
        entry.owner = data.profile;
        entry.state = sectionStates.get(stateKey(entry)) || null;
      } else {
        entry = router.push(name, params, (_e = (_d = c.screen) == null ? void 0 : _d.snapshot) == null ? void 0 : _e.call(_d));
        entry.owner = data.profile;
      }
      await render();
    },
    async back() {
      var _a2, _b;
      if (modal) {
        c.closeModal();
        return;
      }
      if (c.rail.expanded) {
        c.rail.key("back");
        return;
      }
      if ((_a2 = c.screen) == null ? void 0 : _a2.back) {
        if (await c.screen.back()) return;
      }
      if (router.stack.length > 1) {
        await data.refresh().catch(() => c.notify("La connessione \xE8 interrotta. Riprova tra poco."));
        router.back();
        await render();
      } else if (((_b = router.current) == null ? void 0 : _b.name) !== "home") await c.navigate("home", {}, true);
      else c.rail.open();
    },
    async play(t, item, position) {
      var _a2;
      const point = resumePoint(t, data.items, data.progress), target = item || point.item;
      if (t.remoteDown || (target == null ? void 0 : target.remoteDown)) return c.notify("Il fisso \xE8 spento. Riprova quando \xE8 acceso.");
      if (((_a2 = router.current) == null ? void 0 : _a2.name) !== "title" || router.current.params.id !== t.key) await c.navigate("title", { id: t.key });
      return c.navigate("player", { title: t.key, id: target.id, position: position != null ? position : item ? 0 : point.position });
    },
    options(t) {
      openOptions(c, t);
    },
    openModal(title2, choices, { initial, subtitle = "" } = {}) {
      c.closeModal();
      const root = el("div", "modal-shade", el("section", "tv-modal", el("h2", "", title2), subtitle ? el("p", "", subtitle) : null));
      const list = el("div", "modal-choices");
      root.firstChild.append(list);
      for (const o of choices) list.append(button(o.label, o.id, !!o.primary));
      const focus = new FocusModel([{ id: "modal", items: choices.map((o) => o.id) }]);
      if (initial) focus.select("modal", initial);
      const paint = () => {
        setActive(list, focus.current.item);
        c.reportFocus(focus.current, root);
      };
      modal = { key(key) {
        if (key === "back") {
          c.closeModal();
          return;
        }
        if (["up", "down", "left", "right"].includes(key)) {
          const delta = key === "up" || key === "left" ? -1 : 1;
          focus.select("modal", choices[Math.max(0, Math.min(choices.length - 1, focus.current.c + delta))].id);
          paint();
        }
      }, activate() {
        var _a2;
        const choice = choices.find((o) => o.id === focus.current.item);
        c.closeModal();
        return (_a2 = choice.action) == null ? void 0 : _a2.call(choice);
      } };
      modalHost.append(root);
      paint();
    },
    closeModal() {
      var _a2, _b;
      modal = null;
      modalHost.replaceChildren();
      (_b = (_a2 = c.screen) == null ? void 0 : _a2.paint) == null ? void 0 : _b.call(_a2);
    },
    exitPrompt() {
      c.openModal("Uscire da Apollon?", [{ id: "stay", label: "Resta", action: () => c.rail.close() }, { id: "exit", label: "Esci", action: () => {
        try {
          globalThis.tizen.application.getCurrentApplication().exit();
        } catch {
          c.rail.close();
          c.notify("Puoi chiudere questa finestra.");
        }
      } }], { initial: "stay" });
    },
    async action(fn) {
      if (busy) return;
      busy = true;
      try {
        await (fn == null ? void 0 : fn());
      } catch (e) {
        c.notify(/fetch|network|load|timeout/i.test(e.message) ? "La connessione \xE8 interrotta. Riprova tra poco." : e.message);
      } finally {
        busy = false;
      }
    }
  };
  async function render() {
    var _a2, _b;
    (_b = (_a2 = c.screen) == null ? void 0 : _a2.dispose) == null ? void 0 : _b.call(_a2);
    const section = router.stack.find((e) => ["home", "browse", "search", "profiles", "settings"].includes(e.name)) || router.current;
    c.section = section.name === "browse" ? section.params.page : section.name === "profiles" ? "profile" : section.name;
    c.rail.render();
    c.screen = factories[router.current.name](c, router.current.params, router.current.state);
  }
  c.rail = createRail(c);
  var keys = { 37: "left", 38: "up", 39: "right", 40: "down", 13: "ok", 10009: "back", 27: "back", 8: "back", 10252: "toggle", 415: "play", 19: "pause", 417: "forward", 412: "rewind" };
  var named = { ArrowLeft: "left", ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", Enter: "ok", Escape: "back", Backspace: "back", MediaPlayPause: "toggle", MediaPlay: "play", MediaPause: "pause", MediaFastForward: "forward", MediaRewind: "rewind" };
  document.addEventListener("keydown", (e) => {
    var _a2;
    const key = keys[e.keyCode] || named[e.key];
    if (!key) {
      if (e.key === "Tab") e.preventDefault();
      return;
    }
    e.preventDefault();
    if (((_a2 = c.screen) == null ? void 0 : _a2.directKeys) && !modal && !c.rail.expanded) {
      c.action(() => c.screen.key(key, e));
      return;
    }
    if (key === "ok") {
      if (!heldOK) {
        heldOK = true;
        longOK = false;
        okTimer = setTimeout(() => {
          var _a3, _b;
          longOK = true;
          if (!modal && !c.rail.expanded) (_b = (_a3 = c.screen) == null ? void 0 : _a3.longOK) == null ? void 0 : _b.call(_a3);
        }, 650);
      }
      return;
    }
    if (key === "back") {
      if (!e.repeat) c.action(() => c.back());
      return;
    }
    const now = performance.now();
    if (!acceptRepeat(key, now, last, e.repeat)) return;
    last = { key, at: now };
    if (modal) modal.key(key);
    else if (c.rail.expanded) c.rail.key(key);
    else c.action(() => {
      var _a3, _b;
      return (_b = (_a3 = c.screen) == null ? void 0 : _a3.key) == null ? void 0 : _b.call(_a3, key, e);
    });
  });
  document.addEventListener("keyup", (e) => {
    var _a2, _b, _c;
    const key = keys[e.keyCode] || named[e.key];
    if (!key) return;
    e.preventDefault();
    if (((_a2 = c.screen) == null ? void 0 : _a2.directKeys) && !modal && !c.rail.expanded) {
      (_c = (_b = c.screen).keyup) == null ? void 0 : _c.call(_b, key, e);
      return;
    }
    if (key === "ok") {
      clearTimeout(okTimer);
      const activate = heldOK && !longOK;
      heldOK = false;
      if (activate) c.action(() => {
        var _a3, _b2;
        return modal ? modal.activate() : c.rail.expanded ? c.rail.activate() : (_b2 = (_a3 = c.screen) == null ? void 0 : _a3.activate) == null ? void 0 : _b2.call(_a3);
      });
    }
    last = null;
  });
  window.addEventListener("blur", () => {
    var _a2, _b;
    heldOK = false;
    clearTimeout(okTimer);
    last = null;
    (_b = (_a2 = c.screen) == null ? void 0 : _a2.releaseKeys) == null ? void 0 : _b.call(_a2);
  });
  function resize() {
    const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
    document.getElementById("tv-stage").style.transform = `scale(${scale})`;
  }
  window.addEventListener("resize", resize);
  resize();
  var _a;
  try {
    const input = (_a = globalThis.tizen) == null ? void 0 : _a.tvinputdevice;
    for (const name of ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaFastForward", "MediaRewind"]) try {
      input == null ? void 0 : input.registerKey(name);
    } catch {
    }
  } catch {
  }
  async function start() {
    try {
      await data.load();
      c.applyPreferences();
      router.replace(data.profile ? "home" : "profiles").owner = data.profile;
      await render();
      if (data.profile) data.primePreviews();
    } catch {
      c.mount(el("section", "error-screen", el("h1", "", "La raccolta non \xE8 raggiungibile"), el("p", "", "Controlla che Apollon sia accesa e premi OK per riprovare."), button("Riprova", "retry", true)));
      c.screen = { activate: start, key() {
      } };
    }
  }
  start();
})();
