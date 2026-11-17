import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fixture } from './helpers.js';
import { setup } from '../scripts/setup.js';

test('setup locale idempotente conserva configurazione e chiave esistenti', async t => {
  const f = await fixture(); t.after(() => f.close());
  const directory = path.join(f.dir, 'installazione-finta'); await mkdir(directory);
  const first = await setup({ mode: 'music', directory, root: path.join(f.dir, 'server-finto') });
  assert.equal(first.existingConfig, false); assert.equal(typeof first.key, 'string');
  const second = await setup({ mode: 'video', directory });
  assert.equal(second.existingConfig, true); assert.equal(second.key, null);
  const config = JSON.parse(await readFile(path.join(directory, 'config.json'), 'utf8'));
  assert.equal(config.mode, 'music'); assert.equal(config.otherLibraryUrl, '');
  assert.equal(config.navidromeUrl, 'http://127.0.0.1:4533');
});
