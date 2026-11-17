import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile, readdir } from 'node:fs/promises';
import { fingerprint } from '../lib/media.js';
import { fixture } from './helpers.js';

test('ffmpeg Chromaprint legge interi raw little endian senza altri processi', async () => {
  const calls = []; const data = Buffer.alloc(8); data.writeUInt32LE(0xffaabbcc, 0); data.writeUInt32LE(123, 4);
  const result = await fingerprint('video-finto.mkv', 460, 240, undefined, { async exec(command, args, timeout, signal, mode) { calls.push({ command, args, mode }); return data; } });
  assert.deepEqual(result, { offset: 460, words: [0xffaabbcc, 123] }); assert.equal(calls.length, 1); assert.equal(calls[0].mode, 'binary'); assert.ok(calls[0].args.includes('240'));
});
test('ffmpeg senza muxer usa fpcalc su un breve WAV e rimuove il temporaneo anche su errore', async t => {
  const f = await fixture(); t.after(() => f.close());
  for (const fail of [false, true]) {
    const calls = []; let wav;
    const exec = async (command, args) => {
      calls.push({ command, args });
      if (command === 'ffmpeg' && args.includes('chromaprint')) throw new Error("Requested output format 'chromaprint' is not a suitable output format");
      if (command === 'ffmpeg') { wav = args.at(-1); await writeFile(wav, 'audio sintetico finto'); return ''; }
      if (fail) throw new Error('fpcalc non trovato');
      return JSON.stringify({ fingerprint: [123, 4294967295] });
    };
    const task = fingerprint('video-finto.mkv', 600, 240, undefined, { exec, tempDir: f.dir });
    if (fail) await assert.rejects(task, /fpcalc/); else assert.deepEqual(await task, { offset: 600, words: [123, 4294967295] });
    assert.equal(calls.length, 3); assert.equal(calls[2].command, 'fpcalc'); assert.equal(calls[2].args[calls[2].args.indexOf('-algorithm') + 1], '2');
    assert.ok(calls[1].args.includes('600')); assert.ok(calls[1].args.includes('240'));
    assert.ok(!((await readdir(f.dir)).includes(path.basename(wav))));
  }
});
test('nessun fallback per EPERM, errori di lettura o annullamento', async () => {
  for (const error of [Object.assign(new Error('spawn'), { code: 'EPERM' }), new Error('Invalid input'), new DOMException('Stop', 'AbortError')]) {
    let calls = 0;
    await assert.rejects(fingerprint('finto.mkv', 0, 300, undefined, { async exec() { calls++; throw error; } })); assert.equal(calls, 1);
  }
});

test('ffmpeg di Termux: «Unrecognized option algorithm» passa a fpcalc', async t => {
  const f = await fixture(); t.after(() => f.close()); const calls = [];
  const exec = async (command, args) => {
    calls.push(command);
    if (command === 'ffmpeg' && args.includes('chromaprint')) throw new Error("Unrecognized option 'algorithm'. Error splitting the argument list: Option not found");
    if (command === 'ffmpeg') { await writeFile(args.at(-1), 'audio sintetico finto'); return ''; }
    return JSON.stringify({ fingerprint: [7, 8] });
  };
  assert.deepEqual(await fingerprint('video-finto.mp4', 0, 10, undefined, { exec, tempDir: f.dir }), { offset: 0, words: [7, 8] });
  assert.deepEqual(calls, ['ffmpeg', 'ffmpeg', 'fpcalc']);
});
