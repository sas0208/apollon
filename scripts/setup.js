import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, access } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { atomicJson } from '../lib/util.js';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export async function setup({ mode = 'video', directory = appDir, root = '/storage/emulated/0/Server' } = {}) {
  if (!['video', 'music'].includes(mode)) throw new Error('Scegli video oppure music.');
  const configFile = path.join(directory, 'config.json'); const dataDir = path.join(directory, 'data');
  await mkdir(dataDir, { recursive: true });
  let existingConfig = false;
  try { await access(configFile); existingConfig = true; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!existingConfig) {
    await atomicJson(configFile, { port: 8787, host: '0.0.0.0', mode,
      roots: Object.fromEntries(['Film', 'Anime', 'Musica', 'File'].map(name => [name, path.join(root, name)])),
      navidromeUrl: 'http://127.0.0.1:4533',
      musicCatalogPath: 'Libreria/catalogo_musica.json', musicPathPrefix: 'Libreria',
      otherLibraryUrl: '',
      maxUploadGB: 20, metadataDelayMs: 2500 });
  }
  let key = null;
  try { await access(path.join(dataDir, 'access.json')); }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
    key = randomBytes(18).toString('base64url');
    await atomicJson(path.join(dataDir, 'access.json'), { hash: createHash('sha256').update(key).digest('hex') });
  }
  return { existingConfig, key };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'video';
  const result = await setup({ mode });
  console.log(result.existingConfig ? 'Configurazione esistente conservata.' : 'Configurazione pronta.');
  if (result.key) console.log(`\nLa tua nuova chiave di casa (conservala in un posto sicuro):\n${result.key}\n`);
  else console.log('La chiave di casa esistente è stata conservata.');
  console.log('Per avviare: node server.js\nPer cambiare cartelle o indirizzo dell’altro telefono: config.json');
}
