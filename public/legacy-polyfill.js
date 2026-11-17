// Versione per browser vecchi (TV Samsung con Chromium 76). Ogni pezzo parte solo se manca.
window.__legacy = true;
(function () {
  var def = function (obj, name, fn) { if (!obj[name]) Object.defineProperty(obj, name, { value: fn, writable: true, configurable: true }); };
  var rel = function (i, n) { i = Math.trunc(i) || 0; return i < 0 ? n + i : i; };
  [Array.prototype, String.prototype, Uint8Array.prototype].forEach(function (p) {
    def(p, 'at', function (i) { i = rel(i, this.length); return i < 0 || i >= this.length ? undefined : this[i]; });
  });
  def(Array.prototype, 'findLast', function (f, t) { for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return this[i]; });
  def(Array.prototype, 'findLastIndex', function (f, t) { for (var i = this.length - 1; i >= 0; i--) if (f.call(t, this[i], i, this)) return i; return -1; });
  def(String.prototype, 'replaceAll', function (a, b) { return this.replace(a instanceof RegExp ? a : new RegExp(String(a).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), b); });
  def(Object, 'hasOwn', function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); });
  def(window, 'structuredClone', function (v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); });
  def(window, 'queueMicrotask', function (f) { Promise.resolve().then(f); });
  def(window, 'requestIdleCallback', function (f) { return setTimeout(function () { f({ didTimeout: false, timeRemaining: function () { return 10; } }); }, 1); });
  def(window, 'cancelIdleCallback', function (id) { clearTimeout(id); });
  if (window.AbortSignal) {
    def(AbortSignal, 'timeout', function (ms) { var c = new AbortController(); setTimeout(function () { c.abort(); }, ms); return c.signal; });
    def(AbortSignal, 'any', function (list) {
      var c = new AbortController(); list.forEach(function (s) { if (s.aborted) c.abort(); else s.addEventListener('abort', function () { c.abort(); }); });
      return c.signal;
    });
  }
  def(Promise, 'any', function (list) {
    return new Promise(function (ok, no) {
      var errors = [], left = 0, items = Array.from(list);
      if (!items.length) return no(new Error('All promises were rejected'));
      items.forEach(function (p, i) { Promise.resolve(p).then(ok, function (e) { errors[i] = e; if (++left === items.length) { var x = new Error('All promises were rejected'); x.errors = errors; no(x); } }); });
    });
  });
  def(Promise, 'allSettled', function (list) {
    return Promise.all(Array.from(list).map(function (p) { return Promise.resolve(p).then(function (value) { return { status: 'fulfilled', value: value }; }, function (reason) { return { status: 'rejected', reason: reason }; }); }));
  });
  def(Promise, 'withResolvers', function () { var r = {}; r.promise = new Promise(function (a, b) { r.resolve = a; r.reject = b; }); return r; });
  def(Object, 'groupBy', function (items, f) { var out = Object.create(null), i = 0; for (var x of items) (out[f(x, i++)] = out[f(x, i - 1)] || []).push(x); return out; });
  def(Array.prototype, 'flat', function (d) { d = d === undefined ? 1 : d; return d < 1 ? this.slice() : this.reduce(function (a, x) { return a.concat(Array.isArray(x) ? x.flat(d - 1) : x); }, []); });
  def(Array.prototype, 'flatMap', function (f, t) { return this.map(f, t).flat(); });
  if (window.crypto) def(crypto, 'randomUUID', function () {
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    var h = Array.from(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  });
  var S = Set.prototype, has = function (s, x) { return s.has(x); };
  def(S, 'union', function (o) { var r = new Set(this); o.forEach(function (x) { r.add(x); }); return r; });
  def(S, 'intersection', function (o) { var r = new Set(); this.forEach(function (x) { if (has(o, x)) r.add(x); }); return r; });
  def(S, 'difference', function (o) { var r = new Set(); this.forEach(function (x) { if (!has(o, x)) r.add(x); }); return r; });
  def(S, 'isSubsetOf', function (o) { return Array.from(this).every(function (x) { return has(o, x); }); });
  // DOM
  var E = window.Element && Element.prototype;
  if (E) {
    def(E, 'replaceChildren', function () { while (this.firstChild) this.removeChild(this.firstChild); this.append.apply(this, arguments); });
    def(E, 'toggleAttribute', function (n, force) {
      var on = force === undefined ? !this.hasAttribute(n) : !!force;
      if (on) this.setAttribute(n, ''); else this.removeAttribute(n); return on;
    });
  }
  [window.Document, window.DocumentFragment].forEach(function (C) { if (C) def(C.prototype, 'replaceChildren', function () { while (this.firstChild) this.removeChild(this.firstChild); this.append.apply(this, arguments); }); });
  // <dialog>: se manca del tutto, un minimo per showModal/close
  if (window.HTMLDialogElement === undefined && window.HTMLElement) {
    var D = HTMLElement.prototype;
    def(D, 'showModal', function () { this.setAttribute('open', ''); });
    def(D, 'show', function () { this.setAttribute('open', ''); });
    def(D, 'close', function () { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); });
  }
})();
