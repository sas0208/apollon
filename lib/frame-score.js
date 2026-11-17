// Giro G: quale fotogramma merita di essere una copertina. Niente nero, niente titoli di coda o di testa (testo bianco su nero),
// niente scene troppo scure, chiare o sfocate; si preferiscono immagini nitide, colorate, con contrasto e con tonalità di pelle
// al centro (un indicatore semplice di personaggi e volti). Funziona su un campione RGB 160x90 letto da ffmpeg (rawvideo, rgb24).
export const SAMPLE = { w: 160, h: 90 };

export function scoreFrame(buffer, w = SAMPLE.w, h = SAMPLE.h) {
  const n = w * h;
  if (!buffer || buffer.length < n * 3) return { score: 0, reason: 'vuoto' };
  const lum = new Float32Array(n); let sum = 0; let sum2 = 0; let dark = 0; let bright = 0; let spread = 0; let skin = 0; let centre = 0;
  for (let i = 0; i < n; i++) {
    const r = buffer[i * 3]; const g = buffer[i * 3 + 1]; const b = buffer[i * 3 + 2];
    const y = 0.299 * r + 0.587 * g + 0.114 * b; lum[i] = y; sum += y; sum2 += y * y;
    if (y < 24) dark++; if (y > 235) bright++;
    const max = Math.max(r, g, b); const min = Math.min(r, g, b); spread += max - min;
    const x = i % w;
    if (x >= w * 0.25 && x < w * 0.75) {
      centre++;
      if (r > 95 && g > 40 && b > 20 && max - min > 15 && r > g && r > b && Math.abs(r - g) > 10) skin++;
    }
  }
  const mean = sum / n; const std = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  if (mean < 30) return { score: 0, reason: 'scuro', mean };
  if (mean > 222) return { score: 0, reason: 'chiaro', mean };
  if (std < 18) return { score: 0, reason: 'piatto', mean };
  // Nitidezza: variazione media fra pixel vicini; energia per colonna per capire dove sta il soggetto.
  const columns = new Float32Array(w); let gradient = 0;
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x; const d = Math.abs(lum[i + 1] - lum[i]) + Math.abs(lum[i + w] - lum[i]); gradient += d; columns[x] += d;
  }
  gradient /= n;
  let weight = 0; let moment = 0;
  for (let x = Math.floor(w * 0.1); x < Math.ceil(w * 0.9); x++) { weight += columns[x]; moment += columns[x] * x; }
  // Una locandina 2:3 ritagliata da un 16:9 è larga il 37,5%: il centro resta fra il 19% e l'81%.
  const cx = weight > 0 ? Math.min(0.81, Math.max(0.19, moment / weight / w)) : 0.5;
  const sharp = Math.min(1, gradient / 16); const contrast = Math.min(1, std / 60); const color = Math.min(1, spread / n / 60);
  const skinShare = skin / Math.max(1, centre); const face = skinShare >= 0.02 && skinShare <= 0.35 ? 1 : 0;
  // Testo chiaro su fondo scuro: sigla, titoli di testa o di coda.
  const credits = dark / n > 0.6 && bright / n > 0.003 ? 0.15 : 1;
  const fit = 1 - Math.min(1, Math.abs(mean - 120) / 160);
  const score = (0.45 * sharp + 0.2 * contrast + 0.2 * color + 0.15 * face) * (0.5 + 0.5 * fit) * credits;
  return { score, cx, mean, std, sharp, face: !!face, credits: credits < 1 };
}

// Punti da campionare: da circa il 22% al 76% del video, lontano dai tratti noti di sigla, riassunto, finale e anteprima.
export function samplePoints(duration, avoid = [], count = 10) {
  if (!(duration > 0)) return [];
  const points = [];
  for (let i = 0; i < count; i++) {
    const t = Math.round(duration * (0.22 + i * (0.54 / (count - 1))) * 10) / 10;
    if (!avoid.some(range => Array.isArray(range) && t >= range[0] - 4 && t <= range[1] + 4)) points.push(t);
  }
  return points;
}
