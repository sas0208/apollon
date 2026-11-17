import { spawn } from 'node:child_process';
import { ffmpegThreadCount } from './work-pause.js';
import { stat, readFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fail } from './util.js';

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm',
  '.mkv': 'video/x-matroska', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo', '.ts': 'video/mp2t',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac', '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg', '.wav': 'audio/wav', '.vtt': 'text/vtt; charset=utf-8'
};
export function rangeFor(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || size === 0) throw fail(416, 'Intervallo non valido.');
  let start; let end;
  if (!match[1]) { const suffix = Number(match[2]); if (suffix <= 0) throw fail(416, 'Intervallo non valido.'); start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) throw fail(416, 'Intervallo non valido.');
  return { start, end };
}
export async function sendFile(req, res, file, { cache = false, type } = {}) {
  const info = await stat(file);
  if (!info.isFile()) throw fail(404, 'File non trovato.');
  const headers = { 'Content-Type': type || TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Accept-Ranges': 'bytes', 'Cache-Control': cache ? 'public, max-age=3600' : 'no-store', 'Content-Length': info.size };
  let range;
  try { range = rangeFor(req.headers.range, info.size); }
  catch (e) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}`, 'Content-Length': 0 }); res.end(); return; }
  if (range) { headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`; headers['Content-Length'] = range.end - range.start + 1; }
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  const stream = createReadStream(file, range || {});
  stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
}
export function run(command, args, timeout = 45000, signal, mode = 'text') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal });
    const chunks = []; let error = ''; let bytes = 0; let overflow = false;
    const timer = setTimeout(() => { child.kill(); reject(new Error('Tempo esaurito per i metadati.')); }, timeout);
    child.stdout.on('data', b => { bytes += b.length; if (bytes > 4 * 1024 ** 2) { overflow = true; child.kill(); } else chunks.push(b); });
    child.stderr.on('data', b => { if (error.length < (mode === 'stderr' ? 100000 : 2000)) error += b; });
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => { clearTimeout(timer); code === 0 && !overflow ? resolve(mode === 'binary' ? Buffer.concat(chunks) : mode === 'stderr' ? error : Buffer.concat(chunks).toString('utf8')) : reject(new Error(error || `${command} non disponibile.`)); });
  });
}
export async function probe(file, signal) {
  const data = JSON.parse(await run('ffprobe', ['-v', 'error', '-threads', '1', '-show_format', '-show_streams', '-show_chapters', '-of', 'json', file], 20000, signal));
  return { duration: Number(data.format?.duration) || 0,
    chapters: (data.chapters || []).map(c => ({ start: Number(c.start_time), end: Number(c.end_time), title: c.tags?.title || '' })),
    streams: (data.streams || []).map(s => ({ index: s.index, type: s.disposition?.attached_pic ? 'cover' : s.codec_type, codec: s.codec_name, language: s.tags?.language || 'und', title: s.tags?.title || '',
      ...(s.codec_type === 'video' && s.height ? { width: s.width, height: s.height } : {}), ...(s.disposition?.default ? { default: true } : {}) })) };
}
export async function fingerprint(file, offset, length, signal, { exec = run, tempDir, ffmpegThreads, beforeRun = async () => {} } = {}) {
  const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', String(ffmpegThreadCount(ffmpegThreads) || 1), '-ss', String(offset), '-i', file, '-t', String(length), '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '11025'];
  try {
    await beforeRun(); signal?.throwIfAborted();
    const bytes = await exec('ffmpeg', [...args, '-f', 'chromaprint', '-algorithm', '1', '-fp_format', 'raw', 'pipe:1'], 180000, signal, 'binary');
    if (bytes.length % 4 || bytes.length > 10000) throw new Error('Impronta audio non valida.');
    return { offset, words: Array.from({ length: bytes.length / 4 }, (_, i) => bytes.readUInt32LE(i * 4)) };
  } catch (error) {
    // Termux ffmpeg does not normally include this muxer. Do not mask permission,
    // decoding or cancellation failures by launching more processes.
    if (!tempDir || !/(?:[Uu]nknown format.*chromaprint|[Rr]equested output format.*chromaprint|[Mm]uxer.*chromaprint.*not found|[Uu]nrecognized option '(?:algorithm|fp_format)')/.test(error.message)) throw error;
    await mkdir(tempDir, { recursive: true });
    const wav = path.join(tempDir, `impronta-${randomUUID()}.wav`);
    try {
      await beforeRun(); signal?.throwIfAborted();
      await exec('ffmpeg', [...args, '-c:a', 'pcm_s16le', '-n', wav], 180000, signal);
      // fpcalc numbers algorithms from 1; FFmpeg uses Chromaprint's enum from 0.
      await beforeRun(); signal?.throwIfAborted();
      const result = JSON.parse(await exec('fpcalc', ['-raw', '-json', '-algorithm', '2', '-length', String(length), wav], 180000, signal));
      const words = result.fingerprint;
      if (!Array.isArray(words) || !words.length || words.length > 2500 || words.some(n => !Number.isInteger(n) || n < 0 || n > 0xffffffff)) throw new Error('Impronta fpcalc non valida.');
      return { offset, words };
    } finally { await unlink(wav).catch(e => { if (e.code !== 'ENOENT') throw e; }); }
  }
}
export async function black(file, offset, length, signal, { exec = run, ffmpegThreads } = {}) {
  const log = await exec('ffmpeg', ['-nostdin', '-hide_banner', '-threads', String(ffmpegThreadCount(ffmpegThreads) || 1), '-filter_threads', '1', '-ss', String(offset), '-i', file, '-t', String(length), '-an', '-vf', 'scale=160:-2,blackdetect=d=0.3:pix_th=0.10', '-f', 'null', '-'], 180000, signal, 'stderr');
  return [...log.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)/g)].map(m => [offset + Number(m[1]), offset + Number(m[2])]);
}
const timestamp = value => {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})[.,](\d{1,3})$/.exec(value.trim());
  return match ? `${match[1].padStart(2, '0')}:${match[2]}:${match[3]}.${match[4].padEnd(3, '0')}` : value.trim();
};
export function subtitlesToVtt(input, extension) {
  const src = input.replace(/^\uFEFF/, '').replace(/\r/g, '');
  if (extension === '.vtt') return src;
  if (extension === '.srt') return 'WEBVTT\n\n' + src.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  if (extension !== '.ass') throw fail(400, 'Sottotitoli non riconosciuti.');
  let fields = ['Layer', 'Start', 'End', 'Style', 'Name', 'MarginL', 'MarginR', 'MarginV', 'Effect', 'Text'];
  let inEvents = false; const cues = [];
  for (const line of src.split('\n')) {
    if (/^\[/.test(line)) inEvents = line.trim().toLowerCase() === '[events]';
    if (!inEvents) continue;
    if (/^Format:/i.test(line)) fields = line.slice(line.indexOf(':') + 1).split(',').map(s => s.trim());
    if (!/^Dialogue:/i.test(line)) continue;
    const values = line.slice(line.indexOf(':') + 1).trim().split(',');
    if (values.length < fields.length) continue;
    const textIndex = fields.indexOf('Text'); const start = values[fields.indexOf('Start')]; const end = values[fields.indexOf('End')];
    if (textIndex < 0 || !start || !end) continue;
    const plain = values.slice(textIndex).join(',').replace(/\{[^}]*\}/g, '').replace(/\\[Nn]/g, '\n').replace(/\\h/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    cues.push(`${timestamp(start)} --> ${timestamp(end)}\n${plain}`);
  }
  return `WEBVTT\n\n${cues.join('\n\n')}`;
}
export async function readSubtitles(file) {
  if ((await stat(file)).size > 5 * 1024 ** 2) throw fail(413, 'File di sottotitoli troppo grande.');
  const bytes = await readFile(file);
  let input;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) input = bytes.toString('utf16le');
  else { try { input = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { input = new TextDecoder('windows-1252').decode(bytes); } }
  return subtitlesToVtt(input, path.extname(file).toLowerCase());
}

// Sottotitoli testuali dentro il file (mkv/mp4): estratti una volta in WebVTT e tenuti in cache.
export const TEXT_SUBTITLES = new Set(['subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text']);
export async function extractSubtitle(file, index, cacheFile, signal, exec = run) {
  try { return await readFile(cacheFile, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const output = await exec('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1', '-i', file, '-map', `0:${index}`, '-f', 'webvtt', 'pipe:1'], 120000, signal);
  if (!output.startsWith('WEBVTT')) throw fail(422, 'Sottotitoli non leggibili.');
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(cacheFile, output);
  return output;
}
