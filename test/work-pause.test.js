import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { fixture } from './helpers.js';
import { workPaused } from '../lib/work-pause.js';
import { lightArgs } from '../lib/versions.js';
import { fingerprint, black } from '../lib/media.js';

test('pausa: opzioni assenti, RAM, lock con PID vivo, morto o non valido', async t => {
  const f = await fixture(); t.after(() => f.close());
  const lock = path.join(f.dir, 'lavoro.json');
  assert.equal(await workPaused({}, { freemem: () => 0 }), false);
  assert.equal(await workPaused({ minFreeMB: 100 }, { freemem: () => 99 * 1024 ** 2 }), true);
  assert.equal(await workPaused({ minFreeMB: 100 }, { freemem: () => 100 * 1024 ** 2 }), false);
  assert.equal(await workPaused({ pauseLockFile: lock }), false);
  await writeFile(lock, JSON.stringify({ pid: process.pid }));
  assert.equal(await workPaused({ pauseLockFile: lock }), true);
  assert.equal(await workPaused({ pauseLockFile: lock }, { kill: () => { const e = new Error(); e.code = 'ESRCH'; throw e; } }), false);
  assert.equal(await workPaused({ pauseLockFile: lock }, { kill: () => { const e = new Error(); e.code = 'EPERM'; throw e; } }), true);
  for (const content of ['non JSON', '{}', '{"pid":0}', '{"pid":-1}', '{"pid":"123"}']) {
    await writeFile(lock, content); assert.equal(await workPaused({ pauseLockFile: lock }), false, content);
  }
});

test('pausa: lucchetto del preflight di Windows (BOM, owner, scadenza)', async t => {
  const f = await fixture(); t.after(() => f.close());
  const lock = path.join(f.dir, 'lavoro-pesante.lock');
  const preflight = (started, maxMin = 30) => '﻿' + JSON.stringify({ job: 'build', owner: process.pid, started, maxMin }, null, 4);
  await writeFile(lock, preflight(new Date().toISOString()));
  assert.equal(await workPaused({ pauseLockFile: lock }), true);
  await writeFile(lock, preflight(new Date(Date.now() - 31 * 60000).toISOString()));
  assert.equal(await workPaused({ pauseLockFile: lock }), false, 'scaduto');
});

test('ffmpegThreads limita decodifica e codifica; analisi e ripiego rispettano il valore', async () => {
  for (const encoder of ['libx264', 'h264_mediacodec']) {
    const args = lightArgs('input', 'output', encoder, 3);
    assert.equal(args[args.indexOf('-threads') + 1], '3');
    assert.equal(args[args.lastIndexOf('-threads') + 1], '3');
    assert.ok(args.indexOf('-threads') < args.indexOf('-i'));
  }
  const calls = []; const exec = async (cmd, args) => { calls.push(args); return Buffer.alloc(4); };
  await fingerprint('input', 0, 10, undefined, { exec, ffmpegThreads: 3 });
  await black('input', 0, 10, undefined, { exec: async (cmd, args) => { calls.push(args); return ''; }, ffmpegThreads: 3 });
  for (const args of calls) assert.equal(args[args.indexOf('-threads') + 1], '3');
});

test('lock vivo ferma salti e versioni anche urgenti, la chiusura interrompe l’attesa', async t => {
  let calls = 0;
  const f = await fixture({ skipTools: { probe: async () => { calls++; return { duration: 60 }; } }, mediaTools: { run: async () => { calls++; } } });
  t.after(() => f.close());
  const lock = path.join(f.dir, 'lavoro.json'); await writeFile(lock, JSON.stringify({ pid: process.pid }));
  f.app.config.pauseLockFile = lock;
  const a = await f.video('Serie S01E01.mp4', 'Anime');
  f.app.skips.enqueue(a.id); f.app.versions.enqueue([a.id], { first: true });
  await new Promise(r => setTimeout(r, 60)); assert.equal(calls, 0);
  assert.equal(f.app.versions.queue.length, 1);
  const start = Date.now(); await Promise.all([f.app.skips.close(), f.app.versions.close()]);
  assert.ok(Date.now() - start < 500); assert.equal(calls, 0);
});

test('tolto il lock le versioni ripartono al controllo successivo', async t => {
  let calls = 0; const f = await fixture({ mediaTools: { run: async (cmd, args) => { calls++; await writeFile(args.at(-1), 'leggera'); } } });
  t.after(() => f.close());
  const lock = path.join(f.dir, 'lavoro.json'); await writeFile(lock, JSON.stringify({ pid: process.pid }));
  f.app.config.pauseLockFile = lock;
  const a = await f.video(); f.app.versions.enqueue([a.id], { first: true });
  await new Promise(r => setTimeout(r, 40)); assert.equal(calls, 0);
  await writeFile(lock, '{"pid":0}');
  f.app.versions.pause.wake();
  await f.app.versions.wait(); assert.equal(calls, 1); assert.equal(f.app.versions.has(a), true);
});

test('RAM sotto soglia ferma entrambe le code; tolta la soglia ripartono', async t => {
  let calls = 0;
  const f = await fixture({ minFreeMB: Number.MAX_SAFE_INTEGER, skipDelayMs: 0,
    skipTools: { probe: async () => { calls++; return { duration: 60, chapters: [] }; }, fingerprint: async () => ({ words: [], offset: 0 }), black: async () => [], fotogrammi: async () => Buffer.alloc(60 * 2 * 9) },
    mediaTools: { run: async (cmd, args) => { calls++; await writeFile(args.at(-1), 'leggera'); } } });
  t.after(() => f.close()); const a = await f.video('Serie S01E01.mp4', 'Anime');
  f.app.skips.enqueue(a.id); f.app.versions.enqueue([a.id], { first: true });
  await new Promise(r => setTimeout(r, 40)); assert.equal(calls, 0);
  f.app.config.minFreeMB = 0; f.app.skips.resourcePause.wake(); f.app.versions.pause.wake();
  await Promise.all([f.app.skips.wait(), f.app.versions.wait()]); assert.equal(calls, 2);
});
