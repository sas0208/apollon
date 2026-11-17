// Deterministic checks without a bundler, package installation or child processes.
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_DIR } from '../server.js';
const html = await readFile(path.join(APP_DIR, 'public', 'index.html'), 'utf8');
const js = await readFile(path.join(APP_DIR, 'public', 'app.js'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
if (new Set(ids).size !== ids.length) throw new Error('ID HTML duplicati.');
for (const [, id] of js.matchAll(/\$\('#([\w-]+)'\)/g)) if (!ids.includes(id)) throw new Error(`Elemento mancante: ${id}`);
const manifest = JSON.parse(await readFile(path.join(APP_DIR, 'public', 'manifest.webmanifest'), 'utf8'));
const assets = await readdir(path.join(APP_DIR, 'public'));
for (const name of assets.filter(n => n.endsWith('.js') && n !== 'sw.js')) {
  const source = await readFile(path.join(APP_DIR, 'public', name), 'utf8');
  for (const [, dep] of source.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) if (!assets.includes(dep)) throw new Error(`Modulo mancante: ${dep}`);
}
for (const icon of manifest.icons) if (!assets.includes(icon.src.slice(1))) throw new Error(`Icona mancante: ${icon.src}`);
if (/<script[^>]+src="https?:|<link[^>]+href="https?:/i.test(html)) throw new Error('Risorsa esterna inattesa.');
console.log(`Controlli superati: ${ids.length} elementi, icone presenti, nessuna dipendenza online.`);
