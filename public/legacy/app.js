(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // public/music-logic.js
  function similarity(a = {}, b = {}) {
    let score = 0;
    if ((a.genere || a.genre) && (a.genere || a.genre) === (b.genere || b.genre)) score += 3;
    score += list(a.mood).filter((m) => list(b.mood).includes(m)).length * 3;
    for (const [key, span] of [["energia", 100], ["bpm", 120]]) if (Number.isFinite(a[key]) && Number.isFinite(b[key])) score += 2 * Math.max(0, 1 - Math.abs(a[key] - b[key]) / span);
    if (a.tonalita && a.tonalita === b.tonalita) score += 1;
    return score;
  }
  function smartQueue(songs, { exclude = [], stats = {}, seed, limit = 100, random = Math.random } = {}) {
    const seen = new Set(exclude);
    const pool = [];
    for (const song2 of songs) if ((song2 == null ? void 0 : song2.id) && !song2.problema && !seen.has(song2.id)) {
      pool.push(song2);
      seen.add(song2.id);
    }
    const result = [];
    let last = seed;
    const ranks = new Map(pool.map((s) => {
      var _a2;
      return [s.id, -Math.log(Math.max(1e-6, random())) / ((s.starred ? 2 : 1) * (1 + 2 / (1 + (((_a2 = stats[s.id]) == null ? void 0 : _a2.count) || 0))) * (1 + similarity(seed, s)))];
    }));
    while (pool.length && result.length < limit) {
      let candidates = pool.filter((s) => !last || (!last.artist || s.artist !== last.artist) && (!(last.albumId || last.album) || (s.albumId || s.album) !== (last.albumId || last.album)));
      if (!candidates.length) candidates = pool.filter((s) => !(last == null ? void 0 : last.artist) || s.artist !== last.artist);
      if (!candidates.length) candidates = pool;
      let best = candidates[0];
      let score = Infinity;
      for (const s of candidates) {
        const rank2 = ranks.get(s.id) / (1 + similarity(last, s) * 0.3);
        if (rank2 < score) {
          best = s;
          score = rank2;
        }
      }
      result.push(best);
      pool.splice(pool.indexOf(best), 1);
      last = best;
    }
    return result;
  }
  function dailyRandom(key) {
    let n = 2166136261;
    for (const c2 of key) n = Math.imul(n ^ c2.charCodeAt(0), 16777619);
    return () => {
      n |= 0;
      n = n + 1831565813 | 0;
      let t = Math.imul(n ^ n >>> 15, 1 | n);
      t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function moveEntry(queue, index, from, to) {
    if (![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < queue.length)) return { queue: [...queue], index };
    const positions = queue.map((song2, i) => ({ song: song2, i }));
    const [entry] = positions.splice(from, 1);
    positions.splice(to, 0, entry);
    return { queue: positions.map((p) => p.song), index: positions.findIndex((p) => p.i === index) };
  }
  function removeEntry(queue, index, at) {
    const result = queue.filter((_, i) => i !== at);
    return { queue: result, index: Math.max(0, Math.min(result.length - 1, index - Number(at < index))), currentRemoved: index === at };
  }
  function nextIndex(index, length, repeat, ended = false) {
    if (!length) return -1;
    if (ended && repeat === "one") return index;
    return index + 1 < length ? index + 1 : repeat === "all" ? 0 : -1;
  }
  function volumeGain(song2) {
    var _a2, _b2, _c, _d, _e, _f;
    const gain = Number((_d = (_c = (_a2 = song2 == null ? void 0 : song2.replayGain) == null ? void 0 : _a2.trackGain) != null ? _c : (_b2 = song2 == null ? void 0 : song2.replayGain) == null ? void 0 : _b2.albumGain) != null ? _d : 0);
    const peak = Number((_f = (_e = song2 == null ? void 0 : song2.replayGain) == null ? void 0 : _e.trackPeak) != null ? _f : 1);
    return Number.isFinite(gain) ? Math.max(0, Math.min(1, 10 ** (gain / 20), peak > 0 ? 1 / peak : 1)) : 1;
  }
  function qualifies(duration, listened) {
    return Number.isFinite(duration) && duration > 0 && listened >= Math.min(duration / 2, 240);
  }
  var list;
  var init_music_logic = __esm({
    "public/music-logic.js"() {
      list = (value) => Array.isArray(value) ? value : [];
    }
  });

  // public/music-feedback.js
  function marqueePlan(overflow) {
    if (!Number.isFinite(overflow) || overflow <= 1) return null;
    const travel = overflow / 25 * 1e3, duration = travel * 2 + 3200;
    return { duration, frames: [
      { transform: "translateX(0)", offset: 0 },
      { transform: "translateX(0)", offset: 1600 / duration },
      { transform: `translateX(${-overflow}px)`, offset: (1600 + travel) / duration },
      { transform: `translateX(${-overflow}px)`, offset: (3200 + travel) / duration },
      { transform: "translateX(0)", offset: 1 }
    ] };
  }
  function watchMarquees(nodes) {
    var _a2, _b2;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const animations = /* @__PURE__ */ new Map();
    let frame;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        var _a3;
        for (const node of nodes) {
          (_a3 = animations.get(node)) == null ? void 0 : _a3.cancel();
          animations.delete(node);
          let text = node.firstElementChild;
          if (!text) {
            text = document.createElement("span");
            text.className = "marquee-text";
            text.textContent = node.textContent;
            node.replaceChildren(text);
          }
          node.classList.add("marquee-title");
          node.title = text.textContent;
          const plan = marqueePlan(text.scrollWidth - node.clientWidth);
          if (plan && typeof text.animate === "function" && !reduced.matches && !document.hidden && node.getClientRects().length) {
            animations.set(node, text.animate(plan.frames, { duration: plan.duration, iterations: Infinity, easing: "linear" }));
          }
        }
      });
    };
    if ("ResizeObserver" in globalThis) {
      const observer = new ResizeObserver(refresh);
      nodes.forEach((n) => observer.observe(n));
    }
    if (reduced.addEventListener) reduced.addEventListener("change", refresh);
    else (_a2 = reduced.addListener) == null ? void 0 : _a2.call(reduced, refresh);
    document.addEventListener("visibilitychange", refresh);
    (_b2 = document.fonts) == null ? void 0 : _b2.ready.then(refresh);
    refresh();
    return refresh;
  }
  function vibrate(enabled, device = globalThis.navigator) {
    if (!enabled || typeof (device == null ? void 0 : device.vibrate) !== "function") return false;
    try {
      return device.vibrate(12);
    } catch {
      return false;
    }
  }
  async function changeMusicPage(render, { enabled = true, doc = globalThis.document } = {}) {
    var _a2, _b2;
    if (!enabled || typeof (doc == null ? void 0 : doc.startViewTransition) !== "function") return render();
    pageTransition == null ? void 0 : pageTransition.skipTransition();
    let applied = false;
    const apply = () => {
      applied = true;
      return render();
    };
    try {
      const transition = pageTransition = doc.startViewTransition(apply);
      (_a2 = transition.ready) == null ? void 0 : _a2.catch(() => {
      });
      (_b2 = transition.finished) == null ? void 0 : _b2.catch(() => {
      });
      await transition.updateCallbackDone;
    } catch (error) {
      if (!applied) return apply();
      throw error;
    }
  }
  function musicIcon(name, filled = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", class: `music-icon icon-${name}`, "aria-hidden": "true", focusable: "false", fill: "none", stroke: "currentColor", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" })) svg.setAttribute(k, v);
    const paths = {
      heart: "M12 20C8 17 3 13 3 8.5C3 3.5 9 3 12 7C15 3 21 3.5 21 8.5C21 13 16 17 12 20Z",
      play: "M8 4L20 12L8 20Z",
      pause: "M8 5V19M16 5V19",
      next: "M5 5L16 12L5 19ZM19 5V19",
      previous: "M19 5L8 12L19 19ZM5 5V19",
      close: "M6 6L18 18M18 6L6 18"
    };
    if (name === "bars") {
      for (let i = 0; i < 4; i++) {
        const rect = document.createElementNS(svg.namespaceURI, "rect");
        for (const [k, v] of Object.entries({ x: 3 + i * 5, y: 5, width: 3, height: 15, rx: 1, fill: "currentColor", stroke: "none" })) rect.setAttribute(k, v);
        svg.append(rect);
      }
    } else {
      const path = document.createElementNS(svg.namespaceURI, "path");
      path.setAttribute("d", paths[name] || paths.play);
      if (filled || name === "play") path.setAttribute("fill", "currentColor");
      svg.append(path);
    }
    return svg;
  }
  function setMusicIcon(button, name) {
    if (button.dataset.musicIcon === name) return;
    button.replaceChildren(musicIcon(name));
    button.dataset.musicIcon = name;
  }
  var pageTransition;
  var init_music_feedback = __esm({
    "public/music-feedback.js"() {
    }
  });

  // public/music-shell.js
  function shellIcon(name, filled = false) {
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `music-icon shell-icon icon-${name}`);
    const path = document.createElementNS(SVG, "path");
    path.setAttribute("d", PATHS[name] || PATHS.note);
    const solid = filled || name === "play";
    path.setAttribute("fill", solid ? "currentColor" : "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", name === "more" ? "3.2" : "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    return svg;
  }
  function hued(node, property, value) {
    node.style.setProperty(property, String(value));
    return node;
  }
  function nameHue(text) {
    let h = 7;
    for (const ch of String(text || "")) h = h * 31 + ch.codePointAt(0) >>> 0;
    return h % 230;
  }
  function initials(name) {
    const words = String(name || "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
    return words.length ? (words[0][0] + (words.length > 1 ? words.at(-1)[0] : "")).toLocaleUpperCase("it") : "\u266A";
  }
  function art(el2, image, { ids = [], name = "", round = false, glyph = "", size = 160 } = {}) {
    const box = hued(el2("span", { class: `art${round ? " round" : ""}`, "aria-hidden": "true" }), "--art-hue", nameHue(name));
    fillArt(el2, box, image, unique(ids), { name, glyph, size });
    return box;
  }
  function fillArt(el2, box, image, ids, { name, glyph, size }) {
    const generated = () => {
      box.classList.remove("collage");
      box.classList.add("generated");
      box.replaceChildren(el2("span", { class: "art-glyph" }, glyph || initials(name)));
    };
    if (!ids.length) {
      generated();
      return;
    }
    box.classList.remove("generated");
    box.classList.toggle("collage", ids.length >= 2);
    const cells = ids.length >= 2 ? [0, 1, 2, 3].map((i) => ids[i % ids.length]) : [ids[0]];
    box.replaceChildren(...cells.map((id) => el2("img", {
      src: image(id, ids.length >= 2 ? 160 : size),
      alt: "",
      loading: "lazy",
      decoding: "async",
      onerror: (event) => {
        event.target.remove();
        if (!box.querySelector("img")) generated();
      }
    })));
  }
  function setArt(el2, box, image, ids, options = {}) {
    fillArt(el2, box, image, unique(ids), { name: options.name || "", glyph: options.glyph || "", size: options.size || 160 });
  }
  function coverIds(c2, type, name) {
    const id = `${type}:${name}`, scope = c2.key(), storeKey = `${scope}:covers`, memoKey = `${scope}/${id}`;
    const saved = c2.storage.get(storeKey, {});
    const hit = saved && saved[id];
    if (hit && Date.now() - hit.at < 864e5 && Array.isArray(hit.ids)) return Promise.resolve(hit.ids);
    if (memo.has(memoKey)) return memo.get(memoKey);
    const job = line.then(async () => {
      var _a2;
      const result = type === "playlist" ? await c2.api(`/api/music/playlist?id=${encodeURIComponent(name)}`) : await c2.api(`/api/music/collection?type=${type}&name=${encodeURIComponent(name)}`);
      const songs = type === "playlist" ? ((_a2 = result.playlist) == null ? void 0 : _a2.entry) || [] : result.songs || [];
      const ids = unique(songs.map((s) => s.coverArt || s.albumId)).slice(0, 8);
      const all = c2.storage.get(storeKey, {}) || {};
      all[id] = { ids, at: Date.now() };
      c2.storage.set(storeKey, Object.fromEntries(Object.entries(all).slice(-200)));
      return ids;
    });
    line = job.catch(() => {
    });
    memo.set(memoKey, job);
    job.then(() => memo.delete(memoKey), () => memo.delete(memoKey));
    return job;
  }
  function lazyArt(c2, box, type, name, options = {}) {
    coverIds(c2, type, name).then((ids) => {
      if (ids.length) setArt(c2.el, box, c2.image, options.shift ? [...ids.slice(options.shift), ...ids.slice(0, options.shift)] : ids, { name, ...options });
    }).catch(() => {
    });
    return box;
  }
  function coverColor(img) {
    const src = (img == null ? void 0 : img.currentSrc) || (img == null ? void 0 : img.src);
    if (!src) return Promise.resolve(null);
    if (colors.has(src)) return Promise.resolve(colors.get(src));
    return new Promise((resolve) => {
      const read = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 12;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, 12, 12);
          const data = ctx.getImageData(0, 0, 12, 12).data;
          const rgb = [0, 0, 0];
          for (let i = 0; i < data.length; i += 4) for (let k = 0; k < 3; k++) rgb[k] += data[i + k];
          const value = rgb.map((v) => Math.round(v / 144));
          colors.set(src, value);
          resolve(value);
        } catch {
          resolve(null);
        }
      };
      if (img.complete && img.naturalWidth) read();
      else {
        img.addEventListener("load", read, { once: true });
        img.addEventListener("error", () => resolve(null), { once: true });
      }
    });
  }
  function deepen(rgb, light = 0.3) {
    const [r, g, b] = rgb.map((v) => v / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    let h = 0;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    if (d) h = max === r ? (g - b) / d % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return `hsl(${Math.round((h * 60 + 360) % 360)} ${Math.round(Math.min(s, 0.7) * 100)}% ${Math.round(Math.max(0.18, Math.min(light, l)) * 100)}%)`;
  }
  function tint(node, box, property = "--hero-color", light = 0.34) {
    const img = box == null ? void 0 : box.querySelector("img");
    if (!img) {
      node.style.setProperty(property, `hsl(${(box == null ? void 0 : box.style.getPropertyValue("--art-hue")) || 150} 40% ${Math.round(light * 100)}%)`);
      return;
    }
    coverColor(img).then((rgb) => {
      if (rgb) node.style.setProperty(property, deepen(rgb, light));
    });
  }
  function hero(el2, { cover, title, kind = "", sub = "", tools = [], play, shuffle, extra = [] }) {
    const node = el2(
      "header",
      { class: "music-hero" },
      el2("div", { class: "hero-cover" }, cover),
      el2("div", { class: "hero-text" }, kind ? el2("p", { class: "hero-kind" }, kind) : null, el2("h2", {}, title), sub ? el2("p", { class: "hero-sub" }, sub) : null),
      el2("div", { class: "hero-actions" }, el2("div", { class: "hero-tools" }, ...tools), el2("div", { class: "hero-play" }, shuffle || null, play || null)),
      ...extra
    );
    tint(node, cover);
    return node;
  }
  function heroPlay(el2, onclick, disabled = false, label = "Ascolta tutto") {
    return el2("button", { class: "play-big", "aria-label": label, title: label, disabled, onclick }, shellIcon("play"));
  }
  function heroButton(el2, icon, label, onclick, extra = {}) {
    return el2("button", { class: "hero-icon", "aria-label": label, title: label, onclick, ...extra }, shellIcon(icon));
  }
  function shelf(el2, title, cards, { kind = "all", note = "" } = {}) {
    if (!cards.length) return null;
    return el2(
      "section",
      { class: "shelf", "data-shelf": kind },
      el2("div", { class: "shelf-head" }, el2("h2", {}, title), note ? el2("p", { class: "muted" }, note) : null),
      el2("div", { class: "shelf-row" }, ...cards)
    );
  }
  function card(el2, { cover, title, sub = "", label, onclick, round = false, data = {} }) {
    return el2(
      "button",
      { class: `shelf-card${round ? " round-card" : ""}`, "aria-label": label || title, onclick, ...data },
      cover,
      el2("strong", { class: "shelf-title" }, title),
      sub ? el2("small", { class: "shelf-sub" }, sub) : null
    );
  }
  function quickTile(el2, { cover, title, open, play }) {
    let timer = 0, long = false;
    const opener = el2("button", {
      class: "quick-open",
      "aria-label": `Vai a ${title}`,
      onpointerdown: (event) => {
        if (!play || event.button) return;
        long = false;
        clearTimeout(timer);
        timer = setTimeout(() => {
          long = true;
          play();
        }, 550);
      },
      onpointerup: () => clearTimeout(timer),
      onpointerleave: () => clearTimeout(timer),
      onpointercancel: () => clearTimeout(timer),
      oncontextmenu: (event) => {
        if (play) event.preventDefault();
      },
      onclick: (event) => {
        if (long) {
          long = false;
          event.preventDefault();
          return;
        }
        open();
      }
    }, cover, el2("span", { class: "quick-title" }, title));
    return el2("div", { class: "quick-tile" }, opener, play ? el2("button", { class: "quick-play", "aria-label": `Riproduci ${title}`, title: "Riproduci", onclick: play }, shellIcon("play")) : null);
  }
  function pressFeedback(root) {
    const selector = ".shelf-card,.quick-open,.mood-card,.library-open,.library-row,.side-row,.chip,#music-nav button,.sheet-item,.play-big";
    root.addEventListener("pointerdown", (event) => {
      const target = event.target.closest(selector);
      if (target) target.classList.add("pressed");
    });
    for (const type of ["pointerup", "pointercancel", "pointerleave", "dragstart"]) root.addEventListener(type, () => root.querySelectorAll(".pressed").forEach((n) => n.classList.remove("pressed")), true);
  }
  function profileVisual(el2, profile) {
    const letter = () => el2("span", { "aria-hidden": "true" }, initials(profile.name).slice(0, 1));
    if (!/^\/media\/avatar\/[a-f0-9]{24}\.jpg$/.test(profile.avatar || "")) return letter();
    const image = el2("img", { class: "profile-photo", src: profile.avatar, alt: "", decoding: "async" });
    image.addEventListener("error", () => image.replaceWith(letter()), { once: true });
    return image;
  }
  function avatar(c2) {
    var _a2;
    const { el: el2, state: state2 } = c2;
    const me = (((_a2 = state2.boot) == null ? void 0 : _a2.profiles) || []).find((p) => p.id === state2.profile) || { name: state2.profile || "?" };
    return hued(el2(
      "button",
      { class: "avatar", "aria-label": `Cambia profilo, ora ascolta ${me.name}`, title: "Cambia profilo", onclick: () => profileSheet(c2) },
      profileVisual(el2, me)
    ), "--avatar-hue", nameHue(me.name));
  }
  function profileSheet(c2) {
    var _a2;
    const { el: el2, state: state2 } = c2;
    const select = document.querySelector("#profile");
    const sheet = el2(
      "dialog",
      { class: "music-sheet profile-sheet", "aria-labelledby": "profile-sheet-title" },
      el2("div", { class: "dialog-heading" }, el2("h2", { id: "profile-sheet-title" }, "Chi ascolta?"), el2("button", { class: "close-dialog icon-button", "aria-label": "Chiudi la scelta del profilo", onclick: () => sheet.close() }, "\xD7")),
      el2(
        "div",
        { class: "sheet-list" },
        ...(((_a2 = state2.boot) == null ? void 0 : _a2.profiles) || []).map((p) => el2("button", { class: "sheet-item", "aria-pressed": p.id === state2.profile, onclick: () => {
          sheet.close();
          if (p.id === state2.profile) return;
          select.value = p.id;
          select.dispatchEvent(new Event("change"));
        } }, hued(el2("span", { class: "avatar small", "aria-hidden": "true" }, profileVisual(el2, p)), "--avatar-hue", nameHue(p.name)), el2("span", { class: "sheet-copy" }, el2("strong", {}, p.name), el2("small", {}, p.id === state2.profile ? "Sta ascoltando ora" : "Passa a questo profilo")))),
        el2("button", { class: "sheet-item", onclick: () => {
          sheet.close();
          document.querySelector("#add-profile").click();
        } }, el2("span", { class: "sheet-mark" }, shellIcon("plus")), el2("span", { class: "sheet-copy" }, el2("strong", {}, "Nuovo profilo"), el2("small", {}, "Ognuno con la sua musica e i suoi preferiti")))
      )
    );
    sheet.addEventListener("close", () => sheet.remove());
    document.body.append(sheet);
    c2.showModal(sheet);
  }
  function sectionTop(c2, title, tools = []) {
    return c2.el("div", { class: "section-top" }, avatar(c2), c2.el("h2", {}, title), c2.el("div", { class: "section-tools" }, ...tools));
  }
  function artistArt(c2, name, coverArt, size = 160) {
    return art(c2.el, c2.image, { ids: /^ar-/.test(coverArt || "") ? [coverArt] : [], name, round: true, size });
  }
  var SVG, PATHS, unique, memo, line, colors;
  var init_music_shell = __esm({
    "public/music-shell.js"() {
      SVG = "http://www.w3.org/2000/svg";
      PATHS = {
        home: "M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z",
        search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.4 15.4 20 20",
        library: "M8 4h12v12M4 8h12v12H4z",
        plus: "M12 5v14M5 12h14",
        devices: "M3 6h10v12H3zM16 9h5v9h-5zM18.5 15h0M8 15h0",
        add: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 8v8M8 12h8",
        added: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12.5l2.7 2.7L16 9.8",
        shuffle: "M4 7h3.5l9 10H20M4 17h3.5l2.6-2.9M13.9 9.9 16.5 7H20M18 5l2 2-2 2M18 15l2 2-2 2",
        download: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7.5v8M8.5 12.5 12 16l3.5-3.5",
        more: "M5 12h.01M12 12h.01M19 12h.01",
        back: "M15 5l-7 7 7 7",
        queue: "M4 6h16M4 12h10M4 18h10M17 14v6l4-3z",
        people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2",
        blend: "M9 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM15 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z",
        note: "M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
        play: "M8 5.5v13l11-6.5z",
        sort: "M4 7h16M7 12h10M10 17h4",
        grid: "M5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5z",
        list: "M4 6h16M4 12h16M4 18h16",
        close: "M6 6l12 12M18 6 6 18",
        panel: "M4 5h16v14H4zM14 5v14"
      };
      unique = (ids) => [...new Set(ids.filter((id) => typeof id === "string" && id))];
      memo = /* @__PURE__ */ new Map();
      line = Promise.resolve();
      colors = /* @__PURE__ */ new Map();
    }
  });

  // public/music-offline-range.js
  var musicCacheName, manifestURL, streamURL;
  var init_music_offline_range = __esm({
    "public/music-offline-range.js"() {
      musicCacheName = (scope) => `mediateca-music-v1:${encodeURIComponent(scope)}`;
      manifestURL = "/offline-music-manifest";
      streamURL = (id, scope) => `/api/music/stream?id=${encodeURIComponent(id)}&offline=${encodeURIComponent(scope)}`;
    }
  });

  // public/video-offline-range.js
  var CHUNK, MAX_REPLY, videoCacheName, videoManifestURL, partURL, playURL, downloadedBytes;
  var init_video_offline_range = __esm({
    "public/video-offline-range.js"() {
      init_music_offline_range();
      CHUNK = 4 * 1024 ** 2;
      MAX_REPLY = 32 * 1024 ** 2;
      videoCacheName = "mediateca-video-v1";
      videoManifestURL = "/offline-video-manifest";
      partURL = (id, n) => `/offline-video-part/${id}/${n}`;
      playURL = (id) => `/media/${id}?dl=1`;
      downloadedBytes = (entry) => Math.min(entry.total, entry.done * entry.chunk);
    }
  });

  // public/downloads.js
  function notePending(map, id, { position, duration, watched }, at = Date.now()) {
    const seen = Number(position) || 0, length = Number(duration) || 0;
    map[id] = { position: seen, duration: length, watched: watched === true || length > 0 && seen / length >= 0.95, at };
    return map;
  }
  async function syncPending(profile, pending, api2) {
    var _a2;
    const ids = Object.keys(pending);
    if (!ids.length) return {};
    const server = await api2(`/api/progress?profile=${encodeURIComponent(profile)}`);
    const left = {};
    const seen = [];
    const retry = (e) => !e.status || e.status >= 500;
    for (const id of ids) {
      const v = pending[id];
      if ((((_a2 = server[id]) == null ? void 0 : _a2.updated) || 0) > v.at) continue;
      if (v.watched) {
        seen.push(id);
        continue;
      }
      try {
        await api2("/api/progress", { method: "PUT", data: { profile, id, position: v.position, duration: v.duration } });
      } catch (e) {
        if (retry(e)) left[id] = v;
      }
    }
    if (seen.length) try {
      await api2("/api/progress/batch", { method: "PUT", data: { ids: seen, profile, watched: true } });
    } catch (e) {
      if (retry(e)) for (const id of seen) left[id] = pending[id];
    }
    return left;
  }
  function asProgress(pending) {
    return Object.fromEntries(Object.entries(pending || {}).map(([id, v]) => [id, { position: v.position, duration: v.duration, watched: v.watched, updated: v.at }]));
  }
  async function freeSpace(storage2 = ((_a2) => (_a2 = globalThis.navigator) == null ? void 0 : _a2.storage)()) {
    var _a3;
    const e = await ((_a3 = storage2 == null ? void 0 : storage2.estimate) == null ? void 0 : _a3.call(storage2).catch(() => null));
    return (e == null ? void 0 : e.quota) ? Math.max(0, e.quota - (e.usage || 0)) : null;
  }
  function statusText(entry, job) {
    const pct2 = (entry == null ? void 0 : entry.total) ? Math.round(100 * downloadedBytes(entry) / entry.total) : 0;
    if ((entry == null ? void 0 : entry.state) === "done") return "Pronto senza rete";
    if ((job == null ? void 0 : job.state) === "preparing") return "Sto preparando la versione leggera\u2026";
    if ((job == null ? void 0 : job.state) === "queued") return "In attesa\u2026";
    if (job) return `Scarico\u2026 ${pct2}%`;
    return `Interrotto al ${pct2}% \xB7 puoi riprendere`;
  }
  function createDownloads(c2) {
    const { el: el2, state: state2, notify: notify2, action: action2, fmtSize: fmtSize2, manager } = c2;
    let free = null;
    const refreshFree = async () => {
      const now = await freeSpace();
      if (now !== free) {
        free = now;
        c2.repaint();
      }
    };
    const rows = () => {
      var _a2;
      const entries = Object.values(((_a2 = manager.m) == null ? void 0 : _a2.entries) || {});
      const map = new Map(entries.map((e) => [e.id, { entry: e, item: e.item }]));
      for (const job of manager.jobs.values()) if (!map.has(job.id)) map.set(job.id, { entry: null, item: job.item });
      return [...map.values()].sort((a, b) => (a.item.series || a.item.title).localeCompare(b.item.series || b.item.title, "it") || a.item.season - b.item.season || a.item.episode - b.item.episode);
    };
    function row({ entry, item }) {
      var _a2;
      const job = manager.jobs.get(item.id);
      const done = (entry == null ? void 0 : entry.state) === "done";
      const share = (entry == null ? void 0 : entry.total) ? downloadedBytes(entry) / entry.total : 0;
      const name = item.series ? `${item.series} \xB7 S${item.season}:E${item.episode}` : item.title;
      const size = entry ? `${fmtSize2(entry.total)} \xB7 ${entry.quality === "light" ? "Standard" : "Originale"}` : "";
      return el2(
        "li",
        { class: `dl-row${done ? " done" : ""}`, "data-id": item.id },
        el2("span", { class: "dl-art" }, ((_a2 = item.images) == null ? void 0 : _a2.poster) ? el2("img", { src: `/media/${item.id}/poster?s=260`, alt: "", width: 60, height: 90, loading: "lazy", onerror: (e) => e.target.remove() }) : null),
        el2(
          "span",
          { class: "dl-text" },
          el2("strong", {}, name),
          item.series ? el2("small", {}, item.title) : null,
          el2("small", { class: "dl-status", role: "status" }, [size, statusText(entry, job)].filter(Boolean).join(" \xB7 ")),
          done ? null : el2("progress", { max: "1", value: String(share), "aria-label": `Avanzamento: ${name}` })
        ),
        el2(
          "span",
          { class: "dl-actions" },
          done ? el2("button", { class: "primary", onclick: action2(() => c2.playItem(item)) }, "Guarda") : null,
          !done && !job ? el2("button", { class: "primary", onclick: action2(async () => {
            manager.enqueue(item, entry.quality);
          }) }, "Riprendi") : null,
          job ? el2("button", { class: "secondary", onclick: action2(() => manager.cancel(item.id)) }, "Annulla") : el2("button", { class: "quiet", onclick: action2(async () => {
            if (await c2.ask(`Eliminare \xAB${name}\xBB?`, "", "Il video torna a occupare spazio solo a casa. Potrai scaricarlo di nuovo.", true)) {
              await manager.remove(item.id);
              notify2("Download eliminato.");
            }
          }) }, "Elimina")
        )
      );
    }
    function view() {
      var _a2;
      refreshFree();
      const list2 = rows();
      const used = list2.reduce((n, r) => n + (r.entry ? downloadedBytes(r.entry) : 0), 0);
      return [el2(
        "section",
        { class: "dl-page" },
        el2(
          "div",
          { class: "page-head" },
          el2("h1", {}, "Scaricati"),
          el2("p", {}, "I video qui sotto stanno nella memoria di Apollon: li guardi anche senza rete, e non finiscono nella galleria.")
        ),
        state2.offline ? el2("p", { class: "dl-offline", role: "status" }, "Sei senza rete. Puoi guardare quello che hai scaricato. Il punto in cui sei arrivato viene rimandato a casa appena torni connesso.") : null,
        el2(
          "div",
          { class: "dl-space" },
          el2("span", {}, el2("strong", {}, fmtSize2(used)), " occupati dai video scaricati"),
          el2("span", {}, free === null ? "Spazio libero: non lo so dire" : el2("span", {}, el2("strong", {}, fmtSize2(free)), " ancora liberi sul telefono"))
        ),
        manager.lastError ? el2("p", { class: "error", role: "alert" }, manager.lastError) : null,
        list2.length ? el2("ul", { class: "dl-list" }, ...list2.map(row)) : el2("div", { class: "empty" }, el2("h2", {}, "Non hai ancora scaricato niente"), el2("p", {}, "Apri un film o un episodio e tocca \xABScarica\xBB. Scegli se vuoi la versione che occupa meno spazio o l\u2019originale.")),
        ((_a2 = state2.boot) == null ? void 0 : _a2.music) ? el2("p", {}, el2("button", { class: "secondary", onclick: () => c2.setPage("music") }, "Vai alla musica scaricata")) : null
      )];
    }
    return { view };
  }
  var pendingKey;
  var init_downloads = __esm({
    "public/downloads.js"() {
      init_video_offline_range();
      pendingKey = (profile) => `pending-progress:${profile}`;
    }
  });

  // public/music-offline-cache.js
  function estimatedBytes(songs, quality = "high") {
    return songs.reduce((n, s) => n + (quality === "low" ? Math.ceil((Number(s.duration) || 240) * LOW_KBPS * 125 * 1.05) : Number(s.size) > 0 ? Number(s.size) : Math.ceil((Number(s.duration) || 240) * (Number(s.bitRate) || 192) * 125 * 1.1)), 0);
  }
  var LOW_KBPS, locks, OfflineMusic;
  var init_music_offline_cache = __esm({
    "public/music-offline-cache.js"() {
      init_music_offline_range();
      init_music_offline_range();
      LOW_KBPS = 128;
      locks = /* @__PURE__ */ new Map();
      OfflineMusic = class {
        constructor(scope, { caches = globalThis.caches, fetch: fetch2 = (...args) => globalThis.fetch(...args), storage: storage2 = ((_a2) => (_a2 = globalThis.navigator) == null ? void 0 : _a2.storage)(), lock = ((_b2) => (_b2 = globalThis.navigator) == null ? void 0 : _b2.locks)() } = {}) {
          Object.assign(this, { scope, caches, fetch: fetch2, storage: storage2, lock });
          this.name = musicCacheName(scope);
        }
        async manifest() {
          const response = await (await this.caches.open(this.name)).match(manifestURL);
          return response ? response.json() : { version: 1, tracks: {}, collections: {}, limitBytes: 1024 ** 3 };
        }
        async save(manifest) {
          await (await this.caches.open(this.name)).put(manifestURL, new Response(JSON.stringify(manifest), { headers: { "Content-Type": "application/json" } }));
        }
        exclusive(fn) {
          var _a2;
          if ((_a2 = this.lock) == null ? void 0 : _a2.request) return this.lock.request(this.name, fn);
          const task = (locks.get(this.name) || Promise.resolve()).catch(() => {
          }).then(fn);
          locks.set(this.name, task.catch(() => {
          }));
          return task;
        }
        used(manifest) {
          return Object.values(manifest.tracks).reduce((n, t) => n + t.bytes, 0);
        }
        async collections() {
          if (!this.caches) return [];
          const m = await this.manifest(), cache = await this.caches.open(this.name);
          const result = [];
          for (const col of Object.values(m.collections)) {
            let complete = true;
            for (const id of col.ids) if (!m.tracks[id] || !await cache.match(streamURL(id, this.scope))) {
              complete = false;
              break;
            }
            if (complete) result.push({ ...col, songs: col.ids.map((id) => m.tracks[id].song), bytes: col.ids.reduce((n, id) => n + m.tracks[id].bytes, 0), quality: col.ids.every((id) => m.tracks[id].quality === "low") ? "low" : "high", downloaded: true });
          }
          return result;
        }
        async estimate(songs, quality = "high") {
          var _a2, _b2, _c;
          const m = await this.manifest(), system = await ((_b2 = (_a2 = this.storage) == null ? void 0 : _a2.estimate) == null ? void 0 : _b2.call(_a2)) || {};
          const needed = estimatedBytes(songs.filter((s) => !m.tracks[s.id]), quality);
          return { needed, used: this.used(m), limit: m.limitBytes, available: Math.max(0, Math.min(m.limitBytes - this.used(m), ((_c = system.quota) != null ? _c : Infinity) - (system.usage || 0))), quota: system.quota };
        }
        async setLimit(bytes) {
          if (!Number.isFinite(bytes) || bytes < 50 * 1024 ** 2 || bytes > 20 * 1024 ** 3) throw new Error("Scegli un limite tra 50 MB e 20 GB.");
          return this.exclusive(async () => {
            const m = await this.manifest();
            if (bytes < this.used(m)) throw new Error("Prima rimuovi qualche download per scendere a questo limite.");
            m.limitBytes = bytes;
            await this.save(m);
          });
        }
        async download(collection, { signal, progress = () => {
        }, quality = "high" } = {}) {
          return this.exclusive(async () => {
            var _a2, _b2, _c, _d, _e, _f;
            const m = await this.manifest(), cache = await this.caches.open(this.name);
            const next = structuredClone(m), added = [];
            for (const request of await cache.keys()) {
              const url = new URL(typeof request === "string" ? request : request.url, "http://local");
              if (url.pathname === "/api/music/stream" && !m.tracks[url.searchParams.get("id")]) await cache.delete(request);
            }
            const songs = [...new Map(collection.songs.filter((s) => !s.problema).map((s) => [s.id, s])).values()];
            if (!songs.length) throw new Error("Questa raccolta non contiene brani da scaricare.");
            const space = await this.estimate(songs, quality);
            if (space.needed > space.available) throw new Error("Non c\u2019\xE8 abbastanza spazio. Aumenta il limite o rimuovi un download.");
            const persistent = await ((_b2 = (_a2 = this.storage) == null ? void 0 : _a2.persist) == null ? void 0 : _b2.call(_a2).catch(() => false)) || false;
            try {
              for (let i = 0; i < songs.length; i++) {
                signal == null ? void 0 : signal.throwIfAborted();
                const song2 = songs[i];
                const url = streamURL(song2.id, this.scope);
                if (!next.tracks[song2.id] || !await cache.match(url)) {
                  const response = await this.fetch(quality === "low" ? `${url}&q=low` : url, { cache: "no-store", signal });
                  if (!response.ok || response.status !== 200 || !/^(audio\/|application\/octet-stream)/i.test(response.headers.get("Content-Type") || "")) throw new Error("Un brano non si scarica. Controlla la rete e riprova.");
                  const blob = await response.blob();
                  signal == null ? void 0 : signal.throwIfAborted();
                  if (!blob.size) throw new Error("Il brano ricevuto \xE8 vuoto.");
                  const available = await ((_d = (_c = this.storage) == null ? void 0 : _c.estimate) == null ? void 0 : _d.call(_c)) || {};
                  const previousBytes = ((_e = next.tracks[song2.id]) == null ? void 0 : _e.bytes) || 0;
                  if (this.used(next) - previousBytes + blob.size > next.limitBytes || blob.size > ((_f = available.quota) != null ? _f : Infinity) - (available.usage || 0)) throw new Error("Spazio esaurito durante il download. Rimuovi qualche download e riprova.");
                  await cache.put(url, new Response(blob, { headers: { "Content-Type": response.headers.get("Content-Type"), "Content-Length": String(blob.size), "Accept-Ranges": "bytes" } }));
                  added.push(song2.id);
                  next.tracks[song2.id] = { song: song2, bytes: blob.size, quality };
                }
                progress(i + 1, songs.length);
              }
              next.collections[`${collection.type}:${collection.id}`] = { id: collection.id, type: collection.type, name: collection.name, artist: collection.artist, cover: collection.cover, ids: songs.map((s) => s.id) };
              if (collection.cover) try {
                const art2 = await this.fetch(collection.cover, { signal });
                if (art2.ok) await cache.put(collection.cover, art2);
              } catch (error) {
                if (error.name === "AbortError") throw error;
              }
              const keep = new Set(Object.values(next.collections).flatMap((c2) => c2.ids));
              const obsolete = Object.keys(next.tracks).filter((id) => !keep.has(id));
              for (const id of obsolete) delete next.tracks[id];
              signal == null ? void 0 : signal.throwIfAborted();
              await this.save(next);
              for (const id of obsolete) await cache.delete(streamURL(id, this.scope));
              return { persistent, bytes: this.used(next) };
            } catch (error) {
              for (const id of added) if (!m.tracks[id]) await cache.delete(streamURL(id, this.scope));
              throw error;
            }
          });
        }
        async remove(key) {
          return this.exclusive(async () => {
            var _a2;
            const m = await this.manifest(), cache = await this.caches.open(this.name);
            const cover = (_a2 = m.collections[key]) == null ? void 0 : _a2.cover;
            delete m.collections[key];
            const removeCover = cover && !Object.values(m.collections).some((collection) => collection.cover === cover);
            const keep = new Set(Object.values(m.collections).flatMap((c2) => c2.ids));
            const removed = Object.keys(m.tracks).filter((id) => !keep.has(id));
            for (const id of removed) delete m.tracks[id];
            await this.save(m);
            if (removeCover) await cache.delete(cover);
            for (const id of removed) await cache.delete(streamURL(id, this.scope));
          });
        }
      };
    }
  });

  // public/music-offline.js
  var music_offline_exports = {};
  __export(music_offline_exports, {
    QUALITY: () => QUALITY,
    musicJobs: () => musicJobs,
    offlineLibrary: () => offlineLibrary,
    prepareOffline: () => prepareOffline
  });
  async function prepareOffline() {
    let timer;
    try {
      const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("La memoria offline non \xE8 pronta. Ricarica la pagina e riprova.")), 15e3);
      })]);
      clearTimeout(timer);
      await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        timer = setTimeout(() => {
          channel.port1.close();
          reject(new Error("Preparazione offline interrotta. Riprova sul Wi-Fi."));
        }, 2e4);
        channel.port1.onmessage = (e) => {
          channel.port1.close();
          e.data.ok ? resolve() : reject(new Error("Non riesco a preparare la pagina senza rete. Riprova."));
        };
        (navigator.serviceWorker.controller || registration.active).postMessage({ type: "prepare-music" }, [channel.port2]);
      });
    } finally {
      clearTimeout(timer);
    }
  }
  function offlineLibrary(c2) {
    const manager = new OfflineMusic(c2.key());
    const { el: el2, action: action2 } = c2;
    const supported = () => !!globalThis.isSecureContext && !!navigator.serviceWorker && !!globalThis.caches;
    const showCollection = async (type, id, generation) => {
      const collection = (await manager.collections()).find((i) => i.type === type && i.id === id);
      if (generation !== c2.state.musicGeneration) return;
      if (!collection) throw new Error("Questa raccolta non \xE8 scaricata su questo dispositivo.");
      document.querySelector("#music-breadcrumb").replaceChildren(el2("button", { class: "quiet", onclick: () => c2.load("library") }, "\u2039 La tua musica"));
      document.querySelector("#music-results").replaceChildren(el2("section", { class: "offline-heading" }, avatar(c2), el2("h2", {}, collection.name), el2("p", { role: "status" }, "Scaricata \xB7 pronta senza rete"), el2("button", { class: "primary", onclick: () => c2.setQueue(collection.songs) }, "Ascolta tutto"), el2("button", { class: "secondary", onclick: action2(async () => {
        await manager.remove(`${type}:${id}`);
        await showOffline(++c2.state.musicGeneration);
      }) }, "Rimuovi download")), c2.trackList(collection.songs));
    };
    const showOffline = async (generation) => {
      var _a2;
      const collections = await manager.collections();
      if (generation !== c2.state.musicGeneration) return;
      const used = collections.reduce((n, col) => n + col.bytes, 0), free = await freeSpace();
      if (generation !== c2.state.musicGeneration) return;
      const jobs = [...musicJobs.values()].filter((job) => job.scope === manager.name);
      const repaint = () => {
        if (generation === c2.state.musicGeneration) showOffline(generation).catch(() => {
        });
      };
      document.querySelector("#music-breadcrumb").replaceChildren();
      document.querySelector("#music-results").replaceChildren(el2(
        "section",
        { class: "offline-heading dl-page" },
        avatar(c2),
        el2("h2", {}, "Scaricati"),
        el2("p", { role: "status" }, navigator.onLine && !c2.state.offline ? "La musica salvata su questo telefono: si ascolta anche senza rete." : "Sei senza rete. Qui trovi la musica scaricata su questo telefono."),
        el2("div", { class: "dl-space" }, el2("span", {}, el2("strong", {}, c2.fmtSize(used)), " occupati dalla musica scaricata"), el2("span", {}, free === null ? "Spazio libero: non lo so dire" : el2("span", {}, el2("strong", {}, c2.fmtSize(free)), " ancora liberi sul telefono"))),
        el2(
          "ul",
          { class: "dl-list" },
          ...jobs.map((job) => el2(
            "li",
            { class: "dl-row dl-music" },
            el2("span", { class: "dl-art" }),
            el2("span", { class: "dl-text" }, el2("strong", {}, job.name), el2("small", { role: "status" }, `Scarico\u2026 ${job.done} di ${job.total} brani`), el2("progress", { max: String(job.total), value: String(job.done), "aria-label": `Avanzamento: ${job.name}` })),
            el2("span", { class: "dl-actions" }, el2("button", { class: "secondary", onclick: () => job.abort.abort() }, "Annulla"))
          )),
          ...collections.map((col) => {
            var _a3, _b2;
            return el2(
              "li",
              { class: "dl-row dl-music done" },
              el2("span", { class: "dl-art" }, el2("img", { src: col.cover || c2.image(((_a3 = col.songs[0]) == null ? void 0 : _a3.coverArt) || ((_b2 = col.songs[0]) == null ? void 0 : _b2.albumId), 160), alt: "", width: 60, height: 60, loading: "lazy", onerror: (e) => {
                e.target.src = "/music-cover.svg";
              } })),
              el2("span", { class: "dl-text" }, el2("strong", {}, col.name), el2("small", {}, `${col.songs.length} brani \xB7 ${c2.fmtSize(col.bytes)} \xB7 ${QUALITY[col.quality]}`), el2("small", { class: "dl-status" }, "Pronta senza rete")),
              el2(
                "span",
                { class: "dl-actions" },
                el2("button", { class: "primary", onclick: action2(() => showCollection(col.type, col.id, ++c2.state.musicGeneration)) }, "Ascolta"),
                el2("button", { class: "quiet", onclick: action2(async () => {
                  await manager.remove(`${col.type}:${col.id}`);
                  c2.notify("Download eliminato.");
                  await showOffline(++c2.state.musicGeneration);
                }) }, "Elimina")
              )
            );
          })
        ),
        !collections.length && !jobs.length ? el2("p", {}, "Non hai ancora scaricato musica per questo profilo. Torna sul Wi-Fi di casa e usa Scarica su un album o una playlist.") : null,
        ((_a2 = c2.state.boot) == null ? void 0 : _a2.mode) !== "music" ? el2("p", {}, el2("button", { class: "secondary", onclick: () => c2.setPage("scaricati") }, "Vai ai video scaricati")) : null
      ));
      if (jobs.length) setTimeout(repaint, 1e3);
    };
    const downloadButton = (collection) => {
      const button = el2("button", { class: "secondary download-collection", onclick: action2(async () => {
        if (!supported()) throw new Error("Per scaricare serve un browser con memoria offline e Apollon aperta con HTTPS (oppure localhost sul PC).");
        const existing = (await manager.collections()).find((i) => i.type === collection.type && i.id === collection.id);
        let quality = c2.storage.get("music-dl-quality", "low") === "high" ? "high" : "low";
        const info = await manager.estimate(collection.songs, quality);
        const dialog = el2("dialog", { class: "download-dialog", "aria-label": "Musica senza rete" });
        const plan = (i) => existing ? "Questa raccolta \xE8 gi\xE0 scaricata." : `Da scaricare: circa ${c2.fmtSize(i.needed)}. Disponibili entro il limite: ${c2.fmtSize(i.available)}.`;
        const status = el2("p", { role: "status", "aria-live": "polite" }, plan(info));
        const bar = el2("progress", { max: "1", value: "0", hidden: true, "aria-label": "Avanzamento del download" });
        const choose = el2("select", { "aria-label": "Qualit\xE0 del download" }, el2("option", { value: "low" }, "Risparmio spazio (consigliato, circa 128 kbit/s)"), el2("option", { value: "high" }, "Alta qualit\xE0 (il file originale, occupa di pi\xF9)"));
        choose.value = quality;
        choose.addEventListener("change", action2(async () => {
          quality = choose.value;
          c2.storage.set("music-dl-quality", quality);
          status.textContent = plan(await manager.estimate(collection.songs, quality));
        }));
        const limit = el2("input", { type: "number", min: "50", max: "20480", step: "50", value: Math.round(info.limit / 1024 ** 2), "aria-label": "Limite download in MB" });
        let abort;
        const close = el2("button", { class: "quiet", onclick: () => dialog.close(), "aria-label": "Chiudi download" }, "Chiudi");
        const start = el2("button", { class: "primary", onclick: action2(async () => {
          if (abort) return;
          abort = new AbortController();
          start.disabled = true;
          remove.disabled = true;
          choose.disabled = true;
          const key = `${collection.type}:${collection.id}`, job = { scope: manager.name, name: collection.name, done: 0, total: collection.songs.length, abort };
          musicJobs.set(key, job);
          cancel.hidden = false;
          bar.hidden = false;
          status.textContent = "Preparo la memoria offline\u2026";
          try {
            await prepareOffline();
            const first = collection.songs[0];
            const result = await manager.download({ ...collection, cover: first ? c2.image(first.coverArt || first.albumId, 160) : void 0 }, { signal: abort.signal, quality, progress: (n, total) => {
              job.done = n;
              job.total = total;
              bar.max = total;
              bar.value = n;
              status.textContent = `Scarico ${n} di ${total} brani\u2026`;
            } });
            const boot = c2.state.boot;
            c2.storage.set("offline-bootstrap", { music: true, musicUser: boot.musicUser, profiles: boot.profiles, mode: "music", roots: [], count: 0, pending: false, demo: boot.demo });
            status.textContent = result.persistent ? "Scaricata. Puoi ascoltarla senza rete." : "Scaricata. Il browser pu\xF2 liberare questa memoria quando lo spazio scarseggia.";
            button.textContent = "Scaricata \u2713";
            remove.disabled = false;
            if (!dialog.isConnected) c2.notify(`\xAB${collection.name}\xBB \xE8 scaricata. La trovi in Scaricati.`);
          } catch (error) {
            status.textContent = error.name === "AbortError" ? "Download annullato. I download precedenti restano disponibili." : error.message;
            if (!dialog.isConnected && error.name !== "AbortError") c2.notify(error.message, true);
          } finally {
            musicJobs.delete(key);
            abort = null;
            start.disabled = false;
            choose.disabled = false;
            cancel.hidden = true;
            bar.hidden = true;
          }
        }) }, existing ? "Aggiorna download" : "Scarica su questo dispositivo");
        const cancel = el2("button", { class: "secondary", hidden: true, onclick: () => abort == null ? void 0 : abort.abort() }, "Annulla download");
        const remove = el2("button", { class: "secondary", disabled: !existing, onclick: action2(async () => {
          await manager.remove(`${collection.type}:${collection.id}`);
          button.textContent = "Scarica";
          status.textContent = "Download rimosso. I brani restano nella raccolta di casa.";
          remove.disabled = true;
        }) }, "Rimuovi download");
        dialog.append(el2("div", { class: "dialog-heading" }, el2("h2", {}, collection.name), close), status, bar, el2("label", {}, "Qualit\xE0", choose), el2("label", {}, "Spazio massimo per questo profilo (MB)", limit), el2("button", { class: "secondary", onclick: action2(async () => {
          await manager.setLimit(Number(limit.value) * 1024 ** 2);
          status.textContent = "Limite salvato.";
        }) }, "Salva limite"), el2("div", { class: "actions" }, start, cancel, remove));
        dialog.addEventListener("close", () => dialog.remove(), { once: true });
        document.body.append(dialog);
        c2.showModal(dialog);
      }) }, "Scarica");
      manager.collections().then((items) => {
        if (items.some((i) => i.id === collection.id && i.type === collection.type)) button.textContent = "Scaricata \u2713";
      }).catch(() => {
      });
      return button;
    };
    return { manager, showCollection, showOffline, downloadButton };
  }
  var musicJobs, QUALITY;
  var init_music_offline = __esm({
    "public/music-offline.js"() {
      init_music_offline_cache();
      init_music_shell();
      init_downloads();
      musicJobs = /* @__PURE__ */ new Map();
      QUALITY = { low: "Risparmio spazio", high: "Alta qualit\xE0" };
    }
  });

  // public/music-listening.js
  var music_listening_exports = {};
  __export(music_listening_exports, {
    flushListening: () => flushListening
  });
  function flushListening(storage2, key, send) {
    if (running.has(key)) return running.get(key);
    const task = (async () => {
      var _a2;
      for (; ; ) {
        const pending = storage2.get(key, {});
        const [id, event] = Object.entries(pending)[0] || [];
        if (!id) return;
        try {
          await send(event);
        } catch (error) {
          if (![400, 404].includes(error.status)) return;
        }
        const latest = storage2.get(key, {});
        if ((((_a2 = latest[id]) == null ? void 0 : _a2.seconds) || 0) <= event.seconds) delete latest[id];
        storage2.set(key, latest);
      }
    })();
    running.set(key, task);
    return task.finally(() => running.delete(key));
  }
  var running;
  var init_music_listening = __esm({
    "public/music-listening.js"() {
      running = /* @__PURE__ */ new Map();
    }
  });

  // public/music-session.js
  var music_session_exports = {};
  __export(music_session_exports, {
    Together: () => Together,
    addedLabel: () => addedLabel,
    canControl: () => canControl,
    endMessage: () => endMessage,
    queueSignature: () => queueSignature,
    spacedCode: () => spacedCode
  });
  var ENDINGS, endMessage, addedLabel, canControl, spacedCode, queueSignature, song, Together;
  var init_music_session = __esm({
    "public/music-session.js"() {
      ENDINGS = { closed: "La sessione \xE8 stata chiusa.", removed: "Chi ha aperto la sessione ti ha tolto.", hostgone: "La sessione si \xE8 chiusa: il dispositivo che suonava \xE8 rimasto scollegato.", absent: "Sei uscito dalla sessione: eri scollegato da troppo tempo.", left: "Hai lasciato la sessione." };
      endMessage = (reason) => ENDINGS[reason] || "La sessione \xE8 finita.";
      addedLabel = (song2) => (song2 == null ? void 0 : song2.addedBy) ? `Aggiunto da ${song2.addedBy}` : "";
      canControl = (view, id) => !!view && (view.host === id || view.guestsControl);
      spacedCode = (code) => String(code).split("").join(" ");
      queueSignature = (state2) => state2 ? `${state2.index}/${state2.paused}/${(state2.queue || []).map((s) => `${s.id}:${s.addedBy || ""}`).join(",")}` : "";
      song = (s) => Object.fromEntries(["id", "title", "artist", "album", "albumId", "artistId", "coverArt", "duration"].filter((k) => s[k] !== void 0).map((k) => [k, s[k]]));
      Together = class {
        constructor(d) {
          this.d = d;
          this.c = d.c;
          this.view = null;
          this.state = null;
          this.version = -1;
          this.sessions = [];
          this.layout = "";
          this.queueSig = "";
        }
        get guest() {
          return !!this.view && this.view.host !== this.d.id;
        }
        post(verb, data = {}) {
          return this.d.post(`session/${verb}`, { id: this.d.id, ...data });
        }
        event(e) {
          var _a2, _b2, _c, _d, _e;
          const wasGuest = this.guest;
          if (e.type === "session") {
            this.view = e.session;
            if (e.state !== void 0) {
              this.state = e.state;
              this.version = -1;
            }
            if (this.guest && !wasGuest) this.c.pauseLocal();
            if (this.guest && this.state) this.c.mirror({ volume: 0.8, ...this.state });
          } else if (e.type === "session-state" && ((_a2 = this.view) == null ? void 0 : _a2.sid) === e.sid && e.version >= this.version) {
            this.version = e.version;
            this.state = { ...e.state, queue: (_d = (_c = e.state.queue) != null ? _c : (_b2 = this.state) == null ? void 0 : _b2.queue) != null ? _d : [] };
            if (this.guest) this.c.mirror({ volume: 0.8, ...this.state });
          } else if (e.type === "session-end" && ((_e = this.view) == null ? void 0 : _e.sid) === e.sid) {
            this.view = null;
            this.state = null;
            if (wasGuest) this.c.mirror({ queue: [], index: 0, paused: true, position: 0, volume: 0.8 });
            this.c.notify(endMessage(e.reason));
          }
          this.draw();
          this.paint();
        }
        async load() {
          const q = `?id=${encodeURIComponent(this.d.id)}&profile=${encodeURIComponent(this.d.profile)}`;
          const [list2, mine] = await Promise.all([this.c.api(`/api/music/devices/session/list${q}`), this.c.api(`/api/music/devices/session/mine${q}`)]);
          if (mine.session) {
            this.d.event({ type: "session", ...mine });
            return false;
          }
          this.sessions = list2.sessions;
          return true;
        }
        async refresh() {
          if (!this.view && this.dialog && await this.load()) this.draw();
        }
        async enter(data) {
          const r = await this.post("join", data);
          this.d.event({ type: "session", ...r });
          this.c.notify("Sei dentro: ora ascolti insieme.");
        }
        open() {
          var _a2;
          if ((_a2 = this.dialog) == null ? void 0 : _a2.isConnected) return;
          const { el: el2 } = this.c;
          const dialog = this.dialog = el2("dialog", { class: "together-dialog", "aria-label": "Ascoltiamo insieme" });
          this.body = el2("div", { class: "together-body" });
          this.layout = "";
          this.queueSig = "";
          dialog.append(el2("div", { class: "dialog-heading" }, el2("h2", {}, "Ascoltiamo insieme"), el2("button", { class: "quiet", "aria-label": "Chiudi ascoltiamo insieme", onclick: () => dialog.close() }, "Chiudi")), this.body);
          dialog.addEventListener("close", () => {
            var _a3;
            clearInterval(this.poll);
            (_a3 = this.searchRequest) == null ? void 0 : _a3.abort();
            this.dialog = null;
            dialog.remove();
          }, { once: true });
          document.body.append(dialog);
          this.draw();
          this.c.showModal(dialog);
          this.refresh().catch((e) => this.c.notify(e.message, true));
          let ticks = 0;
          this.poll = setInterval(() => {
            if (this.view) this.paint();
            else if (++ticks % 5 === 0) this.refresh().catch(() => {
            });
          }, 1e3);
        }
        // Elenco delle sessioni della casa dentro la finestra dei dispositivi.
        async fill(box) {
          const { el: el2, action: action2 } = this.c;
          if (this.view || !await this.load().catch(() => false) || !box.isConnected) return;
          box.replaceChildren(...this.sessions.map((s) => el2("button", { class: "secondary", disabled: s.full, onclick: action2(async () => {
            var _a2;
            (_a2 = box.closest("dialog")) == null ? void 0 : _a2.close();
            await this.enter({ sid: s.sid });
          }) }, `Entra nella sessione di ${s.hostName}${s.device ? ` \xB7 ${s.device}` : ""} \xB7 ${s.people} ${s.people === 1 ? "persona" : "persone"}${s.full ? " \xB7 piena" : ""}`)));
        }
        draw() {
          var _a2, _b2, _c;
          if (!this.dialog) return;
          const sig = JSON.stringify([this.view, this.view ? "" : this.sessions, this.d.isRemote(), this.c.state.queue.length > 0]);
          if (sig === this.layout) return;
          this.layout = sig;
          this.queueSig = "";
          const key = (_b2 = (_a2 = document.activeElement) == null ? void 0 : _a2.dataset) == null ? void 0 : _b2.k;
          this.body.replaceChildren(...this.view ? this.session() : this.start());
          if (key) (_c = this.body.querySelector(`[data-k="${key}"]`)) == null ? void 0 : _c.focus();
          this.paint();
        }
        start() {
          const { el: el2, action: action2 } = this.c;
          const can = !this.d.isRemote() && this.c.state.queue.length > 0;
          const code = el2("input", { "data-k": "code", inputmode: "numeric", maxlength: "4", pattern: "[0-9]{4}", autocomplete: "off", required: true, "aria-describedby": "together-code-help" });
          return [
            el2("p", { class: "muted" }, "Ascoltate insieme in casa: chi apre la sessione fa suonare la musica, gli altri entrano con un codice di 4 cifre, vedono cosa suona e aggiungono i loro brani alla coda comune."),
            el2(
              "section",
              { class: "together-section" },
              el2("h3", {}, "Apri una sessione"),
              el2("p", { class: "muted" }, can ? "La musica resta su questo dispositivo. Gli altri la vedono e aggiungono brani." : "Per aprire una sessione metti prima in ascolto un brano su questo dispositivo."),
              el2("button", { class: "primary", "data-k": "open", disabled: !can, onclick: action2(async () => {
                const r = await this.post("open");
                this.d.event({ type: "session", ...r });
              }) }, "Apri una sessione qui")
            ),
            el2(
              "section",
              { class: "together-section" },
              el2("h3", {}, "Entra in una sessione"),
              el2("div", { class: "menu-actions together-list" }, ...this.sessions.length ? this.sessions.map((s) => el2("button", { class: "secondary", "data-k": `s-${s.sid}`, disabled: s.full, onclick: action2(() => this.enter({ sid: s.sid })) }, `Sessione di ${s.hostName}${s.device ? ` \xB7 ${s.device}` : ""} \xB7 ${s.people} ${s.people === 1 ? "persona" : "persone"}${s.full ? " \xB7 piena" : ""}`)) : [el2("p", { class: "muted" }, "Non ci sono sessioni aperte in casa.")]),
              el2(
                "form",
                { class: "together-join", onsubmit: action2(async (e) => {
                  e.preventDefault();
                  await this.enter({ code: code.value.trim() });
                }) },
                el2("label", {}, "Oppure scrivi il codice di 4 cifre", code),
                el2("p", { id: "together-code-help", class: "muted" }, "Lo trovi sul dispositivo che suona."),
                el2("button", { class: "secondary", type: "submit", "data-k": "join" }, "Entra")
              )
            )
          ];
        }
        session() {
          const { el: el2, action: action2 } = this.c;
          const v = this.view, host = !this.guest, me = this.d.id;
          this.nowText = el2("p", { class: "together-now" });
          this.toggle = el2("button", { class: "primary", "data-k": "toggle", onclick: action2(() => {
            var _a2;
            return this.post("control", { op: ((_a2 = this.state) == null ? void 0 : _a2.paused) ? "play" : "pause" });
          }) });
          this.next = el2("button", { class: "secondary", "data-k": "next", onclick: action2(() => this.post("control", { op: "next" })) }, "Successivo");
          this.note = el2("p", { class: "muted", role: "status" });
          this.queueList = el2("ol", { class: "together-queue", "aria-label": "Coda comune" });
          const leave = host ? el2("button", { class: "secondary", "data-k": "close", onclick: action2(async () => {
            await this.post("close");
          }) }, "Chiudi la sessione") : el2("button", { class: "secondary", "data-k": "leave", onclick: action2(async () => {
            await this.post("leave");
            this.d.event({ type: "session-end", sid: v.sid, reason: "left" });
          }) }, "Esci dalla sessione");
          return [
            el2(
              "section",
              { class: "together-section" },
              el2("p", { class: "muted" }, host ? "Sessione aperta. Chi \xE8 in casa pu\xF2 entrare con questo codice:" : "Stai ascoltando insieme. Il codice della sessione \xE8:"),
              el2("strong", { class: "together-code", "aria-label": `Codice ${spacedCode(v.code)}` }, v.code)
            ),
            el2(
              "section",
              { class: "together-section" },
              el2("h3", {}, `Chi partecipa (${v.members.length} su ${v.max})`),
              el2("ul", { class: "together-members" }, ...v.members.map((m) => el2(
                "li",
                {},
                el2("span", {}, `${m.name}${m.id === me ? " \xB7 tu" : ""}${m.host ? " \xB7 ha aperto la sessione" : ""}${m.online ? "" : " \xB7 scollegato"}`),
                ...host && !m.host ? [el2("button", { class: "quiet", "data-k": `kick-${m.id}`, "aria-label": `Togli ${m.name} dalla sessione`, onclick: action2(() => this.post("kick", { member: m.id })) }, "Togli")] : []
              ))),
              ...host ? [el2("label", { class: "check" }, el2("input", { type: "checkbox", "data-k": "allow", checked: v.guestsControl, onchange: action2((e) => this.post("setting", { guestsControl: e.target.checked })) }), "Gli ospiti possono controllare la musica")] : []
            ),
            el2("section", { class: "together-section" }, el2("h3", {}, "Cosa suona"), this.nowText, ...host ? [] : [el2("div", { class: "actions" }, this.toggle, this.next), this.note], this.queueList),
            this.search(),
            el2("div", { class: "actions" }, leave)
          ];
        }
        paint() {
          var _a2, _b2;
          if (!this.dialog || !this.view || !((_a2 = this.nowText) == null ? void 0 : _a2.isConnected)) return;
          const s = this.guest ? this.state : this.c.snapshot(), current = (_b2 = s == null ? void 0 : s.queue) == null ? void 0 : _b2[s.index], allowed = canControl(this.view, this.d.id);
          this.nowText.textContent = current ? `${s.paused ? "In pausa" : "Suona ora"}: ${current.title}${current.artist ? ` \xB7 ${current.artist}` : ""}` : "Per ora non suona niente.";
          this.toggle.textContent = (s == null ? void 0 : s.paused) ? "Riproduci" : "Pausa";
          this.toggle.disabled = this.next.disabled = !allowed || !current;
          this.note.textContent = allowed ? "" : "Chi ha aperto la sessione ha tolto i comandi agli ospiti. Puoi sempre aggiungere brani.";
          const sig = queueSignature(s);
          if (sig === this.queueSig) return;
          this.queueSig = sig;
          const { el: el2 } = this.c;
          this.queueList.replaceChildren(...((s == null ? void 0 : s.queue) || []).map((q, i) => el2(
            "li",
            { class: "together-song", ...i === s.index ? { "aria-current": "true" } : {} },
            el2("strong", {}, q.title),
            el2("small", {}, [q.artist, i === s.index ? "In ascolto" : "", addedLabel(q)].filter(Boolean).join(" \xB7 "))
          )));
        }
        search() {
          if (this.box) return this.box;
          const { el: el2, action: action2, api: api2 } = this.c;
          const input = el2("input", { type: "search", "data-k": "search", maxlength: "100", "aria-label": "Cerca un brano da aggiungere" }), message = el2("p", { class: "muted", role: "status" }), results = el2("ul", { class: "together-results" });
          const form = el2("form", { class: "together-search", onsubmit: action2(async (e) => {
            var _a2, _b2;
            e.preventDefault();
            (_a2 = this.searchRequest) == null ? void 0 : _a2.abort();
            const request = this.searchRequest = new AbortController();
            const q = input.value.trim();
            if (!q) {
              message.textContent = "";
              results.replaceChildren();
              return;
            }
            message.textContent = "Cerco\u2026";
            try {
              const found = (((_b2 = (await api2(`/api/music/search?q=${encodeURIComponent(q)}`, { signal: request.signal })).searchResult3) == null ? void 0 : _b2.song) || []).slice(0, 8);
              if (request.signal.aborted || this.searchRequest !== request) return;
              message.textContent = found.length ? "" : "Nessun brano trovato. Prova con altre parole.";
              results.replaceChildren(...found.map((s) => el2(
                "li",
                {},
                el2("span", {}, el2("strong", {}, s.title), " ", el2("small", {}, s.artist || "")),
                el2("button", { class: "secondary", "aria-label": `Aggiungi ${s.title} alla coda comune`, onclick: action2(async () => {
                  await this.post("add", { songs: [song(s)] });
                  this.c.notify("Brano aggiunto alla coda comune.");
                }) }, "Aggiungi")
              )));
            } catch (error) {
              if (!request.signal.aborted) throw error;
            }
          }) }, input, el2("button", { class: "secondary", type: "submit" }, "Cerca"));
          return this.box = el2("section", { class: "together-section" }, el2("h3", {}, "Aggiungi un brano alla coda comune"), form, message, results);
        }
      };
    }
  });

  // public/music-devices.js
  var music_devices_exports = {};
  __export(music_devices_exports, {
    DeviceClient: () => DeviceClient,
    deviceConnection: () => deviceConnection
  });
  var deviceConnection, wireQueue, DeviceClient;
  var init_music_devices = __esm({
    "public/music-devices.js"() {
      deviceConnection = (cryptoApi = globalThis.crypto) => Array.from(cryptoApi.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      wireQueue = (queue) => queue.map((s) => Object.fromEntries(["id", "title", "artist", "album", "albumId", "artistId", "coverArt", "duration", "addedBy"].filter((k) => s[k] !== void 0).map((k) => [k, s[k]])));
      DeviceClient = class {
        constructor(c2) {
          this.c = c2;
          this.scope = c2.key();
          this.connection = deviceConnection();
          this.sequence = 0;
          this.devices = [];
          this.guestOf = "";
          this.target = sessionStorage.getItem(`${this.scope}:target`) || "";
          this.chain = Promise.resolve();
          try {
            this.seen = new Set(JSON.parse(sessionStorage.getItem(`${this.scope}:commands`) || "[]"));
          } catch {
            this.seen = /* @__PURE__ */ new Set();
          }
        }
        isRemote() {
          return !!this.guestOf || !!this.target && this.target !== this.id;
        }
        remote() {
          return this.devices.find((d) => d.id === this.target);
        }
        async post(path, data) {
          return this.c.api(`/api/music/devices/${path}`, { method: "POST", data: { ...data, profile: this.profile } });
        }
        async start() {
          const lifecycle = this.lifecycle = (this.lifecycle || 0) + 1;
          this.stopped = false;
          this.profile = this.c.state.profile;
          const key = `${this.scope}:device`;
          const previousId = sessionStorage.getItem(key);
          const d = await this.post("register", { id: previousId, connection: this.connection, name: sessionStorage.getItem(`${this.scope}:name`) || this.defaultName() });
          if (this.stopped || this.lifecycle !== lifecycle || this.c.key() !== this.scope) return;
          this.id = d.id;
          sessionStorage.setItem(key, d.id);
          if (!this.target || this.target === previousId) this.target = this.id;
          this.stream = new EventSource(`/api/music/devices/events?id=${encodeURIComponent(d.id)}&profile=${encodeURIComponent(this.profile)}`);
          this.stream.onmessage = (e) => {
            try {
              this.event(JSON.parse(e.data));
            } catch {
            }
          };
          this.stream.onerror = () => {
            this.status("Ricollego i dispositivi di casa\u2026");
          };
          if (this.isRemote()) this.c.pauseLocal();
          else await this.publish();
          if (this.stopped || this.lifecycle !== lifecycle || this.c.key() !== this.scope) return;
          this.timer = setInterval(() => {
            if (!this.isRemote() && !this.executing) this.publish().catch(() => {
            });
          }, 1e3);
          this.capture = (event) => this.intercept(event);
          document.addEventListener("click", this.capture, true);
          document.addEventListener("input", this.capture, true);
        }
        defaultName() {
          return /Android|iPhone/i.test(navigator.userAgent) ? "Telefono di casa" : "Browser di casa";
        }
        status(message) {
          var _a2;
          const button = document.querySelector("#music-devices");
          if (button) button.textContent = message || (this.guestOf ? "In sessione insieme" : this.isRemote() ? `Su ${((_a2 = this.remote()) == null ? void 0 : _a2.name) || "altro dispositivo"}` : "Dispositivi di casa");
        }
        event(e) {
          var _a2, _b2, _c, _d, _e;
          if (this.stopped || this.c.key() !== this.scope) return;
          if (e.type === "devices") this.devices = e.devices;
          if (e.type === "state") {
            const at = this.devices.findIndex((d) => d.id === e.device.id), previous = this.devices[at];
            const device = { ...e.device, state: { ...e.device.state, queue: (_c = (_b2 = e.device.state.queue) != null ? _b2 : (_a2 = previous == null ? void 0 : previous.state) == null ? void 0 : _a2.queue) != null ? _c : [] } };
            if (at < 0) this.devices.push(device);
            else if (device.version >= previous.version) this.devices[at] = device;
          }
          if (e.type === "devices" || e.type === "state") {
            const target = this.remote();
            if (this.isRemote() && !this.guestOf && (target == null ? void 0 : target.state)) this.c.mirror(target.state);
            this.status(this.isRemote() && !this.guestOf && !(target == null ? void 0 : target.online) ? "Dispositivo scollegato \xB7 scegli dove ascoltare" : "");
            if (e.type === "devices") (_d = this.draw) == null ? void 0 : _d.call(this);
          }
          if (e.type === "session") this.guestOf = e.session.host !== this.id ? e.session.sid : "";
          if (e.type === "session-end" && e.sid === this.guestOf) this.guestOf = "";
          if ((_e = e.type) == null ? void 0 : _e.startsWith("session")) {
            this.status();
            this.loadTogether().then((t) => t.event(e)).catch((ex) => this.c.notify(ex.message, true));
          }
          if (e.type === "command") {
            this.chain = this.chain.then(async () => {
              if (this.stopped || this.c.key() !== this.scope) return;
              this.executing = true;
              let error = "";
              try {
                if (!this.seen.has(e.commandId)) {
                  this.seen.add(e.commandId);
                  if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
                  sessionStorage.setItem(`${this.scope}:commands`, JSON.stringify([...this.seen]));
                  this.target = this.id;
                  sessionStorage.setItem(`${this.scope}:target`, this.id);
                  await this.c.execute(e.op, e.payload);
                }
              } catch (ex) {
                error = ex.message;
                this.c.notify(error, true);
              } finally {
                await this.publish(e.commandId, error).catch(() => {
                });
                this.executing = false;
              }
            });
          }
          if (e.type === "ack" && e.error) this.c.notify(e.error, true);
          if (e.type === "replaced") {
            this.stop();
            this.status("Pagina duplicata \xB7 ricarica per ricollegare");
          }
        }
        async publish(commandId, error) {
          if (this.stopped) return;
          const snapshot = this.c.snapshot();
          const state2 = { ...snapshot, queue: wireQueue(snapshot.queue) };
          const serialized = JSON.stringify(state2), queue = JSON.stringify(state2.queue);
          if (!commandId && serialized === this.lastPublished) return;
          const sequence = ++this.sequence;
          await this.post("state", { id: this.id, connection: this.connection, sequence, state: queue === this.lastQueue ? { ...state2, queue: void 0 } : state2, commandId, error });
          if (sequence === this.sequence && !this.stopped) {
            this.lastPublished = serialized;
            this.lastQueue = queue;
          }
        }
        loadTogether() {
          return this.togetherReady || (this.togetherReady = Promise.resolve().then(() => (init_music_session(), music_session_exports)).then((m) => this.together = new m.Together(this)));
        }
        async send(op, payload = {}) {
          var _a2;
          if (this.guestOf) throw new Error("Stai ascoltando insieme: aggiungi i brani dalla finestra \u201CAscoltiamo insieme\u201D.");
          if (!((_a2 = this.remote()) == null ? void 0 : _a2.online)) throw new Error("Il dispositivo non \xE8 collegato. Riapri Apollon o scegli questo dispositivo.");
          if (payload.queue) payload = { ...payload, queue: wireQueue(payload.queue) };
          return this.post("command", { from: this.id, target: this.target, op, payload });
        }
        intercept(e) {
          var _a2, _b2, _c;
          if (!this.isRemote()) return;
          const target = e.target.closest("button,input");
          if (!target) return;
          const id = target.id;
          let op, payload = {};
          if (e.type === "click") {
            if (["audio-toggle", "full-toggle"].includes(id)) op = ((_c = this.guestOf ? (_a2 = this.together) == null ? void 0 : _a2.state : (_b2 = this.remote()) == null ? void 0 : _b2.state) == null ? void 0 : _c.paused) ? "play" : "pause";
            if (["audio-next", "full-next"].includes(id)) op = "next";
            if (["audio-prev", "full-prev"].includes(id)) op = "previous";
          } else {
            if (["audio-seek", "full-seek"].includes(id)) {
              op = "seek";
              payload.position = Number(target.value);
            }
            if (id === "volume") {
              op = "volume";
              payload.volume = Number(target.value);
            }
          }
          if (!op || this.guestOf && !["play", "pause", "next"].includes(op)) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          (this.guestOf ? this.post("session/control", { id: this.id, op }) : this.send(op, payload)).catch((ex) => this.c.notify(ex.message, true));
        }
        async select(id) {
          var _a2, _b2, _c, _d, _e, _f, _g;
          if (this.selecting || id === this.target) return;
          this.selecting = true;
          const previousTarget = this.target;
          const snapshot = this.isRemote() ? (_a2 = this.remote()) == null ? void 0 : _a2.state : this.c.snapshot();
          let paused = false;
          try {
            if (this.isRemote() && ((_b2 = this.remote()) == null ? void 0 : _b2.online)) await this.send("pause");
            this.c.pauseLocal();
            paused = true;
            this.target = id;
            sessionStorage.setItem(`${this.scope}:target`, id);
            if (id === this.id) {
              if (snapshot) await this.c.execute("transfer", snapshot);
              await this.publish();
            } else if (snapshot == null ? void 0 : snapshot.queue.length) await this.send("transfer", snapshot);
            else if ((_c = this.remote()) == null ? void 0 : _c.state) this.c.mirror(this.remote().state);
          } catch (error) {
            this.target = previousTarget;
            sessionStorage.setItem(`${this.scope}:target`, previousTarget);
            if (paused && (snapshot == null ? void 0 : snapshot.queue.length) && !this.stopped && this.c.key() === this.scope) {
              try {
                if (previousTarget === this.id) await this.c.execute("transfer", snapshot);
                else if ((_d = this.remote()) == null ? void 0 : _d.online) await this.send("transfer", snapshot);
              } catch {
                (_f = (_e = this.c).notify) == null ? void 0 : _f.call(_e, "Il passaggio non \xE8 riuscito. Tocca Riproduci sul dispositivo precedente.", true);
              }
            }
            throw error;
          } finally {
            this.selecting = false;
            this.status();
            (_g = this.draw) == null ? void 0 : _g.call(this);
          }
        }
        show() {
          var _a2;
          const { el: el2, action: action2 } = this.c;
          const dialog = el2("dialog", { class: "devices-dialog", "aria-label": "Dispositivi di casa" });
          const list2 = el2("div", { class: "menu-actions" });
          const rename = el2("input", { value: ((_a2 = this.devices.find((d) => d.id === this.id)) == null ? void 0 : _a2.name) || this.defaultName(), maxlength: "50", "aria-label": "Nome di questo dispositivo" });
          this.draw = () => list2.replaceChildren(...this.devices.map((d) => el2("button", { class: "secondary", disabled: !d.online && d.id !== this.id, "aria-pressed": d.id === this.target, "data-device-id": d.id, onclick: action2(() => this.select(d.id)) }, `${d.name}${d.id === this.id ? " \xB7 questo dispositivo" : ""}${d.online ? "" : " \xB7 scollegato"}`)));
          dialog.append(el2("div", { class: "dialog-heading" }, el2("h2", {}, "Dove vuoi ascoltare?"), el2("button", { class: "quiet", onclick: () => dialog.close(), "aria-label": "Chiudi dispositivi" }, "Chiudi")), el2("p", { class: "muted" }, "Apri Apollon con lo stesso utente e profilo sui dispositivi di casa. Sul dispositivo scelto pu\xF2 servire un primo tocco su Riproduci per consentire l\u2019audio."), list2, el2("div", { class: "devices-sessions" }), el2("button", { class: "secondary", onclick: action2(async () => {
            dialog.close();
            (await this.loadTogether()).open();
          }) }, "Ascoltiamo insieme"), el2("label", {}, "Nome di questo dispositivo", rename), el2("button", { class: "secondary", onclick: action2(async () => {
            const d = await this.post("register", { id: this.id, connection: this.connection, name: rename.value });
            sessionStorage.setItem(`${this.scope}:name`, d.name);
          }) }, "Salva nome"));
          dialog.addEventListener("close", () => {
            this.draw = null;
            dialog.remove();
          }, { once: true });
          document.body.append(dialog);
          this.draw();
          this.c.showModal(dialog);
          this.loadTogether().then((t) => t.fill(dialog.querySelector(".devices-sessions"))).catch(() => {
          });
        }
        stop() {
          var _a2;
          this.stopped = true;
          this.lifecycle = (this.lifecycle || 0) + 1;
          (_a2 = this.stream) == null ? void 0 : _a2.close();
          clearInterval(this.timer);
          document.removeEventListener("click", this.capture, true);
          document.removeEventListener("input", this.capture, true);
        }
      };
    }
  });

  // public/music-device-bridge.js
  var music_device_bridge_exports = {};
  __export(music_device_bridge_exports, {
    deviceBridge: () => deviceBridge
  });
  function deviceBridge(c2) {
    const $2 = (selector) => document.querySelector(selector);
    let mirroredId, queueSignature2;
    const snapshot = () => ({
      queue: c2.state.queue,
      index: c2.state.queueIndex,
      paused: c2.getAudio().paused,
      position: Number.isFinite(c2.getAudio().currentTime) ? c2.getAudio().currentTime : 0,
      volume: c2.playback.volume
    });
    const mirror = (s) => {
      var _a2, _b2;
      c2.state.queue = s.queue;
      c2.state.queueIndex = s.index;
      const signature = `${s.index}/${s.queue.map((s2) => s2.id).join("/")}`;
      if (signature !== queueSignature2) {
        queueSignature2 = signature;
        c2.renderQueue();
      }
      const song2 = s.queue[s.index];
      if (!song2) {
        mirroredId = void 0;
        $2("#audio-bar").hidden = true;
        $2("#music-player").close();
        document.body.classList.remove("has-audio");
        return;
      }
      if (mirroredId !== song2.id) {
        mirroredId = song2.id;
        (_a2 = c2.trackChanged) == null ? void 0 : _a2.call(c2, song2);
        for (const id of ["audio-title", "full-title"]) $2(`#${id}`).textContent = song2.title;
        $2("#audio-artist").textContent = song2.artist || "";
        $2("#full-artist").textContent = [song2.artist, song2.album].filter(Boolean).join(" \xB7 ");
        $2("#audio-cover").src = c2.image(song2.coverArt || song2.albumId, 80);
        $2("#full-cover").src = c2.image(song2.coverArt || song2.albumId, "large");
      }
      $2("#audio-bar").hidden = false;
      document.body.classList.add("has-audio");
      for (const prefix of ["audio", "full"]) {
        setMusicIcon($2(`#${prefix}-toggle`), s.paused ? "play" : "pause");
        $2(`#${prefix}-toggle`).setAttribute("aria-label", s.paused ? "Riproduci sul dispositivo scelto" : "Metti in pausa sul dispositivo scelto");
        $2(`#${prefix}-time`).textContent = c2.fmtTime(s.position);
        $2(`#${prefix}-duration`).textContent = c2.fmtTime(song2.duration);
        const seek = $2(`#${prefix}-seek`);
        seek.max = song2.duration || 86400;
        if (document.activeElement !== seek) seek.value = s.position;
      }
      if (document.activeElement !== $2("#volume")) $2("#volume").value = s.volume;
      c2.measureAudioBar();
      (_b2 = c2.updateLyrics) == null ? void 0 : _b2.call(c2);
      for (const n of document.querySelectorAll("[data-playing-song]")) {
        n.hidden = n.dataset.playingSong !== song2.id;
        n.classList.toggle("running", !s.paused);
      }
    };
    const execute = async (op, p) => {
      var _a2, _b2;
      mirroredId = void 0;
      const a = c2.getAudio(), engine = c2.playback;
      if (op === "transfer" || op === "queue") {
        const same = ((_a2 = c2.state.queue[c2.state.queueIndex]) == null ? void 0 : _a2.id) === ((_b2 = p.queue[p.index]) == null ? void 0 : _b2.id);
        const wasPaused = a.paused;
        if (op === "transfer" || !same) engine.pause();
        c2.state.queue = p.queue;
        c2.state.queueIndex = p.index;
        engine.setQueue(p.queue, p.index);
        engine.configure({ volume: p.volume });
        if (p.queue.length && (op === "transfer" || !same)) await c2.playSong(p.index, { position: p.position, autoplay: op === "transfer" ? !p.paused : !wasPaused });
        if (!p.queue.length) {
          if (c2.clearQueue) c2.clearQueue();
          else engine.clear();
        }
      } else if (op === "enqueue") {
        const empty = !c2.state.queue.length;
        c2.state.queue = [...c2.state.queue, ...p.songs].slice(0, 2e3);
        if (empty) {
          c2.persistQueue();
          await c2.playSong(0, { autoplay: true });
        }
      } else if (op === "pause") engine.pause();
      else if (op === "play") {
        if (!c2.state.queue.length) throw new Error("La coda del dispositivo \xE8 vuota. Scegli un brano.");
        await engine.prepareAudio();
        await a.play();
      } else if (op === "next") await engine.advance();
      else if (op === "previous") {
        if (a.currentTime > 3) a.currentTime = 0;
        else await c2.playSong(Math.max(0, c2.state.queueIndex - 1));
      } else if (op === "playIndex") await c2.playSong(p.index);
      else if (op === "seek") {
        if (Number.isFinite(a.duration)) {
          engine.cancelFade();
          a.currentTime = Math.min(p.position, a.duration);
        }
      } else if (op === "volume") engine.configure({ volume: p.volume });
      if (typeof document !== "undefined" && $2("#volume")) $2("#volume").value = engine.volume;
      c2.persistQueue();
      c2.renderQueue();
      if ((op === "play" || op === "transfer" && !p.paused) && c2.getAudio().paused && c2.state.queue.length) throw new Error("Sul dispositivo scelto tocca Riproduci per consentire l\u2019audio.");
    };
    return { ...c2, snapshot, mirror, execute, pauseLocal: () => c2.playback.pause() };
  }
  var init_music_device_bridge = __esm({
    "public/music-device-bridge.js"() {
      init_music_feedback();
    }
  });

  // public/music-search.js
  var music_search_exports = {};
  __export(music_search_exports, {
    recentSearches: () => recentSearches,
    remember: () => remember,
    search: () => search
  });
  function recentSearches(previous, query) {
    query = String(query || "").trim().slice(0, 250);
    return query ? [query, ...previous.filter((q) => q.toLocaleLowerCase("it") !== query.toLocaleLowerCase("it"))].slice(0, 10) : previous;
  }
  function remember(c2, query) {
    const key = `${c2.key()}:searches`;
    c2.storage.set(key, recentSearches(c2.storage.get(key, []), query));
  }
  async function search(c2, generation, query) {
    var _a2;
    if (generation !== c2.state.musicGeneration) return;
    searchController == null ? void 0 : searchController.abort();
    const controller = searchController = new AbortController();
    const request = (route) => c2.api(route, { signal: controller.signal });
    const { el: el2, api: api2, state: state2, action: action2 } = c2;
    const key = `${c2.key()}:searches`;
    const root = document.querySelector("#music-results");
    const choose = (q) => {
      document.querySelector("#music-search").value = q;
      remember(c2, q);
      c2.load("browse");
    };
    if (!query) {
      const home = await request("/api/music/home");
      if (generation !== state2.musicGeneration) return;
      const draw = () => {
        const recent = c2.storage.get(key, []);
        const forget = (q) => {
          c2.storage.set(key, c2.storage.get(key, []).filter((r) => r !== q));
          draw();
        };
        root.replaceChildren(el2(
          "div",
          { class: "search-browse" },
          recent.length ? el2(
            "section",
            { class: "search-recent" },
            el2("div", { class: "shelf-head" }, el2("h2", {}, "Ricerche recenti"), el2("button", { class: "quiet", onclick: () => {
              c2.storage.set(key, []);
              draw();
            } }, "Cancella tutte le ricerche")),
            el2("ul", { class: "recent-list" }, ...recent.map((q) => el2(
              "li",
              {},
              el2("button", { class: "recent-query", onclick: () => choose(q) }, shellIcon("search"), el2("span", {}, q)),
              el2("button", { class: "icon-button", "aria-label": `Cancella ricerca ${q}`, title: "Cancella", onclick: () => forget(q) }, shellIcon("close"))
            )))
          ) : el2("div", { class: "shelf-head" }, el2("h2", {}, "Ricerche recenti"), el2("button", { class: "quiet", disabled: true }, "Cancella tutte le ricerche")),
          recent.length ? null : el2("p", { class: "muted" }, "Le ricerche che scegli compariranno qui."),
          el2("h2", { class: "browse-title" }, "Sfoglia tutto"),
          el2("div", { class: "browse-grid" }, ...(home.mood || []).map((m, i) => c2.collectionCard(m, "mood", i)), ...(home.generi || []).map((m, i) => c2.collectionCard(m, "generi", i + 3))),
          !home.available ? el2("p", { class: "muted" }, "Mood e generi non sono ancora disponibili. Cerca un titolo, un artista o un album.") : null
        ));
      };
      draw();
      return;
    }
    const result = await request(`/api/music/search?q=${encodeURIComponent(query)}`);
    if (generation !== state2.musicGeneration) return;
    const found = result.searchResult3 || {};
    const songs = found.song || [], artists = found.artist || [], albums = found.album || [], playlists = ((_a2 = result.playlists) == null ? void 0 : _a2.playlist) || [];
    const kinds = { song: "Brano", album: "Album", artist: "Artista", playlist: "Playlist" };
    const open = (item) => action2(async () => {
      remember(c2, query);
      if (item.type === "song") c2.setQueue(songs, songs.findIndex((s) => s.id === item.id));
      else await c2.open(item);
    });
    const cover = (item, size) => item.type === "artist" ? artistArt(c2, item.name, item.coverArt, size) : item.type === "playlist" && !item.coverArt ? lazyArt(c2, art(el2, c2.image, { name: item.name, glyph: "\u266A", size }), "playlist", item.id) : art(el2, c2.image, { ids: [item.coverArt || item.albumId], name: item.name, size });
    const needle = query.toLocaleLowerCase("it");
    const ranked = [...artists.map((i) => ({ ...i, type: "artist" })), ...albums.map((i) => ({ ...i, type: "album" })), ...playlists.map((i) => ({ ...i, type: "playlist" })), ...songs.map((i) => ({ ...i, type: "song", name: i.title }))];
    const best = ranked.find((i) => (i.name || "").toLocaleLowerCase("it") === needle) || ranked.find((i) => (i.name || "").toLocaleLowerCase("it").startsWith(needle)) || ranked[0];
    const tile = (item) => el2(
      "button",
      { class: `search-result shelf-card${item.type === "artist" ? " round-card" : ""}`, onclick: open(item) },
      cover(item),
      el2("h3", { class: "shelf-title" }, item.name),
      el2("small", { class: "shelf-sub" }, [kinds[item.type], item.type === "artist" ? "" : item.artist || item.owner].filter(Boolean).join(" \xB7 "))
    );
    const group = (title, list2, type) => list2.length ? el2(
      "section",
      { class: "shelf search-group", "data-shelf": type },
      el2("div", { class: "shelf-head" }, el2("h2", {}, title)),
      el2("div", { class: "shelf-row" }, ...list2.map((i) => tile({ ...i, type })))
    ) : null;
    root.replaceChildren(el2(
      "section",
      { class: "search-suggestions", "aria-label": "Suggerimenti di ricerca" },
      el2("h2", { class: "sr-only" }, `Risultati per \u201C${query}\u201D`),
      best ? el2(
        "div",
        { class: "search-top" },
        el2(
          "section",
          { class: "top-result-box" },
          el2("h2", {}, "Risultato migliore"),
          el2(
            "button",
            { class: `search-result top-result${best.type === "artist" ? " round-card" : ""}`, onclick: open(best) },
            cover(best, 400),
            el2("strong", {}, best.name),
            el2("small", {}, [kinds[best.type], best.type === "artist" ? "" : best.artist].filter(Boolean).join(" \xB7 "))
          )
        ),
        songs.length ? el2("section", { class: "search-songs" }, el2("h2", {}, "Brani"), c2.trackList(songs.slice(0, 5))) : null
      ) : null,
      group("Artisti", artists, "artist"),
      group("Album", albums, "album"),
      group("Playlist", playlists, "playlist"),
      songs.length > 5 ? el2("section", { class: "search-more-songs" }, el2("h2", {}, "Altri brani"), c2.trackList(songs.slice(5))) : null,
      !ranked.length ? el2("p", { role: "status" }, "Nessun risultato. Prova un altro nome.") : null
    ));
  }
  var searchController;
  var init_music_search = __esm({
    "public/music-search.js"() {
      init_music_shell();
    }
  });

  // public/music-blend.js
  var music_blend_exports = {};
  __export(music_blend_exports, {
    affinityText: () => affinityText,
    blendView: () => blendView,
    emptyText: () => emptyText,
    savedName: () => savedName,
    showBlend: () => showBlend,
    whoLabel: () => whoLabel
  });
  function emptyText(r, mineName, otherName) {
    const who = [[mineName, r.mine], [otherName, r.other]].filter(([, n]) => n < r.needed).map(([name, n]) => `${name} ha ${n === 0 ? "ancora nessun ascolto" : n === 1 ? "solo 1 ascolto" : `solo ${n} ascolti`}`).join(" e ");
    return `${who}. Per creare la Miscela servono almeno ${r.needed} ascolti a testa: un ascolto conta dopo 20 secondi. Ascoltate un po\u2019 di musica, ognuno dal proprio profilo, e riprovate.`;
  }
  function blendView(c2, r, other) {
    const { el: el2, action: action2, api: api2, notify: notify2 } = c2;
    if (r.empty) return [el2("div", { class: "empty", role: "status" }, el2("h3", {}, "La Miscela non \xE8 ancora pronta"), el2("p", {}, emptyText(r, r.profiles.mine, r.profiles.other)))];
    if (!r.songs.length) return [el2("div", { class: "empty", role: "status" }, el2("h3", {}, "Nessun brano adatto"), el2("p", {}, "Nel catalogo non ci sono ancora brani da mescolare per voi due. Torna a provare dopo aver aggiunto altra musica."))];
    let saved = false;
    const save2 = el2("button", { class: "secondary", onclick: action2(async () => {
      if (saved) return;
      save2.disabled = true;
      try {
        await api2("/api/music/playlist", { method: "POST", data: { name: savedName(r), songs: r.songs.map((s) => s.id) } });
        saved = true;
        save2.textContent = "Playlist salvata \u2713";
        notify2("Playlist salvata: la trovi in La tua libreria.");
      } finally {
        save2.disabled = saved;
      }
    }) }, "Salva come playlist");
    return [
      el2(
        "section",
        { class: "collection-heading" },
        el2("p", { class: "welcome" }, "MISCELA"),
        el2("h2", {}, `${r.profiles.mine} e ${r.profiles.other}`),
        el2("p", { class: "blend-score", role: "status" }, affinityText(r.affinity)),
        el2("p", { class: "muted" }, `${r.songs.length} brani \xB7 aggiornata oggi \xB7 cambia da sola ogni giorno`),
        el2("div", { class: "actions" }, el2("button", { class: "primary", onclick: () => c2.setQueue(r.songs, 0) }, "\u25B6 Ascolta la Miscela"), save2)
      ),
      el2("ol", { class: "blend-list", "aria-label": "Brani della Miscela" }, ...r.songs.map((s, i) => el2(
        "li",
        {},
        el2(
          "button",
          { class: "blend-play", "aria-label": `Ascolta ${s.title}`, onclick: () => c2.setQueue(r.songs, i) },
          el2("img", { src: c2.image(s.coverArt || s.albumId, 80), alt: "", loading: "lazy" }),
          el2("span", { class: "track-text" }, el2("strong", {}, s.title), el2("small", {}, s.artist || "Artista sconosciuto"))
        ),
        el2("span", { class: `blend-who ${s.who}` }, whoLabel(s.who, other.name))
      )))
    ];
  }
  async function showBlend(c2, other) {
    var _a2;
    const { el: el2, api: api2, state: state2 } = c2;
    const generation = ++state2.musicGeneration;
    const root = document.querySelector("#music-results"), crumb = document.querySelector("#music-breadcrumb");
    document.querySelector("#more-albums").hidden = true;
    (_a2 = c2.visit) == null ? void 0 : _a2.call(c2, `blend:${other.id}`, `Miscela con ${other.name}`, () => showBlend(c2, other), "library");
    crumb.replaceChildren();
    root.replaceChildren(el2("div", { class: "music-skeleton skeleton-list", role: "status", "aria-label": "Mescolo i vostri gusti" }, el2("span", { class: "skeleton-block hero" })));
    try {
      const result = await api2(`/api/music/blend?profile=${encodeURIComponent(state2.profile)}&with=${encodeURIComponent(other.id)}`);
      if (generation === state2.musicGeneration) root.replaceChildren(...blendView(c2, result, other));
    } catch (e) {
      if (generation === state2.musicGeneration) root.replaceChildren(el2("div", { class: "empty" }, el2("p", {}, e.message), el2("button", { class: "secondary", onclick: () => showBlend(c2, other) }, "Riprova")));
    }
  }
  var whoLabel, affinityText, savedName;
  var init_music_blend = __esm({
    "public/music-blend.js"() {
      whoLabel = (who, otherName) => ({ mine: "Piace a te", other: `Piace a ${otherName}`, both: "Piace a tutti e due" })[who] || "";
      affinityText = (percent) => `Siete in sintonia al ${percent}%`;
      savedName = (r) => `Miscela ${r.profiles.mine} e ${r.profiles.other} \xB7 ${r.day.split("-").reverse().join("/")}`;
    }
  });

  // public/music-library.js
  var music_library_exports = {};
  __export(music_library_exports, {
    entryKey: () => entryKey,
    init: () => init,
    library: () => library,
    libraryItems: () => libraryItems,
    markOpened: () => markOpened,
    pinEntry: () => pinEntry,
    preferences: () => preferences
  });
  function pinEntry(pins, key) {
    if (pins.includes(key)) return pins.filter((p) => p !== key);
    if (pins.length >= 4) throw new Error("Puoi fissare fino a 4 raccolte. Togli prima una puntina.");
    return [...pins, key];
  }
  function libraryItems(items, { filter: filter2 = "", sort = "recent", pins = [], recent = {}, downloaded = [] } = {}) {
    const stamp = (v) => Number(v) || Date.parse(v) || 0;
    return items.filter((i) => !filter2 || (filter2 === "downloaded" ? downloaded.includes(entryKey(i)) : i.type === filter2)).sort((a, b) => {
      const pa = pins.indexOf(entryKey(a)), pb = pins.indexOf(entryKey(b));
      if (pa >= 0 || pb >= 0) return pa < 0 ? 1 : pb < 0 ? -1 : pa - pb;
      const name = () => (a.name || "").localeCompare(b.name || "", "it", { sensitivity: "base", numeric: true });
      if (sort === "alpha") return name();
      if (sort === "author") return (a.artist || a.name || "").localeCompare(b.artist || b.name || "", "it") || name();
      if (sort === "added") return stamp(b.created) - stamp(a.created) || name();
      return stamp(recent[entryKey(b)]) - stamp(recent[entryKey(a)]) || stamp(b.last) - stamp(a.last) || name();
    });
  }
  function init(context) {
    c = context;
  }
  function preferences() {
    return c.storage.get(`${c.key()}:library`, { pins: [], recent: {}, view: "list", sort: "recent", filter: "" });
  }
  function save(value) {
    c.storage.set(`${c.key()}:library`, value);
  }
  function markOpened(type, id) {
    const p = preferences();
    p.recent || (p.recent = {});
    p.recent[`${type}:${id}`] = Date.now();
    save(p);
  }
  async function library(generation) {
    const { el: el2, api: api2, state: state2, action: action2 } = c;
    const result = await api2(`/api/music/library?profile=${encodeURIComponent(state2.profile)}`);
    const offline = await c.offline();
    const downloaded = await offline.manager.collections();
    if (generation !== state2.musicGeneration) return;
    const p = preferences();
    const root = document.querySelector("#music-results");
    const online = new Set(result.items.map(entryKey)), all = new Map(result.items.map((i) => [entryKey(i), i]));
    for (const item of downloaded) if (!all.has(entryKey(item))) all.set(entryKey(item), item);
    let finding = false;
    let words = "";
    const kinds = { playlist: "Playlist", album: "Album", artist: "Artista" };
    const cover = (item) => item.type === "artist" ? artistArt(c, item.name, item.coverArt, 160) : item.type === "playlist" && !item.coverArt ? lazyArt(c, art(el2, c.image, { name: item.name, glyph: "\u266A" }), "playlist", item.id) : art(el2, c.image, { ids: [item.coverArt], name: item.name });
    const draw = () => {
      if (generation !== state2.musicGeneration) return;
      const change = (patch) => {
        Object.assign(p, patch);
        save(p);
        draw();
      };
      const chip = (id, name) => el2("button", { class: "secondary pill chip", "aria-pressed": p.filter === id, onclick: () => change({ filter: p.filter === id ? "" : id }) }, name);
      const filters = el2(
        "div",
        { class: "library-filters chips", role: "group", "aria-label": "Filtra la tua musica" },
        p.filter ? el2("button", { class: "secondary pill chip chip-clear", "aria-label": "Tutto", title: "Mostra tutto", onclick: () => change({ filter: "" }) }, shellIcon("close")) : null,
        chip("playlist", "Playlist"),
        chip("album", "Album"),
        chip("artist", "Artisti"),
        el2("button", { class: "secondary pill chip", "data-music": "songs" }, "Brani"),
        chip("downloaded", "Scaricati")
      );
      const sort = el2(
        "select",
        { "aria-label": "Ordina la tua musica", onchange: (e) => change({ sort: e.target.value }) },
        ...[["recent", "Recenti"], ["added", "Aggiunti di recente"], ["alpha", "Alfabetico"], ["author", "Autore"]].map(([id, name]) => el2("option", { value: id }, name))
      );
      sort.value = p.sort;
      const downloads = downloaded.map(entryKey);
      const needle = words.trim().toLocaleLowerCase("it");
      const items = libraryItems([...all.values()], { ...p, downloaded: downloads }).filter((i) => !needle || `${i.name} ${i.artist || ""}`.toLocaleLowerCase("it").includes(needle));
      const others = (state2.boot.profiles || []).filter((o) => o.id !== state2.profile);
      const blend = others.length ? [el2(
        "section",
        { class: "blend-entry" },
        el2("h3", {}, "Miscela"),
        el2("p", { class: "muted" }, "Una playlist di 30 brani che mescola i gusti di due persone di casa. Cambia da sola ogni giorno."),
        el2("div", { class: "actions" }, ...others.map((o) => el2("button", { class: "secondary pill", onclick: action2(async () => (await Promise.resolve().then(() => (init_music_blend(), music_blend_exports))).showBlend(c, o)) }, `Miscela con ${o.name}`)))
      )] : [];
      const liked = art(el2, c.image, { name: "Brani che ti piacciono", glyph: "\u2665" });
      liked.classList.add("liked-art");
      const songs = art(el2, c.image, { name: "Tutti i brani", glyph: "\u266B" });
      const row = (tab, cover2, title, sub) => el2(
        "button",
        { class: "library-row", "data-music": tab, "data-library-browse": tab },
        cover2,
        el2("span", { class: "library-copy" }, el2("strong", {}, title), el2("small", {}, sub))
      );
      const browse = el2(
        "div",
        { class: "library-browse", role: "group", "aria-label": "Sfoglia tutta la raccolta" },
        p.filter ? null : row("liked", liked, "Brani che ti piacciono", "Playlist \xB7 i tuoi preferiti"),
        p.filter ? null : row("songs", songs, `Tutti i brani${result.total ? ` \xB7 ${result.total.toLocaleString("it-IT")}` : ""}`, "Tutta la musica di casa"),
        el2(
          "div",
          { class: "library-links" },
          ...[["recent", "Ascoltati di recente"], ["top", "Pi\xF9 ascoltati"], ["history", "Cronologia"], ["albums", "Tutti gli album"], ["artists", "Tutti gli artisti"], ["playlists", "Tutte le playlist"]].map(([tab, name]) => el2("button", { class: "secondary pill", "data-music": tab }, name)),
          el2("button", { class: "secondary pill", "data-music-downloads": "1", onclick: action2(() => offline.showOffline(++state2.musicGeneration)) }, "Gestisci i download")
        )
      );
      const find = el2("input", {
        type: "search",
        class: "library-find",
        placeholder: "Cerca nella tua libreria",
        "aria-label": "Cerca nella tua libreria",
        value: words,
        oninput: (e) => {
          words = e.target.value;
          const at = e.target.selectionStart;
          draw();
          const again = root.querySelector(".library-find");
          again == null ? void 0 : again.focus();
          again == null ? void 0 : again.setSelectionRange(at, at);
        }
      });
      const tools = [
        el2("button", {
          class: "icon-button",
          "aria-label": "Cerca nella libreria",
          title: "Cerca nella libreria",
          "aria-pressed": finding,
          onclick: () => {
            var _a2;
            finding = !finding;
            if (!finding) words = "";
            draw();
            if (finding) (_a2 = root.querySelector(".library-find")) == null ? void 0 : _a2.focus();
          }
        }, shellIcon("search")),
        el2("button", { class: "icon-button", "aria-label": "Crea una playlist o una miscela", title: "Crea", onclick: () => {
          var _a2;
          return (_a2 = document.querySelector("#music-nav [data-section=create]")) == null ? void 0 : _a2.click();
        } }, shellIcon("plus"))
      ];
      root.replaceChildren(el2(
        "div",
        { class: "library-page" },
        sectionTop(c, "La tua libreria", tools),
        filters,
        finding ? find : null,
        el2(
          "div",
          { class: "library-toolbar" },
          el2("label", { class: "library-sort" }, shellIcon("sort"), sort),
          el2("div", { class: "view-toggle", role: "group", "aria-label": "Vista" }, ...[["list", "Elenco"], ["grid", "Griglia"]].map(([id, name]) => el2("button", { class: "icon-button", "aria-label": name, title: name, "aria-pressed": p.view === id, onclick: () => change({ view: id }) }, shellIcon(id))))
        ),
        browse,
        el2("div", { class: `library-items library-${p.view}` }, ...items.map((item) => {
          const key = entryKey(item);
          const pinned = p.pins.includes(key);
          const sub = [kinds[item.type], item.type === "playlist" ? `${item.songCount || 0} brani` : item.type === "album" ? item.artist : "", downloads.includes(key) ? "Scaricata \u2713" : ""].filter(Boolean).join(" \xB7 ");
          return el2(
            "article",
            { class: `library-item${item.type === "artist" ? " library-artist" : ""}`, "data-library-key": key },
            el2(
              "button",
              { class: "library-open quiet", onclick: action2(async () => {
                markOpened(item.type, item.id);
                if (online.has(key)) await c.open(item);
                else await offline.showCollection(item.type, item.id, ++state2.musicGeneration);
              }) },
              cover(item),
              el2("span", { class: "library-copy" }, el2("strong", {}, item.name), el2("small", {}, pinned ? el2("span", { class: "pinned-mark", title: "Fissata in alto" }, pin()) : null, sub))
            ),
            el2("button", { class: "quiet pin-button", "aria-label": `${pinned ? "Togli puntina a" : "Fissa in alto"} ${item.name}`, "aria-pressed": pinned, onclick: action2(() => {
              p.pins = pinEntry(p.pins, key);
              save(p);
              draw();
            }) }, pin())
          );
        })),
        ...!items.length ? [el2("p", { class: "muted" }, needle ? "Nessuna raccolta con queste parole." : "Nessuna raccolta qui. Scegli un altro filtro.")] : [],
        ...blend
      ));
    };
    draw();
  }
  var entryKey, c, pin;
  var init_music_library = __esm({
    "public/music-library.js"() {
      init_music_shell();
      entryKey = (item) => `${item.type}:${item.id}`;
      pin = () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        const path = document.createElementNS(svg.namespaceURI, "path");
        path.setAttribute("d", "M8 3h8l-1 7 4 4H5l4-4zM12 14v7");
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2");
        svg.append(path);
        return svg;
      };
    }
  });

  // public/music-recap.js
  var music_recap_exports = {};
  __export(music_recap_exports, {
    musicRecap: () => musicRecap,
    periodLabel: () => periodLabel,
    showRecap: () => showRecap
  });
  function periodLabel(period) {
    const [year, month] = String(period).split("-");
    if (!month) return year;
    const names = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    return `${names[Number(month) - 1] || month} ${year}`;
  }
  function musicRecap(events, catalog, period, timeZone = "Europe/Rome") {
    if (!/^\d{4}(-(?:0[1-9]|1[0-2]))?$/.test(period)) throw new Error("Scegli un mese o un anno.");
    const songs = new Map(catalog.map((s) => [s.id, s]));
    const seen = /* @__PURE__ */ new Set();
    const tracks = /* @__PURE__ */ new Map(), artists = /* @__PURE__ */ new Map(), genres = /* @__PURE__ */ new Map(), moods = /* @__PURE__ */ new Map(), days = /* @__PURE__ */ new Map(), hours = /* @__PURE__ */ new Map();
    const add = (map, key, name, seconds2) => {
      if (!key) return;
      const entry = map.get(key) || { id: key, name, seconds: 0, count: 0 };
      entry.seconds += seconds2;
      entry.count++;
      map.set(key, entry);
    };
    let seconds = 0, listens = 0;
    for (const e of events) {
      if (!e.playId || seen.has(e.playId) || !(e.seconds > 0) || !Number.isFinite(e.seconds)) continue;
      const date = new Date(e.at);
      if (!Number.isFinite(+date)) continue;
      const parts = Object.fromEntries(new Intl.DateTimeFormat("it-IT", { timeZone, year: "numeric", month: "2-digit", weekday: "long", hour: "2-digit", hourCycle: "h23" }).formatToParts(date).map((p) => [p.type, p.value]));
      if (!`${parts.year}-${parts.month}`.startsWith(period)) continue;
      seen.add(e.playId);
      seconds += e.seconds;
      listens++;
      const song2 = songs.get(e.id) || e.song || { title: "Brano non pi\xF9 in raccolta" };
      add(tracks, e.id, song2.title, e.seconds);
      add(artists, song2.artist, song2.artist, e.seconds);
      add(genres, song2.genere || song2.genre, song2.genere || song2.genre, e.seconds);
      for (const mood of song2.mood || []) add(moods, mood, mood, e.seconds);
      add(days, parts.weekday, parts.weekday, e.seconds);
      add(hours, parts.hour, `${parts.hour}:00`, e.seconds);
    }
    return {
      period,
      seconds,
      minutes: Math.floor(seconds / 60),
      listens,
      trackCount: tracks.size,
      enough: listens >= 3 && seconds >= 60,
      tracks: rank(tracks),
      artists: rank(artists),
      genres: rank(genres),
      moods: rank(moods),
      days: rank(days),
      hours: rank(hours)
    };
  }
  async function showRecap(c2, generation) {
    if (generation !== c2.state.musicGeneration) return;
    const { el: el2, state: state2, action: action2 } = c2;
    const now = /* @__PURE__ */ new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const input = el2("input", { type: "month", value: month, "aria-label": "Mese da raccontare" });
    const year = el2("input", { type: "number", min: "2000", max: "2100", value: now.getFullYear(), "aria-label": "Anno da raccontare" });
    const open = async (period) => {
      var _a2, _b2, _c;
      const result = await c2.api(`/api/music/recap?profile=${encodeURIComponent(state2.profile)}&period=${encodeURIComponent(period)}`);
      if (generation !== state2.musicGeneration) return;
      const d = el2("dialog", { class: "recap-dialog", "aria-label": period.length === 4 ? "Il tuo anno in musica" : "Il tuo mese in musica" });
      const content = el2("div", { class: "recap-card", tabindex: "0" });
      let index = 0;
      const top = (title, entries) => [title, entries.slice(0, 5).map((e, i) => `${i + 1}. ${e.name}`).join("\n") || "Nessun dato disponibile."];
      const cards = result.enough ? [["La tua musica, il tuo tempo", `${result.minutes} minuti ascoltati
${result.trackCount} brani diversi \xB7 ${result.listens} ascolti`], top("I brani pi\xF9 ascoltati", result.tracks), top("Gli artisti che ti accompagnano", result.artists), top("I tuoi generi", result.genres), ["Il tuo umore musicale", ((_a2 = result.moods[0]) == null ? void 0 : _a2.name) || "Mood non disponibili nel catalogo."], ["Quando ascolti", `${((_b2 = result.days[0]) == null ? void 0 : _b2.name) || ""}
La tua ora: ${((_c = result.hours[0]) == null ? void 0 : _c.name) || ""}`]] : [["Il racconto sta iniziando", "Servono almeno 3 ascolti e un minuto di musica in questo periodo. Ascolta ancora e torna qui. Gli ascolti precedenti senza un profilo riconoscibile non sono inclusi."]];
      const prev = el2("button", { class: "secondary", onclick: () => draw(index - 1) }, "Indietro");
      const next = el2("button", { class: "primary", onclick: () => draw(index + 1) }, "Avanti");
      const count = el2("span", { role: "status", "aria-live": "polite" });
      const draw = (i) => {
        var _a3;
        index = Math.max(0, Math.min(cards.length - 1, i));
        content.replaceChildren(el2("p", { class: "welcome" }, `${periodLabel(period)} \xB7 ${((_a3 = state2.boot.profiles.find((p) => p.id === state2.profile)) == null ? void 0 : _a3.name) || ""}`), el2("h2", {}, cards[index][0]), el2("p", {}, cards[index][1]));
        prev.disabled = index === 0;
        next.disabled = index === cards.length - 1;
        count.textContent = `${index + 1} di ${cards.length}`;
      };
      d.append(el2("button", { class: "quiet recap-close", onclick: () => d.close(), "aria-label": "Chiudi il racconto musicale" }, "Chiudi"), content, el2("div", { class: "actions recap-nav" }, prev, count, next));
      d.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          e.stopPropagation();
          draw(index + (e.key === "ArrowRight" ? 1 : -1));
        }
      });
      let start;
      content.addEventListener("pointerdown", (e) => {
        start = e.clientX;
      });
      content.addEventListener("pointerup", (e) => {
        if (Math.abs(e.clientX - start) > 60) draw(index + (e.clientX < start ? 1 : -1));
        start = void 0;
      });
      d.addEventListener("close", () => d.remove(), { once: true });
      document.body.append(d);
      draw(0);
      c2.showModal(d);
      content.focus();
    };
    document.querySelector("#music-results").replaceChildren(el2("section", { class: "recap-heading" }, el2("h2", {}, "Il tuo mese in musica"), el2("p", { class: "muted" }, "Solo gli ascolti di questo profilo, registrati in casa."), el2("div", { class: "actions" }, input, el2("button", { class: "primary", onclick: action2(() => open(input.value)) }, "Racconta il mese")), el2("h2", {}, "Il tuo anno in musica"), el2("div", { class: "actions" }, year, el2("button", { class: "secondary", onclick: action2(() => open(String(year.value))) }, "Racconta l\u2019anno"))));
  }
  var rank;
  var init_music_recap = __esm({
    "public/music-recap.js"() {
      rank = (map) => [...map.values()].sort((a, b) => b.seconds - a.seconds || b.count - a.count || a.name.localeCompare(b.name, "it"));
    }
  });

  // public/music-moment.js
  var music_moment_exports = {};
  __export(music_moment_exports, {
    momentSongs: () => momentSongs,
    showMoment: () => showMoment,
    timeSlot: () => timeSlot
  });
  function timeSlot(date = /* @__PURE__ */ new Date(), timeZone = "Europe/Rome") {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("it-IT", { timeZone, hourCycle: "h23", hour: "2-digit", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((p) => [p.type, p.value]));
    const hour = Number(parts.hour);
    const slot = hour >= 5 && hour < 12 ? { id: "morning", label: "mattina luminosa", mood: ["Energia", "In viaggio"], energia: 50 } : hour < 18 && hour >= 12 ? { id: "afternoon", label: "pomeriggio in movimento", mood: ["Grinta", "Concentrazione"], energia: 65 } : hour >= 18 && hour < 22 ? { id: "evening", label: "sera tranquillo", mood: ["Relax", "Soul e jazz"], energia: 30 } : { id: "night", label: "notte quieta", mood: ["Notte", "Relax"], energia: 15 };
    return { ...slot, key: `${parts.year}-${parts.month}-${parts.day}/${slot.id}`, name: `${parts.weekday[0].toUpperCase()}${parts.weekday.slice(1)} ${slot.label}` };
  }
  function momentSongs(catalog, date = /* @__PURE__ */ new Date()) {
    const slot = timeSlot(date);
    const random = dailyRandom(slot.key);
    const seen = /* @__PURE__ */ new Set();
    const songs = catalog.filter((s) => !s.problema && !seen.has(s.id) && seen.add(s.id)).map((s) => ({ song: s, score: similarity(slot, s) + random() * 0.5 })).sort((a, b) => b.score - a.score).slice(0, 40).map((s) => s.song);
    return { ...slot, songs };
  }
  async function showMoment(c2, generation) {
    const result = await c2.api("/api/music/moment");
    if (generation !== c2.state.musicGeneration) return;
    const root = document.querySelector("#music-results");
    root.replaceChildren(c2.el("section", { class: "moment-heading" }, c2.el("p", { class: "welcome" }, "IL TUO MOMENTO"), c2.el("h2", {}, result.name), c2.el("p", { class: "muted" }, "La musica di casa segue la giornata. Cambia da sola al mattino, al pomeriggio, alla sera e di notte."), c2.el("button", { class: "primary", disabled: !result.songs.length, onclick: () => c2.setQueue(result.songs) }, "Ascolta il tuo momento")), c2.trackList(result.songs));
    clearInterval(momentTimer);
    const key = timeSlot().key;
    momentTimer = setInterval(() => {
      if (c2.state.musicGeneration !== generation) {
        clearInterval(momentTimer);
        return;
      }
      if (timeSlot().key !== key) c2.load("moment");
    }, 15e3);
  }
  var momentTimer;
  var init_music_moment = __esm({
    "public/music-moment.js"() {
      init_music_logic();
    }
  });

  // public/music-songs.js
  var music_songs_exports = {};
  __export(music_songs_exports, {
    SORTS: () => SORTS,
    showSongs: () => showSongs,
    shuffled: () => shuffled,
    sortSongs: () => sortSongs
  });
  function sortSongs(songs, sort = "title", filter2 = "") {
    const words = squash(filter2).split(/\s+/).filter(Boolean);
    const list2 = words.length ? songs.filter((s) => {
      const hay = squash(`${s.title} ${s.artist} ${s.album}`);
      return words.every((w) => hay.includes(w));
    }) : songs.slice();
    const stamp = (s) => Date.parse(s.created) || 0;
    const order = {
      title: by("title"),
      artist: (a, b) => by("artist")(a, b) || (a.track || 0) - (b.track || 0),
      album: (a, b) => by("album")(a, b) || (a.track || 0) - (b.track || 0),
      added: (a, b) => stamp(b) - stamp(a) || by("title")(a, b),
      duration: (a, b) => (a.duration || 0) - (b.duration || 0) || by("title")(a, b)
    };
    return list2.sort(order[sort] || order.title);
  }
  function shuffled(songs, random = Math.random) {
    const list2 = songs.slice();
    for (let i = list2.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [list2[i], list2[j]] = [list2[j], list2[i]];
    }
    return list2;
  }
  async function showSongs(c2, generation) {
    const { el: el2, api: api2, state: state2, storage: storage2 } = c2;
    const key = `${c2.key()}:songs`;
    const { songs, total } = await api2("/api/music/songs");
    if (generation !== state2.musicGeneration) return;
    const p = storage2.get(key, { sort: "title" });
    let filter2 = "";
    const root = document.querySelector("#music-results");
    const count = el2("p", { class: "muted songs-count", role: "status" });
    const holder = el2("div", { class: "songs-holder" });
    let shown = [];
    const paint = () => {
      shown = sortSongs(songs, p.sort, filter2);
      count.textContent = filter2 ? `${many(shown.length)} su ${total.toLocaleString("it-IT")}` : many(total);
      holder.replaceChildren(shown.length ? c2.trackList(shown) : el2("p", { class: "muted" }, filter2 ? "Nessun brano con queste parole. Prova a scriverne meno." : "Qui non ci sono ancora brani."));
    };
    const sort = el2(
      "select",
      { "aria-label": "Ordina i brani", onchange: (e) => {
        p.sort = e.target.value;
        storage2.set(key, p);
        paint();
      } },
      ...SORTS.map(([id, name]) => el2("option", { value: id, selected: p.sort === id }, name))
    );
    let timer;
    const search2 = el2("input", { type: "search", id: "songs-filter", placeholder: "Cerca fra i brani\u2026", "aria-label": "Cerca fra tutti i brani", oninput: (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        filter2 = e.target.value;
        paint();
      }, 120);
    } });
    root.replaceChildren(el2(
      "section",
      { class: "all-songs" },
      el2("div", { class: "collection-heading" }, el2("h2", {}, "Tutti i brani"), count),
      el2(
        "div",
        { class: "actions" },
        el2("button", { class: "primary", id: "songs-play-all", onclick: () => c2.setQueue(shown, 0) }, "\u25B6 Riproduci tutto"),
        el2("button", { class: "secondary", id: "songs-shuffle", onclick: () => c2.setQueue(shuffled(shown), 0) }, "Casuale"),
        sort
      ),
      el2("label", { class: "search" }, el2("span", { class: "sr-only" }, "Cerca fra i brani"), search2),
      holder
    ));
    paint();
  }
  var many, SORTS, collator, by, squash;
  var init_music_songs = __esm({
    "public/music-songs.js"() {
      many = (n) => `${n.toLocaleString("it-IT")} ${n === 1 ? "brano" : "brani"}`;
      SORTS = [["title", "Titolo"], ["artist", "Artista"], ["album", "Album"], ["added", "Aggiunti di recente"], ["duration", "Durata"]];
      collator = new Intl.Collator("it", { sensitivity: "base", numeric: true });
      by = (key) => (a, b) => collator.compare(a[key] || "", b[key] || "") || collator.compare(a.title || "", b.title || "");
      squash = (value) => String(value || "").toLocaleLowerCase("it").normalize("NFD").replace(/[̀-ͯ]/g, "");
    }
  });

  // public/music-home.js
  var music_home_exports = {};
  __export(music_home_exports, {
    MOOD_GLYPHS: () => MOOD_GLYPHS,
    renderHome: () => renderHome
  });
  function framed(el2, box, band) {
    return el2("span", { class: "art-frame" }, box, el2("span", { class: "art-band" }, band));
  }
  function renderHome(c2, { home, albums = [], items = [], recent = [] }) {
    const { el: el2, state: state2, storage: storage2, image } = c2;
    const prefs = storage2.get(`${c2.key()}:library`, {}) || {};
    const pins = Array.isArray(prefs.pins) ? prefs.pins : [], opened = prefs.recent && typeof prefs.recent === "object" ? prefs.recent : {};
    const moods = home.available ? home.mood || [] : [], genres = home.available ? home.generi || [] : [];
    const playlists = items.filter((i) => i.type === "playlist");
    const artists = items.filter((i) => i.type === "artist").sort((a, b) => (Date.parse(b.last) || 0) - (Date.parse(a.last) || 0));
    const playlistArt = (p) => p.coverArt ? art(el2, image, { ids: [p.coverArt], name: p.name }) : lazyArt(c2, art(el2, image, { name: p.name, glyph: "\u266A" }), "playlist", p.id);
    const mixArt = (m) => framed(el2, lazyArt(c2, art(el2, image, { name: `Mix ${m.nome}`, glyph: MOOD_GLYPHS[m.nome] || "\u266B" }), "mood", m.nome, { shift: 1 }), m.nome);
    const playSongs = (load) => c2.action(async () => {
      const songs = await load();
      if (!songs.length) throw new Error("Qui non ci sono ancora brani da ascoltare.");
      c2.setQueue(songs, 0);
    });
    const candidates = [
      {
        key: "liked",
        title: "Brani che ti piacciono",
        cover: () => art(el2, image, { name: "Brani che ti piacciono", glyph: "\u2665" }),
        liked: true,
        open: () => c2.load("liked"),
        play: playSongs(async () => (await c2.api("/api/music/liked")).songs || [])
      },
      ...playlists.map((p) => ({
        key: `playlist:${p.id}`,
        title: p.name,
        cover: () => playlistArt(p),
        open: c2.action(() => c2.open(p)),
        play: playSongs(async () => {
          var _a2;
          return ((_a2 = (await c2.api(`/api/music/playlist?id=${encodeURIComponent(p.id)}`)).playlist) == null ? void 0 : _a2.entry) || [];
        })
      })),
      ...albums.map((a) => ({
        key: `album:${a.id}`,
        title: a.name || "Album senza titolo",
        cover: () => art(el2, image, { ids: [a.coverArt], name: a.name }),
        open: c2.action(() => c2.open({ ...a, type: "album" })),
        play: playSongs(async () => {
          var _a2;
          return ((_a2 = (await c2.api(`/api/music/album?id=${encodeURIComponent(a.id)}`)).album) == null ? void 0 : _a2.song) || [];
        })
      })),
      ...moods.map((m) => ({
        key: `mix:${m.nome}`,
        title: `Mix \xB7 ${m.nome}`,
        cover: () => lazyArt(c2, art(el2, image, { name: `Mix ${m.nome}`, glyph: MOOD_GLYPHS[m.nome] || "\u266B" }), "mood", m.nome, { shift: 1 }),
        open: c2.action(() => c2.showSelection({ kind: "mix", mood: m.nome }, `Mix del giorno \xB7 ${m.nome}`)),
        play: c2.action(() => c2.startSelection({ kind: "mix", mood: m.nome }))
      })),
      ...artists.filter((a) => pins.includes(`artist:${a.id}`) || opened[`artist:${a.id}`]).map((a) => ({
        key: `artist:${a.id}`,
        title: a.name,
        cover: () => artistArt(c2, a.name, a.coverArt, 80),
        open: c2.action(() => c2.open(a)),
        play: c2.action(() => c2.startSelection({ kind: "radio", artist: a.id }))
      }))
    ];
    const rank2 = (item) => {
      const pin2 = pins.indexOf(item.key);
      return pin2 >= 0 ? 1e15 - pin2 : Number(opened[item.key]) || 0;
    };
    const quick = candidates.map((item, order) => ({ item, order, score: rank2(item) })).sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 8).map(({ item }) => {
      const tile = quickTile(el2, { cover: item.cover(), title: item.title, open: item.open, play: item.play });
      if (item.liked) tile.classList.add("liked-tile");
      return tile;
    });
    const others = (state2.boot.profiles || []).filter((o) => o.id !== state2.profile);
    const me = (state2.boot.profiles || []).find((p) => p.id === state2.profile) || { name: state2.profile };
    const seen = /* @__PURE__ */ new Set();
    const heard2 = recent.filter((s) => s && !seen.has(s.id) && seen.add(s.id)).slice(0, 12);
    const moment = card(el2, { cover: art(el2, image, { name: "Il tuo momento", glyph: "\u25D0" }), title: "Il tuo momento", sub: "La musica segue la giornata", label: "Il tuo momento adesso", data: { "data-music": "moment" } });
    const shelves = [
      shelf(el2, "Le tue playlist", playlists.map((p) => card(el2, { cover: playlistArt(p), title: p.name, sub: `Playlist \xB7 ${p.songCount || 0} brani`, label: `Apri playlist ${p.name}`, onclick: c2.action(() => c2.open(p)) })), { kind: "playlist" }),
      shelf(el2, "Mix per te", moods.map((m) => card(el2, {
        cover: mixArt(m),
        title: `Mix \xB7 ${m.nome}`,
        sub: m.descrizione || "Cambia ogni giorno",
        label: `Mix \xB7 ${m.nome}`,
        onclick: c2.action(() => c2.showSelection({ kind: "mix", mood: m.nome }, `Mix del giorno \xB7 ${m.nome}`))
      })), { kind: "mood" }),
      shelf(el2, "Il tuo momento", [moment, ...moods.map((m, i) => c2.collectionCard(m, "mood", i))], { kind: "mood" }),
      shelf(el2, "Ascoltati di recente", heard2.map((s, i) => card(el2, { cover: art(el2, image, { ids: [s.coverArt || s.albumId], name: s.album || s.title }), title: s.title, sub: s.artist || "", label: `Ascolta di nuovo ${s.title}`, onclick: () => c2.setQueue(heard2, i) }))),
      shelf(el2, "I tuoi artisti", artists.slice(0, 14).map((a) => card(el2, { cover: artistArt(c2, a.name, a.coverArt), title: a.name, sub: "Artista", label: `Apri artista ${a.name}`, round: true, onclick: c2.action(() => c2.open(a)) }))),
      shelf(el2, "I tuoi album", albums.slice(0, 14).map(c2.albumCard), { kind: "playlist" }),
      shelf(el2, "Generi", genres.map((g, i) => c2.collectionCard(g, "generi", i + 2)), { kind: "genre" }),
      shelf(el2, "Miscela", others.map((o) => card(el2, {
        cover: art(el2, image, { name: `${me.name} ${o.name}`, glyph: `${initials(me.name)[0]}+${initials(o.name)[0]}` }),
        title: `Miscela con ${o.name}`,
        sub: "Due gusti, cambia ogni giorno",
        label: `Miscela con ${o.name}`,
        onclick: c2.action(async () => (await Promise.resolve().then(() => (init_music_blend(), music_blend_exports))).showBlend(c2, o))
      }))),
      shelf(el2, "Riscopri", [
        card(el2, { cover: art(el2, image, { name: "Riscopri", glyph: "\u21BA" }), title: "Riscopri", sub: "Preferiti che non senti da un po\u2019", label: "Riscopri", onclick: c2.action(() => c2.showSelection({ kind: "rediscover" }, "Riscopri")) }),
        card(el2, { cover: art(el2, image, { name: "Mescola tutta la musica", glyph: "\u292E" }), title: "Mescola tutto", sub: "Tutta la raccolta, in ordine sparso", label: "Mescola tutta la musica", onclick: c2.action(() => c2.startSelection({ kind: "shuffle" })) }),
        card(el2, { cover: art(el2, image, { name: "Il tuo mese", glyph: "\u263C" }), title: "Il tuo mese", sub: "Quello che hai ascoltato", label: "Il tuo mese", data: { "data-music": "recap" } })
      ])
    ].filter(Boolean);
    const root = el2("div", { class: "music-home", "data-filter": filter });
    const chips = el2("div", { class: "chips", role: "group", "aria-label": "Cosa mostrare nella home" }, ...[["all", "Tutti"], ["mood", "Mood"], ["genre", "Generi"], ["playlist", "Playlist"]].map(([key, name]) => el2("button", { class: "chip", "data-home-filter": key, "aria-pressed": key === filter, onclick: () => {
      filter = filter === key && key !== "all" ? "all" : key;
      root.dataset.filter = filter;
      chips.querySelectorAll("[data-home-filter]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.homeFilter === filter));
    } }, name)));
    root.append(el2("div", { class: "home-top" }, avatar(c2), chips));
    if (quick.length) root.append(el2("div", { class: "quick-grid", role: "group", "aria-label": "Ascoltati e fissati di recente" }, ...quick));
    if (!home.available || !moods.length && !genres.length) root.append(el2("div", { class: "catalog-note", role: "status" }, el2("strong", {}, "La musica \xE8 tutta qui."), el2("p", {}, home.message || "Non ci sono ancora mood o generi nel catalogo. Scegli un album o una playlist.")));
    root.append(...shelves);
    if (!albums.length) root.append(el2("p", { class: "muted" }, "Non ci sono ancora album. Puoi cercare un brano o aprire le playlist."));
    return root;
  }
  var MOOD_GLYPHS, filter;
  var init_music_home = __esm({
    "public/music-home.js"() {
      init_music_shell();
      MOOD_GLYPHS = { Energia: "\u2197", Festa: "\u2726", Relax: "\u2248", Concentrazione: "\u25CE", Malinconia: "\u2602", Notte: "\u263E", "Soul e jazz": "\u266B", Grinta: "\u03DF", "In viaggio": "\u279C" };
      filter = "all";
    }
  });

  // public/music-recommendations.js
  var music_recommendations_exports = {};
  __export(music_recommendations_exports, {
    playlistRecommendations: () => playlistRecommendations
  });
  async function playlistRecommendations(c2, host, generation, songs, add) {
    const { el: el2, action: action2, api: api2, state: state2 } = c2;
    let shown = [];
    let busy = false;
    const refresh = async () => {
      if (busy || generation !== state2.musicGeneration) return;
      busy = true;
      host.setAttribute("aria-busy", "true");
      try {
        const result = await api2("/api/music/recommendations", { method: "POST", data: { ids: songs().map((s) => s.id), exclude: shown.slice(-2e3) } });
        if (generation !== state2.musicGeneration) return;
        shown.push(...result.songs.map((s) => s.id));
        host.replaceChildren(
          el2("h2", {}, "Brani consigliati"),
          el2("p", { class: "muted" }, "Scelti dalla musica di casa, vicini al suono della playlist."),
          el2("button", { class: "secondary", onclick: action2(refresh) }, "Aggiorna consigli"),
          ...result.songs.map((song2) => el2(
            "div",
            { class: "actions recommendation" },
            el2("button", { class: "quiet", onclick: () => c2.setQueue([song2]) }, `${song2.title} \xB7 ${song2.artist || ""}`),
            el2("button", { class: "secondary", "aria-label": `Aggiungi ${song2.title} alla playlist`, onclick: action2(async (e) => {
              var _a2;
              const button = e.currentTarget;
              button.disabled = true;
              try {
                await add(song2);
                (_a2 = button.closest(".recommendation")) == null ? void 0 : _a2.remove();
              } catch (error) {
                button.disabled = false;
                throw error;
              }
            }) }, "+")
          )),
          ...!result.songs.length ? [el2("p", { role: "status" }, "Non ci sono altri brani da proporre. I brani gi\xE0 in playlist restano esclusi.")] : []
        );
      } finally {
        busy = false;
        host.removeAttribute("aria-busy");
      }
    };
    await refresh();
  }
  var init_music_recommendations = __esm({
    "public/music-recommendations.js"() {
    }
  });

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
      def(AbortSignal, "any", function(list2) {
        var c2 = new AbortController();
        list2.forEach(function(s) {
          if (s.aborted) c2.abort();
          else s.addEventListener("abort", function() {
            c2.abort();
          });
        });
        return c2.signal;
      });
    }
    def(Promise, "any", function(list2) {
      return new Promise(function(ok, no) {
        var errors = [], left = 0, items = Array.from(list2);
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
    def(Promise, "allSettled", function(list2) {
      return Promise.all(Array.from(list2).map(function(p) {
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
  function playbackAction(item, seconds, duration, hasNext, preferences2 = {}) {
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
        automatic: preferences2.autoSkip === true && sure.includes(type) && (!next || preferences2.autoNext === true)
      };
    }
    return null;
  }
  function storyEndOf(item, duration) {
    const at = item == null ? void 0 : item.fineStoria;
    return typeof at === "number" && Number.isFinite(at) && at > 0 && duration > 0 && at < duration && at >= duration / 2 ? at : null;
  }
  function spatialTarget(activeRect, candidates, direction) {
    const valid = (r) => r && [r.left, r.top, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;
    if (!valid(activeRect)) return null;
    const ax = activeRect ? activeRect.left + activeRect.width / 2 : 0;
    const ay = activeRect ? activeRect.top + activeRect.height / 2 : 0;
    let best = null;
    let score = Infinity;
    let bestAligned = false;
    for (const candidate of candidates) {
      if (!valid(candidate.rect)) continue;
      const r = candidate.rect;
      const dx = r.left + r.width / 2 - ax;
      const dy = r.top + r.height / 2 - ay;
      const horizontal = ["ArrowLeft", "ArrowRight"].includes(direction);
      const forward = direction === "ArrowRight" ? dx : direction === "ArrowLeft" ? -dx : direction === "ArrowDown" ? dy : -dy;
      if (forward <= 4) continue;
      const aligned = horizontal ? r.top < activeRect.top + activeRect.height && r.top + r.height > activeRect.top : r.left < activeRect.left + activeRect.width && r.left + r.width > activeRect.left;
      const sideways = Math.abs(horizontal ? dy : dx);
      const rank2 = forward + sideways * 3;
      if (aligned && !bestAligned || aligned === bestAligned && rank2 < score) {
        score = rank2;
        best = candidate.value;
        bestAligned = aligned;
      }
    }
    return best;
  }
  function normalizeLyrics(response) {
    var _a2;
    const versions = (_a2 = response == null ? void 0 : response.lyricsList) == null ? void 0 : _a2.structuredLyrics;
    if (!Array.isArray(versions)) return { synced: false, lines: [] };
    const choices = versions.slice(0, 50).map((version) => {
      const synced = (version == null ? void 0 : version.synced) === true;
      const lines = (Array.isArray(version == null ? void 0 : version.line) ? version.line : []).slice(0, 5e3).filter((line2) => typeof (line2 == null ? void 0 : line2.value) === "string" && (!synced || Number.isFinite(line2.start) && line2.start >= 0)).map((line2) => ({ text: line2.value.slice(0, 4e3), start: synced ? line2.start : null }));
      if (synced) lines.sort((a, b) => a.start - b.start);
      return { synced, lines };
    }).filter((choice) => choice.lines.some((line2) => line2.text.trim()));
    return choices.find((choice) => choice.synced) || choices[0] || { synced: false, lines: [] };
  }
  function currentLyric(lines, seconds) {
    if (!Number.isFinite(seconds)) return -1;
    let low = 0;
    let high = lines.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = low + high >> 1;
      if (lines[mid].start <= seconds * 1e3) {
        found = mid;
        low = mid + 1;
      } else high = mid - 1;
    }
    return found;
  }
  var VIDEO_PAGE_NAMES = ["home", "film", "series", "anime", "novita", "cerca", "lista", "scaricati", "esplora", "account"];
  function otherServerTarget(page, mode, otherUrl, search2 = "") {
    if (!otherUrl || !(mode === "video" && page === "music" || mode === "music" && VIDEO_PAGE_NAMES.includes(page))) return "";
    let base;
    try {
      base = new URL(otherUrl);
    } catch {
      return "";
    }
    if (!["http:", "https:"].includes(base.protocol)) return "";
    const params = new URLSearchParams(search2);
    const keep = new URLSearchParams();
    for (const key of ["tv", "legacy"]) if (params.has(key)) keep.set(key, params.get(key));
    const query = String(keep);
    return `${base.origin}/${query ? "?" + query : ""}#${page}`;
  }

  // public/app.js
  init_music_logic();

  // public/music-playback.js
  init_music_logic();

  // public/music-equalizer.js
  var EQ_BANDS = [60, 170, 500, 1400, 4e3, 11e3];
  var EQ_PRESETS = {
    normal: { label: "Normale", gains: [0, 0, 0, 0, 0, 0] },
    bass: { label: "Bassi", gains: [5, 3, 0, -1, -1, 0] },
    voice: { label: "Voci", gains: [-3, -1, 2, 4, 1, -2] },
    night: { label: "Notte", gains: [-4, -2, 1, 2, 0, -4] },
    acoustic: { label: "Acustico", gains: [1, 1, 0, 2, 2, 1] },
    custom: { label: "Personalizzato", gains: [0, 0, 0, 0, 0, 0] }
  };
  var cleanGains = (values) => EQ_BANDS.map((_, i) => Number.isFinite(values == null ? void 0 : values[i]) ? Math.max(-9, Math.min(9, values[i])) : 0);
  function equalizerSettings(value = {}) {
    var _a2;
    const preset = Object.hasOwn(EQ_PRESETS, value == null ? void 0 : value.preset) ? value.preset : "normal";
    const custom = cleanGains((_a2 = value == null ? void 0 : value.custom) != null ? _a2 : preset === "custom" ? value == null ? void 0 : value.gains : []);
    return { preset, gains: preset === "custom" ? [...custom] : [...EQ_PRESETS[preset].gains], custom };
  }
  function selectEqualizer(preset, current) {
    const previous = equalizerSettings(current);
    return equalizerSettings({ preset, custom: previous.custom });
  }
  var equalizerHeadroom = (gains) => 10 ** (-gains.reduce((sum, gain) => sum + Math.max(0, gain), 0) / 20);
  var EqualizerGraph = class {
    constructor(context) {
      this.context = context;
      this.sources = /* @__PURE__ */ new Map();
      this.filters = EQ_BANDS.map((frequency, i) => {
        const filter2 = context.createBiquadFilter();
        filter2.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
        filter2.frequency.value = Math.min(frequency, context.sampleRate * 0.45);
        filter2.Q.value = 0.85;
        filter2.gain.value = 0;
        return filter2;
      });
      this.output = context.createGain();
      this.filters.forEach((filter2, i) => filter2.connect(this.filters[i + 1] || this.output));
      this.output.connect(context.destination);
    }
    attach(element) {
      if (this.sources.has(element)) return;
      const gain = this.context.createGain();
      const level = element.volume;
      gain.gain.value = level;
      const source = this.context.createMediaElementSource(element);
      this.sources.set(element, { source, gain, level });
      source.connect(gain);
      gain.connect(this.filters[0]);
      element.volume = 1;
    }
    configure(settings) {
      const { context } = this;
      const ramp = (param, value) => {
        param.cancelScheduledValues(context.currentTime);
        param.setTargetAtTime(value, context.currentTime, 0.015);
      };
      settings.gains.forEach((gain, i) => ramp(this.filters[i].gain, gain));
      ramp(this.output.gain, equalizerHeadroom(settings.gains));
    }
    level(element) {
      var _a2, _b2;
      return (_b2 = (_a2 = this.sources.get(element)) == null ? void 0 : _a2.level) != null ? _b2 : element.volume;
    }
    setLevel(element, level) {
      const entry = this.sources.get(element);
      if (!entry) {
        element.volume = level;
        return;
      }
      entry.level = level;
      entry.gain.gain.setValueAtTime(level, this.context.currentTime);
    }
    destroy() {
      for (const { source, gain } of this.sources.values()) {
        source.disconnect();
        gain.disconnect();
      }
      this.filters.forEach((filter2) => filter2.disconnect());
      this.output.disconnect();
      this.context.close().catch(() => {
      });
    }
  };

  // public/music-playback.js
  var MusicPlayback = class {
    constructor(nodes, callbacks = {}, { now = Date.now, schedule = true, createAudioContext = () => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context() : null;
    }, startupMs = 8e3 } = {}) {
      this.nodes = nodes;
      this.active = nodes[0];
      this.callbacks = callbacks;
      this.now = now;
      this.queue = [];
      this.index = 0;
      this.repeat = "off";
      this.crossfade = 0;
      this.normalize = false;
      this.volume = 0.8;
      this.epoch = 0;
      this.sleepAt = 0;
      this.sleepEnd = false;
      this.startupMs = startupMs;
      this.createAudioContext = createAudioContext;
      this.equalizer = equalizerSettings();
      this.listeners = [];
      const listen = (node, type, handler) => {
        node.addEventListener(type, handler);
        this.listeners.push(() => node.removeEventListener(type, handler));
      };
      for (const node of nodes) {
        listen(node, "loadedmetadata", () => {
          if (node === this.active && this.resume != null) {
            node.currentTime = Math.min(this.resume, Math.max(0, node.duration - 0.1));
            this.resume = null;
          }
        });
        listen(node, "ended", () => {
          if (node === this.active) this.advance(true).catch((e) => {
            var _a2;
            return (_a2 = callbacks.error) == null ? void 0 : _a2.call(callbacks, e);
          });
        });
        listen(node, "play", () => {
          if (node === this.active) {
            this.running = true;
            this.lastAt = this.now();
            this.lastPosition = node.currentTime;
            this.sendListen(false);
          }
        });
        listen(node, "pause", () => {
          if (node === this.active) {
            this.account();
            this.reportActivity(true);
            this.running = false;
            this.cancelFade();
          }
        });
        listen(node, "seeking", () => {
          if (node === this.active) {
            this.lastPosition = node.currentTime;
            this.lastAt = this.now();
          }
        });
        listen(node, "playing", () => {
          var _a2, _b2;
          if (node === this.active) {
            clearTimeout(this.startTimer);
            this.loading = false;
            (_a2 = callbacks.status) == null ? void 0 : _a2.call(callbacks, "playing");
            (_b2 = callbacks.ready) == null ? void 0 : _b2.call(callbacks, this.song());
          }
        });
        listen(node, "waiting", () => {
          var _a2;
          if (node === this.active && !node.paused) (_a2 = callbacks.status) == null ? void 0 : _a2.call(callbacks, "loading");
        });
      }
      if (schedule) this.interval = setInterval(() => this.tick(), 100);
    }
    song() {
      return this.queue[this.index];
    }
    url(song2) {
      var _a2, _b2;
      return ((_b2 = (_a2 = this.callbacks).url) == null ? void 0 : _b2.call(_a2, song2)) || `/api/music/stream?id=${encodeURIComponent(song2.id)}`;
    }
    gain(song2 = this.song()) {
      return this.volume * (this.normalize ? volumeGain(song2) : 1);
    }
    level(node) {
      return this.graph ? this.graph.level(node) : node.volume;
    }
    setLevel(node, value) {
      if (this.graph) this.graph.setLevel(node, value);
      else node.volume = value;
    }
    setEqualizer(value) {
      var _a2;
      this.equalizer = equalizerSettings(value);
      (_a2 = this.graph) == null ? void 0 : _a2.configure(this.equalizer);
      return this.equalizer;
    }
    async prepareAudio() {
      if (!this.graph && this.equalizer.gains.some((g) => g !== 0)) {
        try {
          const context = this.createAudioContext();
          if (!context) return false;
          this.graph = new EqualizerGraph(context);
          for (const node of this.nodes) this.graph.attach(node);
          this.graph.configure(this.equalizer);
        } catch {
          return false;
        }
      }
      if (this.graph && this.graph.context.state !== "running") {
        try {
          await this.graph.context.resume();
        } catch {
          return false;
        }
      }
      return true;
    }
    configure({ repeat = this.repeat, crossfade = this.crossfade, normalize = this.normalize, volume = this.volume } = {}) {
      this.repeat = ["off", "one", "all"].includes(repeat) ? repeat : "off";
      this.crossfade = Math.max(0, Math.min(12, Number(crossfade) || 0));
      this.normalize = !!normalize;
      this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
      this.cancelFade();
      this.preload();
    }
    setQueue(queue, index = this.index, preload = true) {
      this.queue = queue;
      this.index = index;
      if (preload) this.preload();
    }
    // Il primo pezzo del brano toccato parte già al pointerdown, sul secondo elemento nativo.
    warm(song2) {
      if (!song2 || this.fading || this.switching || this.destroyed) return;
      const other = this.nodes.find((n) => n !== this.active), src = this.url(song2);
      if (other.getAttribute("src") === src || this.active.getAttribute("src") === src) return;
      other.pause();
      other.preload = "auto";
      other.src = src;
      other.load();
    }
    candidate(ended = true) {
      return nextIndex(this.index, this.queue.length, this.repeat, ended);
    }
    preload() {
      if (this.fading || this.switching) return;
      const other = this.nodes.find((n) => n !== this.active);
      const index = this.candidate();
      const song2 = this.queue[index];
      if (!song2) {
        other.pause();
        other.removeAttribute("src");
        other.load();
        return;
      }
      const src = this.url(song2);
      if (other.getAttribute("src") === src) return;
      other.pause();
      other.src = src;
      other.preload = "auto";
      other.load();
      this.setLevel(other, this.gain(song2));
    }
    async play(index = this.index, { position = 0, autoplay = true, buffered = false, fade = 0 } = {}) {
      var _a2, _b2, _c, _d, _e, _f, _g, _h, _i, _j, _k;
      if (this.destroyed || !this.queue[index]) return;
      this.account();
      this.reportActivity(true);
      this.cancelFade();
      const previous = Object.fromEntries(["index", "resume", "listened", "started", "submitted", "running", "reportedSeconds", "playId", "lastAt", "lastPosition", "activityStartedAt"].map((key) => [key, this[key]]));
      clearTimeout(this.startTimer);
      (_a2 = this.cancelStart) == null ? void 0 : _a2.call(this);
      const epoch = ++this.epoch;
      const old = this.active;
      this.switching = true;
      const src = this.url(this.queue[index]), spare = this.nodes.find((n) => n !== old);
      buffered = buffered || spare.getAttribute("src") === src;
      const next = buffered ? spare : old;
      if (!buffered) for (const node of this.nodes) node.pause();
      this.active = next;
      this.index = index;
      this.resume = Math.max(0, Number(position) || 0);
      this.listened = 0;
      this.started = false;
      this.submitted = false;
      this.running = false;
      this.reportedSeconds = 0;
      this.playId = `${this.now()}-${Math.random().toString(36).slice(2)}`;
      this.lastAt = this.now();
      this.lastPosition = this.resume;
      this.activityStartedAt = this.now();
      if (old !== next && !fade) old.pause();
      if (!buffered || next.getAttribute("src") !== src) {
        next.src = src;
        next.load();
      }
      if (next.readyState >= 1) {
        next.currentTime = Math.min(this.resume, Math.max(0, next.duration - 0.1));
        this.resume = null;
      }
      this.setLevel(next, fade ? 0 : this.gain());
      this.loading = autoplay;
      (_c = (_b2 = this.callbacks).status) == null ? void 0 : _c.call(_b2, autoplay ? "loading" : "paused");
      const prepare = autoplay ? this.prepareAudio() : Promise.resolve();
      (_e = (_d = this.callbacks).track) == null ? void 0 : _e.call(_d, this.song(), next, index);
      if (autoplay) {
        let timeout;
        const deadline = new Promise((resolve, reject) => {
          this.cancelStart = resolve;
          this.startTimer = setTimeout(() => {
            timeout = true;
            reject(new Error("La musica non parte. Controlla la connessione e tocca Riproduci per riprovare."));
          }, this.startupMs);
        });
        try {
          await Promise.race([(async () => {
            await prepare;
            if (epoch === this.epoch) await next.play();
          })(), deadline]);
        } catch (error) {
          if (epoch === this.epoch) {
            clearTimeout(this.startTimer);
            this.loading = false;
            (_g = (_f = this.callbacks).status) == null ? void 0 : _g.call(_f, "error");
            this.switching = false;
            next.pause();
            if (timeout) {
              next.removeAttribute("src");
              next.load();
            }
            if (old !== next && !old.paused && !old.ended) {
              Object.assign(this, previous);
              this.active = old;
              this.lastAt = this.now();
              this.lastPosition = old.currentTime;
              this.setLevel(old, this.gain());
              next.removeAttribute("src");
              next.load();
              (_i = (_h = this.callbacks).track) == null ? void 0 : _i.call(_h, this.song(), old, this.index);
            } else old.pause();
            this.preload();
            (_k = (_j = this.callbacks).error) == null ? void 0 : _k.call(_j, error);
          }
          return;
        }
        clearTimeout(this.startTimer);
      }
      if (epoch !== this.epoch) return;
      if (old !== next) {
        if (fade && autoplay) this.fading = { old, start: this.now(), duration: fade * 1e3, volume: this.level(old) };
        else old.pause();
      }
      this.switching = false;
      this.preload();
    }
    sendListen(submission) {
      var _a2, _b2;
      if (!this.song() || (submission ? this.submitted : this.started)) return;
      if (submission) this.submitted = true;
      else this.started = true;
      (_b2 = (_a2 = this.callbacks).listen) == null ? void 0 : _b2.call(_a2, { id: this.song().id, playId: this.playId, submission });
    }
    account() {
      var _a2;
      const now = this.now();
      const position = this.active.currentTime;
      const delta = position - (this.lastPosition || 0);
      if (this.running && !this.active.seeking && delta > 0 && delta <= (now - ((_a2 = this.lastAt) != null ? _a2 : now)) / 1e3 + 1) this.listened = (this.listened || 0) + delta;
      this.lastAt = now;
      this.lastPosition = position;
      if (qualifies(this.active.duration, this.listened)) this.sendListen(true);
      this.reportActivity();
    }
    reportActivity(force = false) {
      var _a2, _b2;
      const seconds = Math.floor(this.listened || 0);
      if (!this.song() || !this.playId || seconds <= (this.reportedSeconds || 0) || !force && seconds - (this.reportedSeconds || 0) < 15) return;
      this.reportedSeconds = seconds;
      (_b2 = (_a2 = this.callbacks).activity) == null ? void 0 : _b2.call(_a2, { id: this.song().id, playId: this.playId, seconds, at: this.activityStartedAt });
    }
    cancelFade() {
      if (this.fading) {
        this.fading.old.pause();
        this.fading = null;
      }
      this.setLevel(this.active, this.gain());
    }
    pause() {
      var _a2, _b2, _c, _d, _e;
      clearTimeout(this.startTimer);
      (_a2 = this.cancelStart) == null ? void 0 : _a2.call(this);
      this.loading = false;
      (_c = (_b2 = this.callbacks).status) == null ? void 0 : _c.call(_b2, "paused");
      this.account();
      this.reportActivity(true);
      this.running = false;
      ++this.epoch;
      this.switching = false;
      for (const node of this.nodes) node.pause();
      this.cancelFade();
      (_e = (_d = this.callbacks).progress) == null ? void 0 : _e.call(_d);
    }
    async advance(ended = false) {
      var _a2, _b2;
      if (this.advancing) return;
      this.advancing = true;
      const epoch = this.epoch;
      try {
        this.account();
        if (ended && this.sleepEnd) {
          this.sleepEnd = false;
          this.pause();
          (_b2 = (_a2 = this.callbacks).sleep) == null ? void 0 : _b2.call(_a2);
          return;
        }
        let next = this.candidate(ended);
        if (next < 0 && this.callbacks.more) {
          await this.callbacks.more();
          if (epoch !== this.epoch) return;
          next = this.candidate(ended);
        }
        if (next < 0) {
          this.pause();
          return;
        }
        const other = this.nodes.find((n) => n !== this.active);
        const buffered = other.getAttribute("src") === this.url(this.queue[next]);
        await this.play(next, { buffered, fade: !ended && !this.active.paused && !this.active.ended && this.crossfade && buffered ? Math.min(this.crossfade, Math.max(0, this.active.duration - this.active.currentTime)) : 0 });
      } finally {
        this.advancing = false;
      }
    }
    setSleep(minutes2) {
      this.sleepEnd = minutes2 === "end";
      this.sleepAt = this.sleepEnd ? 0 : this.now() + Math.max(0, Number(minutes2) || 0) * 6e4;
      if (!Number(minutes2)) this.sleepAt = 0;
    }
    tick() {
      var _a2, _b2;
      if (this.destroyed) return;
      this.account();
      if (this.sleepAt && this.now() >= this.sleepAt) {
        this.sleepAt = 0;
        this.pause();
        (_b2 = (_a2 = this.callbacks).sleep) == null ? void 0 : _b2.call(_a2);
      }
      if (this.fading) {
        const progress = Math.min(1, (this.now() - this.fading.start) / this.fading.duration);
        this.setLevel(this.active, this.gain() * progress);
        this.setLevel(this.fading.old, this.fading.volume * (1 - progress));
        if (progress >= 1) {
          const old = this.fading.old;
          this.fading = null;
          old.pause();
          this.preload();
        }
      }
      const other = this.nodes.find((n) => n !== this.active);
      if (this.crossfade && this.repeat !== "one" && !this.sleepEnd && !this.active.paused && !this.active.seeking && !this.fading && other.readyState >= 3 && this.active.duration > this.crossfade * 2 && this.active.duration - this.active.currentTime <= this.crossfade && this.candidate() >= 0) this.advance().catch((e) => {
        var _a3, _b3;
        return (_b3 = (_a3 = this.callbacks).error) == null ? void 0 : _b3.call(_a3, e);
      });
    }
    clear() {
      ++this.epoch;
      this.switching = false;
      this.pause();
      this.queue = [];
      this.index = 0;
      for (const n of this.nodes) {
        n.pause();
        n.removeAttribute("src");
        n.load();
      }
    }
    destroy() {
      var _a2;
      if (this.destroyed) return;
      this.destroyed = true;
      clearInterval(this.interval);
      for (const remove of this.listeners.splice(0)) remove();
      this.clear();
      (_a2 = this.graph) == null ? void 0 : _a2.destroy();
    }
  };

  // public/virtual-list.js
  function windowedList(rows, render, { className = "track-list", height = 76 } = {}) {
    const list2 = document.createElement("ol");
    list2.className = className;
    if (rows.length <= 60) {
      list2.append(...rows.map(render));
      return list2;
    }
    list2.classList.add("windowed-list");
    list2.tabIndex = 0;
    list2.setAttribute("aria-label", `${quantity(rows.length, "brano", "brani")}, scorri per continuare`);
    let start = -1;
    function paint(force = false) {
      var _a2;
      const from = Math.max(0, Math.floor(list2.scrollTop / height) - 4);
      if (!force && from === start) return;
      start = from;
      const focused = document.activeElement;
      const focusedRow = list2.contains(focused) ? focused.closest("[aria-posinset]") : null;
      const focusedPosition = focusedRow == null ? void 0 : focusedRow.getAttribute("aria-posinset");
      const controls = "button,a[href],input,select,textarea,[tabindex]";
      const focusedControl = focusedRow ? [...focusedRow.querySelectorAll(controls)].indexOf(focused) : -1;
      const count = Math.ceil((list2.clientHeight || 600) / height) + 8;
      const end = Math.min(rows.length, start + count);
      const spacer = (size) => {
        const li = document.createElement("li");
        li.style.height = `${size}px`;
        li.setAttribute("role", "presentation");
        return li;
      };
      list2.replaceChildren(spacer(start * height), ...rows.slice(start, end).map((row, i) => {
        const node = render(row, start + i);
        node.style.height = `${height}px`;
        node.setAttribute("aria-posinset", start + i + 1);
        node.setAttribute("aria-setsize", rows.length);
        return node;
      }), spacer((rows.length - end) * height));
      if (focusedRow) (((_a2 = list2.querySelector(`[aria-posinset="${focusedPosition}"]`)) == null ? void 0 : _a2.querySelectorAll(controls)[focusedControl]) || list2).focus({ preventScroll: true });
    }
    list2.addEventListener("scroll", () => paint());
    list2.addEventListener("keydown", (event) => {
      var _a2;
      if (event.target.matches("input,select,textarea,[contenteditable=true]") || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(event.key)) return;
      const row = event.target.closest("[aria-posinset]");
      if (!row) return;
      const current = Number(row.getAttribute("aria-posinset")) - 1;
      const step = Math.max(1, Math.floor(list2.clientHeight / height));
      const target = event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : current + { ArrowDown: 1, ArrowUp: -1, PageDown: step, PageUp: -step }[event.key];
      const index = Math.max(0, Math.min(rows.length - 1, target));
      if (index < 0 || index >= rows.length) return;
      event.preventDefault();
      event.stopPropagation();
      list2.scrollTop = index * height;
      paint(true);
      (_a2 = list2.querySelector(`[aria-posinset="${index + 1}"] button`)) == null ? void 0 : _a2.focus({ preventScroll: true });
    });
    paint();
    return list2;
  }

  // public/music-motion.js
  function rectTransform(from, to) {
    if (!to.width || !to.height) return "none";
    return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  }
  function motionOptions({ reduced = false, phone = false, tv = false } = {}) {
    return { duration: reduced ? 90 : phone && !tv ? 300 : 180, easing: "cubic-bezier(.2,.8,.2,1)", fill: "both" };
  }
  var PlayerMotion = class {
    constructor(dialog, mini, cover, miniCover) {
      Object.assign(this, { dialog, mini, cover, miniCover });
    }
    async run(opening, startRect) {
      this.cancel();
      const { dialog, mini, cover, miniCover } = this;
      if (!dialog.open || !dialog.animate) return;
      const options = motionOptions({
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        phone: matchMedia("(max-width:650px)").matches,
        tv: document.documentElement.classList.contains("tv")
      });
      const animations = [];
      const temporary = [];
      const restores = [];
      const animate = (node, frames) => {
        const a = node.animate(opening ? frames : [...frames].reverse(), options);
        animations.push(a);
      };
      const hide = (node) => {
        const old = node.style.visibility;
        node.style.visibility = "hidden";
        restores.push(() => {
          node.style.visibility = old;
        });
      };
      if (options.duration === 90) animate(dialog, [{ opacity: 0 }, { opacity: 1 }]);
      else {
        const full = dialog.getBoundingClientRect();
        const layer = (name, rect2) => {
          const node = document.createElement("div");
          node.className = name;
          node.setAttribute("aria-hidden", "true");
          Object.assign(node.style, { left: `${rect2.left}px`, top: `${rect2.top}px`, width: `${rect2.width}px`, height: `${rect2.height}px` });
          dialog.append(node);
          temporary.push(node);
          return node;
        };
        const surface = layer("player-surface", full);
        animate(surface, [{ transform: rectTransform(mini.getBoundingClientRect(), full), borderRadius: "12px" }, { transform: startRect ? rectTransform(startRect, full) : "none", borderRadius: getComputedStyle(dialog).borderRadius }]);
        const rect = cover.getBoundingClientRect();
        if (rect.width && rect.height) {
          const flight = layer("player-flight", rect);
          const img = miniCover.cloneNode();
          img.removeAttribute("id");
          img.alt = "";
          flight.append(img);
          const shifted = startRect ? { ...rect.toJSON(), top: rect.top + startRect.top - full.top } : rect;
          animate(flight, [{ transform: rectTransform(miniCover.getBoundingClientRect(), rect) }, { transform: rectTransform(shifted, rect) }]);
          hide(cover);
          hide(miniCover);
        }
        for (const child of [...dialog.children]) if (!temporary.includes(child)) animate(child, [{ opacity: 0 }, { opacity: 1 }]);
        dialog.classList.add("player-moving");
      }
      const cleanup = () => {
        animations.forEach((a) => a.cancel());
        temporary.forEach((n) => n.remove());
        restores.forEach((fn) => fn());
        dialog.classList.remove("player-moving");
      };
      this.cleanup = cleanup;
      await Promise.allSettled(animations.map((a) => a.finished));
      if (this.cleanup === cleanup) {
        cleanup();
        this.cleanup = null;
      }
    }
    cancel() {
      var _a2;
      (_a2 = this.cleanup) == null ? void 0 : _a2.call(this);
      this.cleanup = null;
    }
  };

  // public/music-gestures.js
  function gestureAxis(dx, dy) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return null;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) return "x";
    if (Math.abs(dy) > Math.abs(dx) * 1.2) return "y";
    return null;
  }
  function gestureAction({ mode, axis, dx, dy, width, height, vx = 0, vy = 0, atTop = true }) {
    if (axis === "x" && mode !== "handle" && (Math.abs(dx) >= Math.max(48, Math.min(100, width * 0.22)) || Math.abs(dx) > 24 && Math.abs(vx) > 0.55 && Math.sign(vx) === Math.sign(dx))) return dx < 0 ? "next" : "previous";
    if (axis === "y" && mode === "mini" && (dy < -56 || dy < -24 && vy < -0.55)) return "open";
    if (axis === "y" && mode !== "mini" && atTop && (dy > height * 0.3 || dy > 32 && vy > 0.65)) return "close";
    return null;
  }
  function bindPlayerGesture(surface, { mode, moving = surface, scroller, enabled, perform, feedback = () => {
  } }) {
    let drag;
    let blockClick = false;
    let reset;
    const targets = [.../* @__PURE__ */ new Set([surface, moving])];
    const restore = () => {
      for (const node of targets) {
        node.style.removeProperty("transform");
        node.classList.remove("player-dragging");
      }
    };
    const settle = () => {
      for (const node of targets) {
        node.classList.remove("player-dragging");
        node.style.removeProperty("transform");
      }
      clearTimeout(reset);
      reset = setTimeout(restore, 180);
    };
    const finish = (event, cancelled = false) => {
      var _a2;
      if (!drag || event.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      if ((_a2 = surface.hasPointerCapture) == null ? void 0 : _a2.call(surface, d.id)) surface.releasePointerCapture(d.id);
      if (!d.axis) return;
      blockClick = true;
      setTimeout(() => {
        blockClick = false;
      }, 400);
      const last = d.samples.at(-1);
      const recent = d.samples.find((s) => last.t - s.t <= 100) || last;
      const dt = Math.max(1, event.timeStamp - recent.t);
      const action2 = cancelled || d.scrolling ? null : gestureAction({
        mode,
        axis: d.axis,
        dx: d.dx,
        dy: d.dy,
        width: surface.clientWidth,
        height: (scroller == null ? void 0 : scroller.clientHeight) || surface.clientHeight,
        vx: (event.clientX - recent.x) / dt,
        vy: (event.clientY - recent.y) / dt,
        atTop: d.top <= 1
      });
      if (action2 === "close") {
        const rect = moving.getBoundingClientRect();
        moving.style.transition = "none";
        restore();
        moving.getBoundingClientRect();
        moving.style.removeProperty("transition");
        if (perform(action2, rect) !== false) feedback();
      } else {
        if (action2 && perform(action2) !== false) feedback();
        settle();
      }
    };
    surface.addEventListener("pointerdown", (event) => {
      if (drag && event.pointerId !== drag.id) {
        finish({ ...event, pointerId: drag.id }, true);
        return;
      }
      if (!enabled() || !event.isPrimary || event.pointerType === "mouse" || event.button !== 0) return;
      if (event.target.closest("input,select,a,button:not(#open-music-player)")) return;
      clearTimeout(reset);
      restore();
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dx: 0,
        dy: 0,
        top: (scroller == null ? void 0 : scroller.scrollTop) || 0,
        samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }]
      };
    });
    surface.addEventListener("pointermove", (event) => {
      var _a2;
      if (!drag || drag.id !== event.pointerId) return;
      const d = drag;
      d.dx = event.clientX - d.x;
      d.dy = event.clientY - d.y;
      d.axis || (d.axis = gestureAxis(d.dx, d.dy));
      if (!d.axis) return;
      if (mode === "handle" && d.axis === "x") {
        drag = null;
        return;
      }
      event.preventDefault();
      if (event.isTrusted) (_a2 = surface.setPointerCapture) == null ? void 0 : _a2.call(surface, event.pointerId);
      d.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
      d.samples = d.samples.slice(-12);
      if (scroller && d.axis === "y" && (d.top > 1 || d.dy < 0)) {
        d.scrolling = true;
        scroller.scrollTop = Math.max(0, d.top - d.dy);
        return;
      }
      const target = mode === "cover" && d.axis === "x" ? surface : moving;
      target.classList.add("player-dragging");
      target.style.transform = d.axis === "x" ? `translateX(${d.dx}px)` : `translateY(${mode === "mini" ? Math.min(0, d.dy) : Math.max(0, d.dy)}px)`;
    }, { passive: false });
    surface.addEventListener("pointerup", (event) => finish(event));
    surface.addEventListener("pointercancel", (event) => finish(event, true));
    surface.addEventListener("lostpointercapture", (event) => {
      if (event.target === surface) finish(event, true);
    });
    surface.addEventListener("click", (event) => {
      if (blockClick) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  // public/app.js
  init_music_feedback();
  init_music_shell();

  // public/video-logic.js
  var DAY = 864e5;
  var unique2 = (values) => [...new Set(values.filter((v) => v !== null && v !== void 0 && v !== ""))];
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
    const audio2 = unique2(items.flatMap((i) => (i.streams || []).filter((s) => s.type === "audio").map((s) => String(s.language || "").toLowerCase()))).filter((a) => !["und", "zxx"].includes(a));
    const subs = items.some((i) => {
      var _a2;
      return ((_a2 = i.subtitles) == null ? void 0 : _a2.length) || (i.streams || []).some((s) => s.type === "subtitle");
    });
    const height = Math.max(0, ...items.map((i) => Math.max(0, ...(i.streams || []).filter((s) => s.type === "video").map((s) => s.height || 0))));
    const badges = [];
    if (anime && audio2.some((a) => !isItalian(a) && a !== "und") && subs) badges.push("SUB");
    if (anime && audio2.some(isItalian)) badges.push("DOPPIATO");
    if (height >= 2e3) badges.push("4K");
    else if (height >= 700) badges.push("HD");
    return badges;
  }
  function buildTitles(items, progress = {}) {
    return groupVideos(items, progress).map((group) => {
      var _a2, _b2;
      const all = group.episodes || [group.item];
      const kind = group.root === "Anime" ? "anime" : group.episodes ? "series" : "film";
      const key = group.episodes ? `s:${group.root}/${group.title}` : `f:${group.item.id}`;
      const art2 = [...all].sort((a, b) => artQuality(b) - artQuality(a))[0];
      const added = Math.max(0, ...all.map((i) => i.added || i.mtime || 0));
      const firstAdded = Math.min(...all.map((i) => i.added || i.mtime || 0));
      const years = all.map((i) => i.year).filter(Boolean);
      const description = group.episodes ? ((_a2 = all.find((i) => i.seriesDescription)) == null ? void 0 : _a2.seriesDescription) || "" : group.item.description || "";
      return {
        ...group,
        kind,
        key,
        art: art2,
        added,
        firstAdded,
        year: group.year || (years.length ? Math.min(...years) : null),
        genres: unique2(all.flatMap((i) => i.genres || [])),
        tags: unique2(all.flatMap((i) => i.tags || [])),
        seasons: group.episodes ? unique2(all.map((i) => i.season)).sort((a, b) => a - b) : [],
        subs: all.some((i) => {
          var _a3;
          return ((_a3 = i.subtitles) == null ? void 0 : _a3.length) || (i.streams || []).some((s) => s.type === "subtitle");
        }),
        description,
        score: ((_b2 = all.find((i) => i.onlineScore)) == null ? void 0 : _b2.onlineScore) || null,
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
          var _a3, _b3;
          return ((_a3 = progress[i.id]) == null ? void 0 : _a3.position) > 0 || ((_b3 = progress[i.id]) == null ? void 0 : _b3.watched);
        })
      };
    });
  }
  var artQuality = (i) => {
    var _a2, _b2, _c;
    return i ? (i.poster || i.backdrop || i.imagePath ? 8 : 0) + (((_a2 = i.images) == null ? void 0 : _a2.backdrop) ? 4 : 0) + (((_b2 = i.images) == null ? void 0 : _b2.poster) ? 2 : 0) + (((_c = i.images) == null ? void 0 : _c.thumb) || i.image ? 1 : 0) : 0;
  };
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
  function featuredTitles(titles, count = 6, day = Math.floor(Date.now() / DAY)) {
    const first = featuredTitle(titles, day);
    if (!first) return [];
    const rest = titles.filter((t) => t.key !== first.key).sort((a, b) => Number(a.started) - Number(b.started) || hashText(`${day}${a.key}`) - hashText(`${day}${b.key}`));
    return [first, ...rest.slice(0, Math.max(0, count - 1))];
  }
  function shortPlayLabel(title, point, onSheet = false) {
    const code = title.episodes && (point == null ? void 0 : point.item) ? title.seasons.length > 1 ? `S${point.item.season} E${point.item.episode}` : `E${point.item.episode}` : "";
    if (point == null ? void 0 : point.resume) return code ? `Continua ${code}` : "Continua";
    if (onSheet) return code ? `Guarda ${code}` : "Guarda";
    return code && point.item !== title.episodes[0] ? `Riproduci ${code}` : "Riproduci";
  }
  function shortKind(t, now = Date.now()) {
    if (!t.episodes) return "Film";
    if (t.added - t.firstAdded > DAY && now - t.added < 7 * DAY) return "Nuovo episodio";
    return t.seasons.length > 1 ? quantity(t.seasons.length, "stagione", "stagioni") : quantity(t.episodes.length, "episodio", "episodi");
  }
  function genreLine(t) {
    const length = t.episodes ? quantity(t.episodes.length, "episodio", "episodi") : durationText(t.duration);
    return [t.genres.slice(0, 4).join(", ") || kindLabel(t), length].filter(Boolean).join(" \u2022 ");
  }
  function detailLine(t) {
    return [t.subs ? "Sottotitolato" : "", t.genres.slice(0, 4).join(", ") || kindLabel(t)].filter(Boolean).join(" \u2022 ");
  }
  function aboutInfo(t) {
    const items = t.episodes || [t.item].filter(Boolean);
    const names = (codes) => unique2(codes.map((c2) => String(c2 || "").toLowerCase().split(".")[0]).filter((c2) => c2 && c2 !== "und" && c2 !== "sottotitoli" && c2 !== "zxx").map((c2) => languageName(c2)));
    const audio2 = names(items.flatMap((i) => (i.streams || []).filter((s) => s.type === "audio").map((s) => s.language)));
    const subs = names(items.flatMap((i) => [...(i.streams || []).filter((s) => s.type === "subtitle").map((s) => s.language), ...(i.subtitles || []).map((s) => s.language)]));
    const duration = t.episodes ? [t.seasons.length > 1 ? quantity(t.seasons.length, "Stagione", "Stagioni") : "", quantity(t.episodes.length, "Episodio", "Episodi")].filter(Boolean).join(", ") : durationText(t.duration);
    return { description: t.description || "", duration, audio: audio2, subs };
  }
  function resumePoint(title, items, progress = {}) {
    if (!title.episodes) {
      const p = progress[title.item.id];
      return { item: title.item, position: p && !p.watched ? p.position || 0 : 0, resume: !!((p == null ? void 0 : p.position) > 0 && !p.watched) };
    }
    const ordered = title.episodes;
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
  function playLabel(title, point) {
    if (!point) return "Riproduci";
    const code = title.episodes ? ` ${episodeCode(point.item)}` : "";
    return point.resume ? `Riprendi${code}` : `Riproduci${title.episodes && point.item !== title.episodes[0] ? code : ""}`;
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
  function similarTitles(title, titles, limit = 12) {
    const genres = new Set(title.genres);
    return titles.filter((t) => t.key !== title.key).map((t) => ({ t, score: t.genres.filter((g) => genres.has(g)).length * 3 + (t.kind === title.kind ? 1 : 0) + (t.watched ? -2 : 0) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title, "it")).slice(0, limit).map((x) => x.t);
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
  function rankingScore(title, rating = {}) {
    const online = Number.isFinite(title.score) && title.score > 0 ? Math.min(10, title.score) : 5;
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
  function buildRows(titles, items, progress = {}, list2 = [], { page = "home", now = Date.now(), genre = "", ratings = {}, tv = false } = {}) {
    var _a2;
    const pool = page === "home" ? titles : titles.filter((t) => t.kind === page);
    const scoped = genre ? pool.filter((t) => t.genres.includes(genre)) : pool;
    const rows = [];
    const add = (id, title, entries, shape = "poster") => {
      if (entries.length) rows.push({ id, title, entries, shape });
    };
    const keys = new Set(scoped.map((t) => t.key));
    add("continua", "Continua a guardare", continueEntries(titles, items, progress).filter((e) => keys.has(e.title.key)), "continue");
    const listed = list2.map((l) => titles.find((t) => t.key === l.key)).filter((t) => t && keys.has(t.key));
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
    const recent = (_a2 = titles.filter((t) => t.started && keys.has(t.key)).map((t) => ({ t, at: Math.max(0, ...(t.episodes || [t.item]).map((i) => {
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
  function sortList(titles, list2, order = "aggiunti") {
    const at = new Map(list2.map((l) => [l.key, l.added]));
    const listed = list2.map((l) => titles.find((t) => t.key === l.key)).filter(Boolean);
    if (order === "titolo") return listed.sort((a, b) => a.title.localeCompare(b.title, "it"));
    if (order === "anno") return listed.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title, "it"));
    return listed.sort((a, b) => (at.get(b.key) || 0) - (at.get(a.key) || 0));
  }
  var HOME_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)|\.local$|^[^.]+$/i;
  function connectionIsSlow({ host = "", effectiveType, downlink, saveData, measuredKbps } = {}) {
    if (host && !HOME_HOST.test(host)) return true;
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
  function qualityOptions(item) {
    var _a2;
    const height = (_a2 = ((item == null ? void 0 : item.streams) || []).find((s) => s.type === "video")) == null ? void 0 : _a2.height;
    return [
      { value: "auto", label: "Automatica", sub: "Sceglie da sola in base alla connessione" },
      { value: "original", label: height ? `Originale (${height}p)` : "Originale", sub: "La migliore qualit\xE0 del file" },
      { value: "480", label: "Risparmio dati (480p)", sub: (item == null ? void 0 : item.light) ? "Consuma meno dati" : "Non ancora preparata: chiedila dalla pagina della serie", disabled: !(item == null ? void 0 : item.light) }
    ];
  }
  var mediaUrl = (item, quality) => `/media/${item.id}${quality === "480" && item.light ? "?q=480" : ""}`;

  // public/video-app.js
  init_music_shell();
  var VIDEO_PAGES = ["home", "film", "series", "anime", "novita", "cerca", "lista", "scaricati", "esplora", "account"];
  var KIND_PAGES = ["home", "film", "series", "anime"];
  var PAGE_NAMES = { home: "Home", film: "Film", series: "Serie TV", anime: "Anime" };
  var WHO_KEY = "mediateca:chi-guarda";
  var SVG2 = "http://www.w3.org/2000/svg";
  var ICONS = {
    home: "M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z",
    new: "M4 6h16v12H4zM10 9.3v5.4l4.6-2.7z",
    search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.4 15.4 20 20",
    mylist: "M6 4h12v16l-6-4-6 4z",
    plus: "M12 5v14M5 12h14",
    check: "M5 12.5l4.5 4.5L19 7.5",
    info: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 11v5.5M12 7.6h.01",
    play: "M7.5 4.8v14.4L19.5 12z",
    pause: "M7 5h3.6v14H7zM13.4 5H17v14h-3.6z",
    close: "M6 6l12 12M18 6 6 18",
    down: "M6 9.5l6 6 6-6",
    save: "M12 4v11M7 11l5 5 5-5M5 20h14",
    left: "M15 5l-7 7 7 7",
    right: "M9 5l7 7-7 7",
    back: "M15 5l-7 7 7 7",
    back10: "M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.8v3.4h3.4",
    fwd10: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 3.8v3.4h-3.4",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    morev: "M12 5h.01M12 12h.01M12 19h.01",
    sortlines: "M4 7h16M4 12h11M4 17h6",
    star: "M12 3.4l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.2l-5.4 3 1.1-6.1-4.5-4.3 6.1-.8z",
    starfill: "M12 3.4l2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 17.2l-5.4 3 1.1-6.1-4.5-4.3 6.1-.8z",
    markon: "M6 4h12v16l-6-4-6 4z",
    share: "M18 8.2a3 3 0 1 0 0-6.2 3 3 0 0 0 0 6.2zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6.2 3 3 0 0 0 0 6.2zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
    sort: "M7 4v16M7 20l-3.2-3.4M7 20l3.2-3.4M17 20V4M17 4l-3.2 3.4M17 4l3.2 3.4",
    jump: "M4 12h13M12 6l6 6-6 6",
    episodes: "M3 8h14v11H3zM7 5h14v11",
    subtitles: "M3 5h18v14H3zM6.5 12.5h4M13 12.5h4.5M6.5 15.5h7",
    speed: "M4.2 16.5A8.5 8.5 0 1 1 19.8 16.5M12 13.5l4.2-4.7M12 13.5h.01",
    fullscreen: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
    lock: "M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3M12 14v3",
    edit: "M4 20h4.2L19 9.2 14.8 5 4 15.8zM13.2 6.6l4.2 4.2",
    tv: "M3 5h18v12H3zM8.5 21h7",
    gear: "M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z",
    key: "M8 11.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM10.5 13L20 3.5M17 6.5l3 3M14.5 9.5l2.5 2.5",
    manage: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
    help: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6M12 16.6h.01",
    people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.4 3.5 5.2",
    grid: "M5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 3.5h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5zM15.5 14h3.5a1.5 1.5 0 0 1 1.5 1.5v3.5a1.5 1.5 0 0 1 -1.5 1.5h-3.5a1.5 1.5 0 0 1 -1.5 -1.5v-3.5a1.5 1.5 0 0 1 1.5 -1.5z",
    music: "M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
  };
  function vIcon(name) {
    const svg = document.createElementNS(SVG2, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", `v-icon v-icon-${name}`);
    const path = document.createElementNS(SVG2, "path");
    path.setAttribute("d", ICONS[name] || ICONS.info);
    const solid = name === "play" || name === "pause" || name === "markon" || name === "starfill";
    path.setAttribute("fill", solid ? "currentColor" : "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", name.startsWith("more") ? "3.4" : "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    if (name === "back10" || name === "fwd10") {
      const text = document.createElementNS(SVG2, "text");
      for (const [k, v] of [["x", "12"], ["y", "15.2"], ["text-anchor", "middle"], ["font-size", "7"], ["font-weight", "700"], ["fill", "currentColor"], ["stroke", "none"]]) text.setAttribute(k, v);
      text.textContent = "10";
      svg.append(text);
    }
    return svg;
  }
  var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  var pct = (share) => `${(clamp(share, 0, 1) * 100).toFixed(1)}%`;
  function createVideoApp(c2) {
    const { el: el2, $: $2, state: state2, api: api2, action: action2, notify: notify2, storage: storage2 } = c2;
    const fill = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k !== null && k !== void 0 && k !== false));
    let titles = [];
    let list2 = [];
    let listFor = null;
    let listLoading = null;
    const rowScroll = /* @__PURE__ */ new Map();
    const pageScroll = /* @__PURE__ */ new Map();
    let shown = "";
    let lastY = 0;
    let search2 = "";
    let listOrder = storage2.get("list-order", "aggiunti");
    let open = { key: null, season: null };
    let whoEditing = false;
    const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTv = () => document.documentElement.classList.contains("tv");
    const wide = () => matchMedia("(min-width: 900px)").matches;
    const profileOf = (id) => {
      var _a2;
      return (((_a2 = state2.boot) == null ? void 0 : _a2.profiles) || []).find((p) => p.id === id) || { id, name: id || "?" };
    };
    const ver = (item) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.v) || 0;
    };
    const posterSrc = (item, size = 260) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.poster) ? `/media/${item.id}/poster?s=${size}&v=${ver(item)}` : "";
    };
    const backdropSrc = (item, size = 640) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.backdrop) ? `/media/${item.id}/backdrop?s=${size}&v=${ver(item)}` : "";
    };
    const thumbSrc = (item) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.thumb) ? `/media/${item.id}/thumb?v=${ver(item)}` : backdropSrc(item, 640);
    };
    function picture(src, cls = "", eager2 = false) {
      if (!src) return null;
      const node = el2("img", { class: `v-img ${cls}`.trim(), src, alt: "", loading: eager2 ? "eager" : "lazy", decoding: "async" });
      const done = () => node.classList.add("loaded");
      if (node.complete && node.naturalWidth) done();
      else {
        node.addEventListener("load", done, { once: true });
        node.addEventListener("error", () => node.remove(), { once: true });
      }
      return node;
    }
    const logoSrc = (item) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.logo) ? `/media/${item.id}/logo?v=${item.images.lv || ver(item)}` : "";
    };
    const cardLogo = (item) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.logo) && !item.images.posterTitle && !wide() ? `/media/${item.id}/logo?s=320&v=${item.images.lv || ver(item)}` : "";
    };
    function titleHeading(t, level, cls, id) {
      const text = el2("span", { class: "t-text" }, t.title);
      const heading = el2(level, { class: cls, id }, text);
      const src = logoSrc(t.art);
      if (src) {
        const img = el2("img", { class: "v-logo", src, alt: t.title, decoding: "async" });
        img.addEventListener("error", () => {
          img.remove();
          text.hidden = false;
        }, { once: true });
        text.hidden = true;
        heading.prepend(img);
      }
      return heading;
    }
    const tinted = (node, name) => hued(node, "--hue", nameHue(name));
    const bar = (share) => hued(el2("span", { class: "c-bar", "aria-hidden": "true" }, el2("i")), "--p", pct(share));
    const listed = (key) => list2.some((entry) => entry.key === key);
    async function loadList() {
      const profile = state2.profile;
      if (!profile) {
        list2 = [];
        listFor = "";
        return;
      }
      const result = await api2(`/api/mylist?profile=${encodeURIComponent(profile)}`);
      if (profile === state2.profile) {
        list2 = result.items || [];
        listFor = profile;
      }
    }
    async function toggleList(t) {
      const profile = state2.profile;
      const on = !listed(t.key);
      const result = await api2("/api/mylist", { method: "PUT", data: { profile, key: t.key, on } });
      if (profile !== state2.profile) return;
      list2 = result.items || [];
      notify2(on ? `${t.title} \xE8 nella tua lista.` : `${t.title} tolto dalla tua lista.`);
      render();
    }
    let marking = false;
    async function saveWatched(items, watched) {
      const profile = state2.profile;
      const progress = state2.progress;
      const ids = items.map((i) => i.id);
      const before = new Map(ids.map((id) => [id, state2.progress[id]]));
      state2.progressVersion = (state2.progressVersion || 0) + 1;
      for (const id of ids) state2.progress[id] = { ...state2.progress[id], watched, ...watched ? {} : { position: 0 }, updated: Date.now() };
      render();
      try {
        const saved = await api2("/api/progress/batch", { method: "PUT", data: { ids, profile, watched, ...watched ? {} : { position: 0 } } });
        if (profile !== state2.profile || progress !== state2.progress) return;
        for (const id of ids) state2.progress[id] = saved[id];
        state2.progressVersion++;
      } catch (error) {
        if (profile !== state2.profile || progress !== state2.progress) throw error;
        for (const [id, value] of before) {
          if (value) state2.progress[id] = value;
          else delete state2.progress[id];
        }
        render();
        throw error;
      }
    }
    async function markMany(items, watched, message) {
      if (marking) return;
      marking = true;
      try {
        await saveWatched(items, watched);
        notify2(message);
      } finally {
        marking = false;
      }
      render();
    }
    const markOne = (item, watched) => markMany([item], watched, watched ? "Segnato come visto." : "Tolto dai visti.");
    const toggleWatched = (t) => {
      const watched = !t.watched;
      return markMany(t.episodes || [t.item], watched, watched ? `${t.title}: tutto segnato come visto.` : `${t.title}: tolto dai visti.`);
    };
    async function hideContinue(entry) {
      const profile = state2.profile;
      const progress = state2.progress;
      const saved = await api2("/api/progress", { method: "PUT", data: { id: entry.hideId, profile, hidden: true } });
      if (profile !== state2.profile || progress !== state2.progress) return;
      state2.progress[entry.hideId] = saved;
      notify2(`${entry.title.title} tolto da Continua a guardare.`);
      render();
    }
    function metaLine(t) {
      return el2("p", { class: "v-meta" }, ...metaParts(t).map((part) => el2("span", { class: "v-meta-part" }, part)), ...t.badges.map((b) => el2("span", { class: "v-badge" }, b)));
    }
    function playButton(t, point, { big = false, named = false, detail = "", share = 0, label: given = "" } = {}) {
      const label = given || playLabel(t, point);
      return el2(
        "button",
        { class: `v-play${big ? " big" : ""}`, "aria-label": named ? `${label}: ${t.title}` : void 0, onclick: action2(() => {
          hideHover();
          return c2.playItem(point.item);
        }) },
        vIcon("play"),
        el2("span", { class: "v-play-text" }, el2("span", {}, label), detail ? el2("small", {}, detail) : null),
        share > 0.01 ? hued(el2("span", { class: "v-play-bar", "aria-hidden": "true" }, el2("i")), "--p", pct(share)) : null
      );
    }
    function listButton(t, named = false) {
      const on = listed(t.key);
      return el2("button", { class: "v-second v-list", "aria-pressed": on, "aria-label": named ? `La mia lista: ${t.title}` : void 0, onclick: action2(() => toggleList(t)) }, vIcon(on ? "check" : "plus"), el2("span", {}, "La mia lista"));
    }
    const ratingCache = /* @__PURE__ */ new Map();
    const ratingBusy = /* @__PURE__ */ new Set();
    const ratingKey = (t) => `${state2.profile}|${t.key}`;
    const decimal = (n) => String(n).replace(".", ",");
    const countText = (n) => n > 999 ? `${decimal((n / 1e3).toFixed(1).replace(/[.]0$/, ""))}K` : String(n);
    function ratingOf(t) {
      const key = ratingKey(t);
      if (ratingCache.has(key)) return ratingCache.get(key);
      if (!state2.offline && state2.profile && !ratingBusy.has(key)) {
        ratingBusy.add(key);
        api2(`/api/ratings?key=${encodeURIComponent(t.key)}&profile=${encodeURIComponent(state2.profile)}`).then((r) => {
          ratingCache.set(key, r);
        }, () => {
          ratingCache.set(key, null);
        }).finally(() => {
          ratingBusy.delete(key);
          if (ratingKey(t) === key && $2("#title-dialog").open && open.key === t.key) paintTitle();
        });
      }
      return null;
    }
    async function vote(t, n) {
      ratingCache.set(ratingKey(t), await api2("/api/ratings", { method: "PUT", data: { profile: state2.profile, key: t.key, value: n } }));
      open.pulse = true;
      paintTitle();
      open.pulse = false;
    }
    function ratingBlock(t) {
      const r = ratingOf(t);
      if (!r) return null;
      const half = t.score ? Math.round(t.score / 2 * 10) / 10 : null;
      const level = r.count ? r.average : half;
      const shown2 = r.mine || Math.round(level || 0);
      const stars = el2("div", { class: `tp-stars${r.mine ? " mine" : ""}${open.pulse ? " pulse" : ""}`, role: "group", "aria-label": "Il tuo voto" }, ...[1, 2, 3, 4, 5].map((n) => el2("button", { class: "tp-star", "aria-label": `${n} ${n === 1 ? "stella" : "stelle"}`, "aria-pressed": String(r.mine === n), onclick: action2(() => vote(t, n)) }, vIcon(n <= shown2 ? "starfill" : "star"))));
      const label = level ? ["Valutazione media: ", el2("b", {}, decimal(Number(level).toFixed(1))), r.count ? ` (${countText(r.count)})` : ""] : ["Nessun voto"];
      const text = r.count ? el2(
        "button",
        { class: "tp-rate-text", "aria-expanded": String(!!open.ratingOpen), "aria-label": "Come hanno votato", onclick: () => {
          open.ratingOpen = !open.ratingOpen;
          paintTitle();
        } },
        ...label,
        " ",
        el2("span", { class: "tp-tri", "aria-hidden": "true" }, "\u25BE")
      ) : el2("span", { class: "tp-rate-text" }, ...label);
      const panel = r.count && open.ratingOpen ? el2(
        "div",
        { class: "tp-dist", role: "group", "aria-label": "Voti per stella" },
        ...[5, 4, 3, 2, 1].map((n) => el2(
          "div",
          { class: `tp-dist-row${r.mine === n ? " mine" : ""}` },
          el2("span", { class: "tp-dist-n" }, String(n), vIcon("starfill")),
          hued(el2("span", { class: "tp-dist-bar", "aria-hidden": "true" }, el2("i")), "--p", pct(r.counts[n - 1] / r.count)),
          el2("span", { class: "tp-dist-c" }, String(r.counts[n - 1]))
        )),
        r.mine ? el2("p", { class: "tp-mine" }, `Il tuo ultimo voto: ${r.mine} ${r.mine === 1 ? "stella" : "stelle"}.`) : null,
        t.score ? el2("p", { class: "tp-score" }, `Su AniList: ${decimal(t.score.toFixed(1))}/10`) : null
      ) : null;
      return el2("div", { class: "tp-rating" }, el2("div", { class: "tp-rate-row" }, stars, text), panel);
    }
    function bookmarkButton(t) {
      const on = listed(t.key);
      return el2("button", { class: "v-bookmark", "aria-pressed": on, "aria-label": on ? `Togli ${t.title} dalla mia lista` : `Aggiungi ${t.title} alla mia lista`, onclick: action2(() => toggleList(t)) }, vIcon(on ? "markon" : "mylist"));
    }
    async function shareTitle(t) {
      const url = location.origin + "/";
      if (navigator.share) {
        try {
          await navigator.share({ title: t.title, text: `${t.title} su Apollon`, url });
        } catch (error) {
          if ((error == null ? void 0 : error.name) !== "AbortError") notify2("Non riesco a condividere: riprova.", true);
        }
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        notify2("Link copiato.");
      } catch {
        notify2(`Copia questo link: ${url}`);
      }
    }
    function watchedButton(t) {
      return el2("button", { class: "v-second v-seen", "aria-pressed": t.watched, onclick: action2(() => toggleWatched(t)) }, vIcon("check"), el2("span", {}, t.watched ? "Visto" : "Segna visto"));
    }
    let skipInfo = { series: {} };
    let lightInfo = { count: 0, queued: 0, working: null };
    let infoTimer = 0;
    let lightBusy = false;
    const skipRow = (t) => {
      var _a2;
      return (t.kind === "anime" && t.episodes ? (_a2 = skipInfo.series) == null ? void 0 : _a2[`${t.root}/${t.title}`] : null) || null;
    };
    async function refreshInfo() {
      var _a2;
      clearTimeout(infoTimer);
      await Promise.all([api2("/api/skips").then((v) => {
        skipInfo = v;
      }), api2("/api/versions").then((v) => {
        lightInfo = v;
      })]).catch(() => {
      });
      const busy = !!(lightInfo.working || lightInfo.queued);
      const finished = lightBusy && !busy;
      lightBusy = busy;
      if (finished) await c2.reloadLibrary().catch(() => {
      });
      const t = titles.find((x) => x.key === open.key);
      if ($2("#title-dialog").open) {
        paintTitle();
        if (busy || ((_a2 = skipRow(t || {})) == null ? void 0 : _a2.preparing)) infoTimer = setTimeout(refreshInfo, 3e3);
      }
    }
    function skipLine(t) {
      const row2 = skipRow(t);
      if (!row2) return null;
      const text = row2.preparing ? `Sto preparando i salti (${row2.ready} di ${row2.total})` : row2.ready >= row2.total ? `Salti pronti per ${quantity(row2.total, "episodio", "episodi")}` : row2.ready > 0 ? `Salti pronti per ${row2.ready} episodi su ${row2.total}` : row2.total === 1 ? "Salti non disponibili per questo episodio" : "I salti si preparano da soli, non sono ancora pronti";
      const check = row2.review > 0 ? el2(
        "button",
        { class: "tp-skips-check", title: "Sigla o finale fuori dal solito: da riguardare in Gestisci", onclick: () => {
          const flagged = $2("#title-content .ep.flagged");
          if (flagged) {
            flagged.scrollIntoView({ block: "center", behavior: reduce() ? "auto" : "smooth" });
            flagged.classList.add("ping");
            setTimeout(() => flagged.classList.remove("ping"), 1400);
          }
        } },
        quantity(row2.review, "episodio da controllare", "episodi da controllare")
      ) : null;
      return el2("p", { class: `tp-skips${row2.preparing ? " busy" : ""}`, role: "status" }, el2("span", { class: "tp-skips-dot", "aria-hidden": "true" }), el2("span", { class: "tp-skips-text" }, text), check);
    }
    function lightButton(t) {
      const items = t.episodes || [t.item];
      const ready = items.every((i) => i.light);
      const working = !ready && !!(items.some((i) => (lightInfo.workingIds || [lightInfo.working]).includes(i.id)) || lightInfo.queued && lightBusy && items.some((i) => !i.light) && lightMine);
      const failed = !ready && !working && items.some((i) => (lightInfo.failed || []).includes(i.id));
      const label = ready ? "Versione leggera pronta" : working ? "Preparo la versione leggera\u2026" : failed ? "Non \xE8 riuscita: riprova" : "Prepara versione leggera";
      const short = ready ? "Leggera pronta" : working ? "Preparo\u2026" : failed ? "Riprova" : "Versione leggera";
      return el2("button", {
        class: "v-second v-light",
        "aria-pressed": ready,
        "aria-busy": working ? "true" : void 0,
        disabled: ready || working,
        "aria-label": label,
        title: "Una copia a 480p per guardare con meno dati. L\u2019originale resta com\u2019\xE8.",
        onclick: action2(() => lightRun(t))
      }, vIcon("down"), el2("span", {}, short));
    }
    async function lightRun(t) {
      const ids = (t.episodes || [t.item]).filter((i) => !i.light).map((i) => i.id).slice(0, 300);
      if (!ids.length) return;
      lightMine = true;
      lightInfo = await api2("/api/versions", { method: "POST", data: { ids } });
      lightBusy = true;
      notify2("Preparo la versione leggera, una alla volta: puoi continuare a usare Apollon.");
      refreshInfo();
    }
    let lightMine = false;
    const dl = (id) => {
      var _a2;
      return ((_a2 = c2.downloads) == null ? void 0 : _a2.state(id)) || null;
    };
    function downloadSheet(items, title) {
      const sum = (quality) => items.reduce((n, i) => n + c2.downloads.estimate(i, quality), 0);
      sheet(title, [
        { icon: "save", label: "Standard (occupa meno spazio)", sub: `Circa ${c2.fmtSize(sum("light"))} \xB7 versione leggera a 480p, la preparo io`, run: () => c2.downloads.start(items, "light") },
        { icon: "save", label: "Originale", sub: `Circa ${c2.fmtSize(sum("original"))} \xB7 la qualit\xE0 del file di casa`, run: () => c2.downloads.start(items, "original") }
      ]);
    }
    function downloadLabel(items) {
      const states = items.map((i) => dl(i.id));
      if (states.every((x) => (x == null ? void 0 : x.kind) === "done")) return { text: "Scaricato", done: true };
      const active = states.filter((x) => (x == null ? void 0 : x.kind) === "active");
      if (active.length) return { text: `Scarico\u2026 ${Math.round(100 * active.reduce((n, x) => n + x.share, 0) / active.length)}%`, busy: true };
      if (states.some((x) => (x == null ? void 0 : x.kind) === "paused")) return { text: "Riprendi il download", resume: true };
      return { text: "Scarica" };
    }
    function downloadButton(t, point) {
      const title = "Salva nella memoria di Apollon per guardarlo anche senza rete";
      if (t.episodes) {
        const items = nextToDownload(t, point);
        return el2(
          "button",
          { class: "v-second v-download", title, onclick: action2(async () => {
            if (items.length) downloadSheet(items, "Scarica i prossimi episodi");
            else c2.setPage("scaricati");
          }) },
          vIcon("save"),
          el2("span", {}, items.length ? `Scarica i prossimi ${items.length === 1 ? "episodio" : `${items.length} episodi`}` : "Episodi scaricati")
        );
      }
      const state3 = downloadLabel([t.item]);
      return el2(
        "button",
        {
          class: "v-second v-download",
          "aria-busy": state3.busy ? "true" : void 0,
          disabled: state3.busy,
          title,
          onclick: action2(async () => {
            if (state3.done) return c2.setPage("scaricati");
            if (state3.resume) return c2.downloads.start([t.item], dl(t.item.id).quality);
            downloadSheet([t.item], `Scarica \xAB${t.title}\xBB`);
          })
        },
        vIcon(state3.done ? "check" : "save"),
        el2("span", {}, state3.text)
      );
    }
    const nextToDownload = (t, point) => {
      const from = Math.max(0, t.episodes.findIndex((i) => i.id === point.item.id));
      return t.episodes.slice(from).filter((i) => {
        var _a2;
        return !((_a2 = state2.progress[i.id]) == null ? void 0 : _a2.watched) && !dl(i.id);
      }).slice(0, 3);
    };
    function episodeDownload(item) {
      const state3 = downloadLabel([item]);
      return el2(
        "button",
        {
          class: "ep-save",
          "aria-pressed": !!state3.done,
          "aria-busy": state3.busy ? "true" : void 0,
          disabled: state3.busy,
          "aria-label": `${state3.text}: episodio ${item.episode}`,
          title: state3.text,
          onclick: action2(async () => {
            if (state3.done) return c2.setPage("scaricati");
            if (state3.resume) return c2.downloads.start([item], dl(item.id).quality);
            downloadSheet([item], `Scarica l\u2019episodio ${item.episode}`);
          })
        },
        el2("span", { class: "ep-save-pct", "aria-hidden": "true" }, state3.done ? "\u2713" : state3.busy ? `${Math.round(100 * dl(item.id).share)}%` : "\u2193")
      );
    }
    function restartButton(t) {
      const first = t.episodes ? t.episodes[0] : t.item;
      return el2("button", { class: "v-second v-restart", "aria-label": "Ricomincia dall\u2019inizio", title: "Ricomincia dall\u2019inizio", onclick: action2(() => {
        hideHover();
        return c2.playItem(first, false, { fromStart: true });
      }) }, vIcon("back10"), el2("span", {}, "Ricomincia"));
    }
    function sheet(title, entries) {
      $2("#video-sheet-title").textContent = title;
      $2("#video-sheet-body").replaceChildren(...entries.map((x) => el2(
        "button",
        { class: "sheet-item", "aria-pressed": x.pressed, onclick: action2(async () => {
          $2("#video-sheet").close();
          await x.run();
        }) },
        x.node || el2("span", { class: "sheet-mark" }, vIcon(x.icon || "info")),
        el2("span", { class: "sheet-copy" }, el2("strong", {}, x.label), x.sub ? el2("small", {}, x.sub) : null),
        x.toggle ? el2("span", { class: "sheet-switch", "aria-hidden": "true" }, el2("i")) : null
      )));
      c2.showDialog("#video-sheet");
    }
    const face = (p, cls = "face") => tinted(el2("span", { class: `${cls}${p.avatar ? " photo-face" : ""}`, "aria-hidden": "true" }, profileVisual(el2, p)), p.name);
    async function changeAvatar(me) {
      const dialog = $2("#video-sheet");
      const body = $2("#video-sheet-body");
      $2("#video-sheet-title").textContent = "Cambia immagine";
      let saving = false;
      const save2 = async (avatar2) => {
        if (saving) return;
        saving = true;
        body.querySelectorAll("button").forEach((b) => {
          b.disabled = true;
        });
        try {
          const updated = await api2("/api/profiles/avatar", { method: "PUT", data: { id: me.id, avatar: avatar2 } });
          Object.assign(me, updated);
          dialog.close();
          render();
          notify2("Immagine del profilo aggiornata.");
        } catch (error) {
          notify2(error.message, true);
        } finally {
          saving = false;
          body.querySelectorAll("button").forEach((b) => {
            b.disabled = false;
          });
        }
      };
      const initial = el2("button", { class: "sheet-item", "aria-pressed": !me.avatar, onclick: () => save2(null) }, face({ name: me.name }, "face"), el2("strong", {}, "Usa l\u2019iniziale"));
      const status = el2("p", { class: "avatar-status", role: "status" }, "Caricamento delle immagini\u2026");
      const grid = el2("div", { class: "avatar-choices", "aria-label": "Immagini del profilo" });
      body.replaceChildren(initial, status, grid);
      c2.showDialog("#video-sheet");
      try {
        const choices = await api2("/api/avatar-choices");
        if (!grid.isConnected) return;
        status.textContent = choices.length ? "Scegli il tuo personaggio." : "Nessuna immagine disponibile. Aggiungi anime con copertine online alla raccolta.";
        grid.replaceChildren(...choices.map((choice) => el2(
          "button",
          { class: "avatar-choice", "aria-label": choice.name, "aria-pressed": me.avatar === choice.url, onclick: () => save2(choice.url) },
          el2("span", { class: "avatar-choice-face" }, profileVisual(el2, { name: choice.name, avatar: choice.url })),
          el2("span", { class: "avatar-choice-name" }, choice.name)
        )));
      } catch {
        if (status.isConnected) status.textContent = "Immagini non disponibili. Riprova pi\xF9 tardi.";
      }
    }
    function billboard(page) {
      const pool = titles.filter((t2) => (page === "home" || t2.kind === page) && (!state2.genre || t2.genres.includes(state2.genre)));
      if (!wide()) return billboardPhone(page, pool);
      const t = featuredTitle(pool, Math.floor(Date.now() / 864e5) + KIND_PAGES.indexOf(page) * 7);
      if (!t) return null;
      const point = resumePoint(t, state2.items, state2.progress);
      const wideSrc = backdropSrc(t.art, 1280);
      const tallSrc = posterSrc(t.art, 800);
      const image = picture(tallSrc || wideSrc, "bb-image", true);
      const art2 = el2("picture", { class: "bb-picture" }, wideSrc ? el2("source", { media: "(min-width: 900px)", srcset: wideSrc }) : null, image);
      const ambient = el2("div", { class: "bb-ambient", "aria-hidden": "true" }, picture(posterSrc(t.art, 260), "", true));
      return el2(
        "section",
        { class: "billboard", "data-key": t.key, "aria-label": `In evidenza: ${t.title}` },
        ambient,
        tinted(el2(
          "div",
          { class: "bb-frame" },
          art2,
          el2("div", { class: "bb-shade" }),
          el2(
            "div",
            { class: "bb-copy" },
            el2("p", { class: "bb-kind" }, kindLabel(t)),
            titleHeading(t, "h1", "bb-title"),
            el2("p", { class: "bb-genres" }, t.genres.slice(0, 3).join(" \u2022 ")),
            metaLine(t),
            t.description ? el2("p", { class: "bb-desc" }, t.description) : null,
            el2("div", { class: "bb-actions" }, playButton(t, point, { big: true }), listButton(t), el2("button", { class: "v-second v-info", onclick: () => openTitle(t.key) }, vIcon("info"), el2("span", {}, "Info")))
          )
        ), t.title)
      );
    }
    let hero2 = { key: "", index: 0, manual: false };
    function billboardPhone(page, pool) {
      const day = Math.floor(Date.now() / 864e5) + KIND_PAGES.indexOf(page) * 7;
      const chosen = featuredTitles(pool, 6, day);
      if (!chosen.length) return null;
      const key = `${page}|${state2.genre}|${day}|${chosen.map((t) => t.key).join()}`;
      if (hero2.key !== key) hero2 = { key, index: 0, manual: false };
      const slides = chosen.map((t, n) => {
        const point = resumePoint(t, state2.items, state2.progress);
        const image = picture(posterSrc(t.art, 800) || backdropSrc(t.art, 1280), "bb-image", n === 0);
        return el2(
          "div",
          { class: "bb-slide", "data-key": t.key, role: "group", "aria-label": `In evidenza ${n + 1} di ${chosen.length}: ${t.title}` },
          tinted(el2(
            "div",
            { class: "bb-frame" },
            el2("picture", { class: "bb-picture" }, image),
            el2("div", { class: "bb-shade" }),
            el2("button", { class: "bb-open", "aria-label": `Apri la scheda: ${t.title}`, onclick: () => openTitle(t.key) }),
            el2(
              "div",
              { class: "bb-copy" },
              titleHeading(t, n === 0 ? "h1" : "h2", "bb-title"),
              el2("p", { class: "bb-meta" }, genreLine(t)),
              t.description ? el2("p", { class: "bb-desc" }, t.description) : null,
              el2("div", { class: "bb-actions" }, playButton(t, point, { big: true, label: shortPlayLabel(t, point) }), bookmarkButton(t))
            )
          ), t.title)
        );
      });
      const track = el2("div", { class: "bb-track" }, ...slides);
      const dots = el2("div", { class: `bb-dots${hero2.manual ? " manual" : ""}` }, ...chosen.map((t, n) => el2("button", {
        class: "bb-dot",
        "aria-label": `Mostra ${t.title}`,
        "aria-current": n === hero2.index ? "true" : void 0,
        onclick: () => {
          stop();
          go(n);
        }
      }, el2("i"))));
      const mark = (n) => {
        hero2.index = n;
        [...dots.children].forEach((d, i) => {
          d.classList.toggle("on", i === n);
          if (i === n) d.setAttribute("aria-current", "true");
          else d.removeAttribute("aria-current");
        });
      };
      const go = (n) => track.scrollTo({ left: n * track.clientWidth, behavior: reduce() ? "auto" : "smooth" });
      const stop = () => {
        hero2.manual = true;
        dots.classList.add("manual");
      };
      track.addEventListener("scroll", () => {
        const n = Math.round(track.scrollLeft / (track.clientWidth || 1));
        if (n !== hero2.index && n >= 0 && n < chosen.length) mark(n);
      }, { passive: true });
      for (const type of ["touchstart", "wheel"]) track.addEventListener(type, stop, { passive: true });
      dots.addEventListener("animationend", (event) => {
        if (!hero2.manual && event.target.matches("i") && track.isConnected) go((hero2.index + 1) % chosen.length);
      });
      mark(hero2.index);
      requestAnimationFrame(() => {
        if (hero2.index) track.scrollLeft = hero2.index * track.clientWidth;
      });
      return el2("section", { class: "billboard bb-phone", "aria-roledescription": "carosello", "aria-label": "In evidenza" }, track, dots);
    }
    function posterCard(t, rowId = "griglia", fresh = false) {
      const mark = cardLogo(t.art);
      const art2 = tinted(el2(
        "span",
        { class: mark ? "t-art has-logo" : "t-art" },
        picture(posterSrc(t.art, 260)),
        mark ? el2("img", { class: "t-logo", src: mark, alt: "", loading: "lazy", decoding: "async", onerror: (e) => e.target.remove() }) : null,
        el2("span", { class: "t-name", "aria-hidden": "true" }, t.title),
        fresh ? el2("span", { class: "t-flag" }, "Nuovi episodi") : null,
        t.remote && t.remoteDown ? el2("span", { class: "t-remote" }, "Fisso spento") : null,
        listed(t.key) ? el2("span", { class: "t-ribbon", "aria-hidden": "true" }, vIcon("markon")) : null,
        t.watched ? el2("span", { class: "t-seen", "aria-hidden": "true" }, vIcon("check")) : null
      ), t.title);
      const button = el2("button", { class: `t-card${t.remoteDown ? " t-off" : ""}`, "data-key": t.key, "data-fk": `${rowId}|${t.key}`, "aria-label": `Apri ${t.title}`, onclick: () => openTitle(t.key, button) }, art2);
      hoverable(button, t);
      if (wide()) return button;
      return el2(
        "div",
        { class: "t-cell" },
        button,
        el2("span", { class: "t-title" }, t.title),
        el2(
          "span",
          { class: "t-sub" },
          el2("span", { class: "t-kind" }, shortKind(t)),
          el2("button", { class: "t-more", "aria-label": `Altro per ${t.title}`, onclick: () => titleMenu(t) }, vIcon("morev"))
        )
      );
    }
    function titleMenu(t, point = null) {
      const on = listed(t.key);
      const first = t.episodes ? t.episodes[0] : t.item;
      sheet(t.title, [
        ...point ? [] : [{ icon: "info", label: "Apri la scheda", sub: t.episodes ? "Episodi e dettagli" : "Dettagli del film", run: () => openTitle(t.key) }],
        { icon: on ? "check" : "plus", label: on ? "Togli dalla mia lista" : "Aggiungi alla mia lista", run: () => toggleList(t) },
        { icon: "check", label: t.watched ? "Togli dai visti" : "Segna visto", run: () => toggleWatched(t) },
        ...point && (point.resume || t.started) ? [{ icon: "back10", label: "Ricomincia dall\u2019inizio", run: () => c2.playItem(first, false, { fromStart: true }) }] : [],
        ...point && c2.downloads ? [{ icon: "save", label: "Scarica sul telefono", sub: "Per guardarlo anche senza rete", run: () => downloadRun(t, point) }] : [],
        ...point ? [{ icon: "down", label: "Prepara la versione leggera", sub: "Una copia a 480p per guardare con meno dati", run: () => lightRun(t) }] : []
      ]);
    }
    async function downloadRun(t, point) {
      if (t.episodes) {
        const items = nextToDownload(t, point);
        if (items.length) downloadSheet(items, "Scarica i prossimi episodi");
        else c2.setPage("scaricati");
        return;
      }
      const status = downloadLabel([t.item]);
      if (status.done) return c2.setPage("scaricati");
      if (status.resume) return c2.downloads.start([t.item], dl(t.item.id).quality);
      if (!status.busy) downloadSheet([t.item], `Scarica \xAB${t.title}\xBB`);
    }
    function continueCard(entry, rowId) {
      const t = entry.title;
      const share = entry.duration ? entry.position / entry.duration : 0;
      const code = t.episodes ? episodeCode(entry.item) : "";
      const sub = [code, entry.next ? "Prossimo episodio" : remainingText(entry.position, entry.duration)].filter(Boolean).join(" \xB7 ");
      const opener = el2(
        "button",
        { class: "c-open", "data-fk": `${rowId}|${t.key}`, "aria-label": `Riprendi ${t.title}${code ? ` ${code}` : ""}`, onclick: action2(() => c2.playItem(entry.item)) },
        tinted(el2("span", { class: "c-art" }, picture(thumbSrc(entry.item)), el2("span", { class: "c-play", "aria-hidden": "true" }, vIcon("play")), entry.next ? null : bar(share)), t.title)
      );
      const more = el2("button", { class: "c-more", "aria-label": `Altro per ${t.title}`, onclick: () => continueMenu(entry) }, vIcon("more"));
      return el2("div", { class: "c-card" }, opener, el2("div", { class: "c-info" }, el2("span", { class: "c-text" }, el2("strong", {}, t.title), el2("small", {}, sub)), more));
    }
    function freshCard(t, rowId) {
      const latest = [...t.episodes].sort((a, b) => (b.added || 0) - (a.added || 0) || b.episode - a.episode)[0];
      const code = t.kind === "anime" ? `E${latest.episode}` : episodeCode(latest);
      const p = state2.progress[latest.id];
      const share = (p == null ? void 0 : p.watched) ? 1 : (p == null ? void 0 : p.position) && (p.duration || latest.duration) ? p.position / (p.duration || latest.duration) : 0;
      const opener = el2(
        "button",
        { class: "c-open", "data-fk": `${rowId}|${t.key}`, "aria-label": `Guarda ${t.title} ${code}`, onclick: action2(() => c2.playItem(latest)) },
        tinted(el2("span", { class: "c-art" }, picture(thumbSrc(latest)), el2("span", { class: "c-play", "aria-hidden": "true" }, vIcon("play")), el2("span", { class: "c-new", "aria-hidden": "true" }, "Nuovo"), share ? bar(share) : null), t.title)
      );
      const more = el2("button", { class: "c-more", "aria-label": `Apri ${t.title}`, onclick: (event) => {
        var _a2;
        return openTitle(t.key, (_a2 = event.currentTarget.closest(".c-card")) == null ? void 0 : _a2.querySelector(".c-art"));
      } }, vIcon("info"));
      return el2("div", { class: "c-card" }, opener, el2("div", { class: "c-info" }, el2("span", { class: "c-text" }, el2("strong", {}, t.title), el2("small", {}, `${code} \xB7 nuovo`)), more));
    }
    function continueMenu(entry) {
      const t = entry.title;
      sheet(t.title, [
        { icon: "info", label: "Apri la scheda", sub: t.episodes ? "Episodi e dettagli" : "Dettagli del film", run: () => openTitle(t.key) },
        { icon: "close", label: "Togli dalla riga", sub: "Il punto di ripresa resta salvato", run: () => hideContinue(entry) },
        { icon: "check", label: "Segna visto", sub: t.episodes ? `${episodeCode(entry.item)} ${entry.item.title}` : "Il film passa fra i gi\xE0 visti", run: () => markOne(entry.item, true) }
      ]);
    }
    function slide(track, direction) {
      track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reduce() ? "auto" : "smooth" });
    }
    function edges(wrap, track) {
      wrap.classList.toggle("at-start", track.scrollLeft < 8);
      wrap.classList.toggle("at-end", track.scrollLeft + track.clientWidth > track.scrollWidth - 8);
    }
    function row(r, page) {
      const memory = `${page}|${state2.genre}|${r.id}`;
      const track = el2(
        "div",
        { class: `v-track ${r.shape === "fresh" ? "continue fresh" : r.shape}`, "data-memory": memory },
        ...r.shape === "continue" ? r.entries.map((e) => continueCard(e, r.id)) : r.shape === "fresh" ? r.entries.map((t) => freshCard(t, r.id)) : r.entries.map((t) => posterCard(t, r.id, false))
      );
      const wrap = el2(
        "div",
        { class: "v-track-wrap at-start" },
        el2("button", { class: "row-arrow prev", tabindex: "-1", "aria-label": `Indietro in ${r.title}`, onclick: () => slide(track, -1) }, vIcon("left")),
        track,
        el2("button", { class: "row-arrow next", tabindex: "-1", "aria-label": `Avanti in ${r.title}`, onclick: () => slide(track, 1) }, vIcon("right"))
      );
      track.addEventListener("scroll", () => {
        rowScroll.set(memory, track.scrollLeft);
        edges(wrap, track);
        if (hoverNode) hideHover();
      }, { passive: true });
      const heading = r.id === "recenti" && !wide() ? el2("button", { class: "row-link", onclick: () => c2.setPage("novita") }, el2("span", {}, "Novit\xE0"), vIcon("right")) : r.title;
      return el2("section", { class: `v-row row-${r.shape}`, "data-row": r.id }, el2("h2", { class: "v-row-title" }, heading), wrap);
    }
    function kindHeader(page) {
      return el2(
        "div",
        { class: "kind-head" },
        el2("h1", {}, PAGE_NAMES[page] || "Home"),
        el2("button", { class: "genre-pick", "aria-haspopup": "dialog", "aria-label": state2.genre ? `Genere: ${state2.genre}. Cambia genere` : "Scegli un genere", onclick: genreSheet }, el2("span", {}, state2.genre || "Generi"), vIcon("down")),
        state2.genre ? el2("button", { class: "genre-clear", "aria-label": "Tutti i generi", onclick: () => pickGenre("") }, vIcon("close")) : null
      );
    }
    function browseView(page) {
      var _a2;
      if (!titles.length) return [emptyLibrary()];
      const rows = buildRows(titles, state2.items, state2.progress, list2, { page, genre: state2.genre });
      const freshAt = rows.findIndex((r) => r.id === "nuovi-episodi");
      if (freshAt >= 0) {
        const [r] = rows.splice(freshAt, 1);
        r.shape = "fresh";
        rows.splice(page === "anime" ? 0 : ((_a2 = rows[0]) == null ? void 0 : _a2.id) === "continua" ? 1 : 0, 0, r);
      }
      const hero3 = billboard(page);
      if (!hero3 && !rows.length) return [emptyPage(page)];
      return [page !== "home" || state2.genre ? kindHeader(page) : null, hero3, el2("div", { class: "v-rows" }, ...rows.map((r) => row(r, page)))].filter(Boolean);
    }
    function emptyPage(page) {
      if (state2.genre) return el2(
        "div",
        { class: "v-empty" },
        el2("h1", {}, "Nessun titolo in questo genere"),
        el2("p", {}, `In questa pagina non c\u2019\xE8 nulla del genere \xAB${state2.genre}\xBB.`),
        el2("button", { class: "v-play", onclick: () => pickGenre("") }, el2("span", {}, "Mostra tutti i generi"))
      );
      const how = {
        film: ["Non ci sono ancora film", "I film arrivano mettendoli nella cartella Film del server. Appaiono qui da soli entro un paio di minuti."],
        series: ["Non ci sono ancora serie TV", "Le serie TV arrivano mettendo una cartella per ogni serie dentro la cartella Serie del server. Appaiono qui da sole entro un paio di minuti."],
        anime: ["Non ci sono ancora anime", "Gli anime arrivano mettendoli nella cartella Anime del server. Appaiono qui da soli entro un paio di minuti."]
      }[page] || ["Non c\u2019\xE8 ancora niente qui", "I titoli appaiono da soli entro un paio di minuti da quando li metti sul server."];
      return el2("div", { class: "v-empty" }, el2("h1", {}, how[0]), el2("p", {}, how[1]), el2("button", { class: "v-play", onclick: () => c2.setPage("home") }, el2("span", {}, "Torna alla Home")));
    }
    function emptyLibrary() {
      return el2(
        "div",
        { class: "v-empty" },
        el2("h1", {}, "Qui comincia la tua raccolta"),
        el2("p", {}, "Aggiungi film o episodi da Gestisci, poi aggiorna la raccolta."),
        el2("button", { class: "v-play", onclick: () => c2.setPage("manage") }, el2("span", {}, "Apri Gestisci"))
      );
    }
    function genreTilesFor(pool, pick) {
      const used = /* @__PURE__ */ new Set();
      const drawn = (t) => {
        var _a2, _b2;
        return !!((_b2 = (_a2 = t.art) == null ? void 0 : _a2.images) == null ? void 0 : _b2.cv);
      };
      return el2("div", { class: "genre-tiles" }, ...genreCounts(pool).map((g) => {
        const fits = pool.filter((t) => {
          var _a2, _b2;
          return t.genres.includes(g.name) && ((_b2 = (_a2 = t.art) == null ? void 0 : _a2.images) == null ? void 0 : _b2.backdrop) && !t.remoteDown;
        });
        const sample = fits.find((t) => drawn(t) && !used.has(t.key)) || fits.find((t) => drawn(t)) || fits.find((t) => !used.has(t.key)) || fits[0];
        if (sample) used.add(sample.key);
        return tinted(el2("button", { class: "genre-tile", onclick: () => pick(g.name) }, picture(sample ? backdropSrc(sample.art, 640) : ""), el2("span", {}, g.name), el2("small", {}, quantity(g.count, "titolo", "titoli"))), g.name);
      }));
    }
    const ex = { tab: "all", genre: "", order: "recenti" };
    const EX_ORDERS = [["recenti", "Aggiunti di recente"], ["titolo", "Titolo A\u2013Z"], ["anno", "Anno"]];
    function exploreList() {
      let pool = ex.tab === "all" ? titles : titles.filter((t) => t.kind === ex.tab);
      if (ex.genre) pool = pool.filter((t) => t.genres.includes(ex.genre));
      const byTitle = (a, b) => a.title.localeCompare(b.title, "it");
      return [...pool].sort({ recenti: (a, b) => b.added - a.added || byTitle(a, b), titolo: byTitle, anno: (a, b) => (b.year || 0) - (a.year || 0) || byTitle(a, b) }[ex.order]);
    }
    function esploraView() {
      const tabs = [["all", "Tutti i titoli"], ["anime", "Anime"], ["film", "Film"], ["series", "Serie TV"], ...genreCounts(titles).length ? [["generi", "Generi"]] : []];
      if (!tabs.some(([id]) => id === ex.tab)) ex.tab = "all";
      const go = (tab, genre = "") => {
        ex.tab = tab;
        ex.genre = genre;
        render();
      };
      const orderName = EX_ORDERS.find(([id]) => id === ex.order)[1];
      const head = el2("header", { class: "page-head ex-head" }, el2("h1", {}, "Esplora"));
      const row2 = el2("div", { class: "ex-tabs", role: "tablist", "aria-label": "Cosa esplorare" }, ...tabs.map(([id, name]) => el2("button", { class: "ex-tab", role: "tab", "aria-selected": String(ex.tab === id), onclick: () => go(id) }, name)));
      if (ex.tab === "generi") return [head, row2, el2("section", { class: "search-block ex-genres" }, genreTilesFor(titles, (name) => go("all", name)))];
      const shown2 = exploreList();
      return [
        head,
        row2,
        el2(
          "div",
          { class: "ex-sort" },
          el2("h2", { class: "ex-sort-name" }, orderName),
          ex.genre ? el2("button", { class: "v-chip ex-chip", "aria-label": `Togli il genere ${ex.genre}`, onclick: () => go(ex.tab) }, ex.genre, vIcon("close")) : null,
          el2("button", { class: "ex-sort-btn", "aria-label": "Ordina i titoli", "aria-haspopup": "dialog", onclick: () => sheet("Ordina", EX_ORDERS.map(([id, name]) => ({ icon: ex.order === id ? "check" : "sort", label: name, pressed: ex.order === id, run: () => {
            ex.order = id;
            render();
          } }))) }, vIcon("sortlines"))
        ),
        shown2.length ? el2("div", { class: "ex-grid" }, ...shown2.map((t) => posterCard(t, "esplora"))) : el2("p", { class: "muted ex-none" }, "Nessun titolo qui.")
      ];
    }
    const QUALITY_NAMES = { auto: "Automatica", original: "Originale", 480: "Risparmio dati" };
    function accountView() {
      const me = profileOf(state2.profile);
      const cover = titles.length ? featuredTitle(titles, Math.floor(Date.now() / 864e5) + 3) : null;
      const subsOn = storage2.get(`video-subs:${state2.profile}`, null) !== "off";
      const quality = c2.qualityPreference();
      const link = (label, { value = "", icon = "", run, cls = "" }) => el2(
        "button",
        { class: `ac-row ${cls}`.trim(), onclick: action2(async () => {
          await run();
        }) },
        icon ? el2("span", { class: "ac-icon", "aria-hidden": "true" }, vIcon(icon)) : null,
        el2("span", { class: "ac-label" }, label),
        value ? el2("span", { class: "ac-value" }, value) : null,
        vIcon("right")
      );
      const toggle = (label, on, run) => el2(
        "button",
        { class: "ac-row", role: "switch", "aria-checked": String(on), onclick: action2(async () => {
          await run();
          render();
        }) },
        el2("span", { class: "ac-label" }, label),
        el2("span", { class: "ac-switch", "aria-hidden": "true" }, el2("i"))
      );
      return [el2(
        "section",
        { class: "account" },
        el2(
          "div",
          { class: "ac-hero" },
          tinted(el2("div", { class: "ac-cover", "aria-hidden": "true" }, picture(cover ? backdropSrc(cover.art, 1280) || posterSrc(cover.art, 800) : "", "", true)), me.name),
          el2(
            "div",
            { class: "ac-id" },
            el2(
              "div",
              { class: "ac-avatar" },
              face(me, "ac-face"),
              el2("button", { class: "ac-edit", "aria-label": `Cambia il nome di ${me.name}`, onclick: action2(() => renameProfile(me)) }, vIcon("edit"))
            ),
            el2("h1", { class: "ac-name" }, me.name)
          )
        ),
        el2(
          "div",
          { class: "ac-list" },
          link("Cambia immagine", { run: () => changeAvatar(me) }),
          link("Cambia profilo", { run: askWho }),
          toggle("Salta da solo sigle e riassunti", videoPref("autoSkip"), () => setVideoPref("autoSkip")),
          el2("h2", { class: "ac-group" }, "Riproduzione"),
          link("Qualit\xE0 video", { value: QUALITY_NAMES[quality] || "Automatica", run: () => sheet("Qualit\xE0 video", [
            { icon: "speed", label: "Automatica", sub: "Sceglie da sola in base alla connessione", pressed: quality === "auto", run: () => c2.switchQuality("auto").then(render) },
            { icon: "tv", label: "Originale", sub: "La migliore qualit\xE0 del file", pressed: quality === "original", run: () => c2.switchQuality("original").then(render) },
            { icon: "save", label: "Risparmio dati (480p)", sub: "Dove la versione leggera \xE8 pronta; altrimenti resta l\u2019originale", pressed: quality === "480", run: () => c2.switchQuality("480").then(render) }
          ]) }),
          toggle("Sottotitoli", subsOn, async () => {
            storage2.set(`video-subs:${state2.profile}`, subsOn ? "off" : null);
            notify2(`Sottotitoli: ${subsOn ? "spenti" : "accesi, come l\u2019ultima volta"}.`);
          }),
          el2("h2", { class: "ac-group" }, "Altro"),
          link("Vai alla musica", { icon: "music", cls: "ac-music", run: () => c2.setPage("music") }),
          link("Guida", { run: () => $2("#help-open").click() }),
          el2("h2", { class: "ac-group" }, "Impostazioni"),
          link("Gestisci la raccolta", { icon: "key", run: () => c2.setPage("manage") }),
          el2("p", { class: "ac-count" }, libraryCount(titles))
        )
      )];
    }
    function libraryCount(list3) {
      const films = list3.filter((t) => !t.episodes).length;
      const shows = list3.filter((t) => t.episodes);
      const eps = shows.reduce((n, t) => n + t.episodes.length, 0);
      const fmt = (n) => n.toLocaleString("it-IT");
      return `Nella raccolta: ${fmt(films)} film e ${fmt(eps)} ${eps === 1 ? "episodio" : "episodi"} di ${fmt(shows.length)} serie.`;
    }
    function genreSheet() {
      const page = KIND_PAGES.includes(state2.page) ? state2.page : "home";
      const pool = page === "home" ? titles : titles.filter((t) => t.kind === page);
      sheet(page === "home" ? "Generi" : `Generi \xB7 ${PAGE_NAMES[page]}`, [
        { icon: "grid", label: "Tutti i generi", sub: quantity(pool.length, "titolo", "titoli"), pressed: !state2.genre, run: () => pickGenre("") },
        ...genreCounts(pool).map((g) => ({ node: tinted(el2("span", { class: "sheet-dot", "aria-hidden": "true" }), g.name), label: g.name, sub: quantity(g.count, "titolo", "titoli"), pressed: state2.genre === g.name, run: () => pickGenre(g.name) }))
      ]);
    }
    function pickGenre(genre) {
      if (!KIND_PAGES.includes(state2.page)) c2.setPage("home");
      state2.genre = genre;
      render();
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    function novitaView() {
      const groups = novitaGroups(titles);
      if (!groups.length) return [el2("header", { class: "page-head" }, el2("h1", {}, "Novit\xE0")), emptyLibrary()];
      return [
        el2("header", { class: "page-head" }, el2("h1", {}, "Novit\xE0"), el2("p", { class: "muted" }, "Gli ultimi arrivi nella raccolta di casa.")),
        ...groups.map((g) => el2("section", { class: "nv-group" }, el2("h2", { class: "v-row-title" }, g.label), el2("div", { class: "nv-list" }, ...g.entries.map(newsCard))))
      ];
    }
    function newsCard({ title: t, note, item }) {
      const day = new Date(t.added);
      const point = resumePoint(t, state2.items, state2.progress);
      const description = t.description || item.description || "";
      return el2(
        "article",
        { class: "nv-card" },
        el2("div", { class: "nv-date", "aria-hidden": "true" }, el2("span", {}, day.toLocaleDateString("it-IT", { month: "short" }).replace(".", "")), el2("strong", {}, String(day.getDate()))),
        el2(
          "div",
          { class: "nv-body" },
          el2(
            "button",
            { class: "nv-art", "data-fk": `novita|${t.key}`, "aria-label": `Apri ${t.title}`, onclick: (event) => openTitle(t.key, event.currentTarget.querySelector(".nv-frame")) },
            tinted(el2("span", { class: "nv-frame" }, picture(backdropSrc(t.art, wide() ? 1280 : 640)), el2("span", { class: "nv-note" }, note)), t.title)
          ),
          el2("div", { class: "nv-head" }, el2("h3", {}, t.title), el2("div", { class: "nv-actions" }, playButton(t, point, { named: true }), listButton(t, true))),
          metaLine(t),
          description ? el2("p", { class: "nv-desc" }, description) : null
        )
      );
    }
    const recentKey = () => `video-recent:${state2.profile}`;
    function remember2(query) {
      const q = query.trim();
      if (!q) return;
      storage2.set(recentKey(), [q, ...storage2.get(recentKey(), []).filter((x) => x.toLocaleLowerCase("it") !== q.toLocaleLowerCase("it"))].slice(0, 8));
    }
    function setSearch(value) {
      search2 = value;
      const input = $2("#video-view .search-input");
      if (input) input.value = value;
      paintResults();
    }
    function searchView() {
      const input = el2("input", { class: "search-input", type: "search", placeholder: "Titoli, generi, anni", "aria-label": "Cerca un titolo", autocomplete: "off", enterkeyhint: "search" });
      input.value = search2;
      input.addEventListener("input", () => {
        search2 = input.value;
        paintResults();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          remember2(input.value);
          input.blur();
        }
      });
      const results = el2("div", { class: "search-results", "aria-live": "polite" });
      results.addEventListener("click", (event) => {
        if (event.target.closest(".t-card")) remember2(search2);
      }, true);
      return [el2(
        "header",
        { class: "page-head search-head" },
        el2("h1", { class: "sr-only" }, "Cerca"),
        el2("div", { class: "search-bar" }, vIcon("search"), input, el2("button", { class: "search-clear", type: "button", "aria-label": "Svuota la ricerca", onclick: () => {
          setSearch("");
          input.focus();
        } }, vIcon("close")))
      ), results];
    }
    function paintResults() {
      var _a2;
      const box = $2("#video-view .search-results");
      if (!box) return;
      const q = search2.trim();
      (_a2 = $2("#video-view .search-bar")) == null ? void 0 : _a2.classList.toggle("filled", !!q);
      if (!q) {
        const recent = storage2.get(recentKey(), []);
        const years = [...new Set(titles.map((t) => t.year).filter(Boolean))].sort((a, b) => b - a).slice(0, 8);
        fill(
          box,
          recent.length ? el2(
            "section",
            { class: "search-block" },
            el2(
              "div",
              { class: "block-head" },
              el2("h2", { class: "v-row-title" }, "Ricerche recenti"),
              el2("button", { class: "link-button", onclick: () => {
                storage2.set(recentKey(), []);
                paintResults();
              } }, "Cancella")
            ),
            el2("div", { class: "v-chips" }, ...recent.map((r) => el2("button", { class: "v-chip", onclick: () => setSearch(r) }, vIcon("search"), r)))
          ) : null,
          el2(
            "section",
            { class: "search-block" },
            el2("h2", { class: "v-row-title" }, "Sfoglia per genere"),
            genreTilesFor(titles, setSearch)
          ),
          years.length ? el2("section", { class: "search-block" }, el2("h2", { class: "v-row-title" }, "Per anno"), el2("div", { class: "v-chips" }, ...years.map((y) => el2("button", { class: "v-chip", onclick: () => setSearch(String(y)) }, String(y))))) : null,
          // 11/11: sotto la ricerca si scorre tutto quello che c'è, dalla A alla Z.
          titles.length ? el2(
            "section",
            { class: "search-block search-all" },
            el2("h2", { class: "v-row-title" }, `Tutti i titoli \xB7 ${titles.length.toLocaleString("it-IT")}`),
            el2("div", { class: "poster-grid" }, ...titles.slice().sort((a, b) => a.title.localeCompare(b.title, "it", { numeric: true })).map((t) => posterCard(t, "cerca")))
          ) : null
        );
        return;
      }
      const found = searchTitles(titles, q);
      fill(box, found.length ? el2("section", { class: "search-block" }, el2("h2", { class: "v-row-title" }, `${quantity(found.length, "titolo", "titoli")} per \xAB${q}\xBB`), el2("div", { class: "poster-grid" }, ...found.map((t) => posterCard(t, "cerca")))) : el2("div", { class: "v-empty" }, el2("h2", {}, `Nessun titolo per \xAB${q}\xBB`), el2("p", {}, "Prova con un genere, un anno o una parola del titolo.")));
    }
    function listView() {
      const sorted = sortList(titles, list2, listOrder);
      const orders = [["aggiunti", "Aggiunti di recente"], ["titolo", "Titolo A\u2013Z"], ["anno", "Anno"]];
      return [
        el2(
          "header",
          { class: "page-head" },
          el2("h1", {}, "La mia lista"),
          el2("div", { class: "v-chips", role: "group", "aria-label": "Ordina la lista" }, ...orders.map(([id, name]) => el2("button", { class: "v-chip", "aria-pressed": listOrder === id, onclick: () => {
            listOrder = id;
            storage2.set("list-order", id);
            render();
          } }, name)))
        ),
        sorted.length ? el2("div", { class: "poster-grid list-grid" }, ...sorted.map((t) => el2(
          "div",
          { class: "list-cell" },
          posterCard(t, "lista"),
          el2("button", { class: "list-remove", "aria-label": `Togli ${t.title} dalla lista`, onclick: action2(() => toggleList(t)) }, vIcon("close"), el2("span", {}, "Togli"))
        ))) : el2("div", { class: "v-empty" }, el2("h2", {}, "La tua lista \xE8 vuota"), el2("p", {}, "Tocca \xABLa mia lista\xBB su un titolo per ritrovarlo qui."), el2("button", { class: "v-play", onclick: () => c2.setPage("home") }, el2("span", {}, "Scopri i titoli")))
      ];
    }
    const BLOCK = 12;
    function openTitle(key, from) {
      var _a2, _b2;
      if (!titles.some((t) => t.key === key)) return;
      hideHover();
      open = { key, season: null, block: null };
      ratingCache.delete(ratingKey({ key }));
      const show = () => {
        var _a3;
        eager = false;
        try {
          paintTitle();
        } finally {
          eager = true;
        }
        refreshInfo();
        const dialog = $2("#title-dialog");
        if (!dialog.open) {
          c2.showDialog("#title-dialog");
          pushLayer("title");
        }
        dialog.scrollTop = 0;
        (_a3 = $2(isTv() ? "#title-content .v-play" : "#title-content .tp-close")) == null ? void 0 : _a3.focus({ preventScroll: true });
      };
      const node = ((_a2 = from == null ? void 0 : from.matches) == null ? void 0 : _a2.call(from, ".t-art,.c-art,.nv-frame")) ? from : ((_b2 = from == null ? void 0 : from.querySelector) == null ? void 0 : _b2.call(from, ".t-art,.c-art,.nv-frame")) || from;
      if (node && document.startViewTransition && !reduce() && !isTv() && !$2("#title-dialog").open) {
        const root = document.documentElement;
        node.style.viewTransitionName = "title-art";
        root.classList.add("vt-open");
        const done = () => {
          node.style.viewTransitionName = "";
          root.classList.remove("vt-open");
        };
        try {
          const run = document.startViewTransition(() => {
            node.style.viewTransitionName = "";
            show();
          });
          run.ready.catch(() => {
          });
          run.updateCallbackDone.catch(() => {
          });
          run.finished.then(done, done);
        } catch {
          done();
          show();
        }
      } else show();
    }
    function paintTitle() {
      var _a2;
      const dialog = $2("#title-dialog");
      if (dialog.open && c2.activeDialog() !== dialog) return;
      const active = document.activeElement;
      const controls = () => [...dialog.querySelectorAll('button,input,select,a[href],[tabindex="0"]')];
      const key = (node) => {
        var _a3;
        return [node.id, node.getAttribute("aria-label"), node.className, (_a3 = node.closest("[data-ep]")) == null ? void 0 : _a3.dataset.ep].join("|");
      };
      const focused = dialog.open && dialog.contains(active) ? key(active) : null;
      paintTitleContent();
      if (focused && dialog.open) {
        const next = controls().find((node) => key(node) === focused && !node.disabled && node.getClientRects().length);
        (_a2 = next || dialog.querySelector(".v-play")) == null ? void 0 : _a2.focus({ preventScroll: true });
      }
    }
    function paintTitleContent() {
      var _a2, _b2;
      const dialog = $2("#title-dialog");
      const t = titles.find((x) => x.key === open.key);
      if (!t) {
        if (dialog.open) dialog.close();
        return;
      }
      const point = resumePoint(t, state2.items, state2.progress);
      const season = t.episodes ? t.seasons.includes(open.season) ? open.season : point.item.season : null;
      open.season = season;
      const saved = state2.progress[point.item.id];
      const length = (saved == null ? void 0 : saved.duration) || point.item.duration || 0;
      const resumeShare = point.resume && !point.next && length ? point.position / length : 0;
      const scroll = dialog.scrollTop;
      const phone = !wide();
      $2("#title-content").classList.toggle("phone", phone);
      if (phone) {
        fill($2("#title-content"), ...titlePhone(dialog, t, point, season));
        dialog.scrollTop = scroll;
        titleScroll();
        return;
      }
      fill(
        $2("#title-content"),
        el2(
          "div",
          { class: "tp-hero" },
          tinted(el2("div", { class: "tp-art" }, el2(
            "picture",
            {},
            ((_b2 = (_a2 = t.art) == null ? void 0 : _a2.images) == null ? void 0 : _b2.poster) ? el2("source", { media: "(max-width: 899px)", srcset: posterSrc(t.art, 800) }) : null,
            picture(backdropSrc(t.art, 1280) || posterSrc(t.art, 800), "", true)
          )), t.title),
          el2("button", { class: "tp-close", "aria-label": "Chiudi la scheda", onclick: () => dialog.close() }, vIcon("close")),
          el2("div", { class: "tp-head" }, el2("p", { class: "bb-kind" }, kindLabel(t)), el2("h2", { id: "title-name", class: "tp-title" }, t.title), metaLine(t))
        ),
        el2(
          "div",
          { class: "tp-body" },
          el2("div", { class: "tp-main" }, playButton(t, point, { big: true, detail: resumeShare ? remainingText(point.position, length) : "", share: resumeShare })),
          el2("div", { class: "tp-actions" }, listButton(t), watchedButton(t), point.resume || t.started ? restartButton(t) : null, lightButton(t), c2.downloads ? downloadButton(t, point) : null),
          ratingBlock(t),
          skipLine(t),
          t.description ? el2("p", { class: "tp-desc" }, t.description) : null,
          t.genres.length ? el2("p", { class: "tp-genres" }, ...t.genres.map((g, i) => [i ? " " : "", el2("button", { class: "tp-genre", onclick: () => goGenre(g) }, g)])) : null,
          t.episodes ? episodesBlock(t, point, season) : null,
          similarBlock(t)
        )
      );
      dialog.scrollTop = scroll;
    }
    function openAbout(t) {
      var _a2;
      const dialog = $2("#about-dialog");
      const info = aboutInfo(t);
      const section = (label, text) => text ? el2("section", { class: "ab-sec" }, el2("h3", {}, label), el2("p", {}, text)) : null;
      fill(
        $2("#about-content"),
        el2("div", { class: "ab-head" }, el2("button", { class: "ab-close", "aria-label": "Chiudi", onclick: () => dialog.close() }, vIcon("close")), el2("h2", { id: "about-title" }, t.title)),
        el2(
          "div",
          { class: "ab-body" },
          info.description ? el2("p", { class: "ab-syn" }, info.description) : null,
          section("Durata", info.duration),
          section("Audio", info.audio.join(", ")),
          section("Sottotitoli", info.subs.join(", "))
        )
      );
      c2.showDialog("#about-dialog");
      pushLayer("about");
      $2("#about-content .ab-body").scrollTop = 0;
      (_a2 = $2("#about-content .ab-close")) == null ? void 0 : _a2.focus({ preventScroll: true });
    }
    function titlePhone(dialog, t, point, season) {
      var _a2, _b2;
      const on = listed(t.key);
      const tab = t.episodes && open.tab !== "sim" ? "ep" : "sim";
      const similar = similarTitles(t, titles, 12).filter((x) => !t.genres.length || x.genres.some((g) => t.genres.includes(g)));
      const act = (icon, label, run, pressed) => el2("button", { class: "tp-act", "aria-pressed": pressed, onclick: action2(run) }, vIcon(icon), el2("span", {}, label));
      const tabButton = (id, label) => el2("button", { class: "tp-tab", role: "tab", "aria-selected": String(tab === id), onclick: () => {
        open.tab = id;
        paintTitle();
      } }, label);
      return [
        el2(
          "div",
          { class: "tp-top" },
          el2("div", { class: "tp-topbar", "aria-hidden": "true" }, logoSrc(t.art) ? el2("img", { class: "tp-topbar-logo", src: logoSrc(t.art), alt: "" }) : null, el2("span", {}, t.title)),
          el2("button", { class: "tp-close", "aria-label": "Chiudi la scheda", onclick: () => dialog.close() }, vIcon("close")),
          el2("button", { class: "tp-menu", "aria-label": "Altro su questo titolo", onclick: () => titleMenu(t, point) }, vIcon("morev"))
        ),
        el2("div", { class: "tp-hero" }, tinted(el2("div", { class: "tp-art" }, el2(
          "picture",
          {},
          ((_b2 = (_a2 = t.art) == null ? void 0 : _a2.images) == null ? void 0 : _b2.poster) ? el2("source", { media: "(max-width: 899px)", srcset: posterSrc(t.art, 800) }) : null,
          picture(backdropSrc(t.art, 1280) || posterSrc(t.art, 800), "", true)
        )), t.title), el2("div", { class: "tp-dim", "aria-hidden": "true" })),
        el2(
          "div",
          { class: "tp-body" },
          titleHeading(t, "h2", "tp-title", "title-name"),
          el2("p", { class: "tp-meta" }, detailLine(t)),
          ratingBlock(t),
          el2("div", { class: "tp-acts" }, act(on ? "check" : "plus", "La mia lista", () => toggleList(t), on), act("share", "Condividi", () => shareTitle(t))),
          t.description ? el2(
            "div",
            { class: "tp-about" },
            el2("p", { class: `tp-desc${open.more ? " open" : ""}` }, t.description),
            el2("button", { class: "tp-info", "aria-haspopup": "dialog", onclick: () => openAbout(t) }, "Altre info")
          ) : null,
          skipLine(t),
          t.episodes || similar.length ? el2("div", { class: "tp-tabs", role: "tablist" }, t.episodes ? tabButton("ep", "Episodi") : null, similar.length || t.episodes ? tabButton("sim", "Altri simili") : null) : null,
          tab === "ep" ? episodesBlock(t, point, season) : similar.length ? el2("section", { class: "tp-similar" }, lazyList(el2("div", { class: "poster-grid compact" }), similar, (x) => posterCard(x, "simili"), 4)) : el2("p", { class: "muted tp-none" }, "Non ci sono altri titoli con gli stessi generi.")
        ),
        el2("div", { class: "tp-bar" }, playButton(t, point, { big: true, label: shortPlayLabel(t, point, true) }), bookmarkButton(t))
      ];
    }
    let titleFrame = 0;
    function titleScroll() {
      var _a2;
      const dialog = $2("#title-dialog");
      const art2 = $2("#title-content .tp-art");
      const dim = $2("#title-content .tp-dim");
      if (!art2 || !dim) return;
      const y = Math.max(0, dialog.scrollTop);
      const share = clamp(y / Math.max(1, (art2.offsetHeight || 400) * 0.8), 0, 1);
      (_a2 = $2("#title-content .tp-top")) == null ? void 0 : _a2.classList.toggle("solid", y > (art2.offsetHeight || 400) * 0.62);
      dim.style.opacity = (share * 0.92).toFixed(3);
      art2.style.transform = reduce() ? "" : `translate3d(0,${(-y * 0.16).toFixed(1)}px,0)`;
    }
    const seasonName = (s) => s === 0 ? "Episodi speciali" : `Stagione ${s}`;
    function pickSeason(t, s) {
      const dialog = $2("#title-dialog");
      const row2 = $2("#title-content .tp-seasons");
      const section = $2("#title-content .tp-episodes");
      if (!row2 || !section) return;
      const before = row2.getBoundingClientRect().top;
      const left = row2.scrollLeft;
      open.season = s;
      open.block = null;
      section.replaceWith(episodesBlock(t, resumePoint(t, state2.items, state2.progress), s));
      const next = $2("#title-content .tp-seasons");
      if (next) {
        next.scrollLeft = left;
        dialog.scrollTop += next.getBoundingClientRect().top - before;
      }
      titleScroll();
    }
    function episodesBlock(t, point, season) {
      const all = t.episodes.filter((i) => i.season === season);
      const desc = storage2.get("ep-order", "asc") === "desc";
      const blocks = [];
      for (let i = 0; i < all.length; i += BLOCK) blocks.push(all.slice(i, i + BLOCK));
      const current = Math.max(0, blocks.findIndex((b) => b.some((i) => i.id === point.item.id)));
      const at = open.block != null && open.block < blocks.length ? open.block : current;
      const label = (b) => b.length === 1 ? String(b[0].episode) : `${b[0].episode}\u2013${b.at(-1).episode}`;
      const shown2 = desc ? [...blocks[at]].reverse() : blocks[at];
      const chipsRow = !wide() && t.seasons.length > 1 ? el2("div", { class: "tp-seasons", role: "group", "aria-label": "Stagioni" }, ...t.seasons.map((s) => el2("button", { class: "season-chip", "aria-pressed": String(s === season), onclick: () => pickSeason(t, s) }, seasonName(s)))) : null;
      const picker = chipsRow ? null : t.seasons.length > 1 ? el2("button", { class: "season-button", "aria-haspopup": "dialog", "aria-label": `Scegli la stagione, ora ${seasonName(season)}`, onclick: () => sheet(t.title, t.seasons.map((s) => ({
        icon: s === season ? "check" : "episodes",
        label: seasonName(s),
        sub: quantity(t.episodes.filter((i) => i.season === s).length, "episodio", "episodi"),
        pressed: s === season,
        run: () => {
          open.season = s;
          open.block = null;
          paintTitle();
        }
      }))) }, el2("span", {}, seasonName(season)), vIcon("down")) : el2("strong", { class: "season-single" }, seasonName(season));
      const chips = blocks.length > 1 ? el2("div", { class: "ep-blocks", role: "group", "aria-label": "Gruppi di episodi" }, ...(desc ? [...blocks.keys()].reverse() : [...blocks.keys()]).map((n) => el2("button", { class: "ep-block", "aria-pressed": n === at, "aria-label": `Episodi ${label(blocks[n])}`, onclick: () => {
        open.block = n;
        paintTitle();
      } }, label(blocks[n])))) : el2("span", { class: "ep-count" }, quantity(all.length, "episodio", "episodi"));
      const tools = el2(
        "div",
        { class: "ep-tools" },
        all.length > 1 ? el2("button", { class: "ep-tool", "aria-label": desc ? "Ordine: dal pi\xF9 recente. Passa al pi\xF9 vecchio" : "Ordine: dal primo. Passa al pi\xF9 recente", title: desc ? "Dal pi\xF9 recente" : "Dal primo", onclick: () => {
          storage2.set("ep-order", desc ? "asc" : "desc");
          paintTitle();
        } }, vIcon("sort")) : null,
        all.length > BLOCK ? el2("button", { class: "ep-tool", "aria-label": "Vai all\u2019episodio\u2026", title: "Vai all\u2019episodio\u2026", onclick: action2(() => gotoEpisode(all)) }, vIcon("jump")) : null
      );
      return el2(
        "section",
        { class: "tp-episodes", "aria-labelledby": "tp-episodes-title" },
        chipsRow,
        el2("div", { class: "tp-ep-head" }, el2("h3", { id: "tp-episodes-title" }, "Episodi"), picker),
        el2("div", { class: "ep-bar" }, chips, tools),
        lazyList(el2("ol", { class: "ep-list" }), shown2, (item) => episodeRow(t, item, point), 4)
      );
    }
    let eager = true;
    function lazyList(list3, entries, build, now) {
      const first = eager ? entries.length : now;
      list3.append(...entries.slice(0, first).map(build));
      if (entries.length > first) {
        const token = list3;
        setTimeout(() => {
          if (token.isConnected) token.append(...entries.slice(first).map(build));
        }, 0);
      }
      return list3;
    }
    async function gotoEpisode(all) {
      const first = all[0].episode;
      const last = all.at(-1).episode;
      const value = await c2.ask("Vai all\u2019episodio", "", `Scrivi un numero da ${first} a ${last}.`);
      if (!value) return;
      const target = all.find((i) => i.episode === parseInt(value, 10));
      if (!target) {
        notify2(`L\u2019episodio ${String(value).trim()} non c\u2019\xE8: vanno dal ${first} al ${last}.`);
        return;
      }
      open.block = Math.floor(all.indexOf(target) / BLOCK);
      paintTitle();
      const node = [...$2("#title-content").querySelectorAll(".ep")].find((n) => n.dataset.ep === target.id);
      node == null ? void 0 : node.scrollIntoView({ block: "center", behavior: "auto" });
      node == null ? void 0 : node.classList.add("ping");
      setTimeout(() => node == null ? void 0 : node.classList.remove("ping"), 1400);
    }
    function episodeRow(t, item, point) {
      const p = state2.progress[item.id];
      const watched = !!(p == null ? void 0 : p.watched);
      const length = (p == null ? void 0 : p.duration) || item.duration || 0;
      const share = watched ? 1 : (p == null ? void 0 : p.position) && length ? p.position / length : 0;
      const here = point.item.id === item.id;
      const flagged = (item.controllare || []).length > 0;
      const note = [here && point.resume && !point.next && share ? remainingText(p.position, length) : null, here ? point.resume ? "Riprendi da qui" : null : null, watched ? "Visto" : null, item.remote && item.remoteDown ? "Fisso spento" : null, flagged ? "Salti da controllare" : null].filter(Boolean).join(" \xB7 ");
      return el2(
        "li",
        { class: `ep${here ? " current" : ""}${watched ? " seen" : ""}${flagged ? " flagged" : ""}${item.remote && item.remoteDown ? " ep-off" : ""}`, "data-ep": item.id, "aria-current": here ? "true" : void 0 },
        el2(
          "button",
          { class: "ep-open", "aria-label": `Riproduci episodio ${item.episode}, ${item.title}`, onclick: action2(() => c2.playItem(item)) },
          tinted(el2(
            "span",
            { class: "ep-art" },
            picture(thumbSrc(item)),
            el2("span", { class: "c-play", "aria-hidden": "true" }, vIcon("play")),
            item.duration ? el2("span", { class: "ep-time", "aria-hidden": "true" }, durationText(item.duration)) : null,
            share ? bar(share) : null
          ), t.title),
          el2("span", { class: "ep-text" }, el2("strong", {}, `${item.episode}. ${item.title}`), note ? el2("small", {}, note) : null)
        ),
        c2.downloads ? episodeDownload(item) : null,
        el2("button", { class: "ep-seen", "aria-pressed": watched, "aria-label": `${watched ? "Togli visto" : "Segna visto"}: episodio ${item.episode}`, title: watched ? "Togli visto" : "Segna visto", onclick: action2(() => markOne(item, !watched)) }, vIcon("check")),
        item.description ? el2("p", { class: "ep-desc" }, item.description) : null
      );
    }
    function similarBlock(t) {
      const similar = similarTitles(t, titles, 12);
      if (!similar.length) return null;
      return el2("section", { class: "tp-similar" }, el2("h3", {}, "Titoli simili"), lazyList(el2("div", { class: "poster-grid compact" }), similar, (x) => posterCard(x, "simili"), 4));
    }
    function goGenre(genre) {
      closeThen("#title-dialog", () => {
        if (!KIND_PAGES.includes(state2.page)) c2.setPage("home");
        state2.genre = genre;
        render();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    }
    const layers = /* @__PURE__ */ new Map();
    const afterBack = [];
    let pendingBack = 0;
    let popping = false;
    function pushLayer(name) {
      var _a2;
      if (layers.has(name)) return;
      const depth = (((_a2 = history.state) == null ? void 0 : _a2.depth) || 0) + 1;
      layers.set(name, depth);
      history.pushState({ layer: name, depth }, "");
    }
    function flushAfterBack() {
      while (afterBack.length) afterBack.shift()();
    }
    function trackLayer(name, selector) {
      $2(selector).addEventListener("close", () => {
        var _a2;
        const depth = layers.get(name);
        layers.delete(name);
        if (name === "title") hideHover();
        if (depth && !popping && (((_a2 = history.state) == null ? void 0 : _a2.depth) || 0) >= depth) {
          pendingBack++;
          history.back();
        } else flushAfterBack();
      });
    }
    function closeThen(selector, fn) {
      const node = $2(selector);
      afterBack.push(fn);
      if (node.open) node.close();
      else flushAfterBack();
    }
    window.addEventListener("popstate", () => {
      var _a2;
      if (pendingBack) {
        pendingBack--;
        flushAfterBack();
        return;
      }
      const depth = ((_a2 = history.state) == null ? void 0 : _a2.depth) || 0;
      for (const [name, selector] of [["about", "#about-dialog"], ["player", "#video-dialog"], ["title", "#title-dialog"]]) {
        if ((layers.get(name) || 0) > depth && $2(selector).open) {
          popping = true;
          try {
            $2(selector).close();
          } finally {
            popping = false;
          }
        }
      }
    });
    let hoverTimer = 0;
    let hoverNode = null;
    let hoverCard = null;
    const canHover = () => matchMedia("(hover: hover) and (pointer: fine) and (min-width: 900px)").matches && !isTv();
    function hoverable(button, t) {
      button.addEventListener("pointerenter", () => {
        if (!canHover() || !button.closest(".v-track") || hoverCard === button) return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => showHover(button, t), 400);
      });
      button.addEventListener("pointerleave", (event) => {
        clearTimeout(hoverTimer);
        if (hoverCard === button && !(hoverNode == null ? void 0 : hoverNode.contains(event.relatedTarget))) hideHover();
      });
    }
    function showHover(card2, t) {
      hideHover();
      if (!card2.isConnected || !card2.matches(":hover")) return;
      const r = card2.getBoundingClientRect();
      if (!r.width) return;
      const width = Math.round(Math.max(r.width * 1.9, 320));
      const left = clamp(r.left + r.width / 2 - width / 2, 16, innerWidth - width - 16);
      const point = resumePoint(t, state2.items, state2.progress);
      const on = listed(t.key);
      const node = el2(
        "div",
        { class: "hover-card", role: "group", "aria-label": `Anteprima di ${t.title}` },
        el2(
          "button",
          { class: "hv-art", tabindex: "-1", "aria-label": `Apri ${t.title}`, onclick: () => openTitle(t.key) },
          tinted(el2("span", { class: "hv-frame" }, picture(backdropSrc(t.art, 640), "", true), el2("span", { class: "hv-name" }, t.title)), t.title)
        ),
        el2(
          "div",
          { class: "hv-body" },
          el2(
            "div",
            { class: "hv-actions" },
            el2("button", { class: "round play", "aria-label": `${playLabel(t, point)}: ${t.title}`, title: playLabel(t, point), onclick: action2(() => {
              hideHover();
              return c2.playItem(point.item);
            }) }, vIcon("play")),
            el2("button", { class: "round", "aria-pressed": on, "aria-label": on ? "Togli dalla mia lista" : "Aggiungi alla mia lista", title: on ? "Togli dalla mia lista" : "Aggiungi alla mia lista", onclick: action2(async () => {
              await toggleList(t);
              hideHover();
            }) }, vIcon(on ? "check" : "plus")),
            el2("button", { class: "round", "aria-pressed": t.watched, "aria-label": t.watched ? "Togli dai visti" : "Segna visto", title: t.watched ? "Togli dai visti" : "Segna visto", onclick: action2(async () => {
              await toggleWatched(t);
              hideHover();
            }) }, vIcon("check")),
            el2("button", { class: "round push", "aria-label": `Altre informazioni su ${t.title}`, title: "Altre informazioni", onclick: () => openTitle(t.key) }, vIcon("down"))
          ),
          metaLine(t),
          t.genres.length ? el2("p", { class: "hv-genres" }, t.genres.slice(0, 3).join(" \u2022 ")) : null
        )
      );
      hued(node, "--w", `${width}px`);
      hued(node, "--x", `${Math.round(left)}px`);
      node.addEventListener("pointerleave", (event) => {
        if (!card2.contains(event.relatedTarget)) hideHover();
      });
      document.body.append(node);
      hoverNode = node;
      hoverCard = card2;
      const height = node.offsetHeight;
      hued(node, "--y", `${Math.round(clamp(r.top + r.height / 2 - height / 2, 72, innerHeight - height - 12))}px`);
      const cards = [...card2.parentElement.children];
      const index = cards.indexOf(card2);
      const shift = Math.round((width - r.width) / 5);
      cards.forEach((n, j) => {
        if (j !== index) hued(n, "--shift", `${j < index ? -shift : shift}px`);
      });
      card2.parentElement.classList.add("hovering");
      card2.classList.add("hovered");
      requestAnimationFrame(() => node.classList.add("open"));
    }
    function hideHover() {
      clearTimeout(hoverTimer);
      if (!hoverNode) return;
      const track = hoverCard == null ? void 0 : hoverCard.parentElement;
      track == null ? void 0 : track.classList.remove("hovering");
      hoverCard == null ? void 0 : hoverCard.classList.remove("hovered");
      for (const n of (track == null ? void 0 : track.children) || []) n.style.removeProperty("--shift");
      hoverNode.remove();
      hoverNode = null;
      hoverCard = null;
    }
    function paintWho() {
      var _a2;
      const profiles = ((_a2 = state2.boot) == null ? void 0 : _a2.profiles) || [];
      $2("#who-title").textContent = whoEditing ? "Gestisci i profili" : profiles.length ? "Chi guarda?" : "Crea il primo profilo";
      $2("#who-hint").hidden = whoEditing || profiles.length > 0;
      $2("#who-manage").hidden = !profiles.length;
      $2("#who-manage").textContent = whoEditing ? "Fatto" : "Gestisci profili";
      $2("#who-manage").setAttribute("aria-pressed", String(whoEditing));
      $2("#who-list").replaceChildren(
        ...profiles.map((p) => el2(
          "button",
          { class: `who-tile${whoEditing ? " editing" : ""}`, "aria-label": whoEditing ? `Rinomina ${p.name}` : p.name, onclick: action2(() => whoEditing ? renameProfile(p) : chooseProfile(p)) },
          face(p, "who-face"),
          whoEditing ? el2("span", { class: "who-edit", "aria-hidden": "true" }, vIcon("edit")) : null,
          el2("span", { class: "who-name" }, p.name)
        )),
        el2("button", { class: "who-tile who-add", "aria-label": "Aggiungi un profilo", onclick: () => $2("#add-profile").click() }, el2("span", { class: "who-face", "aria-hidden": "true" }, vIcon("plus")), el2("span", { class: "who-name" }, "Aggiungi"))
      );
    }
    function askWho() {
      whoEditing = false;
      paintWho();
      if (!$2("#who-dialog").open) c2.showDialog("#who-dialog");
    }
    function maybeAskWho() {
      var _a2;
      let seen = false;
      try {
        seen = sessionStorage.getItem(WHO_KEY) === "1";
      } catch {
        seen = true;
      }
      if (!seen && (VIDEO_PAGES.includes(state2.page) || !(((_a2 = state2.boot) == null ? void 0 : _a2.profiles) || []).length)) askWho();
    }
    function profileAdded(p) {
      if (whoEditing) {
        paintWho();
        paintAvatar();
      } else chooseProfile(p);
    }
    function chooseProfile(p) {
      try {
        sessionStorage.setItem(WHO_KEY, "1");
      } catch {
      }
      $2("#who-dialog").close();
      if (p.id !== state2.profile) {
        const select = $2("#profile");
        select.value = p.id;
        select.dispatchEvent(new Event("change"));
      } else {
        paintAvatar();
        render();
      }
    }
    async function renameProfile(p) {
      const name = await c2.ask("Nuovo nome del profilo", p.name, "Il nome si vede in \xABChi guarda?\xBB e nel menu del profilo.");
      if (!name) return;
      Object.assign(p, await api2("/api/profiles/name", { method: "PUT", data: { id: p.id, name } }));
      c2.populateProfiles();
      paintWho();
      paintAvatar();
      notify2(`Ora si chiama ${p.name}.`);
    }
    function paintAvatar() {
      const me = profileOf(state2.profile);
      const button = $2("#avatar-button");
      button.replaceChildren(profileVisual(el2, me));
      button.classList.toggle("photo-face", !!me.avatar);
      tinted(button, me.name);
      button.setAttribute("aria-label", `Profilo di ${me.name} e impostazioni`);
      button.title = me.name;
      const mark = $2("#video-nav [data-page=account] .nav-icon");
      if (mark) {
        mark.replaceChildren(face(me, "nav-face"));
        tinted(mark, me.name);
      }
    }
    const videoPref = (key) => key === "autoSkip" ? profileOf(state2.profile)[key] === true : profileOf(state2.profile)[key] !== false;
    async function setVideoPref(key) {
      const me = profileOf(state2.profile);
      const result = await api2("/api/profiles/preferences", { method: "PUT", data: { profile: state2.profile, [key]: !videoPref(key) } });
      Object.assign(me, result);
      c2.syncVideoPreferences();
      notify2(`${key === "autoSkip" ? "Salto automatico" : "Episodio successivo da solo"}: ${videoPref(key) ? "acceso" : "spento"}.`);
    }
    function avatarMenu() {
      var _a2;
      const tv = isTv();
      sheet(profileOf(state2.profile).name, [
        ...(((_a2 = state2.boot) == null ? void 0 : _a2.profiles) || []).map((p) => ({ node: face(p, "face small"), label: p.name, sub: p.id === state2.profile ? "Sta guardando ora" : "Passa a questo profilo", pressed: p.id === state2.profile, run: () => chooseProfile(p) })),
        { icon: "fwd10", toggle: true, label: "Salta da solo sigle e riassunti", sub: videoPref("autoSkip") ? "Acceso: salta da solo solo i tratti sicuri; per gli altri resta il pulsante" : "Spento: compare il pulsante \xABSalta\xBB e decidi tu", pressed: videoPref("autoSkip"), run: () => setVideoPref("autoSkip") },
        { icon: "episodes", toggle: true, label: "Passa da solo all\u2019episodio successivo", sub: videoPref("autoNext") ? "Acceso" : "Spento", pressed: videoPref("autoNext"), run: () => setVideoPref("autoNext") },
        { icon: "speed", toggle: true, label: "Versione leggera fuori casa o con rete lenta", sub: "Usa la copia pi\xF9 piccola quando la rete non basta; a casa resta l\u2019originale", pressed: c2.lightModeOn(), run: async () => {
          const on = !c2.lightModeOn();
          await c2.switchQuality(on ? "auto" : "original");
          notify2(`Versione leggera: ${on ? "accesa" : "spenta"}.`);
        } },
        { icon: "people", label: "Cambia chi guarda", sub: "Apri \xABChi guarda?\xBB e gestisci i profili", run: askWho },
        { icon: "save", label: "Scaricati", sub: "Video e musica salvati su questo telefono", run: () => c2.setPage("scaricati") },
        { icon: "key", label: "Gestisci la raccolta", sub: "File, copertine, descrizioni e sigle", run: () => c2.setPage("manage") },
        { icon: "tv", toggle: true, label: tv ? "Esci dalla modalit\xE0 TV" : "Modalit\xE0 TV", sub: "Elementi grandi e comandi con le frecce", pressed: tv, run: () => $2("#tv-toggle").click() },
        { icon: "help", label: "Come si usa", sub: "Profili, TV, musica e gestione", run: () => $2("#help-open").click() }
      ]);
    }
    let heroH = 0;
    function syncTop() {
      document.body.classList.toggle("over-hero", heroH > 0 && window.scrollY < heroH - 64);
    }
    function measureHero() {
      const h = wide() ? null : $2("#video-view .bb-picture, #video-view .ac-hero");
      heroH = h ? h.offsetHeight : 0;
      syncTop();
    }
    function render() {
      var _a2, _b2, _c;
      if (!state2.boot) return;
      titles = buildTitles(state2.items, state2.progress);
      if (listFor !== state2.profile && !listLoading && !state2.offline) {
        list2 = [];
        const requestedProfile = state2.profile;
        listLoading = loadList().catch(() => {
        }).finally(() => {
          listLoading = null;
          if (listFor === state2.profile || requestedProfile !== state2.profile) render();
        });
      }
      paintAvatar();
      (_a2 = $2("#video-nav [data-page=esplora]")) == null ? void 0 : _a2.setAttribute("aria-pressed", String(["esplora", "film", "series", "anime"].includes(state2.page)));
      $2("#genres-open").replaceChildren(el2("span", {}, state2.genre || "Generi"), vIcon("down"));
      $2("#genres-open").setAttribute("aria-label", state2.genre ? `Genere: ${state2.genre}. Cambia genere` : "Generi");
      if ($2("#who-dialog").open) paintWho();
      if ($2("#title-dialog").open) paintTitle();
      const page = state2.page;
      if (!VIDEO_PAGES.includes(page)) {
        shown = "";
        hideHover();
        return;
      }
      const view = $2("#video-view");
      const key = `${page}|${state2.genre}`;
      if (page === "cerca" && shown === key && view.querySelector(".search-input")) {
        paintResults();
        return;
      }
      const focused = view.contains(document.activeElement) ? (_b2 = document.activeElement.closest("[data-fk]")) == null ? void 0 : _b2.dataset.fk : null;
      hideHover();
      const nodes = page === "scaricati" ? c2.downloadsView() : page === "esplora" ? esploraView() : page === "account" ? accountView() : page === "novita" ? novitaView() : page === "cerca" ? searchView() : page === "lista" ? listView() : browseView(page);
      fill(view, nodes);
      view.dataset.page = page;
      if (page === "cerca") paintResults();
      for (const track of view.querySelectorAll(".v-track")) {
        const left = rowScroll.get(track.dataset.memory);
        if (left) track.scrollLeft = left;
        requestAnimationFrame(() => edges(track.parentElement, track));
      }
      if (shown !== key) {
        window.scrollTo({ top: pageScroll.get(key) || 0, behavior: "instant" });
        if (!reduce()) {
          view.classList.remove("enter");
          void view.offsetWidth;
          view.classList.add("enter");
        }
      }
      shown = key;
      measureHero();
      if (focused) (_c = view.querySelector(`[data-fk="${CSS.escape(focused)}"]`)) == null ? void 0 : _c.focus({ preventScroll: true });
      if (isTv()) requestAnimationFrame(() => {
        if ((!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected) && !c2.activeDialog()) c2.focusTvStart();
      });
    }
    function init3() {
      for (const node of document.querySelectorAll("[data-vicon]")) node.replaceChildren(vIcon(node.dataset.vicon));
      $2("#top-search").replaceChildren(vIcon("search"));
      $2("#top-search").addEventListener("click", () => {
        if (state2.page !== "cerca") c2.setPage("cerca");
        requestAnimationFrame(() => {
          var _a2;
          return (_a2 = $2("#video-view .search-input")) == null ? void 0 : _a2.focus();
        });
      });
      $2("#genres-open").addEventListener("click", genreSheet);
      $2("#avatar-button").addEventListener("click", avatarMenu);
      $2("#who-manage").addEventListener("click", () => {
        whoEditing = !whoEditing;
        paintWho();
      });
      $2("#who-dialog").addEventListener("close", () => {
        try {
          sessionStorage.setItem(WHO_KEY, "1");
        } catch {
        }
      });
      $2("#title-dialog").addEventListener("scroll", () => {
        if (!titleFrame) titleFrame = requestAnimationFrame(() => {
          titleFrame = 0;
          titleScroll();
        });
      }, { passive: true });
      trackLayer("about", "#about-dialog");
      trackLayer("title", "#title-dialog");
      trackLayer("player", "#video-dialog");
      window.addEventListener("scroll", () => {
        const y = window.scrollY;
        document.body.classList.toggle("scrolled", y > 8);
        syncTop();
        if (VIDEO_PAGES.includes(state2.page) && shown === `${state2.page}|${state2.genre}`) pageScroll.set(shown, y);
        if (hoverNode) hideHover();
        if (Math.abs(y - lastY) < 6) return;
        document.body.classList.toggle("chips-hidden", y > lastY && y > 90);
        lastY = y;
      }, { passive: true });
      window.addEventListener("resize", () => {
        hideHover();
        measureHero();
      });
      matchMedia("(min-width: 900px)").addEventListener("change", () => {
        shown = "";
        render();
      });
      let hold = null;
      const dropHold = () => {
        if (hold) clearTimeout(hold.timer);
        hold = null;
      };
      document.addEventListener("keydown", (event) => {
        var _a2, _b2;
        if (!isTv() || event.key !== "Enter" || c2.activeDialog()) return;
        const card2 = (_b2 = (_a2 = event.target).closest) == null ? void 0 : _b2.call(_a2, "#video-view .c-open,#video-view .t-card");
        if (!card2) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (hold) return;
        hold = { card: card2, fired: false, timer: setTimeout(() => {
          if (hold) {
            hold.fired = true;
            cardOptions(card2);
          }
        }, 650) };
      }, true);
      document.addEventListener("keyup", (event) => {
        if (!hold || event.key !== "Enter") return;
        const { card: card2, fired } = hold;
        dropHold();
        event.preventDefault();
        if (!fired && card2.isConnected) card2.click();
      }, true);
      window.addEventListener("blur", dropHold);
    }
    function cardOptions(card2) {
      var _a2, _b2;
      if (card2.matches(".c-open")) {
        (_b2 = (_a2 = card2.closest(".c-card")) == null ? void 0 : _a2.querySelector(".c-more")) == null ? void 0 : _b2.click();
        return;
      }
      const t = titles.find((x) => x.key === card2.dataset.key);
      if (t) titleMenu(t);
    }
    return { init: init3, render, loadList, openTitle, askWho, maybeAskWho, profileAdded, pushLayer, closeThen, titles: () => titles };
  }

  // public/tv-nav.js
  var SKIP = ".c-more,.t-more,.row-arrow,.bb-dot,.brand";
  var CARD = ".c-open,.t-card";
  var LINE = ".v-track,.bb-actions,.kind-head";
  var ITEMS = 'button,a[href],input,select,summary,[tabindex="0"]';
  function createTvPageNav({ focusable, spatialTarget: spatialTarget2, reduce }) {
    const memory = /* @__PURE__ */ new Map();
    let lastContent = null;
    const all = (root, selector) => [...root.querySelectorAll(selector)];
    const header = () => document.querySelector(".topbar");
    const content = () => document.querySelector("#main");
    const usable = (node) => focusable(node) && !node.matches(SKIP);
    const headerItems = () => all(header(), ITEMS).filter(usable);
    const contentItems = () => all(content(), ITEMS).filter((node) => usable(node) && !node.closest(".topbar"));
    const lineItems = (line2) => all(line2, line2.matches(".v-track") ? CARD : ITEMS).filter(usable);
    const lines = () => all(content(), LINE).filter((line2) => !line2.closest("[hidden]") && lineItems(line2).length);
    const headerHeight = () => {
      const bar = header();
      if (!bar) return 0;
      const style = getComputedStyle(bar);
      return style.position === "fixed" || style.position === "sticky" ? bar.getBoundingClientRect().height : 0;
    };
    function entryOf(line2) {
      const items = lineItems(line2);
      if (line2.matches(".v-track")) {
        const fk = memory.get(line2.dataset.memory);
        const kept = fk && items.find((node) => node.dataset.fk === fk);
        if (kept) return kept;
        const box = line2.getBoundingClientRect();
        return items.find((node) => node.getBoundingClientRect().left >= box.left - 2) || items[0];
      }
      return items.find((node) => node.getAttribute("aria-pressed") === "true") || items[0];
    }
    function reveal(node, smooth = true) {
      if (!node || node.closest(".topbar,dialog")) return;
      const behavior = smooth && !reduce() ? "smooth" : "auto";
      const track = node.closest(".v-track");
      if (track) {
        const pad = 48;
        const box = track.getBoundingClientRect();
        const card2 = node.getBoundingClientRect();
        let shift = 0;
        if (card2.left < box.left + pad) shift = card2.left - box.left - pad;
        else if (card2.right > box.right - pad) shift = card2.right - box.right + pad;
        if (shift) track.scrollTo({ left: Math.max(0, track.scrollLeft + shift), behavior });
      }
      const list2 = lines();
      const line2 = node.closest(LINE);
      const top = headerHeight() + 24;
      const rect = node.getBoundingClientRect();
      let target = null;
      if (line2 && (list2.indexOf(line2) === 0 || line2.closest(".billboard,.kind-head"))) target = 0;
      else if (line2) {
        const block = line2.closest(".v-row") || line2;
        target = scrollY + block.getBoundingClientRect().top - top;
      } else if (rect.top < top) target = scrollY + rect.top - top;
      else if (rect.bottom > innerHeight - 40) target = scrollY + rect.bottom - innerHeight + 40;
      if (target !== null && Math.abs(target - scrollY) > 2) window.scrollTo({ top: Math.max(0, target), behavior });
    }
    function go(node) {
      if (!node) return false;
      node.focus({ preventScroll: true });
      reveal(node);
      return true;
    }
    function remember2(node) {
      if (!node || node.closest(".topbar,dialog")) return;
      lastContent = node;
      const track = node.closest(".v-track");
      if (track && node.matches(CARD) && node.dataset.fk) memory.set(track.dataset.memory, node.dataset.fk);
    }
    function toHeader() {
      const items = headerItems();
      return go(items.find((node) => node.getAttribute("aria-pressed") === "true") || items[0]);
    }
    function move(key, active, focusStart) {
      var _a2;
      const vertical = key === "ArrowUp" || key === "ArrowDown";
      if (active == null ? void 0 : active.closest(".topbar")) {
        if (key === "ArrowUp") return true;
        if (key === "ArrowDown") {
          if ((lastContent == null ? void 0 : lastContent.isConnected) && usable(lastContent)) return go(lastContent);
          focusStart();
          return true;
        }
        return go(spatialTarget2(active.getBoundingClientRect(), headerItems().filter((n) => n !== active).map((n) => ({ value: n, rect: n.getBoundingClientRect() })), key)) || true;
      }
      const line2 = active == null ? void 0 : active.closest(LINE);
      if (line2 && lineItems(line2).includes(active)) {
        if (!vertical) {
          const items = lineItems(line2);
          const next2 = items[items.indexOf(active) + (key === "ArrowRight" ? 1 : -1)];
          return go(next2) || true;
        }
        const list2 = lines();
        const at = list2.indexOf(line2);
        const next = list2[at + (key === "ArrowDown" ? 1 : -1)];
        if (next) {
          const between = spatialAmong(active, key, (node) => !node.closest(LINE));
          if (between && isBefore(between, next.getBoundingClientRect(), key)) return go(between);
          return go(entryOf(next));
        }
        const other = spatialAmong(active, key, (node) => !line2.contains(node));
        if (other) return go(other);
        return key === "ArrowUp" ? toHeader() : true;
      }
      const target = spatialAmong(active, key, () => true);
      if (target) return go(((_a2 = target.closest(LINE)) == null ? void 0 : _a2.matches(".v-track")) ? entryOf(target.closest(LINE)) : target);
      return key === "ArrowUp" ? toHeader() : true;
    }
    function spatialAmong(active, key, accept) {
      const from = active.getBoundingClientRect();
      return spatialTarget2(from, contentItems().filter((n) => n !== active && accept(n)).map((n) => ({ value: n, rect: n.getBoundingClientRect() })), key);
    }
    function isBefore(node, box, key) {
      const r = node.getBoundingClientRect();
      return key === "ArrowDown" ? r.bottom <= box.top + 2 : r.top >= box.bottom - 2;
    }
    return { move, reveal, remember: remember2, entryOf };
  }

  // public/tv/preview.js
  function previewFrame(index, position) {
    if (!(index == null ? void 0 : index.frames) || !(index.interval > 0)) return null;
    const n = Math.max(0, Math.min(index.frames - 1, Math.floor((position || 0) / index.interval)));
    const size = index.columns * index.rows, offset = n % size;
    return { sheet: Math.floor(n / size), x: offset % index.columns * index.width, y: Math.floor(offset / index.columns) * index.height, width: index.width, height: index.height };
  }

  // public/video-player.js
  var TEXT_CODECS = /* @__PURE__ */ new Set(["subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"]);
  var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
  var clamp2 = (value, min, max) => Math.min(max, Math.max(min, value));
  function tapGesture(previous, x, at) {
    const side = x < 0.4 ? -1 : x > 0.6 ? 1 : 0;
    const continued = side && (previous == null ? void 0 : previous.side) === side && at - previous.at < 320;
    return { side, at, seconds: continued ? side * 10 : 0, total: continued ? (previous.total || 0) + side * 10 : 0 };
  }
  function playerFullscreen({ tv, coarse, android }) {
    if (tv || !(coarse || android)) return { videoMode: false, fullscreen: false };
    return { videoMode: !!android, fullscreen: true };
  }
  function createPlayer(c2) {
    const { $: $2, el: el2, state: state2, video: video2, action: action2, storage: storage2, fmtTime: fmtTime2 } = c2;
    const dialog = $2("#video-dialog");
    const stage = $2("#video-stage");
    const layer = $2("#vp-layer");
    let idleTimer = 0;
    let tapTimer = 0;
    let lastTap = 0;
    let dragging = false;
    let flashTimer = 0;
    let panelOpener = null;
    let gesture = null;
    let pointer = null;
    let lastTouch = 0;
    let locked = false;
    let loadingTimer;
    let preview = null;
    let previewGeneration = 0;
    let previewAbort;
    const loading = $2("#vp-loading"), previewBox = $2("#vp-preview");
    const isTv = () => document.documentElement.classList.contains("tv");
    const tool = (node, icon, label) => node.replaceChildren(vIcon(icon), el2("span", { class: "vp-label" }, label));
    $2("#close-player").replaceChildren(vIcon("back"));
    $2("#vp-back").replaceChildren(vIcon("back10"));
    $2("#vp-forward").replaceChildren(vIcon("fwd10"));
    $2("#vp-panel-close").replaceChildren(vIcon("close"));
    tool($2("#vp-episodes"), "episodes", "Episodi");
    tool($2("#vp-lang"), "subtitles", "Audio e sottotitoli");
    tool($2("#vp-speed"), "speed", "Velocit\xE0");
    tool($2("#vp-settings"), "gear", "Impostazioni");
    tool($2("#fullscreen"), "fullscreen", "Schermo intero");
    tool($2("#vp-lock"), "lock", "Blocca");
    tool($2("#vp-next"), "jump", "Episodio successivo");
    const flash = el2("div", { class: "vp-flash", "aria-hidden": "true" });
    stage.append(flash);
    function wake() {
      layer.classList.remove("idle");
      stage.classList.remove("idle");
      clearTimeout(idleTimer);
      if (dialog.open && !video2.paused && $2("#vp-panel").hidden) idleTimer = setTimeout(sleep, 3e3);
    }
    function sleep() {
      if (!dialog.open || video2.paused || !$2("#vp-panel").hidden) return;
      clearTimeout(idleTimer);
      layer.classList.add("idle");
      stage.classList.add("idle");
      focusToggle(true);
    }
    function focusToggle(onlyFromJump = false) {
      if (!dialog.open || locked || !$2("#vp-panel").hidden) return;
      const active = document.activeElement;
      const onJump = (active == null ? void 0 : active.id) === "vp-back" || (active == null ? void 0 : active.id) === "vp-forward";
      const nowhere = !active || active === document.body || active === video2 || active === dialog || active === stage;
      if (onJump || !onlyFromJump && nowhere) $2("#vp-toggle").focus({ preventScroll: true });
    }
    function toggle() {
      if (video2.paused) video2.play().catch(() => {
      });
      else video2.pause();
    }
    function jump(seconds, total = seconds) {
      if (!Number.isFinite(video2.duration)) return;
      video2.currentTime = clamp2(video2.currentTime + seconds, 0, Math.max(0, video2.duration - 0.3));
      flash.textContent = `${total < 0 ? "\u2212" : "+"}${Math.abs(total)} s`;
      flash.className = `vp-flash show ${seconds < 0 ? "left" : "right"}`;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flash.className = "vp-flash";
      }, 650);
      wake();
    }
    function paint() {
      const duration = Number.isFinite(video2.duration) ? video2.duration : 0;
      if (!dragging) $2("#vp-seek").value = duration ? Math.round(video2.currentTime / duration * 1e3) : 0;
      $2("#vp-seek").setAttribute("aria-valuetext", `${fmtTime2(dragging ? Number($2("#vp-seek").value) / 1e3 * duration : video2.currentTime)} di ${fmtTime2(duration)}`);
      $2("#vp-seek").style.setProperty("--seek", `${duration ? (video2.currentTime / duration * 100).toFixed(2) : 0}%`);
      $2("#vp-time").textContent = fmtTime2(video2.currentTime);
      $2("#vp-left").textContent = duration ? `-${fmtTime2(duration - video2.currentTime)}` : "0:00";
      const playing = !video2.paused;
      $2("#vp-toggle").replaceChildren(vIcon(playing ? "pause" : "play"));
      $2("#vp-toggle").setAttribute("aria-label", playing ? "Pausa" : "Riproduci");
      stage.classList.toggle("paused", !playing);
      paintNext();
    }
    function paintNext() {
      var _a2;
      const card2 = $2("#next-card");
      const current = state2.current;
      const next = current ? c2.nextEpisode(current.item) : null;
      const left = video2.duration - video2.currentTime;
      const span = video2.duration >= 300 ? 20 : 5;
      const show = !!next && !current.stay && !current.transitioning && $2("#autonext").checked && $2("#next-episode").hidden && !video2.paused && Number.isFinite(left) && left > 0 && left <= span;
      card2.hidden = !show;
      stage.classList.toggle("has-next", show);
      if (!show) return;
      $2("#next-count").textContent = String(Math.max(1, Math.ceil(left)));
      if (card2.dataset.id !== next.id) {
        card2.dataset.id = next.id;
        $2("#next-name").textContent = `${episodeCode(next)} ${next.title}`;
        const thumb = $2("#next-thumb");
        if ((_a2 = next.images) == null ? void 0 : _a2.thumb) {
          thumb.src = `/media/${next.id}/thumb?v=${next.images.v || 0}`;
          thumb.hidden = false;
        } else thumb.hidden = true;
      }
    }
    $2("#next-now").addEventListener("click", action2(() => c2.performSkip({ kind: "next", next: true, label: "Prossimo episodio" })));
    $2("#next-cancel").addEventListener("click", () => {
      if (state2.current) state2.current.stay = true;
      $2("#next-card").hidden = true;
      stage.classList.remove("has-next");
      wake();
    });
    function openPanel(title, body, prefs = false) {
      if ($2("#vp-panel").hidden) panelOpener = document.activeElement;
      $2("#vp-panel-title").textContent = title;
      $2("#vp-panel-body").replaceChildren(...body.filter(Boolean));
      $2("#vp-prefs").hidden = !prefs;
      $2("#vp-panel").hidden = false;
      stage.classList.add("panel-open");
      wake();
      ($2("#vp-panel-body [aria-pressed=true]") || $2("#vp-panel-close")).focus({ preventScroll: true });
    }
    function closePanel() {
      $2("#vp-panel").hidden = true;
      stage.classList.remove("panel-open");
      if (dialog.open && (panelOpener == null ? void 0 : panelOpener.isConnected) && !panelOpener.disabled && panelOpener.getClientRects().length) panelOpener.focus({ preventScroll: true });
      panelOpener = null;
      wake();
    }
    $2("#vp-panel-close").addEventListener("click", closePanel);
    const option = (label, pressed, onclick, sub = "") => el2("button", { class: "vp-option", "aria-pressed": pressed, onclick }, el2("span", {}, label), sub ? el2("small", {}, sub) : null);
    function subtitleChoice() {
      var _a2;
      return storage2.get(`video-subs:${((_a2 = state2.current) == null ? void 0 : _a2.profile) || state2.profile}`, null);
    }
    function chooseSubtitle(index, remember2 = true) {
      var _a2;
      [...video2.textTracks].forEach((track2, i) => {
        track2.mode = i === index ? "showing" : "disabled";
      });
      const track = video2.textTracks[index];
      if (remember2) storage2.set(`video-subs:${((_a2 = state2.current) == null ? void 0 : _a2.profile) || state2.profile}`, track ? track.language || track.label : "off");
    }
    function audioStreams() {
      var _a2;
      return (((_a2 = state2.current) == null ? void 0 : _a2.item.streams) || []).filter((s) => s.type === "audio");
    }
    function langPanel() {
      const tracks = [...video2.textTracks];
      const shownIndex = tracks.findIndex((t) => t.mode === "showing");
      const streams = audioStreams();
      const native = video2.audioTracks;
      const audioIndex = (native == null ? void 0 : native.length) ? [...native].findIndex((t) => t.enabled) : 0;
      openPanel("Audio e sottotitoli", [
        el2("h4", {}, "Audio"),
        ...(streams.length ? streams : [{ language: "und" }]).map((s, i) => {
          const unavailable = i > 0 && !((native == null ? void 0 : native.length) > i);
          const node = option(languageName(s.language), i === Math.max(0, audioIndex), () => {
            if ((native == null ? void 0 : native.length) > i) {
              [...native].forEach((t, j) => {
                t.enabled = j === i;
              });
              langPanel();
            }
          }, unavailable ? [s.title, "Questo browser legge solo la prima lingua: per le altre usa VLC o il lettore della TV"].filter(Boolean).join(" \xB7 ") : s.title || "");
          node.disabled = unavailable;
          return node;
        }),
        el2("h4", {}, "Sottotitoli"),
        option("Nessuno", shownIndex < 0, () => {
          chooseSubtitle(-1);
          langPanel();
        }),
        ...tracks.map((t, i) => option(languageName(t.language || t.label), i === shownIndex, () => {
          chooseSubtitle(i);
          langPanel();
        }, t.label && languageName(t.language) !== t.label ? t.label : "")),
        $2("#video-info").textContent ? el2("p", { class: "vp-note" }, $2("#video-info").textContent) : null
      ]);
    }
    function speedPanel() {
      openPanel("Velocit\xE0 e salti", [
        el2("h4", {}, "Velocit\xE0"),
        el2("div", { class: "vp-speeds" }, ...SPEEDS.map((s) => el2("button", {
          class: "vp-chip",
          "aria-pressed": video2.playbackRate === s,
          onclick: () => {
            video2.playbackRate = s;
            tool($2("#vp-speed"), "speed", s === 1 ? "Velocit\xE0" : `Velocit\xE0 ${String(s).replace(".", ",")}\xD7`);
            speedPanel();
          }
        }, `${String(s).replace(".", ",")}\xD7`))),
        el2("h4", {}, "Salti automatici")
      ], true);
    }
    function settingsPanel() {
      var _a2;
      const item = (_a2 = state2.current) == null ? void 0 : _a2.item;
      if (!item) return;
      const chosen = c2.qualityPreference();
      const using = state2.current.quality === "480" ? "Ora: risparmio dati (480p)" : "Ora: originale";
      openPanel("Impostazioni", [
        el2("h4", {}, "Qualit\xE0"),
        ...qualityOptions(item).map((o) => {
          const node = option(o.label, o.value === chosen, action2(async () => {
            await c2.switchQuality(o.value);
            settingsPanel();
          }), o.value === "auto" ? `${o.sub}. ${using}` : o.sub);
          node.disabled = !!o.disabled;
          return node;
        }),
        el2("h4", {}, "Salti")
      ], true);
    }
    function episodesPanel(season) {
      var _a2;
      const item = (_a2 = state2.current) == null ? void 0 : _a2.item;
      if (!(item == null ? void 0 : item.series)) return;
      const all = state2.items.filter((i) => i.root === item.root && i.series === item.series).sort((a, b) => a.season - b.season || a.episode - b.episode);
      const seasons = [...new Set(all.map((i) => i.season))];
      season = seasons.includes(season) ? season : item.season;
      openPanel(item.series, [
        seasons.length > 1 ? el2("div", { class: "vp-speeds" }, ...seasons.map((s) => el2("button", { class: "vp-chip", "aria-pressed": s === season, onclick: () => episodesPanel(s) }, s === 0 ? "Speciali" : `Stagione ${s}`))) : null,
        ...all.filter((i) => i.season === season).map((ep) => {
          var _a3;
          const p = state2.progress[ep.id];
          const share = (p == null ? void 0 : p.watched) ? 1 : (p == null ? void 0 : p.position) && (p.duration || ep.duration) ? p.position / (p.duration || ep.duration) : 0;
          const thumb = ((_a3 = ep.images) == null ? void 0 : _a3.thumb) ? el2("img", { src: `/media/${ep.id}/thumb?v=${ep.images.v || 0}`, alt: "", loading: "lazy" }) : el2("span", { class: "vp-ep-blank" });
          const progress = el2("span", { class: "c-bar" }, el2("i"));
          progress.style.setProperty("--p", `${(share * 100).toFixed(1)}%`);
          return el2(
            "button",
            {
              class: `vp-ep${ep.id === item.id ? " current" : ""}`,
              "aria-current": ep.id === item.id ? "true" : void 0,
              "aria-pressed": ep.id === item.id,
              onclick: action2(async () => {
                closePanel();
                if (ep.id !== item.id) await c2.playItem(ep);
              })
            },
            el2("span", { class: "vp-ep-art" }, thumb, share ? progress : null),
            el2("span", { class: "vp-ep-text" }, el2("strong", {}, `${ep.episode}. ${ep.title}`), el2("small", {}, durationText(ep.duration)))
          );
        })
      ]);
    }
    $2("#vp-lang").addEventListener("click", langPanel);
    $2("#vp-speed").addEventListener("click", speedPanel);
    $2("#vp-settings").addEventListener("click", settingsPanel);
    $2("#vp-episodes").addEventListener("click", () => episodesPanel());
    $2("#vp-next").addEventListener("click", action2(() => c2.performSkip({ kind: "next", next: true, label: "Prossimo episodio" })));
    function lock(value) {
      locked = value;
      stage.classList.toggle("locked", value);
      $2("#vp-unlock").hidden = !value;
      layer.inert = value;
      if (value) {
        closePanel();
        $2("#vp-unlock").focus();
      } else wake();
    }
    $2("#vp-lock").addEventListener("click", () => lock(true));
    $2("#vp-unlock").addEventListener("click", () => lock(false));
    $2("#close-player").replaceChildren(vIcon("back"));
    $2("#vp-toggle").addEventListener("click", () => {
      toggle();
      wake();
    });
    const afterJump = (event) => {
      if (event.detail > 0) $2("#vp-toggle").focus({ preventScroll: true });
    };
    $2("#vp-back").addEventListener("click", (event) => {
      jump(-10);
      afterJump(event);
    });
    $2("#vp-forward").addEventListener("click", (event) => {
      jump(10);
      afterJump(event);
    });
    $2("#vp-seek").addEventListener("input", () => {
      dragging = true;
      const duration = video2.duration || 0;
      const at = Number($2("#vp-seek").value) / 1e3 * duration;
      $2("#vp-seek").setAttribute("aria-valuetext", `${fmtTime2(at)} di ${fmtTime2(duration)}`);
      $2("#vp-time").textContent = fmtTime2(at);
      $2("#vp-seek").style.setProperty("--seek", `${(Number($2("#vp-seek").value) / 10).toFixed(2)}%`);
      previewBox.hidden = false;
      $2("#vp-preview-time").textContent = fmtTime2(at);
      const frame = previewFrame(preview, at), image = $2("#vp-preview-image");
      image.hidden = !frame;
      if (frame) {
        image.style.backgroundImage = `url("/media/${state2.current.item.id}/trickplay/${frame.sheet}.jpg")`;
        image.style.backgroundPosition = `-${frame.x / 2}px -${frame.y / 2}px`;
        image.style.backgroundSize = `${preview.columns * frame.width / 2}px ${preview.rows * frame.height / 2}px`;
      }
      wake();
    });
    $2("#vp-seek").addEventListener("change", () => {
      dragging = false;
      previewBox.hidden = true;
      if (Number.isFinite(video2.duration)) video2.currentTime = Number($2("#vp-seek").value) / 1e3 * video2.duration;
      wake();
    });
    for (const name of ["timeupdate", "play", "pause", "durationchange", "seeked", "loadedmetadata", "ratechange"]) video2.addEventListener(name, paint);
    video2.addEventListener("play", wake);
    video2.addEventListener("pause", wake);
    video2.addEventListener("pause", () => focusToggle());
    layer.addEventListener("focusin", wake);
    layer.addEventListener("focusout", wake);
    function showLoading() {
      if (dialog.open && !video2.paused) loading.hidden = false;
    }
    function loaded() {
      loading.hidden = true;
      clearTimeout(loadingTimer);
    }
    video2.addEventListener("waiting", showLoading);
    video2.addEventListener("stalled", showLoading);
    video2.addEventListener("playing", loaded);
    video2.addEventListener("error", loaded);
    video2.addEventListener("loadedmetadata", () => {
      var _a2, _b2;
      const tracks = [...video2.textTracks];
      if (!tracks.length) return;
      const choice = subtitleChoice();
      const original = (_a2 = audioStreams()[0]) == null ? void 0 : _a2.language;
      let index = -1;
      if (choice && choice !== "off") index = tracks.findIndex((t) => [t.language, t.label].some((v) => String(v || "").toLowerCase() === String(choice).toLowerCase()));
      else if (!choice && ((_b2 = state2.current) == null ? void 0 : _b2.item.root) === "Anime" && original && !["ita", "it", "und"].includes(String(original).toLowerCase())) index = tracks.findIndex((t) => /^it/i.test(t.language || t.label));
      if (index >= 0) chooseSubtitle(index, false);
    });
    stage.addEventListener("pointermove", (event) => {
      if (event.pointerType === "mouse") wake();
    });
    stage.addEventListener("pointerdown", (event) => {
      pointer = { x: event.clientX, y: event.clientY };
    });
    stage.addEventListener("pointerup", (event) => {
      if (locked) {
        if (!event.target.closest("#vp-unlock")) event.preventDefault();
        return;
      }
      if (event.target.closest("button,input,label,a,.vp-panel,.next-card")) return;
      if (!pointer || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 24) return;
      const r = stage.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width;
      if (event.pointerType === "mouse") {
        toggle();
        wake();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      lastTouch = now;
      gesture = tapGesture(gesture, x, now);
      if (gesture.seconds) {
        clearTimeout(tapTimer);
        jump(gesture.seconds, gesture.total);
        return;
      }
      lastTap = now;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => {
        if (layer.classList.contains("idle")) wake();
        else sleep();
      }, 320);
    });
    stage.addEventListener("dblclick", (event) => {
      var _a2;
      event.preventDefault();
      event.stopPropagation();
      if (!locked && Date.now() - lastTouch > 600 && !((_a2 = event.sourceCapabilities) == null ? void 0 : _a2.firesTouchEvents) && !event.target.closest("button,input,.vp-panel,.next-card")) $2("#fullscreen").click();
    });
    document.addEventListener("keydown", (event) => {
      var _a2;
      if (event.defaultPrevented || !dialog.open || c2.activeDialog() !== dialog) return;
      if (locked) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          lock(false);
        }
        return;
      }
      if (event.key === "Escape" && !$2("#vp-panel").hidden) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closePanel();
        return;
      }
      wake();
      const active = document.activeElement;
      const onControl = active && active !== video2 && active !== dialog && active !== document.body && active !== stage;
      if (((_a2 = active == null ? void 0 : active.matches) == null ? void 0 : _a2.call(active, "input,select,textarea")) && active.id !== "vp-seek") return;
      const key = event.key.toLowerCase();
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (key === " " && !onControl || key === "k" || key === "enter" && !onControl && !c2.activeSkip()) {
        event.preventDefault();
        toggle();
      } else if (["arrowleft", "arrowright"].includes(key) && !onControl && (active == null ? void 0 : active.id) !== "vp-seek") {
        event.preventDefault();
        jump(key === "arrowleft" ? -10 : 10);
      } else if (["arrowup", "arrowdown"].includes(key) && !onControl && isTv()) {
        event.preventDefault();
        $2("#vp-toggle").focus();
      } else if (key === "f" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        $2("#fullscreen").click();
      } else if (key === "m") video2.muted = !video2.muted;
    }, true);
    document.addEventListener("fullscreenchange", () => {
      var _a2, _b2, _c, _d;
      if (document.fullscreenElement && matchMedia("(pointer: coarse)").matches) (_b2 = (_a2 = screen.orientation) == null ? void 0 : _a2.lock) == null ? void 0 : _b2.call(_a2, "landscape").catch(() => {
      });
      else if (!document.fullscreenElement) (_d = (_c = screen.orientation) == null ? void 0 : _c.unlock) == null ? void 0 : _d.call(_c);
    });
    function resetInteraction() {
      clearTimeout(idleTimer);
      clearTimeout(tapTimer);
      clearTimeout(flashTimer);
      clearTimeout(loadingTimer);
      previewAbort == null ? void 0 : previewAbort.abort();
      previewGeneration++;
      preview = null;
      previewBox.hidden = true;
      lastTap = 0;
      gesture = null;
      pointer = null;
      dragging = false;
      flash.className = "vp-flash";
      lock(false);
    }
    dialog.addEventListener("close", () => {
      var _a2, _b2, _c;
      resetInteraction();
      closePanel();
      $2("#next-card").hidden = true;
      layer.classList.remove("idle");
      stage.classList.remove("idle", "has-next");
      loading.hidden = true;
      (_a2 = globalThis.ApollonAndroid) == null ? void 0 : _a2.setVideoMode(false);
      (_c = (_b2 = screen.orientation) == null ? void 0 : _b2.unlock) == null ? void 0 : _c.call(_b2);
      if (document.pictureInPictureElement === video2) document.exitPictureInPicture().catch((error) => {
        var _a3;
        return (_a3 = c2.notify) == null ? void 0 : _a3.call(c2, error.message, true);
      });
    });
    function opened(item) {
      var _a2;
      resetInteraction();
      panelOpener = null;
      $2("#vp-episodes").hidden = !item.series;
      $2("#vp-panel").hidden = true;
      stage.classList.remove("panel-open", "has-next");
      $2("#next-card").hidden = true;
      $2("#next-card").dataset.id = "";
      $2("#vp-next").hidden = !c2.nextEpisode(item);
      loading.hidden = false;
      loadingTimer = setTimeout(() => {
        if (!dialog.open || loading.hidden) return;
        loading.hidden = true;
        $2("#video-error").textContent = "Il video tarda a partire. Controlla la connessione, poi tocca Riproduci per riprovare.";
        $2("#video-error").hidden = false;
      }, 15e3);
      const full = playerFullscreen({ tv: isTv(), coarse: matchMedia("(pointer: coarse)").matches, android: !!globalThis.ApollonAndroid });
      if (full.videoMode) globalThis.ApollonAndroid.setVideoMode(true);
      if (full.fullscreen && !document.fullscreenElement) (_a2 = stage.requestFullscreen) == null ? void 0 : _a2.call(stage).catch(() => {
      });
      const pg = ++previewGeneration;
      previewAbort = new AbortController();
      fetch(`/media/${item.id}/trickplay?playing=1&cached=1`, { signal: previewAbort.signal }).then((r) => r.ok ? r.json() : null).then((data) => {
        if (pg === previewGeneration && (data == null ? void 0 : data.ready)) preview = data;
      }).catch(() => {
      });
      video2.playbackRate = 1;
      tool($2("#vp-speed"), "speed", "Velocit\xE0");
      for (const s of (item.streams || []).filter((s2) => s2.type === "subtitle" && TEXT_CODECS.has(String(s2.codec).toLowerCase()))) {
        video2.append(el2("track", { kind: "subtitles", label: `${languageName(s.language)}${s.title ? ` \xB7 ${s.title}` : ""}`, srclang: /^[a-z]{2,3}$/i.test(s.language || "") ? s.language : "it", src: `/media/${item.id}/subtitle/s${s.index}` }));
      }
      c2.pushLayer("player");
      paint();
      wake();
    }
    globalThis.mediatecaPlayer = { opened, wake };
    return { opened };
  }

  // public/video-manage.js
  function createArtEditor(c2) {
    const { $: $2, el: el2, state: state2, api: api2, action: action2, notify: notify2 } = c2;
    let frames = null;
    let pictures = null;
    let target = "poster";
    let request = 0;
    const selected = () => state2.items.find((i) => i.id === $2("#edit-item").value);
    const ver = (item) => {
      var _a2;
      return ((_a2 = item == null ? void 0 : item.images) == null ? void 0 : _a2.v) || 0;
    };
    function preview(item, kind) {
      var _a2;
      const src = ((_a2 = item.images) == null ? void 0 : _a2[kind]) ? `/media/${item.id}/${kind}?s=${kind === "poster" ? 260 : 640}&v=${ver(item)}` : "";
      const box = el2("span", { class: `art-preview ${kind}` }, src ? el2("img", { src, alt: "", loading: "lazy" }) : el2("span", { class: "muted" }, "In preparazione"));
      const choice = item[kind] || (item.imagePath ? { path: item.imagePath } : null);
      const how = !choice ? "Automatica, dal video" : choice.immagine ? "Immagine scelta sul fisso" : choice.path ? `Immagine: ${choice.path.split("/").pop()}` : `Fotogramma a ${Math.round(choice.at)} s`;
      return el2(
        "div",
        { class: "art-slot" },
        el2("h3", {}, kind === "poster" ? "Locandina (verticale)" : "Sfondo (16:9)"),
        box,
        el2("p", { class: "muted" }, how),
        el2(
          "div",
          { class: "actions" },
          el2("button", { type: "button", class: "secondary", "aria-pressed": frames && target === kind, onclick: action2(() => showFrames(kind)) }, "Da un fotogramma"),
          el2("button", { type: "button", class: "secondary", "aria-pressed": pictures && target === kind, onclick: action2(() => showPictures(kind)) }, "Da un\u2019immagine"),
          choice ? el2("button", { type: "button", class: "quiet", onclick: action2(() => save2(kind, null)) }, "Torna automatica") : null
        )
      );
    }
    async function save2(kind, choice) {
      const item = selected();
      if (!item) return;
      await api2("/api/manage/edit", { method: "POST", data: { id: item.id, [kind]: choice } });
      frames = null;
      pictures = null;
      await c2.reloadLibrary();
      notify2(kind === "poster" ? "Locandina scelta. La preparo, ci vuole un attimo." : "Sfondo scelto. Lo preparo, ci vuole un attimo.");
    }
    async function showFrames(kind) {
      const item = selected();
      target = kind;
      pictures = null;
      const duration = item.duration || 0;
      if (!duration) throw new Error("La durata del video non \xE8 ancora pronta: riprova fra poco.");
      frames = [0.08, 0.18, 0.3, 0.42, 0.55, 0.67, 0.78, 0.9].map((share) => Math.round(duration * share));
      paint();
    }
    async function showPictures(kind) {
      const item = selected();
      target = kind;
      frames = null;
      pictures = (await api2(`/api/manage/pictures?id=${encodeURIComponent(item.id)}`)).pictures || [];
      paint();
    }
    function frameStrip(item) {
      const mine = ++request;
      const cells = frames.map((at) => el2(
        "button",
        { type: "button", class: "frame-cell", "aria-label": `Usa il fotogramma a ${at} secondi`, onclick: action2(() => save2(target, { at })) },
        el2("span", { class: "frame-wait" }, `${at} s`)
      ));
      (async () => {
        for (const [i, at] of frames.entries()) {
          if (mine !== request) return;
          for (let attempt = 0; attempt < 3; attempt++) {
            const ok = await new Promise((resolve) => {
              const img = el2("img", { alt: "", src: `/media/${item.id}/frame?t=${at}&r=${attempt}`, onload: () => resolve(img), onerror: () => resolve(null) });
            });
            if (mine !== request) return;
            if (ok) {
              cells[i].replaceChildren(ok, el2("small", {}, `${at} s`));
              break;
            }
            await new Promise((r) => setTimeout(r, 600));
          }
        }
      })();
      return el2("div", { class: "frame-strip" }, ...cells);
    }
    function pictureStrip(item) {
      if (!pictures.length) return el2("p", { class: "muted" }, "Nessuna immagine JPG, PNG o WebP nella cartella del video o in quella sopra. Caricala con \xABAggiungi file\xBB, poi riprova.");
      return el2("div", { class: "frame-strip" }, ...pictures.map((path) => el2(
        "button",
        { type: "button", class: "frame-cell", "aria-label": `Usa ${path}`, onclick: action2(() => save2(target, { path })) },
        el2("img", { src: `/api/manage/picture?id=${encodeURIComponent(item.id)}&path=${encodeURIComponent(path)}`, alt: "", loading: "lazy" }),
        el2("small", {}, path.split("/").pop())
      )));
    }
    function paint() {
      const box = $2("#art-editor");
      const item = selected();
      if (!item) {
        box.replaceChildren(el2("p", { class: "muted" }, "Scegli un titolo in \xABSistema titoli\xBB qui sopra."));
        return;
      }
      if (!$2("#art-panel").open) return;
      const description = el2("textarea", { id: "art-description", rows: "4", maxlength: "2000" });
      description.value = item.description || "";
      const seriesDescription = item.series ? el2("textarea", { id: "art-series-description", rows: "4", maxlength: "2000" }) : null;
      if (seriesDescription) seriesDescription.value = item.seriesDescription || "";
      box.replaceChildren(...[
        el2("p", { class: "muted" }, `${item.series ? `${item.series} \xB7 ${episodeLabel(item)} \xB7 ` : ""}${item.title}. Le immagini scelte valgono per tutta la serie.`),
        el2("div", { class: "art-slots" }, preview(item, "poster"), preview(item, "backdrop")),
        frames ? el2("section", { class: "art-pick" }, el2("h3", {}, `Scegli un fotogramma per ${target === "poster" ? "la locandina" : "lo sfondo"}`), frameStrip(item)) : null,
        pictures ? el2("section", { class: "art-pick" }, el2("h3", {}, `Scegli un\u2019immagine per ${target === "poster" ? "la locandina" : "lo sfondo"}`), pictureStrip(item)) : null,
        el2(
          "form",
          { class: "edit-form", onsubmit: action2(async (event) => {
            event.preventDefault();
            await api2("/api/manage/edit", { method: "POST", data: { id: item.id, description: description.value.trim(), ...seriesDescription ? { seriesDescription: seriesDescription.value.trim(), scope: "series" } : {} } });
            await c2.reloadLibrary();
            notify2("Descrizione salvata.");
          }) },
          el2("label", { for: "art-description" }, item.series ? "Descrizione dell\u2019episodio" : "Descrizione del film", description),
          seriesDescription ? el2("label", { for: "art-series-description" }, "Descrizione della serie (vale per tutti gli episodi)", seriesDescription) : null,
          el2("p", { class: "muted" }, "Generi e sigla si cambiano nei pannelli \xABSistema titoli\xBB e \xABSalta riassunto, sigla e finale\xBB."),
          el2(
            "div",
            { class: "actions" },
            el2("button", { class: "primary", type: "submit" }, "Salva la descrizione"),
            el2("button", { class: "secondary", type: "button", onclick: action2(async () => {
              await api2("/api/manage/art", { method: "POST", data: { id: item.id, scope: item.series ? "series" : "episode" } });
              notify2("Rifaccio le immagini, una alla volta. Puoi continuare a usare Apollon.");
            }) }, item.series ? "Rifai le immagini della serie" : "Rifai le immagini")
          )
        )
      ].filter(Boolean));
    }
    const episodeLabel = (item) => `S${item.season}:E${item.episode}`;
    $2("#art-panel").addEventListener("toggle", () => {
      if ($2("#art-panel").open) paint();
    });
    $2("#edit-item").addEventListener("change", () => {
      frames = null;
      pictures = null;
      request++;
      paint();
    });
    return { paint };
  }

  // public/video-offline.js
  init_video_offline_range();
  init_video_offline_range();
  var estimateBytes = (item, quality) => quality === "light" ? Math.round((Number(item.size) || 0) * 0.45) : Number(item.size) || 0;
  var TEXT_CODECS2 = /* @__PURE__ */ new Set(["subrip", "srt", "ass", "ssa", "mov_text", "webvtt", "text"]);
  var subtitleURLs = (item) => [.../* @__PURE__ */ new Set([
    ...(item.subtitles || []).map((_, i) => `/media/${item.id}/subtitle/${i}`),
    ...(item.streams || []).filter((s) => s.type === "subtitle" && TEXT_CODECS2.has(String(s.codec).toLowerCase())).map((s) => `/media/${item.id}/subtitle/s${s.index}`)
  ])];
  var OfflineVideo = class {
    constructor({ caches = globalThis.caches, fetch: fetch2 = (...args) => globalThis.fetch(...args), storage: storage2 = ((_a2) => (_a2 = globalThis.navigator) == null ? void 0 : _a2.storage)(), chunk = CHUNK, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
      Object.assign(this, { caches, fetch: fetch2, storage: storage2, chunk, sleep });
      this.jobs = /* @__PURE__ */ new Map();
      this.listeners = /* @__PURE__ */ new Set();
      this.tail = Promise.resolve();
      this.m = null;
      this.writing = Promise.resolve();
    }
    onchange(fn) {
      this.listeners.add(fn);
      return () => this.listeners.delete(fn);
    }
    emit() {
      for (const fn of this.listeners) try {
        fn();
      } catch {
      }
    }
    async cache() {
      return this.caches.open(videoCacheName);
    }
    async load() {
      if (this.m) return this.m;
      const response = await (await this.cache()).match(videoManifestURL);
      this.m = response ? await response.json() : { version: 1, entries: {} };
      for (const entry of Object.values(this.m.entries)) if (entry.state === "downloading" && !this.jobs.has(entry.id)) entry.state = "paused";
      return this.m;
    }
    persist() {
      const body = JSON.stringify(this.m);
      return this.writing = this.writing.catch(() => {
      }).then(async () => (await this.cache()).put(videoManifestURL, new Response(body, { headers: { "Content-Type": "application/json" } })));
    }
    async list() {
      return Object.values((await this.load()).entries);
    }
    async completed() {
      return new Set((await this.list()).filter((e) => e.state === "done").map((e) => e.id));
    }
    async used() {
      return (await this.list()).reduce((n, e) => n + downloadedBytes(e), 0);
    }
    // Mette in coda un video; ritorna subito. Lo stato vive in this.jobs e in this.m.entries.
    enqueue(item, quality = "original") {
      if (this.jobs.has(item.id)) return this.jobs.get(item.id);
      const job = { id: item.id, item, quality, state: "queued", done: 0, total: 0, controller: new AbortController(), discard: false, error: "" };
      this.jobs.set(item.id, job);
      this.lastError = "";
      job.promise = this.tail = this.tail.catch(() => {
      }).then(() => this.run(job)).catch((error) => {
        job.error = error.name === "AbortError" ? "" : error.message;
      }).finally(() => {
        this.jobs.delete(item.id);
        this.lastError = job.error || this.lastError;
        this.emit();
      });
      this.emit();
      return job;
    }
    pause(id) {
      const job = this.jobs.get(id);
      if (job) job.controller.abort();
    }
    async cancel(id) {
      const job = this.jobs.get(id);
      if (job) {
        job.discard = true;
        job.controller.abort();
        await job.promise;
      }
      await this.remove(id);
    }
    async remove(id) {
      const job = this.jobs.get(id);
      if (job) {
        job.discard = true;
        job.controller.abort();
        await job.promise;
      }
      const m = await this.load();
      const entry = m.entries[id];
      if (!entry) return;
      delete m.entries[id];
      await this.persist();
      await this.dropFiles(entry);
      this.emit();
    }
    async dropFiles(entry) {
      const cache = await this.cache();
      for (let n = 0; n < entry.parts; n++) await cache.delete(partURL(entry.id, n));
      await cache.delete(`/media/${entry.id}/poster?s=260`);
      for (const url of subtitleURLs(entry.item)) await cache.delete(url);
    }
    async json(route, data) {
      const response = await this.fetch(route, { method: data ? "POST" : "GET", cache: "no-store", ...data ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {} });
      if (!response.ok) throw new Error("Il programma di casa non risponde. Controlla la rete e riprova.");
      return response.json();
    }
    // «Standard»: la versione leggera si prepara sul server (passa avanti alla coda) e qui si aspetta che sia pronta.
    async prepareLight(job) {
      job.state = "preparing";
      this.emit();
      const id = job.id;
      for (; ; ) {
        job.controller.signal.throwIfAborted();
        const info = await this.json(`/api/versions/item?id=${encodeURIComponent(id)}`);
        if (info.state === "ready") return info;
        if (info.state === "failed") throw new Error("Non sono riuscito a preparare la versione leggera. Riprova, oppure scegli l\u2019originale.");
        if (info.state === "none") await this.json("/api/versions", { ids: [id], first: true });
        await this.sleep(1500);
      }
    }
    async extras(item, cache, signal) {
      var _a2;
      const urls = [...((_a2 = item.images) == null ? void 0 : _a2.poster) ? [`/media/${item.id}/poster?s=260`] : [], ...subtitleURLs(item)];
      for (const url of urls) try {
        const response = await this.fetch(url, { signal });
        if (response.ok) await cache.put(url, response);
      } catch (error) {
        if (error.name === "AbortError") throw error;
      }
    }
    async run(job) {
      var _a2, _b2, _c, _d, _e;
      const { item, quality } = job;
      const signal = job.controller.signal;
      const m = await this.load();
      const cache = await this.cache();
      let entry;
      try {
        signal.throwIfAborted();
        if (quality === "light") await this.prepareLight(job);
        const url = `/media/${item.id}${quality === "light" ? "?q=480" : ""}`;
        const head = await this.fetch(url, { method: "HEAD", cache: "no-store", signal });
        const total = Number(head.headers.get("Content-Length"));
        if (!head.ok || !(total > 0)) throw new Error("Il video non \xE8 raggiungibile. Controlla la rete e riprova.");
        entry = m.entries[item.id];
        if (entry && (entry.quality !== quality || entry.total !== total || entry.chunk !== this.chunk)) {
          await this.dropFiles(entry);
          entry = null;
        }
        if (!entry) entry = m.entries[item.id] = { id: item.id, quality, total, chunk: this.chunk, type: head.headers.get("Content-Type") || "video/mp4", parts: Math.ceil(total / this.chunk), done: 0, state: "downloading", item, addedAt: Date.now() };
        if (entry.state === "done") return;
        entry.state = "downloading";
        entry.item = item;
        const space = await ((_b2 = (_a2 = this.storage) == null ? void 0 : _a2.estimate) == null ? void 0 : _b2.call(_a2)) || {};
        const need = total - downloadedBytes(entry);
        if (need > ((_c = space.quota) != null ? _c : Infinity) - (space.usage || 0)) throw new Error("Non c\u2019\xE8 abbastanza spazio sul telefono. Elimina qualche download e riprova.");
        await ((_e = (_d = this.storage) == null ? void 0 : _d.persist) == null ? void 0 : _e.call(_d).catch(() => false));
        Object.assign(job, { state: "downloading", total, done: downloadedBytes(entry) });
        await this.persist();
        this.emit();
        await this.extras(item, cache, signal);
        for (let n = entry.done; n < entry.parts; n++) {
          signal.throwIfAborted();
          const from = n * this.chunk, to = Math.min(total, from + this.chunk) - 1;
          const response = await this.fetch(url, { headers: { Range: `bytes=${from}-${to}` }, cache: "no-store", signal });
          if (response.status !== 206 && !(response.status === 200 && entry.parts === 1)) throw new Error("Il download si \xE8 interrotto. Riprova: riparte da dove era arrivato.");
          const blob = await response.blob();
          signal.throwIfAborted();
          if (blob.size !== to - from + 1) throw new Error("Il download si \xE8 interrotto. Riprova: riparte da dove era arrivato.");
          await cache.put(partURL(item.id, n), new Response(blob));
          entry.done = n + 1;
          job.done = downloadedBytes(entry);
          await this.persist();
          this.emit();
        }
        entry.state = "done";
        await this.persist();
      } catch (error) {
        if (entry && m.entries[item.id] === entry && !job.discard) {
          entry.state = "paused";
          await this.persist().catch(() => {
          });
        }
        throw error;
      }
    }
  };

  // public/app.js
  init_downloads();
  var $ = (selector) => document.querySelector(selector);
  var $$ = (selector) => [...document.querySelectorAll(selector)];
  var storage = {
    get(key, fallback = null) {
      var _a2;
      try {
        return (_a2 = JSON.parse(localStorage.getItem(`mediateca:${key}`))) != null ? _a2 : fallback;
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
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === "class") node.className = value;
      else if ((key.startsWith("aria-") || key === "draggable") && typeof value === "boolean") node.setAttribute(key, String(value));
      else if (value !== void 0 && value !== false && value !== null) node.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat(Infinity)) if (child !== null && child !== void 0) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    return node;
  }
  var state = {
    boot: null,
    items: [],
    progress: {},
    profile: storage.get("profile", "bruno"),
    page: "home",
    filter: "all",
    query: "",
    genre: "",
    current: null,
    filePath: "",
    root: "",
    musicTab: "home",
    albumsOffset: 0,
    musicGeneration: 0,
    queue: [],
    queueIndex: 0,
    repeat: "off",
    saveAt: 0
  };
  if (!Array.isArray(state.queue)) state.queue = [];
  state.queue = state.queue.filter((s) => s && typeof s.id === "string" && typeof s.title === "string").slice(0, 2e3);
  if (!Number.isInteger(state.queueIndex) || state.queueIndex < 0 || state.queueIndex >= state.queue.length) state.queueIndex = 0;
  var toastTimer;
  var pollTimer;
  var searchTimer;
  function notify(message, error = false) {
    const node = $("#toast");
    node.textContent = message;
    node.className = `toast${error ? " error" : ""}`;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, error ? 9e3 : 4500);
  }
  async function api(route, { method = "GET", data, signal } = {}) {
    let response;
    try {
      response = await fetch(route, { method, signal, headers: data === void 0 ? {} : { "Content-Type": "application/json" }, body: data === void 0 ? void 0 : JSON.stringify(data), cache: "no-store" });
    } catch (e) {
      if (e.name === "AbortError") throw e;
      throw new Error("Il telefono non risponde. Controlla il Wi-Fi e riprova.");
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("La risposta del telefono non \xE8 valida. Controlla l\u2019indirizzo e riprova.");
    }
    if (!response.ok) throw Object.assign(new Error(result.error || "Operazione non riuscita."), { status: response.status });
    return result;
  }
  function action(fn) {
    return async (event) => {
      try {
        await fn(event);
      } catch (e) {
        notify(e.message, true);
      }
    };
  }
  var fmtTime = (seconds) => {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  var fmtSize = (size) => size >= 1024 ** 3 ? `${(size / 1024 ** 3).toFixed(1)} GB` : `${(size / 1024 ** 2).toFixed(1)} MB`;
  var minutes = (seconds) => seconds ? `${Math.ceil(seconds / 60)} min` : "Durata da leggere";
  var dialogStack = [];
  var dialogOpeners = /* @__PURE__ */ new Map();
  var activeDialog = () => dialogStack.filter((node) => node.open && node.isConnected !== false).at(-1);
  function insideClosedDetails(node) {
    var _a2, _b2;
    for (let d = (_a2 = node.closest) == null ? void 0 : _a2.call(node, "details:not([open])"); d; d = (_b2 = d.parentElement) == null ? void 0 : _b2.closest("details:not([open])")) {
      if (!(node.parentElement === d && node.matches("summary"))) return true;
    }
    return false;
  }
  var dialogControls = (node) => [...node.querySelectorAll("button,a[href],input,select,textarea,summary,[tabindex]")].filter((control) => !control.disabled && control.tabIndex >= 0 && !control.closest("[hidden],[inert]") && !insideClosedDetails(control) && control.getClientRects().length);
  function showDialog(id) {
    const node = $(id);
    if (node.open) return;
    dialogOpeners.set(node, document.activeElement);
    const old = dialogStack.indexOf(node);
    if (old >= 0) dialogStack.splice(old, 1);
    dialogStack.push(node);
    node.showModal();
    document.documentElement.classList.add("has-dialog");
    (node.querySelector("[autofocus]") || dialogControls(node)[0] || node).focus({ preventScroll: true });
  }
  function registerDialog(node) {
    node.addEventListener("close", () => {
      var _a2, _b2, _c;
      if (node.open) return;
      const index = dialogStack.indexOf(node);
      if (index >= 0) dialogStack.splice(index, 1);
      const top = activeDialog();
      document.documentElement.classList.toggle("has-dialog", !!top);
      let opener = dialogOpeners.get(node);
      dialogOpeners.delete(node);
      if (opener && !opener.isConnected && ((_a2 = opener.dataset) == null ? void 0 : _a2.fk)) {
        const key = opener.dataset.fk;
        opener = [...document.querySelectorAll("[data-fk]")].find((candidate) => candidate.dataset.fk === key);
      }
      const focused = document.activeElement;
      if ((opener == null ? void 0 : opener.isConnected) && !opener.disabled && opener.getClientRects().length && (!top || top.contains(opener)) && (focused === document.body || focused === opener || node.contains(focused))) {
        opener.focus({ preventScroll: true });
        if ((_c = (_b2 = document.documentElement.classList).contains) == null ? void 0 : _c.call(_b2, "tv")) opener.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      } else if (!top && focused === document.body && typeof focusTvStart === "function") focusTvStart();
    });
  }
  $$("dialog").forEach(registerDialog);
  document.addEventListener("keydown", (event) => {
    const dialog = activeDialog();
    if (!dialog || event.key !== "Tab") return;
    const controls = dialogControls(dialog);
    const first = controls[0];
    const last = controls.at(-1);
    if (!first) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    if (!dialog.contains(document.activeElement) || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  });
  document.addEventListener("focusin", (event) => {
    const dialog = activeDialog();
    if (dialog && !dialog.contains(event.target)) (dialogControls(dialog)[0] || dialog).focus({ preventScroll: true });
  });
  $$(".close-dialog").forEach((button) => button.addEventListener("click", () => {
    const dialog = button.closest("dialog");
    if (dialog.id === "music-player") closeMusicPlayer();
    else dialog.close();
  }));
  var inputResolve = null;
  $("#input-dialog").addEventListener("close", () => {
    inputResolve == null ? void 0 : inputResolve(null);
    inputResolve = null;
  });
  $("#input-form").addEventListener("submit", (event) => {
    event.preventDefault();
    let result = $("#input-value").disabled ? true : $("#input-value").value.trim();
    if (!result) return;
    const resolve = inputResolve;
    inputResolve = null;
    $("#input-dialog").close();
    resolve == null ? void 0 : resolve(result);
  });
  function ask(title, value = "", description = "", confirm = false, destination = false) {
    $("#input-title").textContent = title;
    $("#input-description").textContent = description;
    $("#input-label").hidden = confirm;
    $("#input-value").disabled = confirm;
    $("#input-value").value = value;
    $("#input-root-label").hidden = !destination;
    if (destination) {
      $("#input-root").replaceChildren(...state.boot.roots.map((root) => el("option", { value: root }, root)));
      $("#input-root").value = state.root;
    }
    $("#input-submit").textContent = confirm ? "Conferma" : "Salva";
    showDialog("#input-dialog");
    if (!confirm) {
      $("#input-value").focus();
      $("#input-value").select();
    }
    return new Promise((resolve) => {
      inputResolve = resolve;
    });
  }
  function populateProfiles() {
    var _a2;
    if (!state.boot.profiles.some((p) => p.id === state.profile)) state.profile = ((_a2 = state.boot.profiles[0]) == null ? void 0 : _a2.id) || "";
    $("#profile").replaceChildren(...state.boot.profiles.map((p) => el("option", { value: p.id }, p.name)));
    $("#profile").value = state.profile;
    storage.set("profile", state.profile);
    syncVideoPreferences();
  }
  function videoPreferences() {
    var _a2;
    return ((_a2 = state.boot) == null ? void 0 : _a2.profiles.find((p) => {
      var _a3;
      return p.id === (((_a3 = state.current) == null ? void 0 : _a3.profile) || state.profile);
    })) || {};
  }
  function syncVideoPreferences() {
    const p = videoPreferences();
    $("#autonext").checked = p.autoNext !== false;
    $("#autoskip").checked = p.autoSkip === true;
    syncLightMode();
  }
  var lightModeOn = () => qualityPreference() !== "original";
  function syncLightMode() {
    $("#lightmode").checked = lightModeOn();
  }
  async function saveVideoPreferences() {
    var _a2;
    const profile = ((_a2 = state.current) == null ? void 0 : _a2.profile) || state.profile;
    const result = await api("/api/profiles/preferences", { method: "PUT", data: { profile, autoSkip: $("#autoskip").checked, autoNext: $("#autonext").checked } });
    Object.assign(state.boot.profiles.find((p) => p.id === profile), result);
    syncVideoPreferences();
  }
  async function reloadLibrary() {
    const result = await api("/api/library");
    state.items = result.items;
    Object.assign(state.boot, { count: result.count, pending: result.pending, warnings: result.warnings, lastScan: result.lastScan });
    renderCatalog();
    populateEdit();
  }
  async function refreshProgress() {
    if (!state.profile) {
      state.progress = {};
      return;
    }
    const profile = state.profile;
    const version = state.progressVersion || 0;
    const fresh = await api(`/api/progress?profile=${encodeURIComponent(profile)}`);
    if (state.profile === profile && (state.progressVersion || 0) === version) {
      state.progress = fresh;
      cacheProgress();
    }
  }
  var tvPageTrail = [];
  var tvReturning = false;
  var librarySwitchPending = false;
  function resetLibrarySwitch() {
    librarySwitchPending = false;
    document.body.classList.remove("switching-library");
    $$("[data-library-pending]").forEach((b) => {
      b.disabled = false;
      b.removeAttribute("aria-busy");
      delete b.dataset.libraryPending;
    });
  }
  window.addEventListener("pageshow", resetLibrarySwitch);
  window.addEventListener("apollonresume", resetLibrarySwitch);
  function openOtherLibrary(away) {
    var _a2;
    if (librarySwitchPending) return;
    librarySwitchPending = true;
    document.body.classList.add("switching-library");
    const pressed = document.activeElement;
    if (pressed == null ? void 0 : pressed.matches("button")) {
      pressed.disabled = true;
      pressed.dataset.libraryPending = "true";
      pressed.setAttribute("aria-busy", "true");
    }
    const target = new URL(away);
    target.searchParams.set("apollonIntro", "done");
    if ((_a2 = globalThis.ApollonAndroid) == null ? void 0 : _a2.openLibrary) globalThis.ApollonAndroid.openLibrary(target.href);
    else location.href = target.href;
    setTimeout(resetLibrarySwitch, 8e3);
  }
  function setPage(page, updateHash = true) {
    var _a2, _b2;
    const away = state.offline ? "" : otherServerTarget(page, (_a2 = state.boot) == null ? void 0 : _a2.mode, (_b2 = state.boot) == null ? void 0 : _b2.otherLibraryUrl, location.search);
    if (away) {
      openOtherLibrary(away);
      return;
    }
    if (!["home", "film", "series", "anime", "novita", "cerca", "lista", "scaricati", "esplora", "account", "music", "manage"].includes(page)) page = "home";
    if (page !== state.page) {
      if (!tvReturning) tvPageTrail.push(state.page);
      state.genre = "";
    }
    if (page !== "manage") state.lastPage = page;
    state.page = page;
    document.body.dataset.page = page;
    document.body.classList.toggle("video-mode", VIDEO_PAGES.includes(page));
    if (updateHash && location.hash !== `#${page}`) history.replaceState(null, "", `#${page}`);
    $$("button[data-page]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.page === page));
    $$(".b-music").forEach((n) => {
      n.hidden = page !== "music";
    });
    $$(".b-video").forEach((n) => {
      n.hidden = page === "music";
    });
    $("#video-page").hidden = !VIDEO_PAGES.includes(page);
    $("#music-page").hidden = page !== "music";
    $("#manage-page").hidden = page !== "manage";
    let pageReady = Promise.resolve();
    if (page === "music") pageReady = loadMusic().catch((e) => notify(e.message, true));
    else if (page === "manage") pageReady = loadManage().catch((e) => notify(e.message, true));
    renderCatalog();
    requestAnimationFrame(() => {
      if (!tvFocusable(document.activeElement) && !activeDialog()) focusTvStart();
    });
    return pageReady.then(() => {
      if (!tvFocusable(document.activeElement) && !activeDialog()) focusTvStart();
    });
  }
  $$("button[data-page]").forEach((b) => b.addEventListener("click", () => setPage(b.dataset.page)));
  $("#manage-back").addEventListener("click", () => setPage(state.lastPage || "home"));
  window.addEventListener("hashchange", () => setPage(location.hash.slice(1), false));
  $("#profile").addEventListener("change", action(async () => {
    pauseMusic();
    ++state.musicGeneration;
    remoteMusic == null ? void 0 : remoteMusic.stop();
    remoteMusic = null;
    await saveVideo();
    state.profile = $("#profile").value;
    storage.set("profile", state.profile);
    if (navigator.onLine && !state.offline) await refreshProgress();
    else state.progress = offlineProgress(state.profile);
    syncVideoPreferences();
    await restoreMusic();
    renderCatalog();
    if (state.page === "music") await loadMusic();
  }));
  $("#add-profile").addEventListener("click", action(async () => {
    const name = await ask("Come si chiama il nuovo profilo?", "", "Ogni persona ha il proprio punto di ripresa.");
    if (!name) return;
    const profile = await api("/api/profiles", { method: "POST", data: { name } });
    state.boot.profiles.push(profile);
    state.profile = profile.id;
    populateProfiles();
    await refreshProgress();
    await videoApp.loadList().catch(() => {
    });
    renderCatalog();
    if ($("#who-dialog").open) videoApp.profileAdded(profile);
    else notify(`Profilo ${profile.name} pronto.`);
  }));
  function renderCatalog() {
    if (!state.boot) return;
    videoApp.render();
    $("#scan-note").textContent = [...state.boot.warnings || [], state.boot.pending ? `Sto preparando ${quantity(state.boot.pending, "anteprima", "anteprime")}, una alla volta.` : "Riproduzione diretta dai file di casa."].join(" ");
  }
  var video = $("#video");
  var qualityKey = () => {
    var _a2;
    return `quality:${((_a2 = state.current) == null ? void 0 : _a2.profile) || state.profile}`;
  };
  var qualityPreference = () => storage.get(qualityKey(), "auto");
  function connectionInfo() {
    const c2 = navigator.connection || {};
    let measuredKbps = state.measuredKbps;
    if (measuredKbps === void 0) {
      try {
        const r = performance.getEntriesByType("resource").find((e) => e.name.endsWith("/app.js") && e.transferSize > 2e4 && e.duration > 30);
        measuredKbps = r ? r.transferSize * 8 / r.duration : 0;
      } catch {
        measuredKbps = 0;
      }
      state.measuredKbps = measuredKbps;
    }
    return { host: location.hostname, effectiveType: c2.effectiveType, downlink: c2.downlink, saveData: c2.saveData, measuredKbps };
  }
  async function switchQuality(preference) {
    storage.set(qualityKey(), preference);
    syncLightMode();
    const current = state.current;
    if (!current || current.quality === "download") return;
    const next = chooseQuality(preference, current.item, connectionInfo());
    current.preference = preference;
    if (next === current.quality) return;
    const at = video.currentTime;
    const playing = !video.paused;
    current.quality = next;
    current.resume = at;
    current.ready = false;
    video.src = mediaUrl(current.item, next);
    video.load();
    if (playing) await video.play().catch(() => {
    });
    notify(next === "480" ? "Qualit\xE0: risparmio dati (480p)." : "Qualit\xE0: originale.");
  }
  function nextEpisode(item) {
    return followingEpisode(state.items, item);
  }
  var videoPlayRequest = 0;
  async function playItem(item, alreadySaved = false, { fromStart = false } = {}) {
    var _a2, _b2;
    if (item.remote && item.remoteDown) {
      notify("Il fisso \xE8 spento. Accendilo per guardare questo titolo.");
      return;
    }
    const request = ++videoPlayRequest;
    const profile = state.profile;
    try {
      if (!alreadySaved) saveVideo().catch((e) => notify(e.message, true));
      if (request !== videoPlayRequest || profile !== state.profile) return;
      pauseMusic();
      const local = downloadedIds.has(item.id);
      const quality = local ? "download" : chooseQuality(storage.get(`quality:${state.profile}`, "auto"), item, connectionInfo());
      state.current = { item, profile: state.profile, ready: false, skipped: /* @__PURE__ */ new Set(), quality };
      syncVideoPreferences();
      state.saveAt = 0;
      $("#player-title").textContent = item.series || item.title;
      $("#vp-episode").textContent = item.series ? `S${item.season}:E${item.episode} ${item.title}` : "";
      $("#video-error").hidden = true;
      $("#skip-intro").hidden = true;
      $("#skip-recap").hidden = true;
      $("#skip-ending").hidden = true;
      $("#next-episode").hidden = true;
      video.replaceChildren(...(item.subtitles || []).map((s, i) => el("track", { kind: "subtitles", label: s.language || s.name, srclang: /^[a-z]{2,3}$/.test(s.language) ? s.language : "it", src: `/media/${item.id}/subtitle/${i}` })));
      const resume = state.progress[item.id];
      state.current.resume = fromStart || (resume == null ? void 0 : resume.watched) ? 0 : (resume == null ? void 0 : resume.position) || 0;
      $("#video-info").textContent = `${item.root} \xB7 ${minutes(item.duration)} \xB7 ${fmtSize(item.size)}. ${quantity(((_a2 = item.subtitles) == null ? void 0 : _a2.length) || 0, "sottotitolo", "sottotitoli")}. Se il formato non \xE8 supportato, usa VLC o il lettore DLNA della TV.`;
      showDialog("#video-dialog");
      (_b2 = globalThis.mediatecaPlayer) == null ? void 0 : _b2.opened(item);
      video.src = local ? playURL(item.id) : mediaUrl(item, quality);
      video.load();
      video.focus();
      await video.play();
    } catch (e) {
      if (request === videoPlayRequest && profile === state.profile && e.name !== "AbortError") {
        $("#video-error").textContent = "Il browser non riesce a riprodurre questo file. Prova il lettore DLNA/VLC della TV, oppure controlla la connessione.";
        $("#video-error").hidden = false;
      }
    }
  }
  video.addEventListener("loadedmetadata", () => {
    if (!state.current) return;
    const { resume } = state.current;
    if (resume && Number.isFinite(video.duration)) video.currentTime = Math.min(resume, Math.max(0, video.duration - 1));
    state.current.ready = true;
  });
  var readPending = (profile) => storage.get(pendingKey(profile), {}) || {};
  function dropPending(profile, id) {
    const all = readPending(profile);
    if (id in all) {
      delete all[id];
      storage.set(pendingKey(profile), all);
    }
  }
  function holdProgress(data) {
    var _a2;
    const all = readPending(data.profile);
    notePending(all, data.id, data);
    storage.set(pendingKey(data.profile), all);
    const old = state.progress[data.id] || {};
    return { ...old, position: data.position, duration: data.duration, watched: (_a2 = data.watched) != null ? _a2 : old.watched || all[data.id].watched, updated: all[data.id].at };
  }
  var offlineProgress = (profile) => ({ ...storage.get(`progress-cache:${profile}`, {}), ...asProgress(readPending(profile)) });
  function cacheProgress() {
    if (downloadedIds.size) storage.set(`progress-cache:${state.profile}`, Object.fromEntries([...downloadedIds].filter((id) => state.progress[id]).map((id) => [id, state.progress[id]])));
  }
  var syncing = null;
  function syncPendingProgress() {
    return syncing || (syncing = (async () => {
      var _a2;
      for (const p of ((_a2 = state.boot) == null ? void 0 : _a2.profiles) || []) {
        const pending = readPending(p.id);
        if (!Object.keys(pending).length) continue;
        try {
          storage.set(pendingKey(p.id), await syncPending(p.id, pending, api));
        } catch {
        }
      }
    })().finally(() => {
      syncing = null;
    }));
  }
  async function saveVideo(watched) {
    const current = state.current;
    if (!(current == null ? void 0 : current.ready) || !Number.isFinite(video.duration) || video.duration <= 0 || current.transitioning && watched === void 0) return;
    const data = { profile: current.profile, id: current.item.id, position: video.currentTime, duration: video.duration, ...watched === void 0 ? {} : { watched } };
    const task = (current.saveQueue || Promise.resolve()).catch(() => {
    }).then(async () => {
      if (state.offline || !navigator.onLine) return holdProgress(data);
      try {
        const saved = await api("/api/progress", { method: "PUT", data });
        dropPending(data.profile, data.id);
        return saved;
      } catch (error) {
        if (error.status) throw error;
        return holdProgress(data);
      }
    });
    current.saveQueue = task;
    const result = await task;
    if (state.profile === current.profile) state.progress[current.item.id] = result;
  }
  function activeSkip() {
    var _a2;
    if (!((_a2 = state.current) == null ? void 0 : _a2.ready)) return null;
    return playbackAction(state.current.item, video.currentTime, video.duration, !!nextEpisode(state.current.item), { autoSkip: $("#autoskip").checked, autoNext: $("#autonext").checked });
  }
  async function performSkip(value = activeSkip()) {
    const current = state.current;
    if (!current || !value || current.transitioning) return;
    current.skipped.add(value.kind);
    if (value.next) {
      const next = nextEpisode(current.item);
      if (!next) return;
      current.transitioning = true;
      try {
        await saveVideo(true);
        if (state.current === current) await playItem(next, true);
      } finally {
        current.transitioning = false;
      }
    } else {
      const from = video.currentTime;
      video.currentTime = value.target;
      updateVideoSkips();
      if (value.automatic) showSkipToast(value.kind, from);
    }
  }
  var skipToastTimer = 0;
  function showSkipToast(kind, from) {
    const text = { sigla: "Sigla saltata", riassunto: "Riassunto saltato", finale: "Finale saltato", anteprima: "Anteprima saltata" }[kind] || "Tratto saltato";
    $("#skip-toast-text").textContent = text;
    const toast = $("#skip-toast");
    toast.hidden = false;
    toast.dataset.from = String(from);
    toast.classList.remove("run");
    void toast.offsetWidth;
    toast.classList.add("run");
    clearTimeout(skipToastTimer);
    skipToastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 2e3);
  }
  $("#skip-undo").addEventListener("click", () => {
    const toast = $("#skip-toast");
    const from = Number(toast.dataset.from);
    toast.hidden = true;
    clearTimeout(skipToastTimer);
    if (Number.isFinite(from)) {
      video.currentTime = from;
      updateVideoSkips();
    }
  });
  function updateVideoSkips() {
    const value = activeSkip();
    for (const [id, kind] of [["skip-intro", "sigla"], ["skip-recap", "riassunto"], ["skip-ending", "finale"], ["next-episode", "next"]]) {
      const button = document.getElementById(id);
      button.hidden = !value || (kind === "next" ? !value.next : value.next || value.kind !== kind);
      if (!button.hidden) button.textContent = value.label;
    }
    if ((value == null ? void 0 : value.kind) === "anteprima" && !value.next) {
      $("#skip-ending").hidden = false;
      $("#skip-ending").textContent = value.label;
    }
    const current = state.current;
    if ((value == null ? void 0 : value.automatic) && !video.paused && !video.seeking && current && !current.skipped.has(value.kind)) performSkip(value).catch((e) => notify(e.message, true));
  }
  video.addEventListener("timeupdate", () => {
    if (!state.current) return;
    updateVideoSkips();
    if (Date.now() - state.saveAt > 5e3) {
      state.saveAt = Date.now();
      saveVideo().catch(() => {
      });
    }
  });
  video.addEventListener("seeked", updateVideoSkips);
  video.addEventListener("loadedmetadata", updateVideoSkips);
  video.addEventListener("pause", () => saveVideo().catch(() => {
  }));
  video.addEventListener("ended", action(async () => {
    const current = state.current;
    if (!current || current.transitioning) return;
    current.transitioning = true;
    try {
      await saveVideo(true);
      if (state.current !== current) return;
      renderCatalog();
      const next = nextEpisode(current.item);
      if (next && $("#autonext").checked && !current.stay) await playItem(next, true);
    } finally {
      current.transitioning = false;
    }
  }));
  video.addEventListener("error", () => {
    const current = state.current;
    if ((current == null ? void 0 : current.quality) === "download" && navigator.onLine && !state.offline) {
      downloadedIds.delete(current.item.id);
      current.quality = "original";
      current.resume = video.currentTime || current.resume;
      current.ready = false;
      video.src = mediaUrl(current.item, "original");
      video.load();
      video.play().catch(() => {
      });
      return;
    }
    $("#video-error").textContent = "Il browser non legge questo formato oppure il file non \xE8 raggiungibile. Prova VLC/DLNA o controlla il Wi-Fi.";
    $("#video-error").hidden = false;
  });
  $("#video-dialog").addEventListener("close", () => {
    var _a2;
    (_a2 = globalThis.ApollonAndroid) == null ? void 0 : _a2.setVideoMode(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {
    });
    videoPlayRequest++;
    const saving = saveVideo();
    state.current = null;
    video.pause();
    video.removeAttribute("src");
    video.load();
    saving.catch((e) => notify(e.message, true)).finally(renderCatalog);
  });
  $("#close-player").addEventListener("click", () => $("#video-dialog").close());
  for (const selector of ["#skip-intro", "#skip-recap", "#skip-ending", "#next-episode"]) $(selector).addEventListener("click", action(() => performSkip()));
  $("#fullscreen").addEventListener("click", action(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($("#video-stage").requestFullscreen) await $("#video-stage").requestFullscreen();
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else notify("Usa il comando schermo intero del lettore.");
  }));
  document.addEventListener("fullscreenchange", () => {
    ($("#fullscreen").querySelector(".vp-label") || $("#fullscreen")).textContent = document.fullscreenElement ? "Esci da schermo intero" : "Schermo intero";
  });
  $("#lightmode").addEventListener("change", action(async () => {
    await switchQuality($("#lightmode").checked ? "auto" : "original");
    if (!$("#vp-panel").hidden && $("#vp-panel-title").textContent === "Impostazioni") {
      $("#vp-settings").click();
      $("#lightmode").focus({ preventScroll: true });
    }
  }));
  for (const selector of ["#autonext", "#autoskip"]) $(selector).addEventListener("change", action(async () => {
    try {
      await saveVideoPreferences();
    } catch (e) {
      syncVideoPreferences();
      throw e;
    }
    updateVideoSkips();
  }));
  function flushPosition() {
    const current = state.current;
    if ((current == null ? void 0 : current.ready) && !current.transitioning && Number.isFinite(video.duration)) fetch("/api/progress", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: current.profile, id: current.item.id, position: video.currentTime, duration: video.duration }), keepalive: true }).catch(() => {
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPosition();
  });
  window.addEventListener("pagehide", flushPosition);
  var audio = $("#audio");
  function measureAudioBar() {
    document.documentElement.style.setProperty("--audio-bar-height", `${$("#audio-bar").getBoundingClientRect().height}px`);
  }
  if ("ResizeObserver" in window) new ResizeObserver(measureAudioBar).observe($("#audio-bar"));
  window.addEventListener("resize", measureAudioBar);
  measureAudioBar();
  var storedVolume = Number(storage.get("volume", 0.8));
  audio.volume = Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 1 ? storedVolume : 0.8;
  function musicImage(id, size = 160) {
    return id ? `/api/music/cover?id=${encodeURIComponent(id)}&size=${size}&offline=${encodeURIComponent(`${musicKey()}:${state.profile}`)}` : "/music-cover.svg";
  }
  var lyrics = { synced: false, lines: [] };
  var lyricAt = -2;
  var lyricRequest;
  var songGeneration = 0;
  function centerLyric(index) {
    const box = $("#lyrics-lines");
    const row = box.children[index];
    if (!row || !$("#music-player").open || !box.clientHeight) return;
    box.style.setProperty("--lyric-padding", `${box.clientHeight / 2}px`);
    box.scrollTo({
      top: box.scrollTop + row.getBoundingClientRect().top - box.getBoundingClientRect().top - (box.clientHeight - row.clientHeight) / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"
    });
  }
  function updateLyrics(force = false) {
    var _a2, _b2;
    if (!lyrics.synced) return;
    const position = typeof remoteMusic !== "undefined" && (remoteMusic == null ? void 0 : remoteMusic.isRemote()) ? ((_b2 = (_a2 = remoteMusic.remote()) == null ? void 0 : _a2.state) == null ? void 0 : _b2.position) || 0 : audio.currentTime;
    const index = currentLyric(lyrics.lines, position);
    if (!force && index === lyricAt) return;
    lyricAt = index;
    [...$("#lyrics-lines").children].forEach((row, i) => {
      row.classList.toggle("past", i < index);
      row.classList.toggle("current", i === index);
      if (i === index) row.setAttribute("aria-current", "true");
      else row.removeAttribute("aria-current");
    });
    if (force || !$("#lyrics-lines").contains(document.activeElement)) centerLyric(index);
  }
  async function loadLyrics(song2, generation) {
    lyricRequest == null ? void 0 : lyricRequest.abort();
    const request = new AbortController();
    lyricRequest = request;
    lyrics = { synced: false, lines: [] };
    lyricAt = -2;
    $("#lyrics-note").textContent = "Cerco il testo\u2026";
    $("#lyrics-lines").replaceChildren();
    $("#lyrics-lines").style.removeProperty("--lyric-padding");
    $("#lyrics-preview").textContent = "Cerco il testo\u2026";
    try {
      const response = await api(`/api/music/lyrics?id=${encodeURIComponent(song2.id)}`, { signal: request.signal });
      if (generation !== songGeneration) return;
      lyrics = normalizeLyrics(response);
      $("#lyrics-preview").replaceChildren(...lyrics.lines.length ? lyrics.lines.filter((l) => l.text).slice(0, 3).map((l) => el("span", {}, l.text)) : ["Testo non disponibile per questo brano"], el("small", {}, "Apri il testo"));
      $("#lyrics-note").textContent = !lyrics.lines.length ? "Testo non disponibile per questo brano" : lyrics.synced ? "Segui la musica. Tocca una riga per saltare l\xEC." : "Solo testo \xB7 scorri per leggerlo.";
      $("#lyrics-lines").replaceChildren(...lyrics.lines.map((line2, index) => lyrics.synced ? el("button", { class: "lyric-line", "aria-label": `${line2.text || "Pausa"} \xB7 ${fmtTime(line2.start / 1e3)}`, onclick: () => {
        if (remoteMusic == null ? void 0 : remoteMusic.isRemote()) {
          remoteMusic.send("seek", { position: line2.start / 1e3 }).catch((e) => notify(e.message, true));
          return;
        }
        if (!Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.min(audio.duration, line2.start / 1e3);
        updateLyrics(true);
      } }, line2.text || "\u266A") : el("p", { class: "lyric-line plain-line" }, line2.text || "\xA0")));
      $("#lyrics-lines").scrollTop = 0;
      updateLyrics(true);
    } catch (error) {
      if (request.signal.aborted || generation !== songGeneration) return;
      $("#lyrics-note").textContent = "Non riesco a caricare il testo. La musica continua.";
      $("#lyrics-preview").textContent = "Non riesco a caricare il testo. Tocca per riprovare.";
      $("#lyrics-lines").replaceChildren(el("button", { class: "secondary", onclick: () => loadLyrics(song2, generation) }, "Riprova il testo"));
    }
  }
  function playerView(words) {
    $("#music-player").classList.toggle("show-words", words);
    $("#view-cover").setAttribute("aria-pressed", String(!words));
    $("#view-lyrics").setAttribute("aria-pressed", String(words));
    $("#music-player").scrollTop = 0;
    updateLyrics(true);
  }
  var playerMotion = new PlayerMotion($("#music-player"), $("#audio-bar"), $("#full-cover"), $("#audio-cover"));
  var playerClosing = false;
  function openMusicPlayer(words = false) {
    if (playerClosing) return;
    const wasOpen = $("#music-player").open;
    showDialog("#music-player");
    playerView(words);
    loadPlayerDetails();
    renderQueuePreview();
    refreshMarquees();
    if (!wasOpen) {
      $("#music-player").scrollTop = 0;
      playerMotion.run(true);
    }
  }
  async function closeMusicPlayer(startRect) {
    if (playerClosing || !$("#music-player").open) return;
    playerClosing = true;
    try {
      await playerMotion.run(false, startRect);
      $("#music-player").close();
    } finally {
      playerClosing = false;
    }
  }
  $("#music-player").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeMusicPlayer();
  });
  $("#music-player").addEventListener("close", () => playerMotion.cancel());
  function performPlayerGesture(name, rect) {
    if (name === "previous" && state.queueIndex === 0) return false;
    if (name === "next" && playback.candidate(false) < 0 && !radio) return false;
    if (name === "open") openMusicPlayer();
    else if (name === "close") closeMusicPlayer(rect);
    else if (name === "previous") playSong(Math.max(0, state.queueIndex - 1));
    else nextSong();
  }
  var gesturesEnabled = () => matchMedia("(max-width:650px)").matches && !document.documentElement.classList.contains("tv") && !playerClosing && !playerMotion.cleanup;
  bindPlayerGesture($("#audio-bar"), { mode: "mini", enabled: gesturesEnabled, perform: performPlayerGesture, feedback: vibrateFeedback });
  bindPlayerGesture($("#full-cover"), { mode: "cover", moving: $("#music-player"), scroller: $("#music-player"), enabled: gesturesEnabled, perform: performPlayerGesture, feedback: vibrateFeedback });
  bindPlayerGesture($("#music-player > .dialog-heading"), { mode: "handle", moving: $("#music-player"), scroller: $("#music-player"), enabled: gesturesEnabled, perform: performPlayerGesture, feedback: vibrateFeedback });
  var refreshMarquees = watchMarquees([$("#audio-title"), $("#full-title")]);
  var feedbackKey = () => {
    var _a2;
    return `music-options:${((_a2 = state.boot) == null ? void 0 : _a2.musicUser) || "guest"}:${state.profile}`;
  };
  var musicFeedback = { vibration: true };
  function restoreMusicFeedback() {
    const saved = storage.get(feedbackKey(), {});
    musicFeedback = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    $("#music-vibration").checked = musicFeedback.vibration !== false;
    playback.setEqualizer(equalizerSettings(musicFeedback.equalizer));
    paintEqualizer();
  }
  function vibrateFeedback() {
    vibrate(musicFeedback.vibration !== false);
  }
  $("#music-vibration").addEventListener("change", () => {
    musicFeedback.vibration = $("#music-vibration").checked;
    storage.set(feedbackKey(), musicFeedback);
  });
  for (const [id, name] of [["audio-prev", "previous"], ["audio-next", "next"], ["full-prev", "previous"], ["full-next", "next"], ["audio-toggle", "play"], ["full-toggle", "play"]]) setMusicIcon(document.getElementById(id), name);
  $("#music-player .close-dialog").replaceChildren(musicIcon("close"));
  function songIndicator(song2) {
    var _a2;
    const current = ((_a2 = state.queue[state.queueIndex]) == null ? void 0 : _a2.id) === song2.id;
    return el("span", {
      class: `playing-indicator${!audio.paused ? " running" : ""}`,
      "data-playing-song": song2.id,
      hidden: !current,
      role: "img",
      "aria-label": audio.paused ? "In pausa" : "In riproduzione"
    }, musicIcon("bars"));
  }
  function syncIndicators() {
    var _a2;
    const id = (_a2 = state.queue[state.queueIndex]) == null ? void 0 : _a2.id;
    $$("[data-playing-song]").forEach((n) => {
      n.hidden = n.dataset.playingSong !== id;
      n.classList.toggle("running", !audio.paused);
      n.setAttribute("aria-label", audio.paused ? "In pausa" : "In riproduzione");
    });
  }
  function pulseHearts(id) {
    var _a2;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const buttons = $$("[data-song-heart]").filter((b) => b.dataset.songHeart === id);
    if (((_a2 = state.queue[state.queueIndex]) == null ? void 0 : _a2.id) === id) buttons.push($("#full-like"));
    for (const b of buttons) {
      const icon = b.querySelector("svg");
      if (!(icon == null ? void 0 : icon.animate)) continue;
      const animation = icon.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)", offset: 0.4 }, { transform: "scale(1)" }], { duration: 240, easing: "ease-out" });
      animation.finished.then(() => animation.cancel(), () => {
      });
    }
  }
  function musicPageUpdate(generation, render) {
    return changeMusicPage(
      () => {
        if (generation === state.musicGeneration) render();
      },
      { enabled: state.page === "music" && !activeDialog() && !matchMedia("(prefers-reduced-motion: reduce)").matches }
    );
  }
  $("#equalizer-preset").replaceChildren(...Object.entries(EQ_PRESETS).map(([value, p]) => el("option", { value }, p.label)));
  $("#equalizer-bands").replaceChildren(...EQ_BANDS.map((hz, i) => el(
    "label",
    {},
    `${hz < 1e3 ? hz + " Hz" : hz / 1e3 + " kHz"}`,
    el("input", {
      id: `eq-band-${i}`,
      "aria-label": `Equalizzatore ${hz} Hz`,
      type: "range",
      min: -9,
      max: 9,
      step: 1,
      value: 0,
      oninput: (event) => {
        const gains = [...playback.equalizer.gains];
        gains[i] = Number(event.target.value);
        applyEqualizer({ preset: "custom", custom: gains });
      }
    }),
    el("output", { id: `eq-value-${i}`, for: `eq-band-${i}` }, "0 dB")
  )));
  function paintEqualizer() {
    $("#equalizer-preset").value = playback.equalizer.preset;
    playback.equalizer.gains.forEach((gain, i) => {
      document.getElementById(`eq-band-${i}`).value = gain;
      document.getElementById(`eq-value-${i}`).textContent = `${gain > 0 ? "+" : ""}${gain} dB`;
    });
    const supported = !!(window.AudioContext || window.webkitAudioContext);
    $("#equalizer-controls").disabled = !supported;
    if (!supported) $("#equalizer-note").textContent = "L\u2019equalizzatore non \xE8 disponibile in questo browser. Puoi ascoltare con il suono normale.";
  }
  async function applyEqualizer(value) {
    playback.setEqualizer(value);
    musicFeedback.equalizer = playback.equalizer;
    storage.set(feedbackKey(), musicFeedback);
    paintEqualizer();
    const ready = await playback.prepareAudio();
    $("#equalizer-note").textContent = ready ? "Il volume pu\xF2 scendere un po\u2019 per mantenere il suono pulito." : "Tocca Riproduci per attivare il suono scelto. Se non parte, usa Normale.";
  }
  $("#equalizer-preset").addEventListener("change", () => applyEqualizer(selectEqualizer($("#equalizer-preset").value, playback.equalizer)));
  $("#open-music-player").addEventListener("click", () => openMusicPlayer());
  $("#bar-lyrics").addEventListener("click", () => openMusicPlayer(true));
  $("#view-cover").addEventListener("click", () => playerView(false));
  $("#view-lyrics").addEventListener("click", () => playerView(true));
  $("#lyrics-preview").addEventListener("click", () => {
    playerView(true);
    $("#lyrics-lines").focus();
  });
  $("#player-open-queue").addEventListener("click", () => showDialog("#queue-dialog"));
  var detailRequest;
  var detailSong;
  var playerArtist;
  async function loadPlayerDetails(force = false) {
    var _a2, _b2;
    const song2 = state.queue[state.queueIndex];
    const key = `${musicKey()}/${song2 == null ? void 0 : song2.id}`;
    if (!song2 || !$("#music-player").open || !force && detailSong === key) return;
    detailRequest == null ? void 0 : detailRequest.abort();
    const request = new AbortController();
    detailRequest = request;
    detailSong = key;
    playerArtist = null;
    $("#track-facts").replaceChildren(el("p", { class: "muted" }, "Cerco i dati\u2026"));
    $("#player-artist").textContent = song2.artist || "Artista sconosciuto";
    $("#artist-radio").disabled = true;
    $("#retry-player-details").hidden = true;
    try {
      const result = await api(`/api/music/details?id=${encodeURIComponent(song2.id)}`, { signal: request.signal });
      if (request.signal.aborted || `${musicKey()}/${(_a2 = state.queue[state.queueIndex]) == null ? void 0 : _a2.id}` !== key) return;
      const s = result.song;
      playerArtist = result.artist;
      const rows = [
        ["Album", s.album],
        ["Anno", s.year],
        ["Genere", s.genre],
        ["Mood", (_b2 = s.mood) == null ? void 0 : _b2.join(", ")],
        ["BPM", s.bpm],
        ["Tonalit\xE0", s.tonalita],
        ["Energia", s.energia == null ? null : `${s.energia}/100`],
        ["Durata", s.duration == null ? null : fmtTime(s.duration)],
        ["Formato", s.format],
        ["Bitrate", s.bitRate ? `${s.bitRate} kb/s` : null]
      ];
      $("#track-facts").replaceChildren(...rows.flatMap(([name, value]) => [el("dt", {}, name), el("dd", {}, value === "" || value == null ? "Non disponibile" : value)]));
      $("#player-artist").replaceChildren(
        el("img", { src: musicImage(playerArtist.coverArt, 400), alt: "", loading: "lazy", onerror: (event) => {
          event.target.hidden = true;
        } }),
        el("h3", {}, playerArtist.name),
        el("p", { class: "muted" }, `${quantity(playerArtist.songCount, "brano", "brani")} nella tua raccolta`)
      );
      $("#artist-radio").disabled = !playerArtist.id;
    } catch (error) {
      if (request.signal.aborted) return;
      detailSong = null;
      $("#track-facts").replaceChildren(el("p", { class: "muted" }, "I dati non sono disponibili. La musica continua."));
      $("#retry-player-details").hidden = false;
    }
  }
  $("#retry-player-details").addEventListener("click", () => loadPlayerDetails(true));
  $("#artist-radio").addEventListener("click", action(() => (playerArtist == null ? void 0 : playerArtist.id) && startSelection({ kind: "radio", artist: playerArtist.id })));
  function renderQueuePreview() {
    const next = state.queue.slice(state.queueIndex + 1, state.queueIndex + 4);
    $("#queue-preview").replaceChildren(...next.map((s, i) => el("li", { class: "track-row" }, el(
      "button",
      { class: "track-main", onclick: () => playSong(state.queueIndex + i + 1), "aria-label": `Ascolta dalla coda ${s.title}` },
      songIndicator(s),
      el("img", { class: "track-cover", src: musicImage(s.coverArt || s.albumId, 80), alt: "", loading: "lazy" }),
      el("span", { class: "track-text" }, el("strong", {}, s.title), el("small", {}, s.artist || ""))
    ))));
    if (!next.length) $("#queue-preview").append(el("li", { class: "muted" }, "Non ci sono altri brani in coda."));
  }
  if ("ResizeObserver" in window) new ResizeObserver(() => {
    if (lyrics.synced) centerLyric(lyricAt);
  }).observe($("#lyrics-lines"));
  $("#full-cover").addEventListener("error", () => {
    $("#music-player").style.removeProperty("--cover-color");
    if ($("#full-cover").getAttribute("src") !== "/music-cover.svg") $("#full-cover").src = "/music-cover.svg";
  });
  $("#full-cover").addEventListener("load", () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage($("#full-cover"), 0, 0, 16, 16);
      const pixels = ctx.getImageData(0, 0, 16, 16).data;
      const rgb = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) for (let c2 = 0; c2 < 3; c2++) rgb[c2] += pixels[i + c2];
      $("#music-player").style.setProperty("--cover-color", `rgb(${rgb.map((v) => Math.round(v / 256 * 0.48)).join(" ")})`);
    } catch {
      $("#music-player").style.removeProperty("--cover-color");
    }
  });
  function albumCard(album) {
    return el(
      "button",
      { class: "card shelf-card", onclick: action(() => openAlbum(album.id)), "aria-label": `Apri album ${album.name}` },
      art(el, musicImage, { ids: [album.coverArt], name: album.name }),
      el("h3", { class: "shelf-title" }, album.name || "Album senza titolo"),
      el("span", { class: "meta shelf-sub" }, album.artist || "Artista sconosciuto")
    );
  }
  var moodSymbols = { Energia: "\u2197", Festa: "\u2726", Relax: "\u2248", Concentrazione: "\u25CE", Malinconia: "\u2602", Notte: "\u263E", "Soul e jazz": "\u266B", Grinta: "\u03DF", "In viaggio": "\u279C" };
  function musicCollectionCard(group, type, index) {
    const cover = lazyArt(musicContext(), art(el, musicImage, { name: group.nome, glyph: moodSymbols[group.nome] || "\u266B" }), type, group.nome);
    cover.classList.add("tilt");
    return hued(el(
      "button",
      { class: `mood-card${type === "generi" ? " genre-card" : ""}`, "aria-label": `Apri ${type === "mood" ? "mood" : "genere"} ${group.nome}`, onclick: () => openCollection(type, group.nome) },
      el("strong", { class: "tile-name" }, group.nome),
      el("small", { class: "tile-count" }, quantity(group.brani, "brano", "brani")),
      cover
    ), "--tile-hue", (nameHue(group.nome) + index * 7) % 230);
  }
  function musicSkeleton(kind = "list") {
    const block = (cls) => el("span", { class: `skeleton-block ${cls}` });
    return el(
      "div",
      { class: `music-skeleton skeleton-${kind}`, role: "status", "aria-label": "Carico la musica" },
      kind === "home" ? [el("div", { class: "skeleton-quick" }, ...Array.from({ length: 8 }, () => block("quick"))), block("heading"), el("div", { class: "skeleton-shelf" }, ...Array.from({ length: 4 }, () => block("cover")))] : [block("hero"), ...Array.from({ length: 6 }, () => el("div", { class: "skeleton-row" }, block("thumb"), block("line")))]
    );
  }
  function musicLoading(kind) {
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches || !$("#music-results").children.length) {
      $("#music-breadcrumb").replaceChildren();
      $("#music-results").replaceChildren(musicSkeleton(kind));
    }
  }
  function collectionMenu(title, entries) {
    $("#song-menu-title").textContent = title;
    $("#song-menu-actions").replaceChildren(...entries.filter(Boolean).map(([label, fn]) => el("button", { class: "secondary", onclick: action(async () => {
      $("#song-menu").close();
      await fn();
    }) }, label)));
    showDialog("#song-menu");
  }
  async function openCollection(type, name) {
    const generation = ++state.musicGeneration;
    musicVisit(`${type}:${name}`, name, () => openCollection(type, name));
    $("#more-albums").hidden = true;
    musicLoading("list");
    try {
      const result = await api(`/api/music/collection?type=${type}&name=${encodeURIComponent(name)}`);
      if (generation !== state.musicGeneration) return;
      const songs = result.songs || [];
      await musicPageUpdate(generation, () => {
        const cover = art(el, musicImage, { ids: songs.map((s) => s.coverArt || s.albumId), name, glyph: moodSymbols[name] || "\u266B", size: 400 });
        $("#music-breadcrumb").replaceChildren(hero(el, {
          cover,
          kind: type === "mood" ? "Il tuo momento" : "Il tuo suono",
          title: name,
          sub: `${quantity(songs.length, "brano pronto", "brani pronti")} da ascoltare`,
          tools: [
            heroButton(el, "add", "Aggiungi alla coda", () => addToQueue(songs), { disabled: !songs.length }),
            el("button", { class: "hero-text-button", onclick: action(() => {
              var _a2;
              return startSelection({ kind: "radio", ...type === "mood" ? { mood: name } : { seed: (_a2 = songs[0]) == null ? void 0 : _a2.id } });
            }) }, "Avvia radio")
          ],
          shuffle: heroButton(el, "shuffle", "Mescola", action(() => shuffleSongs(songs)), { disabled: !songs.length }),
          play: heroPlay(el, () => setQueue(songs, 0), !songs.length)
        }));
        $("#music-results").replaceChildren(...[
          result.missing ? el("p", { class: "catalog-note" }, `${quantity(result.missing, "brano non \xE8 ancora collegato", "brani non sono ancora collegati")}. Aggiorna l\u2019indice in Navidrome e controlla che i file siano nella cartella del catalogo. Non vengono sostituiti con brani dallo stesso titolo.`) : null,
          songs.length ? trackList(songs) : el("div", { class: "empty" }, el("h3", {}, "Nessun brano pronto in questa raccolta"), el("p", {}, "Puoi ascoltare le playlist Mood e Generi importate da Navidrome."))
        ].filter(Boolean));
      });
    } catch (e) {
      if (generation === state.musicGeneration) $("#music-results").replaceChildren(el("div", { class: "empty" }, el("p", {}, e.message), el("button", { class: "secondary", onclick: () => openCollection(type, name) }, "Riprova")));
    }
  }
  var MUSIC_SECTIONS = { home: "home", recap: "home", moment: "home", browse: "search", library: "library", songs: "library", albums: "library", artists: "library", playlists: "library", liked: "library", recent: "library", top: "library", history: "library" };
  var MUSIC_TITLES = { home: "Home", recap: "Il tuo mese", moment: "Il tuo momento", browse: "Cerca", library: "La tua libreria", songs: "Tutti i brani", albums: "Tutti gli album", artists: "Tutti gli artisti", playlists: "Tutte le playlist", liked: "Brani che ti piacciono", recent: "Ascoltati di recente", top: "I pi\xF9 ascoltati", history: "Cronologia" };
  var musicTrail = [];
  var musicReturning = false;
  function musicSection(section) {
    if (!section) return;
    document.body.dataset.musicSection = section;
    $$("#music-nav [data-section]").forEach((b) => {
      if (b.dataset.section !== "create") b.setAttribute("aria-pressed", String(b.dataset.section === section));
    });
  }
  function musicVisit(key, title, run, section) {
    var _a2;
    musicSection(section || (musicTrail.length ? void 0 : "home"));
    if (!musicReturning && ((_a2 = musicTrail.at(-1)) == null ? void 0 : _a2.key) !== key) {
      const top = musicTrail.at(-1);
      if (top) top.scroll = window.scrollY;
      if (["tab:home", "tab:browse", "tab:library"].includes(key)) musicTrail.length = 0;
      musicTrail.push({ key, title, run, scroll: 0, section: document.body.dataset.musicSection });
      if (musicTrail.length > 40) musicTrail.splice(1, 1);
      if (state.page === "music" && window.scrollY > 0) window.scrollTo({ top: 0, behavior: "instant" });
    }
    musicTitle(title);
  }
  function musicTitle(title) {
    const top = musicTrail.at(-1);
    if (top && title) top.title = title;
    $("#music-top-title").textContent = (top == null ? void 0 : top.title) || "";
    $("#music-top").hidden = musicTrail.length < 2;
    document.body.classList.toggle("music-subpage", musicTrail.length > 1);
    requestAnimationFrame(musicHeroScroll);
  }
  async function musicBack() {
    if (musicTrail.length < 2) return;
    musicTrail.pop();
    const back = musicTrail.at(-1);
    musicReturning = true;
    musicSection(back.section);
    try {
      await back.run();
    } finally {
      musicReturning = false;
    }
    musicTitle(back.title);
    requestAnimationFrame(() => window.scrollTo({ top: back.scroll || 0, behavior: "instant" }));
  }
  function musicHeroScroll() {
    const top = $("#music-top");
    const node = $("#music-breadcrumb .music-hero");
    if (!node || state.page !== "music") {
      top.classList.toggle("solid", !top.hidden);
      top.style.removeProperty("--top-color");
      return;
    }
    const rect = node.getBoundingClientRect();
    const reach = Math.max(1, rect.height - 140);
    const progress = Math.min(1, Math.max(0, (top.getBoundingClientRect().bottom - rect.top - 56) / reach));
    node.style.setProperty("--hero-fade", (1 - progress).toFixed(3));
    top.classList.toggle("solid", progress > 0.72);
    const color = node.style.getPropertyValue("--hero-color");
    if (color) top.style.setProperty("--top-color", color);
  }
  var musicScrollFrame = 0;
  window.addEventListener("scroll", () => {
    if (state.page !== "music" || musicScrollFrame) return;
    musicScrollFrame = requestAnimationFrame(() => {
      musicScrollFrame = 0;
      musicHeroScroll();
    });
  }, { passive: true });
  $("#music-back").addEventListener("click", action(musicBack));
  var libraryModule;
  var offlineModules = /* @__PURE__ */ new Map();
  async function musicOffline() {
    const key = `${musicKey()}:${state.profile}`;
    if (!offlineModules.has(key)) offlineModules.set(key, Promise.resolve().then(() => (init_music_offline(), music_offline_exports)).then((m) => m.offlineLibrary({ ...musicContext(), key: () => key, fmtSize, setPage })));
    return offlineModules.get(key);
  }
  function flushPlayed(profile = state.profile) {
    if (!navigator.onLine || state.offline) return;
    const user = state.boot.musicUser, key = `${musicKey()}:${profile}:pending-listens`;
    if (!Object.keys(storage.get(key, {})).length) return;
    Promise.resolve().then(() => (init_music_listening(), music_listening_exports)).then((m) => m.flushListening(storage, key, (event) => api("/api/music/played", { method: "POST", data: { ...event, profile, user } }))).catch(() => {
    });
  }
  function recordPlayed(data) {
    var _a2;
    const profile = state.listeningProfile || state.profile, key = `${musicKey()}:${profile}:pending-listens`, pending = storage.get(key, {});
    if ((((_a2 = pending[data.playId]) == null ? void 0 : _a2.seconds) || 0) < data.seconds) pending[data.playId] = data;
    storage.set(key, Object.fromEntries(Object.entries(pending).slice(-2e3)));
    flushPlayed(profile);
  }
  var remoteMusic;
  var devicesStarting;
  async function ensureDevices() {
    var _a2;
    if (!((_a2 = state.boot) == null ? void 0 : _a2.music) || !navigator.onLine) return;
    const key = `${musicKey()}:${state.profile}`;
    if (devicesStarting) return devicesStarting;
    if ((remoteMusic == null ? void 0 : remoteMusic.scope) === key && !remoteMusic.stopped) return;
    remoteMusic == null ? void 0 : remoteMusic.stop();
    remoteMusic = null;
    devicesStarting = (async () => {
      const [{ DeviceClient: DeviceClient2 }, { deviceBridge: deviceBridge2 }] = await Promise.all([Promise.resolve().then(() => (init_music_devices(), music_devices_exports)), Promise.resolve().then(() => (init_music_device_bridge(), music_device_bridge_exports))]);
      if (`${musicKey()}:${state.profile}` !== key) return;
      const client = new DeviceClient2(deviceBridge2({
        ...musicContext(),
        getAudio: () => audio,
        playback,
        playSong,
        persistQueue,
        renderQueue,
        clearQueue,
        fmtTime,
        notify,
        measureAudioBar,
        updateLyrics,
        trackChanged: (song2) => {
          loadLyrics(song2, ++songGeneration);
          loadPlayerDetails();
          syncHeart();
          refreshMarquees();
        }
      }));
      remoteMusic = client;
      try {
        await client.start();
        if (`${musicKey()}:${state.profile}` !== key) {
          client.stop();
          if (remoteMusic === client) remoteMusic = null;
        }
      } catch (error) {
        client.stop();
        remoteMusic = null;
        throw error;
      }
    })();
    try {
      await devicesStarting;
    } finally {
      devicesStarting = null;
      if (`${musicKey()}:${state.profile}` !== key) ensureDevices().catch(() => {
      });
    }
  }
  function extraStyles() {
    if (!document.querySelector('link[href="/music-library.css"]')) document.head.append(el("link", { rel: "stylesheet", href: "/music-library.css" }));
  }
  var musicContext = () => (extraStyles(), {
    el,
    api,
    state,
    storage,
    action,
    notify,
    key: () => `${musicKey()}:${state.profile}`,
    image: musicImage,
    open: (item) => item.type === "playlist" ? openPlaylist(item.id) : item.type === "album" ? openAlbum(item.id) : openArtist(item),
    collectionCard: musicCollectionCard,
    albumCard,
    setQueue,
    trackList,
    load: loadMusic,
    offline: musicOffline,
    visit: musicVisit,
    showSelection,
    startSelection,
    openCollection,
    hero,
    heroPlay,
    heroButton,
    art,
    showModal: (node) => {
      node.id || (node.id = `extra-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      registerDialog(node);
      showDialog(`#${node.id}`);
    }
  });
  var searchModule;
  var musicSearch = () => searchModule || (searchModule = Promise.resolve().then(() => (init_music_search(), music_search_exports)));
  async function musicLibrary() {
    if (!libraryModule) {
      libraryModule = Promise.resolve().then(() => (init_music_library(), music_library_exports)).then((module) => {
        module.init(musicContext());
        return module;
      });
    }
    return libraryModule;
  }
  async function loadMusic(tab = state.musicTab, append = false) {
    $("#music-login").hidden = state.boot.music;
    $("#music-content").hidden = !state.boot.music;
    if (!state.boot.music) return;
    ensureDevices().catch(() => {
    });
    const generation = ++state.musicGeneration;
    state.musicTab = tab;
    if (!append) musicVisit(`tab:${tab}`, MUSIC_TITLES[tab] || "Musica", () => loadMusic(tab), MUSIC_SECTIONS[tab] || "home");
    if (!append) {
      $("#music-results").classList.remove("album-open");
      musicLoading(tab === "home" ? "home" : "list");
      $("#music-breadcrumb").replaceChildren();
      state.albumsOffset = 0;
    }
    $("#more-albums").hidden = true;
    paintMusicSide(!append && ["library", "playlists"].includes(tab));
    try {
      if (!navigator.onLine || state.offline) {
        await (await musicOffline()).showOffline(generation);
        return;
      }
      await ensureLikes();
      const query = $("#music-search").value.trim();
      if (!query && tab === "recap") {
        const m = await Promise.resolve().then(() => (init_music_recap(), music_recap_exports));
        await m.showRecap(musicContext(), generation);
        return;
      }
      if (!query && tab === "moment") {
        const m = await Promise.resolve().then(() => (init_music_moment(), music_moment_exports));
        await m.showMoment(musicContext(), generation);
        return;
      }
      if (query || tab === "browse") {
        musicSection("search");
        $("#music-search-field .section-top-slot").replaceChildren(sectionTop(musicContext(), "Cerca"));
        await (await musicSearch()).search(musicContext(), generation, query);
        return;
      }
      if (!query && tab === "songs") {
        await (await Promise.resolve().then(() => (init_music_songs(), music_songs_exports))).showSongs(musicContext(), generation);
        return;
      }
      if (!query && tab === "library") {
        await (await musicLibrary()).library(generation);
        return;
      }
      if (!query && ["liked", "recent", "top", "history"].includes(tab)) {
        const result2 = await api(tab === "liked" ? "/api/music/liked" : "/api/music/activity");
        if (generation !== state.musicGeneration) return;
        if (tab === "liked") {
          likedIds = new Set(result2.songs.map((s) => s.id));
          likesLoaded = true;
        }
        const songs = result2.songs || result2[tab] || [];
        await musicPageUpdate(generation, () => {
          const glyph = { liked: "\u2665", recent: "\u21BA", top: "\u2605", history: "\u25F7" }[tab];
          const cover = art(el, musicImage, { name: MUSIC_TITLES[tab], glyph, size: 400 });
          if (tab === "liked") cover.classList.add("liked-art");
          $("#music-breadcrumb").replaceChildren(hero(el, {
            cover,
            kind: tab === "liked" ? "Playlist" : "I tuoi ascolti",
            title: MUSIC_TITLES[tab],
            sub: quantity(songs.length, "brano", "brani"),
            tools: [heroButton(el, "add", "Aggiungi alla coda", () => addToQueue(songs), { disabled: !songs.length })],
            shuffle: heroButton(el, "shuffle", "Mescola", action(() => shuffleSongs(songs)), { disabled: !songs.length }),
            play: heroPlay(el, () => setQueue(songs), !songs.length)
          }));
          $("#music-results").replaceChildren(songs.length ? trackList(songs) : el("p", { class: "muted" }, "Qui ritroverai i tuoi ascolti. Un brano conta dopo met\xE0 ascolto, fino a quattro minuti."));
        });
        return;
      }
      if (!query && tab === "home") {
        const [home, albums, lib, activity, homeView] = await Promise.all([
          api("/api/music/home"),
          api("/api/music/albums?offset=0"),
          api(`/api/music/library?profile=${encodeURIComponent(state.profile)}`).catch(() => ({ items: [] })),
          api("/api/music/activity").catch(() => ({})),
          Promise.resolve().then(() => (init_music_home(), music_home_exports))
        ]);
        if (generation !== state.musicGeneration) return;
        await musicPageUpdate(generation, () => {
          var _a2;
          return $("#music-results").replaceChildren(homeView.renderHome(musicContext(), { home, albums: ((_a2 = albums.albumList2) == null ? void 0 : _a2.album) || [], items: lib.items || [], recent: activity.recent || [] }));
        });
        return;
      }
      const result = await api(`/api/music/${tab}${tab === "albums" ? `?offset=${state.albumsOffset}` : ""}`);
      if (generation !== state.musicGeneration) return;
      await musicPageUpdate(generation, () => {
        var _a2, _b2, _c;
        const container = $("#music-results");
        if (!append) container.replaceChildren();
        if (!append) $("#music-breadcrumb").replaceChildren(el("h2", { class: "page-heading" }, MUSIC_TITLES[tab]));
        if (tab === "albums") {
          const albums = ((_a2 = result.albumList2) == null ? void 0 : _a2.album) || [];
          container.append(...albums.map(albumCard));
          $("#more-albums").hidden = albums.length < 100;
          state.albumsOffset += albums.length;
        } else if (tab === "artists") {
          container.append(...(((_b2 = result.artists) == null ? void 0 : _b2.index) || []).flatMap((index) => index.artist || []).map(artistCard));
        } else {
          container.append(...(((_c = result.playlists) == null ? void 0 : _c.playlist) || []).map(playlistCard));
          $("#music-breadcrumb").append(el("div", { class: "actions page-actions" }, el("button", { class: "secondary pill", onclick: action(createPlaylist) }, "Nuova playlist"), el("button", { class: "secondary pill", onclick: () => showDialog("#queue-dialog") }, "Crea una playlist dalla coda")));
        }
        if (!container.children.length) container.append(el("div", { class: "empty" }, el("h2", {}, query ? "Nessun risultato" : "Qui non ci sono ancora brani"), el("p", {}, "Controlla i file e l\u2019indice in Navidrome sul telefono della musica.")));
      });
    } catch (e) {
      if (generation !== state.musicGeneration) return;
      if (!e.status && e.message.startsWith("Il telefono non risponde")) {
        state.offline = true;
        await (await musicOffline()).showOffline(generation);
        return;
      }
      $("#music-results").replaceChildren(el("div", { class: "empty" }, el("p", {}, e.message), el("button", { class: "secondary", onclick: () => loadMusic() }, "Riprova")));
    }
  }
  async function openArtist(artist) {
    const generation = ++state.musicGeneration;
    musicVisit(`artist:${artist.id}`, artist.name, () => openArtist(artist));
    musicLoading("list");
    const library2 = await musicLibrary();
    if (generation !== state.musicGeneration) return;
    library2.markOpened("artist", artist.id);
    const data = await api(`/api/music/artist?id=${encodeURIComponent(artist.id)}`);
    if (generation !== state.musicGeneration) return;
    await musicPageUpdate(generation, () => {
      var _a2, _b2;
      const albums = ((_a2 = data.artist) == null ? void 0 : _a2.album) || [];
      const radio2 = () => startSelection({ kind: "radio", artist: artist.id });
      $("#music-breadcrumb").replaceChildren(hero(el, {
        cover: artistArt(musicContext(), artist.name, ((_b2 = data.artist) == null ? void 0 : _b2.coverArt) || artist.coverArt, 400),
        kind: "Artista",
        title: artist.name,
        sub: `${quantity(albums.length, "album")} nella tua raccolta`,
        tools: [el("button", { class: "hero-text-button primary-outline", onclick: action(radio2) }, "Radio artista")],
        play: heroPlay(el, action(radio2), false, "Ascolta la radio dell\u2019artista")
      }));
      $("#music-results").replaceChildren(el("h3", { class: "results-heading" }, "Album"), ...albums.map(albumCard));
      $("#more-albums").hidden = true;
    });
  }
  function artistCard(artist) {
    return el(
      "button",
      { class: "card shelf-card round-card", onclick: action(() => openArtist(artist)) },
      artistArt(musicContext(), artist.name, artist.coverArt),
      el("h3", { class: "shelf-title" }, artist.name),
      el("span", { class: "meta shelf-sub" }, quantity(artist.albumCount || 0, "album"))
    );
  }
  function trackList(songs, edit) {
    return windowedList(songs, (song2, i) => {
      const row = el(
        "li",
        { class: "track-row", draggable: !!(edit == null ? void 0 : edit.editing) },
        el(
          "button",
          { class: "track-main", "data-n": i + 1, onpointerdown: () => {
            if (!(remoteMusic == null ? void 0 : remoteMusic.isRemote())) playback.warm(song2);
          }, onclick: () => setQueue(songs, i), "aria-label": `Ascolta ${song2.title}` },
          songIndicator(song2),
          el("img", { class: "track-cover", src: musicImage(song2.coverArt || song2.albumId, 80), alt: "", loading: "lazy" }),
          el("span", { class: "track-text" }, el("strong", {}, song2.title), el("small", {}, song2.artist || "Artista sconosciuto")),
          el("span", { class: "duration" }, fmtTime(song2.duration))
        ),
        el("button", { class: "quiet heart", "data-song-heart": song2.id, "aria-label": `Mi piace ${song2.title}`, "aria-pressed": likedIds.has(song2.id), onclick: action(() => toggleLike(song2)) }, musicIcon("heart", likedIds.has(song2.id))),
        el("button", { class: "quiet", "aria-label": `Aggiungi ${song2.title} alla coda`, onclick: () => addToQueue([song2]) }, "+"),
        el("button", { class: "quiet", "aria-label": `Opzioni ${song2.title}`, onclick: () => songMenu(song2) }, "\u22EF")
      );
      if (edit) {
        row.append(
          el("button", { class: "quiet edit-tool", "aria-label": `Sposta su ${song2.title}`, disabled: i === 0, onclick: () => edit.move(i, i - 1) }, "\u2191"),
          el("button", { class: "quiet edit-tool", "aria-label": `Sposta gi\xF9 ${song2.title}`, disabled: i === songs.length - 1, onclick: () => edit.move(i, i + 1) }, "\u2193"),
          el("button", { class: "quiet edit-tool", "aria-label": `Togli ${song2.title} dalla playlist`, onclick: () => edit.remove(i) }, "\xD7")
        );
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", String(i));
        });
        row.addEventListener("dragover", (e) => e.preventDefault());
        row.addEventListener("drop", (e) => {
          e.preventDefault();
          const from = Number(e.dataTransfer.getData("text/plain"));
          if (Number.isInteger(from)) edit.move(from, i);
        });
      }
      return row;
    }, { className: `track-list${edit ? " editable-list" : ""}${(edit == null ? void 0 : edit.editing) ? " editing" : ""}`, height: (edit == null ? void 0 : edit.editing) ? 112 : 76 });
  }
  async function openAlbum(id) {
    const generation = ++state.musicGeneration;
    musicVisit(`album:${id}`, "", () => openAlbum(id));
    musicLoading("list");
    const library2 = await musicLibrary();
    if (generation !== state.musicGeneration) return;
    library2.markOpened("album", id);
    if (!navigator.onLine || state.offline) {
      await (await musicOffline()).showCollection("album", id, generation);
      return;
    }
    const result = await api(`/api/music/album?id=${encodeURIComponent(id)}`);
    if (generation !== state.musicGeneration) return;
    const album = result.album;
    const songs = album.song || [];
    musicTitle(album.name);
    await musicPageUpdate(generation, () => {
      $("#more-albums").hidden = true;
      const seconds = songs.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
      $("#music-breadcrumb").replaceChildren(hero(el, {
        cover: art(el, musicImage, { ids: [album.coverArt], name: album.name, size: "large" }),
        kind: "Album",
        title: album.name,
        sub: [album.artist, album.year, quantity(songs.length, "brano", "brani"), seconds ? minutes(seconds) : ""].filter(Boolean).join(" \xB7 "),
        tools: [
          heroButton(el, "add", "Aggiungi alla coda", () => addToQueue(songs)),
          heroButton(el, "more", "Altre azioni dell\u2019album", () => collectionMenu(album.name, [
            ["Aggiungi alla coda", () => addToQueue(songs)],
            ["Avvia radio", () => {
              var _a2;
              return startSelection({ kind: "radio", seed: (_a2 = songs[0]) == null ? void 0 : _a2.id });
            }],
            album.artistId ? ["Vai all\u2019artista", () => openArtist({ id: album.artistId, name: album.artist })] : null
          ]))
        ],
        shuffle: heroButton(el, "shuffle", "Mescola", action(() => shuffleSongs(songs))),
        play: heroPlay(el, () => setQueue(songs, 0))
      }));
      $("#music-results").replaceChildren(trackList(songs));
      $("#music-results").classList.add("album-open");
    });
    const offline = await musicOffline();
    if (generation === state.musicGeneration) ($("#music-breadcrumb").querySelector(".hero-tools") || $("#music-breadcrumb")).append(offline.downloadButton({ type: "album", id: album.id, name: album.name, artist: album.artist, songs }));
  }
  function revealMusicTracks() {
    const list2 = $("#music-results").querySelector(".track-list");
    if (!list2) return;
    const rect = list2.getBoundingClientRect();
    const bar = $("#audio-bar");
    const bottom = bar.hidden ? window.innerHeight : Math.min(window.innerHeight, bar.getBoundingClientRect().top);
    const shift = Math.min(rect.top, rect.bottom - bottom + 16);
    if (shift > 0) window.scrollBy({ top: shift, behavior: "instant" });
  }
  async function openPlaylist(id) {
    const generation = ++state.musicGeneration;
    musicVisit(`playlist:${id}`, "", () => openPlaylist(id));
    const library2 = await musicLibrary();
    if (generation !== state.musicGeneration) return;
    library2.markOpened("playlist", id);
    if (!navigator.onLine || state.offline) {
      await (await musicOffline()).showCollection("playlist", id, generation);
      return;
    }
    const result = await api(`/api/music/playlist?id=${encodeURIComponent(id)}`);
    if (generation !== state.musicGeneration) return;
    const p = result.playlist;
    let songs = p.entry || [];
    let dirty = false;
    let saving = false;
    let editing = false;
    musicTitle(p.name);
    const suggestions = el("section", { class: "playlist-recommendations", "aria-label": "Brani consigliati" });
    const save2 = el("button", { class: "primary", disabled: true, onclick: action(async () => {
      if (saving) return;
      saving = true;
      save2.disabled = true;
      try {
        await api("/api/music/playlist", { method: "PUT", data: { id: p.id, name: p.name, songs: songs.map((s) => s.id) } });
        dirty = false;
        notify("Ordine della playlist salvato.");
      } finally {
        saving = false;
        save2.disabled = !dirty;
      }
    }) }, "Salva ordine e brani");
    const paint = (focusAt, focusLabel) => {
      if (generation !== state.musicGeneration) return;
      const list2 = trackList(songs, {
        editing,
        move(from, to) {
          var _a2;
          if (saving) return;
          const label = (_a2 = document.activeElement) == null ? void 0 : _a2.getAttribute("aria-label");
          songs = moveEntry(songs, 0, from, to).queue;
          dirty = true;
          save2.disabled = false;
          paint(to, label);
        },
        remove(at) {
          if (saving) return;
          songs = songs.filter((_, i) => i !== at);
          dirty = true;
          save2.disabled = false;
          paint(Math.min(at, songs.length - 1));
        }
      });
      $("#music-results").replaceChildren(list2, suggestions);
      if (!songs.length) $("#music-results").append(el("p", { class: "muted" }, "Playlist vuota. Aggiungi un brano dal menu \u22EF."));
      if (Number.isInteger(focusAt)) {
        if (list2.classList.contains("windowed-list")) {
          list2.scrollTop = Math.max(0, focusAt) * (editing ? 112 : 76);
          list2.dispatchEvent(new Event("scroll"));
        }
        const row = list2.querySelector(`[aria-posinset="${focusAt + 1}"]`) || list2.children[focusAt];
        const control = [...(row == null ? void 0 : row.querySelectorAll("button")) || []].find((button) => button.getAttribute("aria-label") === focusLabel && !button.disabled);
        (control || (row == null ? void 0 : row.querySelector("button")) || save2).focus({ preventScroll: true });
      }
    };
    const done = el("button", { class: "secondary", onclick: () => toggleEdit() }, "Fine");
    const editBar = el("div", { class: "playlist-edit", hidden: true }, el("span", { class: "muted" }, "Trascina i brani oppure usa le frecce, poi salva."), el("span", { class: "playlist-edit-actions" }, done, save2));
    function toggleEdit() {
      editing = !editing;
      editBar.hidden = !editing;
      paint();
    }
    const rename = action(async () => {
      const name = await ask("Rinomina la playlist", p.name);
      if (!name) return;
      await api("/api/music/playlist", { method: "PUT", data: { id: p.id, name, songs: songs.map((s) => s.id) } });
      await openPlaylist(p.id);
    });
    const remove = action(async () => {
      if (!await ask("Togliere la playlist?", "", `Sar\xE0 rimossa soltanto la playlist \u201C${p.name}\u201D. I brani restano nella raccolta.`, true)) return;
      await api("/api/music/playlist", { method: "DELETE", data: { id: p.id } });
      await loadMusic("playlists");
    });
    await musicPageUpdate(generation, () => {
      $("#more-albums").hidden = true;
      const cover = art(el, musicImage, { ids: p.coverArt ? [p.coverArt] : songs.map((s) => s.coverArt || s.albumId), name: p.name, glyph: "\u266A", size: 400 });
      $("#music-breadcrumb").replaceChildren(hero(el, {
        cover,
        kind: "Playlist",
        title: p.name,
        sub: [p.owner, quantity(songs.length, "brano", "brani")].filter(Boolean).join(" \xB7 "),
        tools: [
          heroButton(el, "add", "Aggiungi alla coda", () => addToQueue(songs)),
          heroButton(el, "more", "Altre azioni della playlist", () => collectionMenu(p.name, [[editing ? "Fine modifica" : "Modifica ordine e brani", toggleEdit], ["Rinomina", rename], ["Togli la playlist", remove]]))
        ],
        shuffle: heroButton(el, "shuffle", "Mescola", action(() => shuffleSongs(songs))),
        play: heroPlay(el, () => setQueue(songs, 0)),
        extra: [editBar]
      }));
      paint();
      revealMusicTracks();
    });
    const offline = await musicOffline();
    if (generation === state.musicGeneration) {
      ($("#music-breadcrumb").querySelector(".hero-tools") || $("#music-breadcrumb")).append(offline.downloadButton({ type: "playlist", id: p.id, name: p.name, get songs() {
        return songs;
      } }));
      revealMusicTracks();
    }
    const { playlistRecommendations: playlistRecommendations2 } = await Promise.resolve().then(() => (init_music_recommendations(), music_recommendations_exports));
    await playlistRecommendations2(musicContext(), suggestions, generation, () => songs, async (song2) => {
      if (saving) throw new Error("Attendi il salvataggio della playlist.");
      if (songs.some((s) => s.id === song2.id)) return;
      saving = true;
      save2.disabled = true;
      try {
        const next = [...songs, song2];
        await api("/api/music/playlist", { method: "PUT", data: { id: p.id, name: p.name, songs: next.map((s) => s.id) } });
        songs = next;
        dirty = false;
        paint();
        notify("Brano aggiunto alla playlist.");
      } finally {
        saving = false;
        save2.disabled = !dirty;
      }
    });
  }
  $("#music-link").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button.primary");
    button.disabled = true;
    try {
      await api("/api/manage/music/link", { method: "POST", data: { username: form.elements.username.value, password: form.elements.password.value } });
      form.elements.password.value = "";
      form.elements.username.value = "";
      await paintMusicLink();
      notify("Musica collegata. Ora si apre da sola.");
    } finally {
      button.disabled = false;
    }
  }));
  $("#music-unlink").addEventListener("click", action(async () => {
    pauseMusic();
    remoteMusic == null ? void 0 : remoteMusic.stop();
    remoteMusic = null;
    await api("/api/manage/music/unlink", { method: "POST", data: {} });
    state.boot.music = false;
    state.boot.musicUser = "";
    await paintMusicLink();
    notify("Musica scollegata.");
  }));
  $("#music-login").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    button.disabled = true;
    playback.pause();
    remoteMusic == null ? void 0 : remoteMusic.stop();
    remoteMusic = null;
    try {
      await api("/api/music/login", { method: "POST", data: { username: form.elements.username.value, password: form.elements.password.value } });
      form.elements.password.value = "";
      state.boot.music = true;
      state.boot.musicUser = form.elements.username.value.trim();
      await restoreMusic();
      await loadMusic();
    } finally {
      button.disabled = false;
    }
  }));
  $("#music-page").addEventListener("click", (event) => {
    const b = event.target.closest("[data-music]");
    if (!b || b.disabled) return;
    clearTimeout(searchTimer);
    $("#music-search").value = "";
    loadMusic(b.dataset.music);
  });
  $("#music-search").addEventListener("input", () => {
    ++state.musicGeneration;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadMusic("browse"), 180);
  });
  $("#music-search").addEventListener("focus", () => {
    if (!$("#music-search").value.trim()) loadMusic("browse");
  });
  $("#music-search").addEventListener("keydown", action(async (event) => {
    if (event.key === "Enter") {
      clearTimeout(searchTimer);
      (await musicSearch()).remember(musicContext(), $("#music-search").value);
      await loadMusic("browse");
    }
  }));
  $("#more-albums").addEventListener("click", () => loadMusic("albums", true));
  var likedIds = /* @__PURE__ */ new Set();
  var likesLoaded = false;
  var likesBusy = /* @__PURE__ */ new Set();
  var radio = null;
  var radioBusy = false;
  var radioGeneration = 0;
  var heard = /* @__PURE__ */ new Set();
  var lastMusicSave = 0;
  var restoringMusic = false;
  var musicKey = () => {
    var _a2;
    return `music:${((_a2 = state.boot) == null ? void 0 : _a2.musicUser) || "guest"}`;
  };
  var playback = new MusicPlayback([audio, $("#audio-buffer")], {
    url: (song2) => `/api/music/stream?id=${encodeURIComponent(song2.id)}&offline=${encodeURIComponent(`${musicKey()}:${state.profile}`)}`,
    track(song2, node, index) {
      state.listeningProfile = state.profile;
      audio.id = "audio-buffer";
      node.id = "audio";
      audio = node;
      state.queueIndex = index;
      heard.add(song2.id);
      const generation = ++songGeneration;
      video.pause();
      $("#audio-title").textContent = song2.title;
      $("#audio-artist").textContent = song2.artist || "";
      $("#full-title").textContent = song2.title;
      $("#full-artist").textContent = [song2.artist, song2.album].filter(Boolean).join(" \xB7 ");
      $("#music-player").style.removeProperty("--cover-color");
      syncFullPlayer();
      syncHeart();
      $("#audio-bar").hidden = false;
      document.body.classList.add("has-audio");
      measureAudioBar();
      refreshMarquees();
      syncIndicators();
      if ("mediaSession" in navigator && "MediaMetadata" in window) navigator.mediaSession.metadata = new MediaMetadata({ title: song2.title, artist: song2.artist || "", album: song2.album || "", artwork: [{ src: new URL(musicImage(song2.coverArt || song2.albumId, 400), location.href).href, sizes: "400x400" }] });
      persistQueue();
      renderQueue();
    },
    status(value) {
      const message = value === "loading" ? "Caricamento del brano\u2026" : value === "error" ? "Il brano non parte. Tocca Riproduci per riprovare." : "";
      for (const id of ["music-load-status", "mini-load-status"]) {
        const n = document.getElementById(id);
        n.textContent = message;
        n.hidden = !message;
      }
      $("#audio-bar").setAttribute("aria-busy", String(value === "loading"));
    },
    ready(song2) {
      var _a2;
      if (!song2 || song2.id !== ((_a2 = state.queue[state.queueIndex]) == null ? void 0 : _a2.id)) return;
      if (state.musicReadyGeneration === songGeneration) return;
      state.musicReadyGeneration = songGeneration;
      $("#audio-cover").src = musicImage(song2.coverArt || song2.albumId, 80);
      $("#full-cover").src = musicImage(song2.coverArt || song2.albumId, "large");
      loadLyrics(song2, songGeneration);
      loadPlayerDetails();
      fillRadio().catch((e) => notify(e.message, true));
    },
    // Senza rete l'ascolto resta nella coda locale (activity → recordPlayed): nessun avviso rosso durante l'ascolto offline.
    listen: (data) => !navigator.onLine || state.offline ? Promise.resolve() : api("/api/music/listen", { method: "POST", data }).catch((e) => {
      if (navigator.onLine && !state.offline) notify(`Cronologia non aggiornata: ${e.message}`, true);
    }),
    activity: recordPlayed,
    more: () => fillRadio(true),
    progress: () => persistQueue(),
    sleep: () => {
      $("#sleep-timer").value = "0";
      notify("Timer terminato. Buonanotte.");
    },
    error: (error) => notify((error == null ? void 0 : error.message) || "Tocca Riproduci per avviare il brano. Se non parte, controlla la connessione.", true)
  });
  function pauseMusic() {
    if (remoteMusic == null ? void 0 : remoteMusic.isRemote()) remoteMusic.send("pause").catch((e) => notify(e.message, true));
    else playback.pause();
  }
  async function ensureLikes() {
    var _a2;
    if (!navigator.onLine || state.offline) return;
    if (likesLoaded || !((_a2 = state.boot) == null ? void 0 : _a2.music)) return;
    const result = await api("/api/music/liked");
    likedIds = new Set((result.songs || []).map((s) => s.id));
    likesLoaded = true;
    syncHeart();
  }
  function syncHeart() {
    $$("[data-song-heart]").forEach((b) => {
      const liked2 = likedIds.has(b.dataset.songHeart);
      b.replaceChildren(musicIcon("heart", liked2));
      b.setAttribute("aria-pressed", liked2);
    });
    const song2 = state.queue[state.queueIndex];
    const liked = !!song2 && likedIds.has(song2.id);
    $("#full-like").replaceChildren(musicIcon("heart", liked), " Mi piace");
    $("#full-like").setAttribute("aria-pressed", liked);
    syncMiniLike();
  }
  async function toggleLike(song2) {
    if (!song2 || likesBusy.has(song2.id)) return;
    likesBusy.add(song2.id);
    try {
      await ensureLikes();
      const starred = !likedIds.has(song2.id);
      await api("/api/music/star", { method: "POST", data: { id: song2.id, starred } });
      if (starred) likedIds.add(song2.id);
      else likedIds.delete(song2.id);
      syncHeart();
      vibrateFeedback();
      if (starred) pulseHearts(song2.id);
    } finally {
      likesBusy.delete(song2.id);
    }
  }
  function playlistCard(p) {
    const cover = p.coverArt ? art(el, musicImage, { ids: [p.coverArt], name: p.name }) : lazyArt(musicContext(), art(el, musicImage, { name: p.name, glyph: "\u266A" }), "playlist", p.id);
    return el("button", { class: "card shelf-card", onclick: action(() => openPlaylist(p.id)) }, cover, el("h3", { class: "shelf-title" }, p.name), el("span", { class: "meta shelf-sub" }, `Playlist \xB7 ${quantity(p.songCount || 0, "brano", "brani")}`));
  }
  async function createPlaylist(song2) {
    var _a2;
    const name = await ask("Come chiamiamo la playlist?");
    if (!name) return;
    const result = await api("/api/music/playlist", { method: "POST", data: { name, songs: song2 ? [song2.id] : [] } });
    notify("Playlist creata.");
    if ((_a2 = result.playlist) == null ? void 0 : _a2.id) await openPlaylist(result.playlist.id);
    else await loadMusic("playlists");
  }
  async function addToPlaylist(song2) {
    var _a2;
    const lists = await api("/api/music/playlists");
    $("#song-menu-title").textContent = `Aggiungi ${song2.title} a una playlist`;
    $("#song-menu-actions").replaceChildren(
      el("button", { class: "primary", onclick: action(async () => {
        $("#song-menu").close();
        await createPlaylist(song2);
      }) }, "Nuova playlist"),
      ...(((_a2 = lists.playlists) == null ? void 0 : _a2.playlist) || []).map((p) => el("button", { class: "secondary", onclick: action(async () => {
        await api("/api/music/playlist/add", { method: "POST", data: { id: p.id, song: song2.id } });
        $("#song-menu").close();
        notify("Brano aggiunto alla playlist.");
      }) }, p.name))
    );
    showDialog("#song-menu");
  }
  function songMenu(song2) {
    if (!song2) return;
    $("#song-menu-title").textContent = song2.title;
    const button = (label, fn) => el("button", { class: "secondary", onclick: action(async () => {
      $("#song-menu").close();
      await fn();
    }) }, label);
    $("#song-menu-actions").replaceChildren(
      button("Riproduci dopo", () => addToQueue([song2], true)),
      button("Aggiungi in coda", () => addToQueue([song2])),
      button(likedIds.has(song2.id) ? "Togli Mi piace" : "Metti Mi piace", () => toggleLike(song2)),
      button("Radio del brano", () => startSelection({ kind: "radio", seed: song2.id })),
      button("Aggiungi a una playlist", () => addToPlaylist(song2)),
      ...song2.albumId ? [button("Apri album", () => {
        setPage("music");
        return openAlbum(song2.albumId);
      })] : []
    );
    showDialog("#song-menu");
  }
  async function showSelection(options, title) {
    const generation = ++state.musicGeneration;
    musicVisit(`selection:${title}`, title, () => showSelection(options, title));
    musicLoading("list");
    const result = await api("/api/music/select", { method: "POST", data: options });
    if (generation !== state.musicGeneration) return;
    await musicPageUpdate(generation, () => {
      const songs = result.songs;
      const cover = art(el, musicImage, { ids: songs.map((s) => s.coverArt || s.albumId), name: title, glyph: options.mood ? moodSymbols[options.mood] || "\u266B" : "\u21BA", size: 400 });
      $("#music-breadcrumb").replaceChildren(hero(el, {
        cover,
        kind: "Scelto per te",
        title,
        sub: quantity(songs.length, "brano", "brani"),
        tools: [heroButton(el, "add", "Aggiungi alla coda", () => addToQueue(songs), { disabled: !songs.length })],
        shuffle: heroButton(el, "shuffle", "Mescola", action(() => shuffleSongs(songs)), { disabled: !songs.length }),
        play: heroPlay(el, () => setQueue(songs), !songs.length)
      }));
      $("#music-results").replaceChildren(songs.length ? trackList(songs) : el("p", { class: "muted" }, "Nessun brano da riscoprire oggi. Metti un cuore ai tuoi preferiti e torna pi\xF9 avanti."));
    });
  }
  async function startSelection(options) {
    const token = ++radioGeneration;
    const result = await api("/api/music/select", { method: "POST", data: options });
    if (token !== radioGeneration) return;
    if (!result.songs.length) {
      notify("Non ci sono altri brani per questa selezione.");
      return;
    }
    setQueue(result.songs);
    radio = ["radio", "shuffle"].includes(options.kind) ? options : null;
    $("#radio-state").textContent = radio ? options.kind === "radio" ? "Radio attiva \xB7 brani simili, senza ripetizioni" : "Shuffle intelligente \xB7 senza ripetizioni" : "Ascolto dalla coda";
  }
  async function fillRadio(force = false) {
    if (!radio || radioBusy || !force && state.queue.length - state.queueIndex > 5) return;
    if (heard.size >= 1900) {
      radio = null;
      notify("Hai ascoltato una lunga sessione. Avvia una nuova radio per ricominciare.");
      return;
    }
    radioBusy = true;
    const token = radioGeneration;
    try {
      const result = await api("/api/music/select", { method: "POST", data: { ...radio, exclude: [.../* @__PURE__ */ new Set([...heard, ...state.queue.map((s) => s.id)])].slice(0, 2e3) } });
      if (token !== radioGeneration || !radio) return;
      if (!result.songs.length) {
        radio = null;
        $("#radio-state").textContent = "Hai scoperto tutti i brani della radio";
        return;
      }
      if (state.queueIndex > 60) {
        const cut = state.queueIndex - 30;
        state.queue.splice(0, cut);
        state.queueIndex -= cut;
      }
      addToQueue(result.songs, false, false);
    } finally {
      radioBusy = false;
    }
  }
  async function shuffleSongs(songs) {
    const result = await api("/api/music/select", { method: "POST", data: { kind: "shuffle", ids: songs.map((s) => s.id).slice(0, 2e3) } });
    if (!result.songs.length) {
      notify("Non ci sono brani pronti da mescolare.");
      return;
    }
    setQueue(result.songs);
  }
  function persistQueue() {
    var _a2, _b2;
    if (typeof remoteMusic !== "undefined" && (remoteMusic == null ? void 0 : remoteMusic.isRemote())) {
      const s = (_a2 = remoteMusic.remote()) == null ? void 0 : _a2.state;
      if (s) remoteMusic.send("queue", { ...s, queue: state.queue, index: state.queueIndex }).catch((e) => notify(e.message, true));
      return;
    }
    if (restoringMusic) return;
    if (state.queue.length > 2e3) {
      state.queue = state.queue.slice(0, 2e3);
      notify("La coda contiene al massimo 2000 brani.");
    }
    playback.setQueue(state.queue, state.queueIndex);
    if ((_b2 = state.boot) == null ? void 0 : _b2.musicUser) storage.set(musicKey(), {
      queue: state.queue,
      index: state.queueIndex,
      position: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      repeat: state.repeat,
      crossfade: playback.crossfade,
      normalize: playback.normalize,
      volume: playback.volume,
      radio,
      heard: [...heard].slice(-2e3)
    });
  }
  function addToQueue(songs, after = false, message = true) {
    if (after) state.queue.splice(state.queue.length ? state.queueIndex + 1 : 0, 0, ...songs);
    else state.queue.push(...songs);
    persistQueue();
    renderQueue();
    if (message) {
      if (songs.length) vibrateFeedback();
      notify(after ? "Il brano verr\xE0 riprodotto dopo quello in ascolto." : "Brani aggiunti alla coda.");
    }
  }
  function setQueue(songs, index = 0) {
    var _a2, _b2, _c;
    if (typeof remoteMusic !== "undefined" && (remoteMusic == null ? void 0 : remoteMusic.isRemote())) {
      remoteMusic.send("transfer", { queue: songs.slice(0, 2e3), index, paused: false, position: 0, volume: (_c = (_b2 = (_a2 = remoteMusic.remote()) == null ? void 0 : _a2.state) == null ? void 0 : _b2.volume) != null ? _c : 0.8 }).catch((e) => notify(e.message, true));
      return;
    }
    if (!songs.length) {
      clearQueue();
      return;
    }
    pauseMusic();
    ++radioGeneration;
    radio = null;
    heard = /* @__PURE__ */ new Set();
    $("#radio-state").textContent = "Ascolto dalla coda";
    const start = index >= 2e3 ? index : 0;
    state.queue = songs.slice(start, start + 2e3);
    state.queueIndex = index - start;
    playback.setQueue(state.queue, state.queueIndex, false);
    playSong(state.queueIndex);
  }
  async function playSong(index, options = {}) {
    if (typeof remoteMusic !== "undefined" && (remoteMusic == null ? void 0 : remoteMusic.isRemote())) {
      await remoteMusic.send("playIndex", { index });
      return;
    }
    if (!state.queue[index]) return;
    if (!state.boot.music) {
      setPage("music");
      notify("Accedi alla musica per riprendere la coda.");
      return;
    }
    playback.setQueue(state.queue, state.queueIndex, false);
    await playback.play(index, options);
  }
  async function restoreMusic() {
    var _a2;
    restoreMusicFeedback();
    const saved = storage.get(musicKey(), {});
    restoringMusic = true;
    try {
      likesLoaded = false;
      likedIds = /* @__PURE__ */ new Set();
      ++radioGeneration;
      radio = null;
      playback.clear();
      state.queue = Array.isArray(saved.queue) ? saved.queue.filter((s) => s && typeof s.id === "string" && typeof s.title === "string").slice(0, 2e3) : [];
      if (state.offline || typeof navigator !== "undefined" && !navigator.onLine) {
        const offline = await musicOffline();
        const ids = new Set((await offline.manager.collections()).flatMap((c2) => c2.songs.map((s) => s.id)));
        state.queue = state.queue.filter((s) => ids.has(s.id));
      }
      state.queueIndex = Number.isInteger(saved.index) && saved.index >= 0 && saved.index < state.queue.length ? saved.index : 0;
      state.repeat = ["off", "one", "all"].includes(saved.repeat) ? saved.repeat : "off";
      heard = new Set(Array.isArray(saved.heard) ? saved.heard.filter((id) => typeof id === "string").slice(-2e3) : []);
      playback.configure({ repeat: state.repeat, crossfade: saved.crossfade, normalize: saved.normalize, volume: (_a2 = saved.volume) != null ? _a2 : storedVolume });
      $("#repeat-queue").value = state.repeat;
      $("#crossfade").value = playback.crossfade;
      $("#normalize-volume").checked = playback.normalize;
      $("#volume").value = playback.volume;
      playback.setQueue(state.queue, state.queueIndex);
      renderQueue();
      if (!state.queue.length && typeof document !== "undefined") {
        $("#audio-bar").hidden = true;
        document.body.classList.remove("has-audio");
      }
      if (state.queue.length) await playback.play(state.queueIndex, { position: saved.position, autoplay: false });
      if (saved.radio && ["radio", "shuffle"].includes(saved.radio.kind)) {
        radio = saved.radio;
        $("#radio-state").textContent = "La tua selezione \xE8 pronta a riprendere";
      }
      try {
        await ensureLikes();
      } catch (e) {
        notify(e.message, true);
      }
    } finally {
      restoringMusic = false;
    }
  }
  function renderQueue() {
    renderQueuePreview();
    paintNowPanel();
    $("#queue-count").textContent = state.queue.length;
    const list2 = windowedList(state.queue, (song2, index) => {
      const move = (to) => {
        const result = moveEntry(state.queue, state.queueIndex, index, to);
        state.queue = result.queue;
        state.queueIndex = result.index;
        persistQueue();
        renderQueue();
      };
      const row = el(
        "li",
        { class: `track-row${index === state.queueIndex ? " current" : ""}`, draggable: true },
        el("button", { class: "track-main", onclick: () => playSong(index) }, songIndicator(song2), el("span", { class: "track-text" }, el("strong", {}, song2.title), el("small", {}, song2.artist || ""))),
        el("button", { class: "icon-button", "aria-label": `Sposta su ${song2.title}`, disabled: index === 0, onclick: () => move(index - 1) }, "\u2191"),
        el("button", { class: "icon-button", "aria-label": `Sposta gi\xF9 ${song2.title}`, disabled: index === state.queue.length - 1, onclick: () => move(index + 1) }, "\u2193"),
        el("button", { class: "icon-button", "aria-label": `Togli ${song2.title} dalla coda`, onclick: () => {
          if (index === state.queueIndex) pauseMusic();
          const result = removeEntry(state.queue, state.queueIndex, index);
          state.queue = result.queue;
          state.queueIndex = result.index;
          persistQueue();
          renderQueue();
          if (!state.queue.length) clearQueue();
          else if (result.currentRemoved) playSong(state.queueIndex);
        } }, "\xD7"),
        el("button", { class: "quiet", "aria-label": `Opzioni ${song2.title}`, onclick: () => songMenu(song2) }, "\u22EF")
      );
      row.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", String(index)));
      row.addEventListener("dragover", (e) => e.preventDefault());
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        const from = Number(e.dataTransfer.getData("text/plain"));
        const result = moveEntry(state.queue, state.queueIndex, from, index);
        state.queue = result.queue;
        state.queueIndex = result.index;
        persistQueue();
        renderQueue();
      });
      return row;
    });
    list2.id = "queue-list";
    $("#queue-list").replaceWith(list2);
    if (!state.queue.length) list2.append(el("li", { class: "muted" }, "La coda \xE8 vuota. Aggiungi un album o un brano."));
    syncIndicators();
  }
  function nextSong() {
    ((remoteMusic == null ? void 0 : remoteMusic.isRemote()) ? remoteMusic.send("next") : playback.advance()).catch((e) => notify(e.message, true));
  }
  $("#audio-next").addEventListener("click", nextSong);
  $("#full-next").addEventListener("click", nextSong);
  $("#full-prev").addEventListener("click", () => $("#audio-prev").click());
  $("#full-toggle").addEventListener("click", () => $("#audio-toggle").click());
  function syncFullPlayer() {
    var _a2;
    if (typeof remoteMusic !== "undefined" && (remoteMusic == null ? void 0 : remoteMusic.isRemote())) {
      const s = (_a2 = remoteMusic.remote()) == null ? void 0 : _a2.state;
      if (s) remoteMusic.c.mirror(s);
      return;
    }
    setMusicIcon($("#full-toggle"), audio.paused ? "play" : "pause");
    $("#full-toggle").setAttribute("aria-label", audio.paused ? "Riproduci nel lettore" : "Metti in pausa nel lettore");
    $("#full-time").textContent = fmtTime(audio.currentTime);
    $("#full-duration").textContent = fmtTime(audio.duration);
    $("#full-seek").max = Number.isFinite(audio.duration) ? audio.duration : 100;
    $("#full-seek").value = audio.currentTime;
    updateLyrics();
  }
  for (const node of playback.nodes) {
    for (const event of ["timeupdate", "seeked", "loadedmetadata", "play", "pause", "emptied"]) node.addEventListener(event, () => {
      var _a2, _b2;
      if (node !== audio) return;
      syncFullPlayer();
      setMusicIcon($("#audio-toggle"), audio.paused ? "play" : "pause");
      $("#audio-toggle").setAttribute("aria-label", audio.paused ? "Riproduci musica" : "Metti in pausa la musica");
      if (["play", "pause", "emptied"].includes(event)) syncIndicators();
      $("#audio-time").textContent = fmtTime(audio.currentTime);
      $("#audio-duration").textContent = fmtTime(audio.duration);
      $("#audio-seek").max = Number.isFinite(audio.duration) ? audio.duration : 100;
      $("#audio-seek").value = audio.currentTime;
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = audio.paused ? "paused" : "playing";
        if (Number.isFinite(audio.duration) && audio.duration > 0) try {
          (_b2 = (_a2 = navigator.mediaSession).setPositionState) == null ? void 0 : _b2.call(_a2, { duration: audio.duration, position: Math.min(audio.duration, audio.currentTime), playbackRate: audio.playbackRate });
        } catch {
        }
      }
      if (["pause", "seeked"].includes(event) || Date.now() - lastMusicSave > 5e3) {
        lastMusicSave = Date.now();
        persistQueue();
      }
    });
    node.addEventListener("error", () => {
      if (node === audio) notify("Questo brano non si apre. Controlla Navidrome o prova un formato supportato.", true);
    });
  }
  for (const id of ["full-seek", "audio-seek"]) document.getElementById(id).addEventListener("input", (event) => {
    if (Number.isFinite(audio.duration)) {
      playback.cancelFade();
      audio.currentTime = Number(event.target.value);
    }
  });
  $("#audio-prev").addEventListener("click", () => {
    if (audio.currentTime > 3) {
      playback.cancelFade();
      audio.currentTime = 0;
    } else playSong(Math.max(0, state.queueIndex - 1));
  });
  $("#audio-toggle").addEventListener("click", action(async () => {
    if (audio.paused) {
      video.pause();
      if (!audio.getAttribute("src")) await playSong(state.queueIndex);
      else {
        await playback.prepareAudio();
        await audio.play();
      }
    } else pauseMusic();
  }));
  $("#volume").addEventListener("input", () => {
    playback.configure({ volume: $("#volume").value });
    persistQueue();
  });
  $("#music-queue-open").addEventListener("click", () => showDialog("#queue-dialog"));
  $("#bar-queue").addEventListener("click", () => showDialog("#queue-dialog"));
  $("#music-devices").addEventListener("click", action(async () => {
    await ensureDevices();
    if (!remoteMusic) throw new Error("Collegati al Wi-Fi di casa per scegliere un dispositivo.");
    remoteMusic.show();
  }));
  for (const id of ["#music-together", "#music-together-page"]) $(id).addEventListener("click", action(async () => {
    await ensureDevices();
    if (!remoteMusic) throw new Error("Accedi alla musica e collegati al Wi-Fi di casa per ascoltare insieme.");
    (await remoteMusic.loadTogether()).open();
  }));
  function clearQueue() {
    var _a2, _b2, _c;
    if (remoteMusic == null ? void 0 : remoteMusic.isRemote()) {
      remoteMusic.send("queue", { queue: [], index: 0, paused: true, position: 0, volume: (_c = (_b2 = (_a2 = remoteMusic.remote()) == null ? void 0 : _a2.state) == null ? void 0 : _b2.volume) != null ? _c : 0.8 }).catch((e) => notify(e.message, true));
      return;
    }
    ++radioGeneration;
    radio = null;
    heard = /* @__PURE__ */ new Set();
    ++songGeneration;
    lyricRequest == null ? void 0 : lyricRequest.abort();
    lyrics = { synced: false, lines: [] };
    $("#lyrics-lines").replaceChildren();
    $("#music-player").close();
    playback.clear();
    state.queue = [];
    state.queueIndex = 0;
    persistQueue();
    renderQueue();
    $("#audio-bar").hidden = true;
    document.body.classList.remove("has-audio");
  }
  $("#clear-queue").addEventListener("click", clearQueue);
  $("#repeat-queue").addEventListener("change", () => {
    state.repeat = $("#repeat-queue").value;
    playback.configure({ repeat: state.repeat });
    persistQueue();
  });
  $("#crossfade").addEventListener("change", () => {
    playback.configure({ crossfade: $("#crossfade").value });
    persistQueue();
  });
  $("#normalize-volume").addEventListener("change", () => {
    playback.configure({ normalize: $("#normalize-volume").checked });
    persistQueue();
  });
  $("#sleep-timer").addEventListener("change", () => {
    playback.setSleep($("#sleep-timer").value);
    notify($("#sleep-timer").value === "0" ? "Timer disattivato." : "Timer impostato.");
  });
  $("#full-like").addEventListener("click", action(() => toggleLike(state.queue[state.queueIndex])));
  $("#full-menu").addEventListener("click", () => songMenu(state.queue[state.queueIndex]));
  $("#stop-radio").addEventListener("click", () => {
    ++radioGeneration;
    radio = null;
    $("#radio-state").textContent = "Radio fermata \xB7 la coda resta pronta";
  });
  $("#shuffle-queue").addEventListener("click", () => {
    if (!state.queue.length) return;
    const song2 = state.queue[state.queueIndex];
    state.queue = [song2, ...smartQueue(state.queue, { seed: song2, exclude: [...heard, song2.id], limit: 1999 })];
    state.queueIndex = 0;
    persistQueue();
    renderQueue();
  });
  $("#save-playlist").addEventListener("click", action(async () => {
    if (!state.queue.length) {
      notify("Aggiungi prima qualche brano alla coda.");
      return;
    }
    const name = await ask("Come chiamiamo la playlist?");
    if (!name) return;
    await api("/api/music/playlist", { method: "POST", data: { name, songs: state.queue.map((s) => s.id) } });
    notify("Playlist salvata in Navidrome.");
  }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      playback.account();
      persistQueue();
    }
  });
  window.addEventListener("pagehide", () => persistQueue());
  if ("mediaSession" in navigator) {
    const handlers = {
      play: () => {
        video.pause();
        playback.prepareAudio().then(() => audio.play()).catch(() => {
        });
      },
      pause: pauseMusic,
      stop: pauseMusic,
      previoustrack: () => $("#audio-prev").click(),
      nexttrack: nextSong,
      seekto: (d) => {
        if (Number.isFinite(d.seekTime) && Number.isFinite(audio.duration)) {
          playback.cancelFade();
          audio.currentTime = Math.max(0, Math.min(audio.duration, d.seekTime));
        }
      },
      seekbackward: (d) => {
        playback.cancelFade();
        audio.currentTime = Math.max(0, audio.currentTime - (d.seekOffset || 10));
      },
      seekforward: (d) => {
        if (Number.isFinite(audio.duration)) {
          playback.cancelFade();
          audio.currentTime = Math.min(audio.duration, audio.currentTime + (d.seekOffset || 10));
        }
      }
    };
    for (const [name, fn] of Object.entries(handlers)) try {
      navigator.mediaSession.setActionHandler(name, fn);
    } catch {
    }
  }
  async function paintMusicLink() {
    const link = await api("/api/manage/music");
    state.boot.musicLinked = link.linked;
    if (link.linked) {
      state.boot.music = true;
      state.boot.musicUser = link.user;
    }
    $("#music-link-state").textContent = link.linked ? `La musica \xE8 collegata (utente ${link.user}). Si apre da sola per tutti i profili.` : "La musica non \xE8 ancora collegata.";
    $("#music-link-fields").hidden = link.linked;
    $("#music-unlink").hidden = !link.linked;
  }
  async function loadManage() {
    $("#admin-login").hidden = state.boot.admin;
    $("#admin-content").hidden = !state.boot.admin;
    $("#logout").hidden = !state.boot.admin;
    if (!state.boot.admin) return;
    await paintMusicLink();
    if (!state.root) state.root = state.boot.roots[0];
    $("#root").replaceChildren(...state.boot.roots.map((r) => el("option", { value: r }, r)));
    $("#root").value = state.root;
    const spaces = await api("/api/manage/space");
    $("#space").replaceChildren(...spaces.map((s) => el("div", {}, el("strong", {}, s.name), s.unavailable ? "Cartella non disponibile" : `${fmtSize(s.free)} liberi`, s.unavailable ? null : el("progress", { value: s.total - s.free, max: s.total, "aria-label": `Spazio usato ${s.name}` }))));
    await loadFiles();
    populateEdit();
    loadExtras().catch(() => {
    });
  }
  async function loadExtras() {
    const [light, online] = await Promise.all([api("/api/versions"), api("/api/manage/online-art")]);
    $("#versions-status").textContent = light.count ? `${quantity(light.count, "versione leggera pronta", "versioni leggere pronte")}, ${fmtSize(light.bytes)} occupati.` : "Nessuna versione leggera preparata.";
    if (light.queued || light.working) $("#versions-status").textContent += ` Ne sto preparando altre (${light.queued + (light.working ? 1 : 0)}).`;
    $("#versions-clear").disabled = !light.count;
    $("#online-art-enabled").checked = online.enabled;
    $("#music-art-status").textContent = "Le copertine della musica si prendono dai file (incorporate o cover.jpg accanto), una cartella alla volta, in sottofondo.";
  }
  $("#versions-clear").addEventListener("click", action(async () => {
    if (!await ask("Eliminare le versioni leggere?", "", "Si cancellano solo le copie a 480p: i video originali restano dove sono. Puoi prepararle di nuovo quando vuoi.", true)) return;
    const result = await api("/api/manage/versions/clear", { method: "POST", data: {} });
    await reloadLibrary();
    await loadExtras();
    notify(`Eliminate ${quantity(result.removed, "versione leggera", "versioni leggere")}.`);
  }));
  $("#versions-prepare").addEventListener("click", action(async () => {
    const item = state.items.find((i) => i.id === $("#edit-item").value);
    if (!item) throw new Error("Scegli prima un titolo in \xABSistema titoli\xBB.");
    const ids = (item.series ? state.items.filter((i) => i.root === item.root && i.series === item.series) : [item]).filter((i) => !i.light).map((i) => i.id).slice(0, 300);
    if (!ids.length) {
      notify("Questo titolo ha gi\xE0 la versione leggera.");
      return;
    }
    await api("/api/versions", { method: "POST", data: { ids } });
    await loadExtras();
    notify("Preparo la versione leggera, una alla volta: puoi continuare a usare Apollon.");
  }));
  $("#online-art-enabled").addEventListener("change", action(async () => {
    const wanted = $("#online-art-enabled").checked;
    try {
      if (wanted && !await ask("Cercare le copertine ufficiali su internet?", "", "Apollon mander\xE0 solo i titoli (e gli artisti) ad AniList, iTunes e MusicBrainz e salver\xE0 le immagini qui. Non invia mai i tuoi file.", true)) {
        $("#online-art-enabled").checked = false;
        return;
      }
      await api("/api/manage/online-art", { method: "POST", data: { enabled: wanted } });
      notify(wanted ? "Acceso. Le copertine ufficiali arrivano pian piano, una alla volta." : "Spento. Apollon non chiede pi\xF9 niente a internet.");
    } catch (error) {
      $("#online-art-enabled").checked = !wanted;
      throw error;
    }
  }));
  async function loadFiles() {
    if (!state.root) return;
    const list2 = await api(`/api/manage/files?root=${encodeURIComponent(state.root)}&path=${encodeURIComponent(state.filePath)}`);
    $("#current-path").textContent = `${state.root}/${state.filePath}`;
    $("#parent-folder").disabled = !state.filePath;
    $("#files-list").replaceChildren(...list2.map((file) => el("tr", {}, el("td", {}, file.directory ? el("button", { class: "file-name", onclick: action(async () => {
      state.filePath = file.path;
      await loadFiles();
    }) }, `\u25B8 ${file.name}`) : file.name), el("td", { class: "muted" }, file.directory ? "Cartella" : fmtSize(file.size)), el("td", {}, file.directory ? null : [
      el("button", { class: "quiet", onclick: action(async () => {
        const to = await ask("Rinomina o sposta il file", file.path, "Scegli la raccolta e scrivi il percorso al suo interno. Esempio: Serie/Stagione 1/Episodio.mp4. Le cartelle devono esistere. I sottotitoli vanno spostati e rinominati a parte.", false, true);
        const toRoot = $("#input-root").value;
        if (!to || to === file.path && toRoot === state.root) return;
        await api("/api/manage/move", { method: "POST", data: { root: state.root, toRoot, from: file.path, to } });
        await afterFiles();
        notify("File sistemato.");
      }) }, "Rinomina / Sposta"),
      el("button", { class: "quiet danger", onclick: action(async () => {
        if (!await ask("Mettere il file nel cestino?", "", `\u201C${file.name}\u201D rester\xE0 recuperabile.`, true)) return;
        await api("/api/manage/trash", { method: "POST", data: { root: state.root, path: file.path } });
        await afterFiles();
        notify("File spostato nel cestino.");
      }) }, "Nel cestino")
    ]))));
    if (!list2.length) $("#files-list").append(el("tr", {}, el("td", { colspan: 3, class: "muted" }, "La cartella \xE8 vuota. Puoi caricare qui i tuoi file.")));
  }
  async function afterFiles() {
    await reloadLibrary();
    await refreshProgress();
    await loadManage();
  }
  $("#admin-login").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    await api("/api/login", { method: "POST", data: { key: form.elements.key.value } });
    form.elements.key.value = "";
    state.boot.admin = true;
    await loadManage();
    notify("Gestione aperta su questo dispositivo.");
  }));
  $("#logout").addEventListener("click", action(async () => {
    pauseMusic();
    persistQueue();
    await api("/api/logout", { method: "POST", data: {} });
    ++radioGeneration;
    radio = null;
    state.boot.admin = false;
    state.boot.music = false;
    await loadManage();
    notify("Accesso chiuso.");
  }));
  $("#root").addEventListener("change", action(async () => {
    state.root = $("#root").value;
    state.filePath = "";
    await loadFiles();
  }));
  $("#parent-folder").addEventListener("click", action(async () => {
    state.filePath = state.filePath.split("/").slice(0, -1).join("/");
    await loadFiles();
  }));
  $("#new-folder").addEventListener("click", action(async () => {
    const name = await ask("Nome della nuova cartella");
    if (!name) return;
    await api("/api/manage/folder", { method: "POST", data: { root: state.root, path: [state.filePath, name].filter(Boolean).join("/") } });
    await loadFiles();
  }));
  async function scan(retry = false) {
    await api("/api/manage/scan", { method: "POST", data: { retry } });
    await afterFiles();
    notify("Raccolta aggiornata. Le anteprime arrivano una alla volta.");
  }
  $("#refresh-index").addEventListener("click", action(() => scan()));
  $("#retry-metadata").addEventListener("click", action(() => scan(true)));
  $("#upload-form").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button");
    const files = [...form.elements.files.files];
    if (!files.length) return;
    button.disabled = true;
    $("#upload-progress").hidden = false;
    const root = state.root;
    const folder = state.filePath;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        $("#upload-note").textContent = `Carico ${file.name} (${i + 1} di ${files.length})\u2026`;
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `/api/manage/upload?root=${encodeURIComponent(root)}&path=${encodeURIComponent([folder, file.name].filter(Boolean).join("/"))}`);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) $("#upload-progress").value = 100 * e.loaded / e.total;
          };
          xhr.onerror = () => reject(new Error("Caricamento interrotto. Controlla il Wi-Fi e riprova."));
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              let error;
              try {
                error = JSON.parse(xhr.responseText).error;
              } catch {
                error = "Caricamento non riuscito.";
              }
              reject(new Error(error));
            }
          };
          xhr.send(file);
        });
      }
      form.reset();
      $("#upload-note").textContent = "Caricamento completato. I nuovi file sono nella raccolta.";
      notify("File caricati.");
    } finally {
      button.disabled = false;
      $("#upload-progress").hidden = true;
      await afterFiles();
    }
  }));
  async function loadTrash() {
    const list2 = await api("/api/manage/trash");
    $("#trash-list").replaceChildren(...list2.map((r) => el("div", { class: "trash-row" }, el("div", {}, el("strong", {}, r.path), el("p", { class: "muted" }, `${r.root} \xB7 ${new Date(r.date).toLocaleDateString("it-IT")}`)), el("button", { class: "secondary", onclick: action(async () => {
      await api("/api/manage/restore", { method: "POST", data: { id: r.id } });
      await loadTrash();
      await afterFiles();
      notify("File rimesso al suo posto.");
    }) }, "Ripristina"))));
    if (!list2.length) $("#trash-list").append(el("p", { class: "muted" }, "Il cestino \xE8 vuoto."));
  }
  $("#trash-open").addEventListener("click", action(async () => {
    await loadTrash();
    showDialog("#trash-dialog");
  }));
  function populateEdit() {
    const previous = $("#edit-item").value;
    $("#edit-item").replaceChildren(...state.items.map((i) => el("option", { value: i.id }, `${i.series ? `${i.series} S${i.season}E${i.episode} \xB7 ` : ""}${i.title}`)));
    if (state.items.some((i) => i.id === previous)) $("#edit-item").value = previous;
    fillEdit();
  }
  function fillEdit() {
    var _a2, _b2;
    const item = state.items.find((i) => i.id === $("#edit-item").value);
    if (!item) return;
    $("#edit-title").value = item.title;
    $("#edit-genres").value = (item.genres || []).join(", ");
    $("#edit-series").value = item.series || "";
    $("#edit-season").value = (_a2 = item.season) != null ? _a2 : 1;
    $("#edit-episode").value = (_b2 = item.episode) != null ? _b2 : 1;
    $("#edit-image").value = item.imagePath || "";
    $("#edit-image").placeholder = `Esempio: Copertine/locandina.jpg (dentro ${item.root})`;
    $("#edit-scope").value = "episode";
    fillSkipEdit(item);
    artEditor.paint();
  }
  function fillSkipEdit(item) {
    var _a2, _b2, _c, _d;
    for (const [type, prefix] of [["riassunto", "recap"], ["sigla", "opening"], ["finale", "ending"], ["anteprima", "preview"]]) {
      const range = (_a2 = item.salti) == null ? void 0 : _a2[type];
      $(`#${prefix}-start`).value = (_b2 = range == null ? void 0 : range[0]) != null ? _b2 : "";
      $(`#${prefix}-end`).value = (_c = range == null ? void 0 : range[1]) != null ? _c : "";
    }
    $("#skip-same-opening").checked = false;
    $("#skip-sources").textContent = Object.entries(item.fontiSalti || {}).map(([type, source]) => `${type}: ${source}`).join(" \xB7 ") || "Nessun tempo trovato. Puoi analizzare la stagione o inserirli qui.";
    if ((_d = state.boot) == null ? void 0 : _d.admin) loadSkipStatus().catch(() => {
    });
  }
  async function loadSkipStatus() {
    const id = $("#edit-item").value;
    const result = await api(`/api/manage/skips${id ? `?id=${encodeURIComponent(id)}` : ""}`);
    if (id !== $("#edit-item").value) return;
    $("#skip-status").textContent = `${result.message} ${result.running ? "In corso" : ""}${result.pending ? ` \xB7 ${quantity(result.pending, "stagione", "stagioni")} in attesa` : ""}${result.failed ? ` \xB7 ${quantity(result.failed, "problema", "problemi")}` : ""}`;
    $("#aniskip-enabled").checked = result.aniskip;
    $("#aniskip-mal").value = result.malId || "";
  }
  $("#skip-refresh").addEventListener("click", action(async () => {
    await reloadLibrary();
    await loadSkipStatus();
  }));
  $("#skip-analyze").addEventListener("click", action(async () => {
    await api("/api/manage/skips/analyze", { method: "POST", data: { id: $("#edit-item").value } });
    await loadSkipStatus();
    notify("Stagione aggiunta alla coda locale. Puoi continuare a usare Apollon.");
  }));
  $("#skip-settings").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const id = $("#edit-item").value;
    await api("/api/manage/skips/settings", { method: "POST", data: { aniskip: $("#aniskip-enabled").checked, ...id ? { id, malId: $("#aniskip-mal").value ? Number($("#aniskip-mal").value) : null } : {} } });
    notify("Scelta salvata. Usa Analizza la stagione per cercare i tempi.");
  }));
  $("#skip-edit-form").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const salti = {};
    for (const [type, prefix] of [["riassunto", "recap"], ["sigla", "opening"], ["finale", "ending"], ["anteprima", "preview"]]) {
      const start = $(`#${prefix}-start`).value;
      const end = $(`#${prefix}-end`).value;
      if (start === "" !== (end === "")) throw new Error("Per ogni tratto inserisci sia inizio sia fine, oppure lascia entrambi vuoti.");
      salti[type] = start === "" ? null : [Number(start), Number(end)];
    }
    const result = await api("/api/manage/skips/edit", { method: "POST", data: { id: $("#edit-item").value, salti, sameOpening: $("#skip-same-opening").checked } });
    await reloadLibrary();
    notify(`Tempi salvati per ${quantity(result.updated, "episodio", "episodi")}.`);
  }));
  $("#edit-item").addEventListener("change", fillEdit);
  $("#edit-form").addEventListener("submit", action(async (event) => {
    event.preventDefault();
    const id = $("#edit-item").value;
    if (!id) return;
    await api("/api/manage/edit", { method: "POST", data: {
      id,
      title: $("#edit-title").value,
      series: $("#edit-series").value.trim(),
      season: Number($("#edit-season").value),
      episode: Number($("#edit-episode").value),
      imagePath: $("#edit-image").value.trim(),
      scope: $("#edit-scope").value,
      genres: $("#edit-genres").value.split(",").map((s) => s.trim()).filter(Boolean)
    } });
    await reloadLibrary();
    notify("Scheda aggiornata.");
  }));
  var wideEnoughForTv = () => Math.max(innerWidth, innerHeight) >= 900 && innerWidth >= 700;
  function tvFocusable(node) {
    if (!node || node === document.body || !node.isConnected || node.disabled || node.closest('[hidden],[inert],[aria-disabled="true"]') || insideClosedDetails(node) || node.matches(".skip")) return false;
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return node.getClientRects().length > 0 && box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.visibility !== "collapse";
  }
  function tvPage() {
    if (!tvPage.nav) tvPage.nav = createTvPageNav({ focusable: tvFocusable, spatialTarget, reduce: () => matchMedia("(prefers-reduced-motion: reduce)").matches });
    return tvPage.nav;
  }
  function tvFocus(node) {
    if (!node) return;
    node.focus({ preventScroll: true });
    if (node.closest("dialog,.topbar")) node.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
    else tvPage().reveal(node);
  }
  document.addEventListener("focusin", (event) => {
    if (document.documentElement.classList.contains("tv")) tvPage().remember(event.target);
  });
  function focusTvStart() {
    if (!document.documentElement.classList.contains("tv") || activeDialog() || document.documentElement.classList.contains("booting")) return;
    const first = $$("#video-view .c-open, #video-view .t-card").find(tvFocusable) || $$("#video-view .billboard .v-play").find(tvFocusable) || $$("#music-page button, #manage-page button, #main-nav button").find(tvFocusable);
    tvFocus(first);
  }
  function applyTv(enabled) {
    enabled = !!enabled && wideEnoughForTv();
    document.documentElement.classList.toggle("tv", enabled);
    document.documentElement.classList.toggle("remote-input", enabled);
    $("#tv-toggle").setAttribute("aria-pressed", String(enabled));
    storage.set("tv", enabled);
  }
  try {
    tizen.tvinputdevice.registerKeyBatch(["MediaPlayPause", "MediaPlay", "MediaPause", "MediaFastForward", "MediaRewind"]);
  } catch {
  }
  {
    const asked = new URLSearchParams(location.search).get("tv");
    applyTv(asked === "1" ? true : asked === "0" ? false : storage.get("tv", false));
  }
  $("#tv-toggle").addEventListener("click", () => applyTv(!document.documentElement.classList.contains("tv")));
  var tvCursorTimer;
  document.addEventListener("mousemove", () => {
    if (!document.documentElement.classList.contains("tv")) return;
    document.documentElement.classList.remove("remote-input");
    clearTimeout(tvCursorTimer);
    tvCursorTimer = setTimeout(() => document.documentElement.classList.add("remote-input"), 1800);
  }, { passive: true });
  document.addEventListener("keydown", (event) => {
    const isTv = document.documentElement.classList.contains("tv");
    if (!isTv) return;
    document.documentElement.classList.add("remote-input");
    clearTimeout(tvCursorTimer);
    if (event.defaultPrevented) return;
    if (document.documentElement.classList.contains("booting") && event.key.startsWith("Arrow")) {
      event.preventDefault();
      if (!$("#apollon-boot-retry").hidden) $("#apollon-boot-retry").focus();
      return;
    }
    const active = document.activeElement;
    const dialog = activeDialog();
    if (event.key === "Enter" && (dialog == null ? void 0 : dialog.id) === "video-dialog" && (active === video || active === dialog || active === document.body) && activeSkip()) {
      event.preventDefault();
      performSkip().catch((e) => notify(e.message, true));
      return;
    }
    if (["Escape", "BrowserBack", "GoBack"].includes(event.key) || event.keyCode === 10009) {
      if ((dialog == null ? void 0 : dialog.id) === "video-dialog" && !$("#vp-panel").hidden) {
        event.preventDefault();
        $("#vp-panel-close").click();
      } else if (dialog) {
        event.preventDefault();
        if (dialog.id === "music-player") closeMusicPlayer();
        else dialog.close();
      } else if (document.fullscreenElement) {
        event.preventDefault();
        document.exitFullscreen().catch(() => {
        });
      } else if (state.page === "music" && musicTrail.length > 1) {
        event.preventDefault();
        musicBack().catch((e) => notify(e.message, true));
      } else {
        event.preventDefault();
        const previous = tvPageTrail.pop();
        if (previous || state.page !== "home") {
          tvReturning = true;
          try {
            setPage(previous || "home");
          } finally {
            tvReturning = false;
          }
        } else try {
          tizen.application.getCurrentApplication().exit();
        } catch {
        }
      }
      return;
    }
    const seek = (seconds) => {
      if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
    };
    const media = { MediaPlayPause: (v) => v.paused ? v.play() : v.pause(), MediaPlay: (v) => v.play(), MediaPause: (v) => v.pause(), MediaFastForward: () => seek(10), MediaRewind: () => seek(-10) };
    const mediaKey = { 10252: "MediaPlayPause", 415: "MediaPlay", 19: "MediaPause", 417: "MediaFastForward", 412: "MediaRewind" }[event.keyCode] || event.key;
    if (media[mediaKey] && (dialog == null ? void 0 : dialog.id) === "video-dialog") {
      event.preventDefault();
      try {
        const result = media[mediaKey](video);
        if (result == null ? void 0 : result.catch) result.catch(() => {
        });
      } catch {
      }
      return;
    }
    if (["MediaPlayPause", "MediaPlay", "MediaPause"].includes(mediaKey) && state.page === "music") {
      event.preventDefault();
      if (mediaKey === "MediaPlayPause" || mediaKey === "MediaPlay" && audio.paused || mediaKey === "MediaPause" && !audio.paused) $("#audio-toggle").click();
      return;
    }
    if (event.key === "Enter" && active === document.body) {
      event.preventDefault();
      focusTvStart();
      return;
    }
    if (event.key.startsWith("Arrow") && (!active || active === document.body) && !dialog) {
      event.preventDefault();
      focusTvStart();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    if ((dialog == null ? void 0 : dialog.id) === "music-player" && (active == null ? void 0 : active.id) === "lyrics-lines" && !lyrics.synced && ["ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      active.scrollBy({ top: active.clientHeight * (event.key === "ArrowDown" ? 0.6 : -0.6), behavior: "auto" });
      return;
    }
    if ((dialog == null ? void 0 : dialog.id) === "music-player" && event.key === "ArrowUp" && (active == null ? void 0 : active.closest(".full-controls")) && lyrics.synced) {
      const index = Math.max(0, lyricAt);
      const row = $("#lyrics-lines").children[index];
      if (row == null ? void 0 : row.getClientRects().length) {
        event.preventDefault();
        row.focus({ preventScroll: true });
        centerLyric(index);
        return;
      }
    }
    if ((dialog == null ? void 0 : dialog.id) === "music-player" && ["ArrowUp", "ArrowDown"].includes(event.key) && (active == null ? void 0 : active.matches(".lyric-line"))) {
      const next = event.key === "ArrowDown" ? active.nextElementSibling : active.previousElementSibling;
      if (next) {
        event.preventDefault();
        next.focus({ preventScroll: true });
        centerLyric([...next.parentNode.children].indexOf(next));
        return;
      }
    }
    if (active == null ? void 0 : active.matches("textarea,video,audio,[contenteditable]")) return;
    if ((active == null ? void 0 : active.matches("select")) && ["ArrowUp", "ArrowDown"].includes(event.key)) return;
    if ((active == null ? void 0 : active.matches("input")) && ["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    if (!dialog && active && active !== document.body) {
      event.preventDefault();
      tvPage().move(event.key, active, focusTvStart);
      return;
    }
    const scope = dialog || document;
    const candidates = [...scope.querySelectorAll('button,a[href],input,select,summary,[tabindex="0"]')].filter(tvFocusable);
    if (!candidates.length) return;
    const best = spatialTarget(active == null ? void 0 : active.getBoundingClientRect(), candidates.filter((c2) => c2 !== active).map((c2) => ({ value: c2, rect: c2.getBoundingClientRect() })), event.key);
    if (best) {
      event.preventDefault();
      tvFocus(best);
    }
  });
  $("#help-open").addEventListener("click", () => showDialog("#help-dialog"));
  var installPrompt;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    $("#install").hidden = false;
  });
  $("#install").addEventListener("click", action(async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      installPrompt = null;
      $("#install").hidden = true;
    }
  }));
  if ("serviceWorker" in navigator && window.isSecureContext && !window.__legacy) navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => {
  });
  window.addEventListener("offline", () => {
    remoteMusic == null ? void 0 : remoteMusic.stop();
    remoteMusic = null;
    notify("Sei senza rete. Puoi ascoltare la musica scaricata.");
    if (state.page === "music") loadMusic("library");
  });
  function reachableOther(url) {
    if (!url || /^(192\.168\.|10\.|127\.|localhost$)/.test(location.hostname)) return url;
    try {
      const u = new URL(url);
      u.hostname = location.hostname;
      u.port = location.port === "8788" ? "8787" : "8788";
      return u.href;
    } catch {
      return url;
    }
  }
  async function comeBackOnline() {
    if (!state.offline) {
      syncPendingProgress();
      return;
    }
    try {
      state.boot = await api("/api/bootstrap");
      state.boot.otherLibraryUrl = reachableOther(state.boot.otherLibraryUrl);
    } catch {
      return;
    }
    state.offline = false;
    populateProfiles();
    await syncPendingProgress();
    await Promise.all([reloadLibrary(), refreshProgress(), videoApp.loadList().catch(() => {
    })]).catch(() => {
    });
    renderCatalog();
    flushPlayed();
    if (state.page === "music") loadMusic("library");
  }
  window.addEventListener("online", () => {
    comeBackOnline().catch(() => {
    });
    if (!state.offline) flushPlayed();
  });
  window.addEventListener("pagehide", () => {
    playback.account();
    playback.reportActivity(true);
    remoteMusic == null ? void 0 : remoteMusic.stop();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) ensureDevices().catch(() => {
    });
  });
  window.addEventListener("focus", () => {
    if (state.boot && !state.current) refreshProgress().then(renderCatalog).catch(() => {
    });
  });
  $$("[data-icon]").forEach((node) => node.replaceChildren(shellIcon(node.dataset.icon)));
  $("#mini-devices").replaceChildren(shellIcon("devices"));
  $("#bar-now").replaceChildren(shellIcon("panel"));
  pressFeedback(document.body);
  var offlineVideo = new OfflineVideo();
  var downloadedIds = /* @__PURE__ */ new Set();
  function refreshDownloaded() {
    var _a2;
    const before = downloadedIds.size;
    downloadedIds = new Set(Object.values(((_a2 = offlineVideo.m) == null ? void 0 : _a2.entries) || {}).filter((e) => e.state === "done").map((e) => e.id));
    if (downloadedIds.size !== before) cacheProgress();
  }
  var downloadsPage = createDownloads({ el, state, notify, action, fmtSize, manager: offlineVideo, playItem, setPage, ask, repaint: () => {
    if (state.page === "scaricati") videoApp.render();
  } });
  var downloadsApi = {
    state(id) {
      var _a2;
      const job = offlineVideo.jobs.get(id);
      const e = (_a2 = offlineVideo.m) == null ? void 0 : _a2.entries[id];
      const share = (e == null ? void 0 : e.total) ? downloadedBytes(e) / e.total : 0;
      if (job) return { kind: "active", share, quality: job.quality };
      return e ? { kind: e.state === "done" ? "done" : "paused", share, quality: e.quality } : null;
    },
    estimate: estimateBytes,
    async start(items, quality) {
      if (!window.isSecureContext || !navigator.serviceWorker || !globalThis.caches) throw new Error("Per scaricare serve Apollon aperta con HTTPS (oppure localhost sul PC), con un browser che ha la memoria offline.");
      let timer;
      try {
        await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("La memoria offline non \xE8 pronta. Ricarica la pagina e riprova.")), 15e3);
        })]);
      } finally {
        clearTimeout(timer);
      }
      await offlineVideo.load();
      const saved = storage.get("offline-bootstrap") || {};
      const boot = state.boot;
      storage.set("offline-bootstrap", { profiles: boot.profiles, mode: saved.mode || boot.mode || "video", music: !!saved.music, musicUser: saved.musicUser || "", roots: [], count: 0, pending: false, demo: boot.demo });
      for (const item of items) offlineVideo.enqueue(item, quality);
      notify(items.length === 1 ? "Download avviato. Lo trovi in Scaricati." : `Scarico ${items.length} episodi. Li trovi in Scaricati.`);
    }
  };
  var repaintTimer = 0;
  offlineVideo.onchange(() => {
    refreshDownloaded();
    if (repaintTimer || state.page !== "scaricati" && !$("#title-dialog").open) return;
    repaintTimer = setTimeout(() => {
      repaintTimer = 0;
      videoApp.render();
    }, 1e3);
  });
  var videoApp = createVideoApp({ el, $, state, api, action, notify, storage, ask, showDialog, activeDialog, focusTvStart, populateProfiles, playItem, setPage, reloadLibrary, saveVideoPreferences, syncVideoPreferences, lightModeOn, switchQuality, qualityPreference, fmtSize, downloads: downloadsApi, downloadsView: downloadsPage.view });
  videoApp.init();
  createPlayer({ $, el, state, video, action, storage, fmtTime, notify, playItem, performSkip, activeSkip, switchQuality, qualityPreference, nextEpisode, activeDialog, pushLayer: (name) => videoApp.pushLayer(name) });
  var artEditor = createArtEditor({ $, el, state, api, action, notify, reloadLibrary });
  $("#music-nav").addEventListener("click", (event) => {
    const button = event.target.closest("[data-section]");
    if (!button) return;
    const section = button.dataset.section;
    if (section === "create") {
      showDialog("#music-create");
      return;
    }
    const tab = { home: "home", search: "browse", library: "library" }[section];
    if (musicTrail.length === 1 && musicTrail[0].key === `tab:${tab}`) window.scrollTo({ top: 0, behavior: "instant" });
    clearTimeout(searchTimer);
    $("#music-search").value = "";
    loadMusic(tab);
  });
  $("#music-create").addEventListener("click", (event) => {
    if (event.target.closest(".sheet-item")) $("#music-create").close();
  }, true);
  $("#create-playlist").addEventListener("click", action(() => createPlaylist()));
  $("#create-from-queue").addEventListener("click", () => showDialog("#queue-dialog"));
  $("#create-blend").addEventListener("click", action(async () => {
    const others = (state.boot.profiles || []).filter((o) => o.id !== state.profile);
    if (!others.length) throw new Error("Per una Miscela serve un secondo profilo. Aggiungilo con \xAB+\xBB in alto.");
    const blend = async (o) => {
      setPage("music");
      (await Promise.resolve().then(() => (init_music_blend(), music_blend_exports))).showBlend(musicContext(), o);
    };
    if (others.length === 1) await blend(others[0]);
    else collectionMenu("Miscela con\u2026", others.map((o) => [o.name, () => blend(o)]));
  }));
  $("#mini-devices").addEventListener("click", () => {
    openMusicPlayer();
    requestAnimationFrame(() => {
      $("#music-devices").scrollIntoView({ block: "center", behavior: "instant" });
      $("#music-devices").focus({ preventScroll: true });
    });
  });
  $("#mini-like").addEventListener("click", action(() => toggleLike(state.queue[state.queueIndex])));
  function syncMiniLike() {
    const song2 = state.queue[state.queueIndex];
    const liked = !!song2 && likedIds.has(song2.id);
    $("#mini-like").replaceChildren(shellIcon(liked ? "added" : "add"));
    $("#mini-like").setAttribute("aria-pressed", String(liked));
    $("#mini-like").title = liked ? "Tra i brani che ti piacciono" : "Aggiungi ai brani che ti piacciono";
  }
  $("#audio-cover").addEventListener("load", () => coverColor($("#audio-cover")).then((rgb) => {
    if (rgb) $("#audio-bar").style.setProperty("--mini-color", deepen(rgb, 0.27));
    else $("#audio-bar").style.removeProperty("--mini-color");
  }));
  $("#audio-cover").addEventListener("error", () => {
    if ($("#audio-cover").getAttribute("src") !== "/music-cover.svg") $("#audio-cover").src = "/music-cover.svg";
  });
  function paintMiniProgress() {
    const seek = $("#audio-seek");
    const max = Number(seek.max) || 0;
    $("#mini-progress-fill").style.width = `${max ? Math.min(100, Number(seek.value) / max * 100) : 0}%`;
  }
  for (const node of [$("#audio"), $("#audio-buffer")]) for (const name of ["timeupdate", "seeked", "emptied", "loadedmetadata"]) node.addEventListener(name, () => requestAnimationFrame(paintMiniProgress));
  $("#audio-seek").addEventListener("input", paintMiniProgress);
  var sideFilter = "";
  var sideRequest = 0;
  async function paintMusicSide(force = false) {
    var _a2;
    const side = $("#music-side");
    const key = `${musicKey()}:${state.profile}:${sideFilter}`;
    if (!((_a2 = state.boot) == null ? void 0 : _a2.music) || state.page !== "music" || !matchMedia("(min-width:900px)").matches || !force && side.dataset.key === key) return;
    side.dataset.key = key;
    const request = ++sideRequest;
    try {
      const [result, lib] = await Promise.all([api(`/api/music/library?profile=${encodeURIComponent(state.profile)}`), Promise.resolve().then(() => (init_music_library(), music_library_exports))]);
      if (request !== sideRequest) return;
      const prefs = storage.get(`${musicKey()}:${state.profile}:library`, {}) || {};
      const items = lib.libraryItems(result.items || [], { filter: sideFilter, sort: "recent", pins: prefs.pins || [], recent: prefs.recent || {} });
      const c2 = musicContext();
      const kinds = { playlist: "Playlist", album: "Album", artist: "Artista" };
      const cover = (item) => item.type === "artist" ? artistArt(c2, item.name, item.coverArt, 80) : item.type === "playlist" && !item.coverArt ? lazyArt(c2, art(el, musicImage, { name: item.name, glyph: "\u266A" }), "playlist", item.id) : art(el, musicImage, { ids: [item.coverArt], name: item.name, size: 80 });
      const liked = art(el, musicImage, { name: "Brani che ti piacciono", glyph: "\u2665" });
      liked.classList.add("liked-art");
      side.replaceChildren(
        el("div", { class: "side-head" }, el("h2", {}, "La tua libreria"), el("button", { class: "icon-button", "aria-label": "Crea una playlist o una miscela", title: "Crea", onclick: () => showDialog("#music-create") }, shellIcon("plus"))),
        el("div", { class: "chips", role: "group", "aria-label": "Filtra la libreria a sinistra" }, ...[["playlist", "Playlist"], ["album", "Album"], ["artist", "Artisti"]].map(([id, name]) => el("button", { class: "chip", "aria-label": `Solo ${name.toLocaleLowerCase("it")}`, "aria-pressed": sideFilter === id, onclick: () => {
          sideFilter = sideFilter === id ? "" : id;
          paintMusicSide(true);
        } }, name))),
        el(
          "div",
          { class: "side-list" },
          sideFilter ? null : el("button", { class: "side-row", "aria-label": "Brani che ti piacciono, la tua playlist dei preferiti", onclick: () => loadMusic("liked") }, liked, el("span", { class: "side-copy" }, el("strong", {}, "Brani che ti piacciono"), el("small", {}, `Playlist \xB7 ${likedIds.size} brani`))),
          ...items.slice(0, 60).map((item) => el(
            "button",
            { class: `side-row${item.type === "artist" ? " side-artist" : ""}`, "aria-label": `${item.name}, ${kinds[item.type].toLocaleLowerCase("it")}`, onclick: action(() => c2.open(item)) },
            cover(item),
            el("span", { class: "side-copy" }, el("strong", {}, item.name), el("small", {}, [kinds[item.type], item.type === "playlist" ? quantity(item.songCount || 0, "brano", "brani") : item.artist].filter(Boolean).join(" \xB7 ")))
          ))
        )
      );
      if (items.length > 60) side.append(el("button", { class: "secondary", onclick: () => loadMusic("library") }, "Apri tutta la libreria"));
    } catch {
      if (request === sideRequest) {
        side.dataset.key = "";
        side.replaceChildren(el("p", { class: "muted" }, "La libreria non si \xE8 caricata. Riprova pi\xF9 tardi."));
      }
    }
  }
  function paintNowPanel() {
    const panel = $("#music-now");
    const song2 = state.queue[state.queueIndex];
    const open = storage.get("now-panel", true) !== false;
    $("#bar-now").setAttribute("aria-pressed", String(open));
    panel.hidden = !song2 || !open;
    document.body.classList.toggle("now-open", !panel.hidden);
    if (panel.hidden) return;
    const next = state.queue.slice(state.queueIndex + 1, state.queueIndex + 6);
    const cover = el("img", { class: "now-cover", src: musicImage(song2.coverArt || song2.albumId, 400), alt: "", onerror: (event) => {
      event.target.src = "/music-cover.svg";
    } });
    coverColor(cover).then((rgb) => {
      if (rgb) panel.style.setProperty("--now-color", deepen(rgb, 0.3));
    });
    const credits = [["Artista", song2.artist], ["Album", song2.album], ["Anno", song2.year], ["Durata", song2.duration ? fmtTime(song2.duration) : ""]].filter(([, value]) => value);
    panel.replaceChildren(
      el("div", { class: "now-head" }, el("strong", {}, song2.album || "In riproduzione"), el("button", { class: "icon-button", "aria-label": "Chiudi il pannello In riproduzione", title: "Chiudi", onclick: () => {
        storage.set("now-panel", false);
        paintNowPanel();
      } }, shellIcon("close"))),
      cover,
      el("div", { class: "now-title" }, el("strong", {}, song2.title), el("span", { class: "muted" }, song2.artist || "Artista sconosciuto")),
      el("section", { class: "now-card" }, el("h3", {}, "Crediti"), el("dl", {}, ...credits.flatMap(([name, value]) => [el("dt", {}, name), el("dd", {}, value)]))),
      el(
        "section",
        { class: "now-card" },
        el("h3", {}, "Prossimi in coda"),
        next.length ? el("ol", { class: "now-queue" }, ...next.map((s, i) => el("li", {}, el(
          "button",
          { class: "now-next", "aria-label": `Salta a ${s.title}`, onclick: () => playSong(state.queueIndex + i + 1) },
          el("img", { src: musicImage(s.coverArt || s.albumId, 80), alt: "", loading: "lazy" }),
          el("span", {}, el("strong", {}, s.title), el("small", {}, s.artist || ""))
        )))) : el("p", { class: "muted" }, "Non ci sono altri brani in coda."),
        el("button", { class: "secondary pill", onclick: () => showDialog("#queue-dialog") }, "Apri la coda")
      )
    );
  }
  $("#bar-now").addEventListener("click", () => {
    storage.set("now-panel", storage.get("now-panel", true) === false);
    paintNowPanel();
  });
  var _a, _b;
  (_b = (_a = matchMedia("(min-width:900px)")).addEventListener) == null ? void 0 : _b.call(_a, "change", () => paintMusicSide());
  async function init2() {
    var _a2, _b2, _c;
    try {
      try {
        state.boot = await api("/api/bootstrap");
      } catch (error) {
        const saved = storage.get("offline-bootstrap");
        if (!saved) throw error;
        state.boot = saved;
        state.offline = true;
      }
      state.boot.otherLibraryUrl = reachableOther(state.boot.otherLibraryUrl);
      $("#demo-notice").hidden = !state.boot.demo;
      populateProfiles();
      await offlineVideo.load().catch(() => {
      });
      refreshDownloaded();
      if (!state.offline) {
        await Promise.all([reloadLibrary(), refreshProgress(), videoApp.loadList().catch(() => {
        })]);
        syncPendingProgress();
      } else {
        state.items = Object.values(((_a2 = offlineVideo.m) == null ? void 0 : _a2.entries) || {}).filter((e) => e.state === "done").map((e) => e.item);
        state.progress = offlineProgress(state.profile);
      }
      if (state.boot.otherLibraryUrl) {
        $("#other-library").href = state.boot.otherLibraryUrl;
        $("#other-library").hidden = false;
        if (state.boot.mode !== "music") {
          $("#music-server-link").href = `${state.boot.otherLibraryUrl.replace(/\/$/, "")}/#music`;
          $("#music-server-link").hidden = false;
        }
      }
      $("#loading").hidden = true;
      renderQueue();
      if (state.boot.music) {
        await restoreMusic();
        flushPlayed();
      }
      const asked = location.hash.slice(1);
      await setPage(state.offline ? asked === "music" || !downloadedIds.size && state.boot.music ? "music" : "scaricati" : asked || (state.boot.mode === "music" ? "music" : "home"));
      await ((_b2 = window.ApollonBoot) == null ? void 0 : _b2.ready());
      focusTvStart();
      if (!document.documentElement.classList.contains("tv") || !state.profile) videoApp.maybeAskWho();
      pollTimer = setInterval(async () => {
        if (document.visibilityState !== "visible" || state.page === "manage" || state.current) return;
        try {
          const boot = await api("/api/bootstrap");
          if (state.offline) {
            comeBackOnline().catch(() => {
            });
            return;
          }
          const changed = boot.lastScan !== state.boot.lastScan || boot.pending !== state.boot.pending || boot.count !== state.boot.count;
          Object.assign(state.boot, boot);
          if (changed) await reloadLibrary();
        } catch {
        }
      }, 15e3);
    } catch (e) {
      $("#loading").hidden = false;
      $("#loading").className = "boot-error";
      $("#loading").replaceChildren(el("h1", {}, "Non riesco ad aprire la raccolta"), el("p", {}, e.message), el("button", { class: "primary", onclick: () => location.reload() }, "Riprova"));
      await ((_c = window.ApollonBoot) == null ? void 0 : _c.ready());
      if (document.documentElement.classList.contains("tv")) tvFocus($("#loading button"));
    }
  }
  init2();
})();
