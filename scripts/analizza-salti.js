// Offline command: no HTTP listener, no access key or Navidrome session needed.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../lib/util.js';
import { Store } from '../lib/store.js';
import { Files } from '../lib/files.js';
import { Library } from '../lib/library.js';
import { SkipService } from '../lib/skip-service.js';

export async function analyzeSeason(config, series, season, { tools, onStatus = () => {} } = {}) {
  const store = await new Store(config.dataDir).init();
  const files = new Files(config.roots, store);
  const library = await new Library({ ...config, metadata: false }, files, store).init();
  const skips = await new SkipService({ ...config, metadata: false }, library, files, store, tools).init();
  try {
    const item = library.list().find(i => i.root === 'Anime' && i.series === series && i.season === season);
    if (!item) throw new Error('Stagione non trovata. Controlla nome serie e numero stagione.');
    // This command is deliberately offline, even if AniSkip was enabled in UI.
    skips.allowNetwork = false;
    skips.enqueue(item.id); await skips.wait(); const result = skips.status(); onStatus(result);
    return { ...result, items: library.list().filter(i => i.root === 'Anime' && i.series === series && i.season === season).map(i => ({ id: i.id, episodio: i.episode, salti: i.salti, fonti: i.fontiSalti })) };
  } finally { await skips.close(); await library.close(); await store.queue; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [configName, series, seasonText] = process.argv.slice(2); const season = Number(seasonText);
  if (!configName || !series || !Number.isInteger(season) || season < 0 || season > 999) {
    console.error('Uso: node scripts/analizza-salti.js percorso-config.json "Nome serie" 1'); process.exitCode = 1;
  } else {
    try {
      const configFile = path.resolve(configName); const source = await readJson(configFile, null);
      if (!source?.roots?.Anime) throw new Error('Nel file di configurazione manca la cartella Anime.');
      const config = { ...source, metadata: false, dataDir: path.resolve(path.dirname(configFile), source.dataDir || 'data') };
      const result = await analyzeSeason(config, series, season);
      console.log(JSON.stringify(result, null, 2)); if (result.failed) process.exitCode = 1;
    } catch (error) { console.error(error.status ? error.message : 'Analisi non riuscita. Controlla configurazione, ffmpeg con Chromaprint e permessi.'); process.exitCode = 1; }
  }
}
