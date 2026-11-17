// Prepara i file finti della demo: video con un fotogramma disegnato dal codice (scripts/demo-art.js) e audio muto,
// con le durate vere di film ed episodi, e le immagini già pronte nell'indice della demo (così il collaudo, che gira
// senza metadati, mostra locandine e durate). Mai file personali, mai servizi esterni.
//   node scripts/make-demo.js            fa tutto (lancia ffmpeg da Node)
//   node scripts/make-demo.js --piano    scrive solo disegni e demo-data/.arte/piano.json (i comandi ffmpeg li lancia make-demo.ps1)
//   node scripts/make-demo.js --indice   dopo il piano: date dei file e indice con durate e immagini
import { mkdir, writeFile, readFile, stat, utimes, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from '../lib/media.js';
import { idFor, atomicJson } from '../lib/util.js';
import { ART_VERSION, ART_FILES, artArgs } from '../lib/library.js';
import { sceneArt, hash } from './demo-art.js';
import { demoFiles, SUBTITLE_TEXT } from './demo-catalog.js';

const base = path.join(path.dirname(path.dirname(fileURLToPath(import.meta.url))), 'demo-data');
const arte = path.join(base, '.arte'); const state = path.join(base, 'state'); const images = path.join(state, 'immagini');
const VERSION = 4; // cambia quando cambia il modo di generare: i file vecchi (barre colorate) si rifanno
const SIZES = { thumb: [640, 360], wide: [1280, 720], wideSmall: [640, 360], poster: [520, 780], posterSmall: [260, 390] };
const ffmpegBase = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-filter_threads', '1'];

function videoArgs(file, frame, srt, out) {
  // Un'immagine ferma, un fotogramma ogni 4 secondi a qualità costante: i fotogrammi uguali non pesano quasi niente,
  // così un film di 2 ore sta sotto 1 MB e si genera in pochi secondi con un solo thread.
  const audio = file.audio.flatMap(() => ['-f', 'lavfi', '-t', String(file.seconds), '-i', 'anullsrc=r=8000:cl=mono']);
  const subIn = file.subs === 'interni' ? ['-i', srt] : [];
  const maps = ['-map', '0:v', ...file.audio.flatMap((_, i) => ['-map', `${i + 1}:a`]), ...(subIn.length ? ['-map', `${file.audio.length + 1}:s`] : [])];
  const tags = [...file.audio.flatMap((lang, i) => [`-metadata:s:a:${i}`, `language=${lang}`, `-disposition:a:${i}`, i === 0 ? 'default' : '0']),
    ...(subIn.length ? ['-metadata:s:s:0', 'language=ita', '-c:s', 'mov_text'] : [])];
  return [...ffmpegBase, '-framerate', '1/4', '-i', frame, ...audio, ...subIn, ...maps, '-vf', `tpad=stop_mode=clone:stop_duration=${file.seconds}`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-qp', '26', '-x264-params', 'ipratio=1:pbratio=1', '-pix_fmt', 'yuv420p', '-g', '75', '-r', '1/4',
    '-c:a', 'aac', '-b:a', '8k', ...tags, '-t', String(file.seconds), '-movflags', '+faststart', '-y', out];
}
const streamsFor = file => [{ index: 0, type: 'video', codec: 'h264', language: 'und', title: '', width: 1280, height: 720, default: true },
  ...file.audio.map((language, i) => ({ index: i + 1, type: 'audio', codec: 'aac', language, title: '', ...(i === 0 ? { default: true } : {}) })),
  ...(file.subs === 'interni' ? [{ index: file.audio.length + 1, type: 'subtitle', codec: 'mov_text', language: 'ita', title: '' }] : [])];
const specOf = file => hash(JSON.stringify([VERSION, file.rel, file.seconds, file.audio, file.subs, file.scene]));

// Disegni, sottotitoli e comandi: tutto quello che si può fare senza processi figli.
export async function planDemo() {
  for (const dir of ['Film', 'Anime', 'Musica', 'File', '.arte', 'state/immagini']) await mkdir(path.join(base, dir), { recursive: true });
  const files = demoFiles(); const done = JSON.parse(await readFile(path.join(arte, 'fatti.json'), 'utf8').catch(() => '{}'));
  const jobs = []; const srt = path.join(arte, 'prova.it.srt'); await writeFile(srt, SUBTITLE_TEXT);
  for (const file of files) {
    const out = path.join(base, file.root, ...file.rel.split('/')); await mkdir(path.dirname(out), { recursive: true });
    const id = idFor(`${file.root}/${file.rel}`); const spec = specOf(file);
    if (file.subs === 'srt') await writeFile(out.replace(/\.mp4$/, '.it.srt'), SUBTITLE_TEXT);
    const fresh = done[file.rel] === spec && await stat(out).then(s => s.size > 0).catch(() => false)
      && await stat(path.join(images, `${id}-poster.jpg`)).then(() => true).catch(() => false);
    if (fresh) continue;
    const frame = path.join(arte, `${id}.png`); const poster = path.join(arte, `${id}-locandina.png`);
    await writeFile(frame, sceneArt(file.scene, 1280, 720));
    // La locandina è un disegno verticale a parte (come le locandine vere), con la figura al centro.
    await writeFile(poster, sceneArt({ ...file.scene, figureX: .5, figureSize: (file.scene.figureSize || .2) * 1.15 }, 520, 780));
    const out_ = name => ({ file: path.join(images, `${id}${ART_FILES[name]}.jpg`), w: SIZES[name][0], h: SIZES[name][1], q: name.endsWith('Small') || name === 'thumb' ? 5 : 3 });
    jobs.push({ rel: file.rel, spec, args: videoArgs(file, frame, srt, out) });
    jobs.push({ rel: file.rel, args: artArgs(poster, { image: true, outputs: [out_('poster'), out_('posterSmall')] }) });
    jobs.push({ rel: file.rel, args: artArgs(frame, { image: true, outputs: [out_('wide'), out_('wideSmall'), out_('thumb')] }) });
  }
  const plan = { jobs, done: Object.fromEntries(files.map(f => [f.rel, specOf(f)])) };
  await writeFile(path.join(arte, 'piano.json'), JSON.stringify(plan, null, 1));
  return plan;
}

// Dopo ffmpeg: date dei file (per Novità e Nuovi episodi) e indice della demo con durate, lingue e immagini già pronte.
export async function writeIndex(plan) {
  plan ||= JSON.parse(await readFile(path.join(arte, 'piano.json'), 'utf8'));
  const files = demoFiles(); const items = []; const sig = `${ART_VERSION}:${JSON.stringify({ poster: null, backdrop: null })}`;
  for (const file of files) {
    const out = path.join(base, file.root, ...file.rel.split('/'));
    const when = new Date(Math.min(Date.now() - 60000, file.added)); await utimes(out, when, when);
    const info = await stat(out); const id = idFor(`${file.root}/${file.rel}`);
    items.push({ id, root: file.root, path: file.rel, size: info.size, mtime: info.mtimeMs, added: Math.round(info.mtimeMs), genres: [],
      duration: file.seconds, streams: streamsFor(file), chapters: [], image: true, art: { sig, at: Math.round(info.mtimeMs) } });
  }
  await atomicJson(path.join(state, 'indice.json'), { items });
  await writeFile(path.join(arte, 'fatti.json'), JSON.stringify(plan.done));
  // I disegni servono solo a generare: si tengono le locandine (piccole) per rifare in fretta, si tolgono i fotogrammi grandi.
  for (const name of await readdir(arte)) if (/^[a-f0-9]{24}\.png$/.test(name)) await unlink(path.join(arte, name)).catch(() => {});
  return items.length;
}

export async function makeDemo({ exec = run } = {}) {
  const plan = await planDemo();
  let n = 0;
  for (const job of plan.jobs) {
    await exec('ffmpeg', job.args, 600000);
    if (++n % 15 === 0) console.log(`  ${n}/${plan.jobs.length} comandi ffmpeg`);
  }
  const count = await writeIndex(plan);
  const song = path.join(base, 'Musica', 'Luce di casa.wav');
  if (!await stat(song).catch(() => null)) await exec('ffmpeg', [...ffmpegBase, '-f', 'lavfi', '-i', 'sine=frequency=330:sample_rate=44100', '-t', '12', '-c:a', 'pcm_s16le', song]);
  console.log(`Demo pronta: ${count} video finti con disegni generati e toni, nessun file personale.`);
  return base;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--piano')) { const plan = await planDemo(); console.log(`Piano: ${plan.jobs.length} comandi ffmpeg in demo-data/.arte/piano.json`); }
  else if (process.argv.includes('--indice')) console.log(`Indice della demo: ${await writeIndex()} video.`);
  else await makeDemo();
}
