import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';

test('attese browser: predicati letterali sincroni, senza fetch o Promise', async () => {
  const directory = new URL('./', import.meta.url); let checked = 0;
  for (const file of (await readdir(directory)).filter(name => /^browser.*\.py$/.test(name))) {
    const source = await readFile(new URL(file, directory), 'utf8');
    const calls = [...source.matchAll(/\bwait_for(?:_function)?\s*\(/g)];
    const predicates = [...source.matchAll(/\bwait_for(?:_function)?\s*\(\s*(?:'''([\s\S]*?)'''|"""([\s\S]*?)"""|'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/g)];
    assert.equal(predicates.length, calls.length, `${file}: usare predicati JavaScript letterali verificabili`);
    for (const match of predicates) {
      const predicate = match.slice(1).find(value => value !== undefined);
      assert.doesNotMatch(predicate, /\b(?:async|await|Promise|fetch)\b|\.then\s*\(/, `${file}: interrogare le API da Python, fuori dal predicato di attesa`);
      assert.equal(typeof vm.runInNewContext(`(${predicate})`, Object.create(null), { timeout: 1000 }), 'function');
      checked++;
    }
  }
  assert.ok(checked > 0);
});
