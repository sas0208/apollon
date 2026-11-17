// Called only by test-salti.ps1 on freshly generated fixtures, never a library.
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { matchFingerprints } from '../lib/skips.js';
import { isInside, readJson, atomicJson } from '../lib/util.js';
const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.resolve(process.argv[2] || '');
assert.ok(isInside(path.join(app, 'output', 'tests'), dir) && dir !== path.join(app, 'output', 'tests'), 'Usa soltanto fixture in output/tests.');
const fixtures = JSON.parse(await readFile(path.join(dir, 'fixture.json'), 'utf8'));
assert.ok(Array.isArray(fixtures) && fixtures.length === 2 && fixtures.every(f => /^Finto-S01E0[12]$/.test(f.name)), 'Sono ammesse soltanto le fixture generate da test-salti.ps1.');
async function load(name, window, offset) {
  const data = await readFile(path.join(dir, `${name}.${window}.raw`));
  return { offset, words: Array.from({ length: data.length / 4 }, (_, i) => data.readUInt32LE(i * 4)) };
}
const result = [];
for (const [window, type] of [['head', 'sigla'], ['tail', 'finale']]) {
  const a = fixtures[0]; const b = fixtures[1];
  const match = matchFingerprints(await load(a.name, window, window === 'tail' ? a.duration - 240 : 0), await load(b.name, window, window === 'tail' ? b.duration - 240 : 0));
  assert.ok(match, `${type}: nessuna corrispondenza`);
  const actual = [match.a, match.b];
  for (let i = 0; i < 2; i++) for (let bound = 0; bound < 2; bound++) {
    const error = Math.abs(actual[i][bound] - fixtures[i][type][bound]);
    result.push({ episodio: i + 1, tipo: type, limite: bound ? 'fine' : 'inizio', atteso: fixtures[i][type][bound], trovato: actual[i][bound], errore: Math.round(error * 100) / 100 });
  }
}
const report = { ok: result.every(r => r.errore <= 2), generato: new Date().toISOString(), soloFileSintetici: true, risultati: result };
const scenario = `${fixtures[0].sigla[1] - fixtures[0].sigla[0]}-${fixtures[0].finale[1] - fixtures[0].finale[0]}`;
await writeFile(path.join(app, 'output', `verifica-salti-${scenario}.json`), JSON.stringify(report, null, 2));
const summaryFile = path.join(app, 'output', 'verifica-salti-reali.json');
const old = await readJson(summaryFile, { casi: [] });
const cases = [...(old.casi || []).filter(c => c.scenario !== scenario), { scenario, ...report }];
await atomicJson(summaryFile, { ok: cases.every(c => c.ok), soloFileSintetici: true, erroreMassimo: Math.max(...cases.flatMap(c => c.risultati.map(r => r.errore))), casi: cases });
console.log(JSON.stringify(report, null, 2));
assert.ok(report.ok, 'I tempi devono essere corretti entro 2 secondi.');
