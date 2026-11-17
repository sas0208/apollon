import test from 'node:test';
import assert from 'node:assert/strict';
import { OfflineMusic } from '../public/music-offline-cache.js';

// Browsers throw "Illegal invocation" when window.fetch runs with another `this`.
// Collaudo 5/11/2026: the default fetch was stored on the manager and called as this.fetch(...).
test('il fetch predefinito del download offline resta legato a globalThis', async () => {
  const original = globalThis.fetch;
  let seenThis;
  globalThis.fetch = function (url) {
    seenThis = this;
    if (this !== undefined && this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
    return Promise.resolve(new Response('ok'));
  };
  try {
    const manager = new OfflineMusic('demo:bruno', { caches: null, storage: null, lock: null });
    const response = await manager.fetch('http://local/x');
    assert.equal(await response.text(), 'ok');
    assert.ok(seenThis === undefined || seenThis === globalThis);
  } finally {
    globalThis.fetch = original;
  }
});
