import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Collaudo 5/11/2026 (giro C): "Salva come playlist" nella Miscela salvava ma poi falliva con
// "notify is not a function", perché il contesto passato ai moduli musicali non conteneva notify.
// Ogni funzione che i moduli caricati a richiesta prendono dal contesto deve esserci davvero.
test('il contesto dei moduli musicali contiene tutto quello che i moduli usano', async () => {
  const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = app.indexOf('const musicContext = () =>');
  assert.ok(start >= 0, 'musicContext non trovato in app.js');
  const body = app.slice(start, app.indexOf('});', start));
  const blend = await readFile(new URL('../public/music-blend.js', import.meta.url), 'utf8');
  const used = [...blend.matchAll(/const \{([^}]+)\} = c;/g)].flatMap(m => m[1].split(',').map(s => s.trim()).filter(Boolean));
  assert.ok(used.includes('notify'));
  for (const name of used) assert.match(body, new RegExp(`\\b${name}\\b`), `musicContext non passa ${name}`);
});
