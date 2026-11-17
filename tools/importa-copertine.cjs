#!/usr/bin/env node
// node tools/importa-copertine.cjs <src> <out> [--sharp=percorso-modulo]
// Sorgente in sola lettura. Sharp serve solo allo strumento di preparazione, non al server.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { norm } = require('./importa-loghi.cjs');

function csv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === ';' || ch === '\n' || ch === '\r')) {
      row.push(field); field = '';
      if (ch !== ';') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        if (row.some(Boolean)) rows.push(row); row = [];
      }
    } else field += ch;
  }
  if (quoted) throw new Error('CSV non valido: virgolette non chiuse.');
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  for (const name of ['title', 'portrait_file', 'landscape_file']) if (!headers.includes(name)) throw new Error(`Colonna mancante: ${name}`);
  return rows.map(values => Object.fromEntries(headers.map((key, i) => [key, values[i] || ''])));
}

const within = (parent, child) => { const rel = path.relative(parent, child); return !rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
function writeChanged(file, value) {
  const content = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === content) return;
  const temp = `${file}.${process.pid}.tmp`; fs.writeFileSync(temp, content); fs.renameSync(temp, file);
}

async function importCovers(source, out, { sharp } = {}) {
  source = fs.realpathSync(source); out = path.resolve(out);
  // Controlla anche il genitore esistente, per non scrivere nella sorgente tramite un collegamento.
  let ancestor = out;
  while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const realOut = path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, out));
  if (within(source, realOut)) throw new Error('La cartella di uscita deve essere esterna alla sorgente.');
  const rows = csv(fs.readFileSync(path.join(source, 'INDICE_COPERTINE.csv'), 'utf8'));
  sharp ||= require('sharp'); sharp.concurrency(1);
  fs.mkdirSync(out, { recursive: true });
  const index = {}; const stats = { fatti: 0, saltati: 0, titoli: 0, errori: [] };
  const roles = [['poster', 'portrait_file', '01 - Verticali 2x3', { height: 1440 }], ['backdrop', 'landscape_file', '02 - Orizzontali 16x9', { width: 1920 }]];
  for (const row of rows) {
    const key = norm(row.title); if (!key) continue;
    const entry = index[key] || {};
    for (const [role, column, folder, size] of roles) {
      const name = row[column].trim(); if (!name) continue;
      let temp;
      try {
        if (path.basename(name) !== name || /[\\/]/.test(name)) throw new Error('Nome file non valido.');
        const input = fs.realpathSync(path.join(source, folder, name));
        if (!within(source, input)) throw new Error('Immagine esterna alla sorgente.');
        const bytes = fs.readFileSync(input);
        const hash = createHash('sha256').update('copertine-q90-v1').update(role).update(bytes).digest('hex').slice(0, 16);
        const file = `${key.replace(/ /g, '-').slice(0, 70)}-${hash}-${role}.jpg`;
        if (fs.existsSync(path.join(out, file))) stats.saltati++;
        else {
          temp = path.join(out, `.${file}.${process.pid}.tmp`);
          await sharp(bytes).rotate().resize({ ...size, withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(temp);
          fs.renameSync(temp, path.join(out, file)); stats.fatti++;
        }
        entry[role] = file;
      } catch (error) { stats.errori.push(`${row.title} (${role}): ${error.message}`); }
      finally { if (temp) fs.rmSync(temp, { force: true }); }
    }
    if (Object.keys(entry).length) index[key] = entry;
  }
  writeChanged(path.join(out, 'indice.json'), Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b))));
  stats.titoli = Object.keys(index).length; return stats;
}

module.exports = { norm, csv, importCovers };
if (require.main === module) {
  const args = process.argv.slice(2); const [source, out] = args.filter(a => !a.startsWith('--'));
  if (!source || !out) { console.error('Uso: node tools/importa-copertine.cjs <src> <out> [--sharp=percorso-modulo]'); process.exitCode = 2; }
  else importCovers(source, out, { sharp: args.find(a => a.startsWith('--sharp=')) ? require(path.resolve(args.find(a => a.startsWith('--sharp=')).slice(8))) : undefined })
    .then(stats => { console.log(JSON.stringify(stats)); if (stats.errori.length) process.exitCode = 1; })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
