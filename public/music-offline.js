import { OfflineMusic } from './music-offline-cache.js';
import { avatar } from './music-shell.js';
import { freeSpace } from './downloads.js';
// Download di musica in corso (per scheda): la pagina «Scaricati» li mostra con barra e «Annulla».
export const musicJobs = new Map();
export const QUALITY = { low: 'Risparmio spazio', high: 'Alta qualità' };
export async function prepareOffline() {
  let timer;
  try {
    const registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('La memoria offline non è pronta. Ricarica la pagina e riprova.')), 15000); })]);
    clearTimeout(timer);
    await new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      timer = setTimeout(() => { channel.port1.close(); reject(new Error('Preparazione offline interrotta. Riprova sul Wi-Fi.')); }, 20000);
      channel.port1.onmessage = e => { channel.port1.close(); e.data.ok ? resolve() : reject(new Error('Non riesco a preparare la pagina senza rete. Riprova.')); };
      (navigator.serviceWorker.controller || registration.active).postMessage({ type: 'prepare-music' }, [channel.port2]);
    });
  } finally { clearTimeout(timer); }
}
export function offlineLibrary(c) {
  const manager = new OfflineMusic(c.key()); const { el, action } = c;
  const supported = () => !!globalThis.isSecureContext && !!navigator.serviceWorker && !!globalThis.caches;
  const showCollection = async (type, id, generation) => {
    const collection = (await manager.collections()).find(i => i.type === type && i.id === id);
    if (generation !== c.state.musicGeneration) return;
    if (!collection) throw new Error('Questa raccolta non è scaricata su questo dispositivo.');
    document.querySelector('#music-breadcrumb').replaceChildren(el('button', { class: 'quiet', onclick: () => c.load('library') }, '‹ La tua musica'));
    document.querySelector('#music-results').replaceChildren(el('section', { class: 'offline-heading' }, avatar(c), el('h2', {}, collection.name), el('p', { role: 'status' }, 'Scaricata · pronta senza rete'), el('button', { class: 'primary', onclick: () => c.setQueue(collection.songs) }, 'Ascolta tutto'), el('button', { class: 'secondary', onclick: action(async () => { await manager.remove(`${type}:${id}`); await showOffline(++c.state.musicGeneration); }) }, 'Rimuovi download')), c.trackList(collection.songs));
  };
  const showOffline = async generation => {
    const collections = await manager.collections(); if (generation !== c.state.musicGeneration) return;
    const used = collections.reduce((n, col) => n + col.bytes, 0), free = await freeSpace(); if (generation !== c.state.musicGeneration) return;
    const jobs = [...musicJobs.values()].filter(job => job.scope === manager.name);
    const repaint = () => { if (generation === c.state.musicGeneration) showOffline(generation).catch(() => {}); };
    document.querySelector('#music-breadcrumb').replaceChildren();
    document.querySelector('#music-results').replaceChildren(el('section', { class: 'offline-heading dl-page' }, avatar(c), el('h2', {}, 'Scaricati'),
      el('p', { role: 'status' }, navigator.onLine && !c.state.offline ? 'La musica salvata su questo telefono: si ascolta anche senza rete.' : 'Sei senza rete. Qui trovi la musica scaricata su questo telefono.'),
      el('div', { class: 'dl-space' }, el('span', {}, el('strong', {}, c.fmtSize(used)), ' occupati dalla musica scaricata'), el('span', {}, free === null ? 'Spazio libero: non lo so dire' : el('span', {}, el('strong', {}, c.fmtSize(free)), ' ancora liberi sul telefono'))),
      el('ul', { class: 'dl-list' },
        ...jobs.map(job => el('li', { class: 'dl-row dl-music' }, el('span', { class: 'dl-art' }), el('span', { class: 'dl-text' }, el('strong', {}, job.name), el('small', { role: 'status' }, `Scarico… ${job.done} di ${job.total} brani`), el('progress', { max: String(job.total), value: String(job.done), 'aria-label': `Avanzamento: ${job.name}` })),
          el('span', { class: 'dl-actions' }, el('button', { class: 'secondary', onclick: () => job.abort.abort() }, 'Annulla')))),
        ...collections.map(col => el('li', { class: 'dl-row dl-music done' },
          el('span', { class: 'dl-art' }, el('img', { src: col.cover || c.image(col.songs[0]?.coverArt || col.songs[0]?.albumId, 160), alt: '', width: 60, height: 60, loading: 'lazy', onerror: e => { e.target.src = '/music-cover.svg'; } })),
          el('span', { class: 'dl-text' }, el('strong', {}, col.name), el('small', {}, `${col.songs.length} brani · ${c.fmtSize(col.bytes)} · ${QUALITY[col.quality]}`), el('small', { class: 'dl-status' }, 'Pronta senza rete')),
          el('span', { class: 'dl-actions' }, el('button', { class: 'primary', onclick: action(() => showCollection(col.type, col.id, ++c.state.musicGeneration)) }, 'Ascolta'),
            el('button', { class: 'quiet', onclick: action(async () => { await manager.remove(`${col.type}:${col.id}`); c.notify('Download eliminato.'); await showOffline(++c.state.musicGeneration); }) }, 'Elimina'))))),
      !collections.length && !jobs.length ? el('p', {}, 'Non hai ancora scaricato musica per questo profilo. Torna sul Wi-Fi di casa e usa Scarica su un album o una playlist.') : null,
      c.state.boot?.mode !== 'music' ? el('p', {}, el('button', { class: 'secondary', onclick: () => c.setPage('scaricati') }, 'Vai ai video scaricati')) : null));
    if (jobs.length) setTimeout(repaint, 1000);
  };
  const downloadButton = collection => {
    const button = el('button', { class: 'secondary download-collection', onclick: action(async () => { 
      if (!supported()) throw new Error('Per scaricare serve un browser con memoria offline e Apollon aperta con HTTPS (oppure localhost sul PC).');
      const existing = (await manager.collections()).find(i => i.type === collection.type && i.id === collection.id);
      let quality = c.storage.get('music-dl-quality', 'low') === 'high' ? 'high' : 'low';
      const info = await manager.estimate(collection.songs, quality);
      const dialog = el('dialog', { class: 'download-dialog', 'aria-label': 'Musica senza rete' });
      const plan = i => existing ? 'Questa raccolta è già scaricata.' : `Da scaricare: circa ${c.fmtSize(i.needed)}. Disponibili entro il limite: ${c.fmtSize(i.available)}.`;
      const status = el('p', { role: 'status', 'aria-live': 'polite' }, plan(info));
      const bar = el('progress', { max: '1', value: '0', hidden: true, 'aria-label': 'Avanzamento del download' });
      const choose = el('select', { 'aria-label': 'Qualità del download' }, el('option', { value: 'low' }, 'Risparmio spazio (consigliato, circa 128 kbit/s)'), el('option', { value: 'high' }, 'Alta qualità (il file originale, occupa di più)'));
      choose.value = quality;
      choose.addEventListener('change', action(async () => { quality = choose.value; c.storage.set('music-dl-quality', quality); status.textContent = plan(await manager.estimate(collection.songs, quality)); }));
      const limit = el('input', { type: 'number', min: '50', max: '20480', step: '50', value: Math.round(info.limit / 1024 ** 2), 'aria-label': 'Limite download in MB' });
      let abort; const close = el('button', { class: 'quiet', onclick: () => dialog.close(), 'aria-label': 'Chiudi download' }, 'Chiudi');
      const start = el('button', { class: 'primary', onclick: action(async () => {
        if (abort) return; abort = new AbortController(); start.disabled = true; remove.disabled = true; choose.disabled = true;
        const key = `${collection.type}:${collection.id}`, job = { scope: manager.name, name: collection.name, done: 0, total: collection.songs.length, abort }; musicJobs.set(key, job);
        cancel.hidden = false; bar.hidden = false; status.textContent = 'Preparo la memoria offline…';
        try {
          await prepareOffline();
          const first = collection.songs[0];
          const result = await manager.download({ ...collection, cover: first ? c.image(first.coverArt || first.albumId, 160) : undefined }, { signal: abort.signal, quality, progress: (n, total) => { job.done = n; job.total = total; bar.max = total; bar.value = n; status.textContent = `Scarico ${n} di ${total} brani…`; } });
          const boot = c.state.boot; c.storage.set('offline-bootstrap', { music: true, musicUser: boot.musicUser, profiles: boot.profiles, mode: 'music', roots: [], count: 0, pending: false, demo: boot.demo });
          status.textContent = result.persistent ? 'Scaricata. Puoi ascoltarla senza rete.' : 'Scaricata. Il browser può liberare questa memoria quando lo spazio scarseggia.';
          button.textContent = 'Scaricata ✓'; remove.disabled = false;
          if (!dialog.isConnected) c.notify(`«${collection.name}» è scaricata. La trovi in Scaricati.`);
        } catch (error) { status.textContent = error.name === 'AbortError' ? 'Download annullato. I download precedenti restano disponibili.' : error.message; if (!dialog.isConnected && error.name !== 'AbortError') c.notify(error.message, true); }
        finally { musicJobs.delete(key); abort = null; start.disabled = false; choose.disabled = false; cancel.hidden = true; bar.hidden = true; }
      }) }, existing ? 'Aggiorna download' : 'Scarica su questo dispositivo');
      const cancel = el('button', { class: 'secondary', hidden: true, onclick: () => abort?.abort() }, 'Annulla download');
      const remove = el('button', { class: 'secondary', disabled: !existing, onclick: action(async () => { await manager.remove(`${collection.type}:${collection.id}`); button.textContent = 'Scarica'; status.textContent = 'Download rimosso. I brani restano nella raccolta di casa.'; remove.disabled = true; }) }, 'Rimuovi download');
      dialog.append(el('div', { class: 'dialog-heading' }, el('h2', {}, collection.name), close), status, bar, el('label', {}, 'Qualità', choose), el('label', {}, 'Spazio massimo per questo profilo (MB)', limit), el('button', { class: 'secondary', onclick: action(async () => { await manager.setLimit(Number(limit.value) * 1024 ** 2); status.textContent = 'Limite salvato.'; }) }, 'Salva limite'), el('div', { class: 'actions' }, start, cancel, remove));
      // Chiudere la finestra non ferma il download: continua e si segue in Scaricati.
      dialog.addEventListener('close', () => dialog.remove(), { once: true }); document.body.append(dialog); c.showModal(dialog);
    }) }, 'Scarica');
    manager.collections().then(items => { if (items.some(i => i.id === collection.id && i.type === collection.type)) button.textContent = 'Scaricata ✓'; }).catch(() => {}); return button;
  };
  return { manager, showCollection, showOffline, downloadButton };
}
