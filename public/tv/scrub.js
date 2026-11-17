// Ricerca virtuale: il tempo monotono, non il numero di eventi, determina la distanza.
export function createScrub({ position = 0, duration = 0 } = {}) {
  const end = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const clamp = n => Math.max(0, Math.min(end, n));
  const origin = clamp(position); let at = origin, base = origin, started = 0, direction = 0, held = false, released = null, done = false;
  const traversal = 3000 + Math.min(1, Math.max(0, (end - 1800) / 5400)) * 2000;
  const api = {
    get position() { return at; }, get held() { return held; },
    press(sign, now) {
      if (done) return at;
      const next = sign < 0 ? -1 : 1;
      if (held && next === direction) return api.tick(now);
      if (held) api.tick(now);
      base = at; direction = next; started = now; held = true; released = null;
      at = clamp(base + direction * 10); return at;
    },
    tick(now) {
      if (held && !done) {
        const t = Math.max(0, now - started - 160) / (traversal - 160);
        at = clamp(base + direction * (10 + end * Math.pow(t, 2.6)));
      }
      return at;
    },
    release(now) { if (!done && held) { api.tick(now); held = false; released = now; } return at; },
    due(now) { return !done && released !== null && now - released >= 800; },
    confirm() { if (done) return null; done = true; held = false; return at; },
    cancel() { done = true; held = false; at = origin; return origin; }
  };
  return api;
}
