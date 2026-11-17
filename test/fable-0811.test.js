import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { json } from '../lib/util.js';
import { lightArgs } from '../lib/versions.js';

const fakeRes = (accept) => { const r = { req: { headers: accept ? { 'accept-encoding': accept } : {} }, headersSent: false, destroyed: false };
  r.done = new Promise(resolve => { r.writeHead = (status, headers) => { r.status = status; r.headers = headers; r.headersSent = true; }; r.end = body => { r.body = body; resolve(); }; }); return r; };

test('json grande compresso se il lettore accetta gzip, piccolo e senza gzip invariati', async () => {
  const big = { items: Array.from({ length: 2000 }, (_, i) => ({ id: i, title: 'Episodio ' + i })) };
  const z = fakeRes('gzip, deflate'); json(z, big); await z.done;
  assert.equal(z.headers['Content-Encoding'], 'gzip'); assert.deepEqual(JSON.parse(gunzipSync(z.body)), big);
  const plain = fakeRes(''); json(plain, big); await plain.done; assert.equal(plain.headers['Content-Encoding'], undefined); assert.deepEqual(JSON.parse(plain.body), big);
  const small = fakeRes('gzip'); json(small, { ok: true }); await small.done; assert.equal(small.body, '{"ok":true}');
});

test('versione leggera: tag colore BT.709 solo se la sorgente è HD', () => {
  assert.match(lightArgs('a.mkv', 'b.mp4', 'libx264', 2, 1080).join(' '), /setparams=colorspace=bt709/);
  assert.doesNotMatch(lightArgs('a.mkv', 'b.mp4', 'libx264', 2, 480).join(' '), /setparams/);
  assert.doesNotMatch(lightArgs('a.mkv', 'b.mp4', 'libx264', 2).join(' '), /setparams/);
});
