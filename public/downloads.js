import { downloadedBytes } from './video-offline-range.js';
// Scaricati: l'avanzamento guardato senza rete (da rimandare a casa) e la pagina dei video scaricati.
export const pendingKey = profile => `pending-progress:${profile}`;
export function notePending(map, id, { position, duration, watched }, at = Date.now()) {
  const seen = Number(position) || 0, length = Number(duration) || 0;
  map[id] = { position: seen, duration: length, watched: watched === true || (length > 0 && seen / length >= 0.95), at }; return map;
}
// Rimanda a casa quello che si è guardato senza rete. Se il server ha un punto più recente (guardato su un altro
// dispositivo dopo) vince il server. Ritorna quello che non è riuscito a partire: resta da riprovare.
export async function syncPending(profile, pending, api) {
  const ids = Object.keys(pending); if (!ids.length) return {};
  const server = await api(`/api/progress?profile=${encodeURIComponent(profile)}`);
  const left = {}; const seen = []; const retry = e => !e.status || e.status >= 500;
  for (const id of ids) {
    const v = pending[id];
    if ((server[id]?.updated || 0) > v.at) continue;
    if (v.watched) { seen.push(id); continue; }
    try { await api('/api/progress', { method: 'PUT', data: { profile, id, position: v.position, duration: v.duration } }); } catch (e) { if (retry(e)) left[id] = v; }
  }
  if (seen.length) try { await api('/api/progress/batch', { method: 'PUT', data: { ids: seen, profile, watched: true } }); } catch (e) { if (retry(e)) for (const id of seen) left[id] = pending[id]; }
  return left;
}
export function asProgress(pending) {
  return Object.fromEntries(Object.entries(pending || {}).map(([id, v]) => [id, { position: v.position, duration: v.duration, watched: v.watched, updated: v.at }]));
}
export async function freeSpace(storage = globalThis.navigator?.storage) {
  const e = await storage?.estimate?.().catch(() => null); return e?.quota ? Math.max(0, e.quota - (e.usage || 0)) : null;
}
export function statusText(entry, job) {
  const pct = entry?.total ? Math.round(100 * downloadedBytes(entry) / entry.total) : 0;
  if (entry?.state === 'done') return 'Pronto senza rete';
  if (job?.state === 'preparing') return 'Sto preparando la versione leggera…';
  if (job?.state === 'queued') return 'In attesa…';
  if (job) return `Scarico… ${pct}%`;
  return `Interrotto al ${pct}% · puoi riprendere`;
}
// La pagina «Scaricati» dei video (accento arancione). Le righe nascono dai download in corso e da quelli finiti.
export function createDownloads(c) {
  const { el, state, notify, action, fmtSize, manager } = c; let free = null;
  const refreshFree = async () => { const now = await freeSpace(); if (now !== free) { free = now; c.repaint(); } };
  const rows = () => {
    const entries = Object.values(manager.m?.entries || {}); const map = new Map(entries.map(e => [e.id, { entry: e, item: e.item }]));
    for (const job of manager.jobs.values()) if (!map.has(job.id)) map.set(job.id, { entry: null, item: job.item });
    return [...map.values()].sort((a, b) => (a.item.series || a.item.title).localeCompare(b.item.series || b.item.title, 'it') || (a.item.season - b.item.season) || (a.item.episode - b.item.episode));
  };
  function row({ entry, item }) {
    const job = manager.jobs.get(item.id); const done = entry?.state === 'done'; const share = entry?.total ? downloadedBytes(entry) / entry.total : 0;
    const name = item.series ? `${item.series} · S${item.season}:E${item.episode}` : item.title;
    const size = entry ? `${fmtSize(entry.total)} · ${entry.quality === 'light' ? 'Standard' : 'Originale'}` : '';
    return el('li', { class: `dl-row${done ? ' done' : ''}`, 'data-id': item.id },
      el('span', { class: 'dl-art' }, item.images?.poster ? el('img', { src: `/media/${item.id}/poster?s=260`, alt: '', width: 60, height: 90, loading: 'lazy', onerror: e => e.target.remove() }) : null),
      el('span', { class: 'dl-text' }, el('strong', {}, name), item.series ? el('small', {}, item.title) : null,
        el('small', { class: 'dl-status', role: 'status' }, [size, statusText(entry, job)].filter(Boolean).join(' · ')),
        done ? null : el('progress', { max: '1', value: String(share), 'aria-label': `Avanzamento: ${name}` })),
      el('span', { class: 'dl-actions' },
        done ? el('button', { class: 'primary', onclick: action(() => c.playItem(item)) }, 'Guarda') : null,
        !done && !job ? el('button', { class: 'primary', onclick: action(async () => { manager.enqueue(item, entry.quality); }) }, 'Riprendi') : null,
        job ? el('button', { class: 'secondary', onclick: action(() => manager.cancel(item.id)) }, 'Annulla') : el('button', { class: 'quiet', onclick: action(async () => { if (await c.ask(`Eliminare «${name}»?`, '', 'Il video torna a occupare spazio solo a casa. Potrai scaricarlo di nuovo.', true)) { await manager.remove(item.id); notify('Download eliminato.'); } }) }, 'Elimina')));
  }
  function view() {
    refreshFree(); const list = rows(); const used = list.reduce((n, r) => n + (r.entry ? downloadedBytes(r.entry) : 0), 0);
    return [el('section', { class: 'dl-page' },
      el('div', { class: 'page-head' }, el('h1', {}, 'Scaricati'),
        el('p', {}, 'I video qui sotto stanno nella memoria di Apollon: li guardi anche senza rete, e non finiscono nella galleria.')),
      state.offline ? el('p', { class: 'dl-offline', role: 'status' }, 'Sei senza rete. Puoi guardare quello che hai scaricato. Il punto in cui sei arrivato viene rimandato a casa appena torni connesso.') : null,
      el('div', { class: 'dl-space' }, el('span', {}, el('strong', {}, fmtSize(used)), ' occupati dai video scaricati'),
        el('span', {}, free === null ? 'Spazio libero: non lo so dire' : el('span', {}, el('strong', {}, fmtSize(free)), ' ancora liberi sul telefono'))),
      manager.lastError ? el('p', { class: 'error', role: 'alert' }, manager.lastError) : null,
      list.length ? el('ul', { class: 'dl-list' }, ...list.map(row))
        : el('div', { class: 'empty' }, el('h2', {}, 'Non hai ancora scaricato niente'), el('p', {}, 'Apri un film o un episodio e tocca «Scarica». Scegli se vuoi la versione che occupa meno spazio o l’originale.')),
      state.boot?.music ? el('p', {}, el('button', { class: 'secondary', onclick: () => c.setPage('music') }, 'Vai alla musica scaricata')) : null)];
  }
  return { view };
}
