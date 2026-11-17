#!/usr/bin/env node
// Importa i loghi inglesi in alta qualità: node tools/importa-loghi.cjs <cartella-sorgente> <cartella-uscita> [--ffmpeg=percorso]
// - legge SOLO i PNG nella radice della sorgente (le sottocartelle si ignorano) e non modifica mai nulla lì;
// - ogni logo diventa largo al massimo 800 px (ffmpeg, un thread);
// - i loghi scuri e quasi di un solo colore (vettori neri su trasparente) diventano una sagoma BIANCA con lo stesso alpha, perché su sfondo nero non si vedrebbero;
// - scrive <titolo-normalizzato>.png e indice.json { titolo normalizzato: file } dai titoli del MANIFEST e dai nomi dei file;
// - si può rilanciare: i file già fatti (stessa dimensione e data della sorgente) si saltano.
// Il server legge l'indice (config localLogosDir, di base data/loghi-locali) e li usa prima di taizen.moe.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Stessa normalizzazione del server (lib/online-art.js; un test le confronta): minuscole, senza accenti, tutto ciò che non è lettera o cifra diventa spazio.
const norm = text => String(text ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const DARK_LUMA = 70; const MAX_SPREAD = 35; const MAX_COLOURFUL = 0.04; const MAX_LIGHT = 0.05; const REV = 4; // REV: cambia quando cambia il criterio, così i file già fatti si rifanno

// data: pixel RGBA. Luminosità media e «dispersione» di colore dei pixel opachi (alpha > 128); bianco = scuro e quasi monocolore.
function classify(data) {
  let n = 0; let vivid = 0; let light = 0; let luma = 0; let sr = 0; let sg = 0; let sb = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] <= 128) continue;
    if (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]) > 60) vivid++;
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > 150) light++;
    n++; sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; luma += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  if (!n) return { opaque: 0, luma: 255, spread: 999, white: false };
  const mr = sr / n; const mg = sg / n; const mb = sb / n; let spread = 0;
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 128) spread += Math.hypot(data[i] - mr, data[i + 1] - mg, data[i + 2] - mb);
  luma /= n; spread /= n; vivid /= n; light /= n; // vivid: quota di pixel vivaci (un contorno rosso su nero non è «un solo colore»)
  return { opaque: n, luma, spread, white: luma < DARK_LUMA && spread < MAX_SPREAD && vivid < MAX_COLOURFUL && light < MAX_LIGHT };
}

function main() {
  const args = process.argv.slice(2); const flag = args.find(a => a.startsWith('--ffmpeg='));
  const [source, out] = args.filter(a => !a.startsWith('--'));
  if (!source || !out) { console.error('Uso: node tools/importa-loghi.cjs <cartella-sorgente> <cartella-uscita> [--ffmpeg=percorso]'); process.exit(2); }
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Links/ffmpeg.exe');
  const ffmpeg = flag ? flag.slice(9) : process.env.FFMPEG || (fs.existsSync(winget) ? winget : 'ffmpeg');
  fs.mkdirSync(out, { recursive: true });
  const run = (argv, binary = false) => { const r = spawnSync(ffmpeg, ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', ...argv], { maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(String(r.stderr || r.error || 'ffmpeg ha fallito').slice(0, 300)); return binary ? r.stdout : null; };
  const stateFile = path.join(out, '.stato.json'); let state = {}; try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* prima volta */ }
  const files = fs.readdirSync(source, { withFileTypes: true }).filter(e => e.isFile() && /\.png$/i.test(e.name)).map(e => e.name).sort((a, b) => a.localeCompare(b));
  const used = new Set(Object.values(state).map(s => s.out)); const stats = { done: 0, skipped: 0, white: 0, failed: [] };
  for (const name of files) {
    const stat = fs.statSync(path.join(source, name)); const known = state[name];
    if (known && known.rev === REV && known.size === stat.size && known.mtimeMs === stat.mtimeMs && fs.existsSync(path.join(out, known.out))) { stats.skipped++; if (known.white) stats.white++; continue; }
    let slug = (norm(path.basename(name, path.extname(name))).replace(/ /g, '-') || 'logo').slice(0, 80); let file = `${slug}.png`;
    for (let n = 2; used.has(file) && state[name]?.out !== file; n++) file = `${slug}-${n}.png`;
    const tmp = path.join(out, `.lavoro-${process.pid}.png`);
    try {
      run(['-y', '-i', path.join(source, name), '-vf', "scale='min(800,iw)':-1:flags=lanczos,format=rgba", tmp]);
      const look = classify(run(['-i', tmp, '-vf', 'scale=64:-1,format=rgba', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1'], true));
      if (look.white) run(['-y', '-i', tmp, '-vf', 'format=rgba,lutrgb=r=255:g=255:b=255', path.join(out, file)]); else fs.copyFileSync(tmp, path.join(out, file));
      state[name] = { rev: REV, size: stat.size, mtimeMs: stat.mtimeMs, out: file, white: look.white, luma: Math.round(look.luma), spread: Math.round(look.spread) }; used.add(file);
      stats.done++; if (look.white) stats.white++;
    } catch (error) { stats.failed.push(`${name}: ${error.message}`); } finally { fs.rmSync(tmp, { force: true }); }
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 1));
  // Indice: prima i titoli del MANIFEST (con «:» e simili), poi i nomi dei file.
  const index = {}; const outOf = file => state[file]?.out;
  const manifestName = fs.readdirSync(source).find(n => /^MANIFEST.*\.json$/i.test(n));
  if (manifestName) { try { for (const m of JSON.parse(fs.readFileSync(path.join(source, manifestName), 'utf8'))) { const o = outOf(m.file); if (o && norm(m.title)) index[norm(m.title)] = o; } } catch { /* manifest illeggibile: bastano i nomi */ } }
  for (const name of Object.keys(state)) { const key = norm(path.basename(name, path.extname(name))); if (key && !index[key] && fs.existsSync(path.join(source, name))) index[key] = state[name].out; }
  fs.writeFileSync(path.join(out, 'indice.json'), JSON.stringify(Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b))), null, 1));
  const bytes = fs.readdirSync(out).filter(n => /\.png$/.test(n) && !n.startsWith('.')).reduce((sum, n) => sum + fs.statSync(path.join(out, n)).size, 0);
  console.log(JSON.stringify({ fatti: stats.done, saltati: stats.skipped, bianchi: stats.white, inIndice: Object.keys(index).length, errori: stats.failed, megabyte: Math.round(bytes / 1048576 * 10) / 10 }));
}

module.exports = { norm, classify };
if (require.main === module) main();
