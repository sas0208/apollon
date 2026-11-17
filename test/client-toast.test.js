import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('toast: i messaggi sopra le righe lasciano passare il puntatore e il drag', async () => {
  const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  // The toast is only a live message, with no controls that need pointer input.
  assert.match(html, /<div\b[^>]*id="toast"[^>]*role="status"[^>]*><\/div>/);
  assert.match(css, /#toast\s*\{[^}]*\bpointer-events\s*:\s*none\s*[;}]/);
});
