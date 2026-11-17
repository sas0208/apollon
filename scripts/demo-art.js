// Giro F: "fotogrammi" finti per la demo dei video. Paesaggi disegnati dal codice (cielo, astro, crinali,
// mare, città, neve, stelle, una figura in controluce): nessuna immagine presa da fuori, nessun file personale.
// Ogni titolo ha la sua tavolozza, ogni episodio una variante, così locandine e miniature sembrano un catalogo vero.
import zlib from 'node:zlib';

export const hash = text => { let h = [...String(text)].reduce((h, ch) => Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0, 2166136261); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; return (h ^ (h >>> 13)) >>> 0; };
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5 >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; }; }
// Niente rosa/magenta: le tinte fra 290° e 10° (viola e magenta) si spostano su blu/arancio.
export function safeHue(h) { h = ((h % 360) + 360) % 360; return h >= 290 ? h - 110 : h < 10 ? h + 20 : h; }
export function hsl(h, s, l) {
  h = safeHue(h);
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function chunk(type, data) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}
function png(width, height, pixels) {
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) { rows[y * (width * 3 + 1)] = 0; pixels.copy(rows, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3); }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

// scene: { seed, hue, hue2, time: 'giorno'|'tramonto'|'notte', land: 'monti'|'mare'|'citta'|'neve'|'bosco'|'spazio'|'deserto', figure, moons }
export function sceneArt(scene, width = 1280, height = 720) {
  const r = rng(hash(scene.seed));
  const night = scene.time === 'notte', dusk = scene.time === 'tramonto';
  // Due tinte vicine (al massimo 80° di distanza): tinte opposte, mescolate, danno un grigio-viola sporco.
  const hue = safeHue(scene.hue), hue2 = hue + Math.max(-80, Math.min(80, ((safeHue(scene.hue2 ?? (hue + 40)) - hue + 540) % 360) - 180));
  const skyTop = night ? hsl(hue, .55, .09) : dusk ? hsl(hue, .5, .3) : hsl(hue, .55, .55);
  const skyLow = night ? hsl(hue2, .5, .26) : dusk ? hsl(hue2, .75, .66) : hsl(hue2, .45, .82);
  const sunColor = night ? [246, 244, 235] : dusk ? hsl(hue2 + 10, .9, .82) : [255, 251, 238];
  const sun = { x: (.28 + r() * .44) * width, y: (night ? .2 + r() * .14 : dusk ? .42 + r() * .1 : .18 + r() * .16) * height, r: (night ? .055 : dusk ? .085 : .06) * height * (1 + r() * .5) };
  const horizon = (scene.land === 'mare' ? .6 : .55 + r() * .08) * height;
  const px = Buffer.alloc(width * height * 3);
  const set = (x, y, c) => { const i = (y * width + x) * 3; px[i] = clamp(c[0], 0, 255); px[i + 1] = clamp(c[1], 0, 255); px[i + 2] = clamp(c[2], 0, 255); };
  const get = (x, y) => { const i = (y * width + x) * 3; return [px[i], px[i + 1], px[i + 2]]; };
  // Cielo, bagliore dell'astro, stelle.
  const stars = new Set(); if (night || scene.land === 'spazio') for (let i = 0; i < width * height / 900; i++) stars.add(Math.floor(r() * width) + Math.floor(r() * horizon) * width);
  for (let y = 0; y < height; y++) {
    const t = clamp(y / horizon); const base = mix(skyTop, skyLow, Math.pow(t, 1.4));
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x - sun.x, y - sun.y); let c = base;
      const glow = Math.exp(-Math.pow(d / (sun.r * (night ? 3.2 : 4.5)), 2)) * (night ? .35 : .55);
      c = mix(c, sunColor, glow);
      if (d < sun.r) c = mix(sunColor, [255, 255, 255], .25);
      else if (d < sun.r + 1.5) c = mix(c, sunColor, sun.r + 1.5 - d);
      if (stars.has(x + y * width)) { const s = .5 + (x * 7 + y * 13) % 50 / 100; c = mix(c, [255, 255, 255], s); }
      set(x, y, c);
    }
  }
  if (scene.moons) { // un secondo astro piccolo per i mondi inventati
    const m = { x: sun.x + (r() > .5 ? 1 : -1) * width * .18, y: sun.y - height * .06, r: sun.r * .45 };
    for (let y = Math.max(0, Math.floor(m.y - m.r - 2)); y < Math.min(height, m.y + m.r + 2); y++) for (let x = Math.max(0, Math.floor(m.x - m.r - 2)); x < Math.min(width, m.x + m.r + 2); x++) {
      const d = Math.hypot(x - m.x, y - m.y); if (d < m.r + 1) set(x, y, mix(get(x, y), hsl(hue2 + 160, .5, .8), clamp(m.r + 1 - d)));
    }
  }
  // Crinali a strati, dal più lontano (chiaro, nella foschia) al più vicino (scuro).
  const layers = scene.land === 'spazio' ? 2 : scene.land === 'mare' ? 2 : 4;
  const farColor = mix(skyLow, skyTop, .35), nearColor = night ? hsl(hue, .45, .05) : dusk ? hsl(hue + 330, .45, .14) : hsl(hue + (scene.land === 'neve' ? 0 : 120), .35, .22);
  const ridges = [];
  for (let l = 0; l < layers; l++) {
    const f = [r() * .004 + .002, r() * .012 + .006, r() * .03 + .02], ph = [r() * 6, r() * 6, r() * 6];
    const amp = height * (scene.land === 'deserto' ? .05 : scene.land === 'citta' ? .03 : .09) * (1 - l * .12);
    const base = horizon - height * .1 + l * height * (scene.land === 'mare' ? .03 : .075);
    ridges.push(Array.from({ length: width }, (_, x) => base - amp * (Math.sin(x * f[0] + ph[0]) + .5 * Math.sin(x * f[1] + ph[1]) + .22 * Math.sin(x * f[2] + ph[2]))));
  }
  const city = scene.land === 'citta' ? Array.from({ length: Math.ceil(width / 18) }, () => ({ h: height * (.08 + r() * .26), w: 14 + Math.floor(r() * 26) })) : null;
  for (let l = 0; l < layers; l++) {
    const snowField = night ? [150, 160, 190] : [236, 241, 250];
    const tone = scene.land === 'neve' ? mix(mix(snowField, farColor, .35), mix(snowField, nearColor, .45), l / layers) : mix(farColor, nearColor, (l + 1) / layers);
    const snowy = scene.land === 'monti' && l === 0;
    for (let x = 0; x < width; x++) {
      const top = Math.max(0, Math.floor(ridges[l][x]));
      for (let y = top; y < height; y++) {
        let c = tone;
        if (snowy && y - top < height * .025) c = mix(tone, night ? [170, 180, 210] : [244, 246, 252], .6 * (1 - (y - top) / (height * .025)));
        else if (scene.land !== 'neve') c = mix(tone, nearColor, clamp((y - top) / height * 1.6) * .5);
        set(x, y, c);
      }
    }
  }
  if (city) { // grattacieli con finestre accese davanti all'ultimo crinale
    let x = 0; const ground = horizon + height * .1; const body = night ? hsl(hue, .35, .07) : hsl(hue, .25, .2); const lit = hsl(hue2 + 30, .9, .74);
    for (const b of city) {
      for (let xx = x; xx < Math.min(width, x + b.w); xx++) for (let y = Math.floor(ground - b.h); y < height; y++) {
        const win = (xx - x) % 6 > 2 && (y - Math.floor(ground - b.h)) % 9 > 4 && (xx - x) > 1 && (xx - x) < b.w - 2 && hash(`${Math.floor(xx / 6)}:${Math.floor(y / 9)}:${scene.seed}`) % 9 < (night ? 2 : 1);
        set(xx, y, win ? lit : body);
      }
      x += b.w + Math.floor(r() * 4);
      if (x > width) break;
    }
  }
  if (scene.land === 'mare') { // acqua con riflesso dell'astro
    const sea = horizon + height * .02; const deep = mix(skyTop, [0, 0, 0], .35), near = mix(skyLow, skyTop, .55);
    for (let y = Math.floor(sea); y < height; y++) for (let x = 0; x < width; x++) {
      const t = (y - sea) / (height - sea); let c = mix(near, deep, t);
      const ripple = Math.sin(y * .9 + Math.sin(x * .02) * 3) > .55;
      const path = Math.exp(-Math.pow((x - sun.x) / (sun.r * (1.4 + t * 3)), 2));
      if (ripple) c = mix(c, sunColor, path * (night ? .55 : .75));
      set(x, y, c);
    }
  }
  if (scene.land === 'bosco') { // abeti in primo piano
    const tree = mix(nearColor, [0, 0, 0], .45);
    for (let i = 0; i < 22; i++) {
      const cx = r() * width, h = height * (.18 + r() * .22), w = h * .32, base = height - r() * height * .05;
      for (let y = Math.floor(base - h); y < height; y++) { const half = (y - (base - h)) / h * w / 2; if (half <= 0) continue; for (let x = Math.max(0, Math.floor(cx - half)); x < Math.min(width, cx + half); x++) set(x, y, tree); }
    }
  }
  if (scene.lanterns) { // lanterne luminose nel cielo
    const lamp = hsl(scene.lanternHue ?? 45, .95, .7);
    for (let i = 0; i < 26; i++) {
      const lx = r() * width, ly = r() * horizon * .85, lr = 2 + r() * 5;
      for (let y = Math.max(0, Math.floor(ly - lr * 5)); y < Math.min(height, ly + lr * 5); y++) for (let x = Math.max(0, Math.floor(lx - lr * 5)); x < Math.min(width, lx + lr * 5); x++) {
        const d = Math.hypot(x - lx, (y - ly) * 1.2); set(x, y, mix(get(x, y), lamp, d < lr ? 1 : Math.exp(-Math.pow((d - lr) / (lr * 1.6), 2)) * .6));
      }
    }
  }
  if (scene.figure) { // una figura in controluce sul crinale più vicino: dà il "protagonista" alla locandina
    const fx = width * (scene.figureX ?? .5), ground = ridges[layers - 1][Math.floor(fx)] + 2, h = height * (scene.figureSize ?? .2), ink = mix(nearColor, [0, 0, 0], .55);
    const head = { x: fx, y: ground - h * .86, r: h * .085 };
    for (let y = Math.floor(ground - h); y < Math.min(height, ground + 2); y++) for (let x = Math.floor(fx - h * .3); x < fx + h * .3; x++) {
      if (x < 0 || x >= width) continue;
      const v = (y - (ground - h * .76)) / (h * .76); const half = h * (.07 + .11 * clamp(v)) * (v > .55 ? 1 - (v - .55) * .35 : 1);
      const inBody = v >= 0 && v <= 1 && Math.abs(x - fx) < half && !(v > .62 && Math.abs(x - fx) < h * .015);
      const inHead = Math.hypot(x - head.x, y - head.y) < head.r;
      const cape = scene.cape && v >= .05 && v <= 1 && x > fx && x < fx + half * 1.6 + v * h * .12;
      if (inBody || inHead || cape) set(x, y, ink);
    }
  }
  // Grana leggera e vignettatura: meno "computer", più fotogramma.
  const cx = width / 2, cy = height / 2, maxD = Math.hypot(cx, cy);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const v = 1 - Math.pow(Math.hypot(x - cx, y - cy) / maxD, 2.2) * .55; const n = (r() - .5) * 5;
    const i = (y * width + x) * 3; for (let k = 0; k < 3; k++) px[i + k] = clamp(px[i + k] * v + n, 0, 255);
  }
  return png(width, height, px);
}
