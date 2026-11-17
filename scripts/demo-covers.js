// Copertine finte per la demo: forme e colori calcolati dal codice, nessuna immagine presa da fuori.
import zlib from 'node:zlib';

const cache = new Map();
const hash = text => { let h = [...String(text)].reduce((h, ch) => Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0, 2166136261); h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0; return (h ^ (h >>> 13)) >>> 0; };
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; h = h >= 290 ? h - 110 : h < 10 ? h + 20 : h; // niente tinte viola-magenta
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map(n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))));
}
function chunk(type, data) {
  const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])) >>> 0, 0);
  return Buffer.concat([head, data, crc]);
}

// Una copertina 600x600 (come una copertina grande vera): fondo sfumato fra due tinte e una forma (cerchi, strisce o puntini) scelta dall'id.
export function demoCover(id) {
  if (cache.has(id)) return cache.get(id);
  const size = 600, h = hash(id), hue = h % 230, hue2 = (hue + 40 + (h >> 9) % 40) % 276, kind = (h >> 4) % 3;
  const a = hsl(hue, .55, .42), b = hsl(hue2, .6, .22), ink = hsl((hue + 180) % 360, .7, .78);
  const rows = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1); rows[row] = 0;
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size); let c = a.map((v, i) => v * (1 - t) + b[i] * t);
      const dx = x - size * .62, dy = y - size * .4, d = Math.hypot(dx, dy);
      const mark = kind === 0 ? Math.abs(d % 85 - 42.5) < 10 && d < 275 : kind === 1 ? ((x - y + 1500) % 115) < 30 && y > size * .35 : (x % 75 - 37.5) ** 2 + (y % 75 - 37.5) ** 2 < 262 && d < 225;
      if (mark) c = c.map((v, i) => v * .45 + ink[i] * .55);
      rows.set(c.map(Math.round), row + 1 + x * 3);
    }
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header.set([8, 2, 0, 0, 0], 8);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
  cache.set(id, png); return png;
}
