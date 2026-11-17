import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { fixture } from './helpers.js';
import { APP_DIR } from '../server.js';
import { esbuild, TARGET } from '../scripts/build-legacy.mjs';

const TV = 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36';
const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const LEGACY = path.join(APP_DIR, 'public', 'legacy');

test('i file legacy si rileggono con target chrome76 (niente ?. ?? ||= campi privati)', async () => {
  const files = (await readdir(LEGACY)).filter(f => /\.(js|css)$/.test(f)); assert.ok(files.includes('app.js') && files.includes('tv-legacy.css'));
  for (const f of files) {
    const code = await readFile(path.join(LEGACY, f), 'utf8');
    await assert.doesNotReject(() => esbuild.transform(code, { loader: f.endsWith('.css') ? 'css' : 'js', target: TARGET, logLevel: 'silent' }), f);
    if (f.endsWith('.js')) assert.doesNotMatch(code, /\?\.[^\d]|\?\?|\|\|=|&&=|#[A-Za-z_]\w*\s*[=;(,)]/, f);
  }
});
test('la TV Samsung riceve la pagina legacy, un Chrome moderno quella normale', async t => {
  const f = await fixture(); t.after(() => f.close());
  const tv = await (await f.request('/', { headers: { 'User-Agent': TV } })).text();
  assert.match(tv, /\/legacy\/app\.js/); assert.doesNotMatch(tv, /type="module"/); assert.match(tv, /\/legacy\/tv-legacy\.css/);
  const normal = await (await f.request('/', { headers: { 'User-Agent': CHROME } })).text();
  assert.match(normal, /src="\/app\.js" type="module"/); assert.doesNotMatch(normal, /legacy/);
  assert.match(await (await f.request('/?legacy=1', { headers: { 'User-Agent': CHROME } })).text(), /\/legacy\/app\.js/);
  assert.match(await (await f.request('/', { headers: { 'User-Agent': CHROME.replace('130', '79') } })).text(), /\/legacy\/app\.js/);
  assert.equal((await f.request('/legacy/app.js')).status, 200);
  assert.equal((await f.request('/legacy/../server.js')).status, 404);
});
