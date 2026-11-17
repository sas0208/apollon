import path from 'node:path';
import { copyFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { atomicJson, readJson, fail, text, number } from './util.js';

// Locandina o sfondo scelti a mano: un fotogramma (secondi, anche da un altro episodio) o un'immagine della raccolta.
function artChoice(value) {
  if (value === null || value === '') return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail(400, 'Scelta dell’immagine non valida.');
  if ('path' in value) return { path: text(value.path, 1500) };
  const choice = { at: number(value.at, 0, 86400) };
  if (value.source !== undefined) { if (typeof value.source !== 'string' || !/^[a-f0-9]{24}$/.test(value.source)) throw fail(400, 'Episodio non valido.'); choice.source = value.source; }
  return choice;
}
// Le prime versioni partivano con due profili d'esempio già fatti, che nessuno aveva creato. Ora si parte
// senza profili (il primo si crea da «Chi guarda?»); quelli predefiniti restano solo se hanno già visti, lista o ascolti.
const PREMADE = ['marta', 'piero'];
// I voti di un titolo da parte di un profilo, in ordine: una lista (un vecchio voto singolo vale come lista di uno).
const voteList = v => (Array.isArray(v) ? v : [v]).filter(x => Number.isInteger(x) && x >= 1 && x <= 5);
export class Store {
  constructor(dir, { seed = [], log = console } = {}) { this.file = path.join(dir, 'stato.json'); this.queue = Promise.resolve(); this.seed = seed; this.log = log; }
  async init() {
    const saved = await readJson(this.file, null);
    this.data = saved || { profiles: [], progress: {}, edits: {}, trash: [], migrations: { autoSkipOff: 1 } };
    let dirty = false;
    if (saved && !this.data.migrations?.premade) { dirty = true; this.data.migrations = { ...this.data.migrations, premade: 1 }; this.dropUnusedPremade(); }
    for (const p of this.seed) if (!this.data.profiles.some(x => x.id === p.id)) { this.data.profiles.push({ id: p.id, name: p.name }); dirty = true; }
    // Voti: da un solo voto per titolo a una lista di voti (il vecchio voto diventa il primo). Prima di migrare si salva una copia del file.
    if (saved && !this.data.migrations?.ratingList) {
      if (Object.values(this.data.ratings || {}).some(v => Object.values(v || {}).some(x => !Array.isArray(x)))) {
        await copyFile(this.file, `${this.file}.prima-dei-voti-multipli.bak`).catch(() => {});
        for (const votes of Object.values(this.data.ratings)) for (const k of Object.keys(votes || {})) votes[k] = voteList(votes[k]);
      }
      this.data.migrations = { ...this.data.migrations, ratingList: 1 }; dirty = true;
    }
    // 12/11: il salto automatico torna spento per tutti, una volta sola. Era acceso di base e tagliava scene:
    // ora compare il pulsante «Salta» e chi vuole il salto da solo lo riaccende dalle impostazioni.
    if (saved && !this.data.migrations?.autoSkipOff) {
      for (const p of this.data.profiles) delete p.autoSkip;
      this.data.migrations = { ...this.data.migrations, autoSkipOff: 1 }; dirty = true;
    }
    if (dirty) await atomicJson(this.file, this.data);
    return this;
  }
  profileHasData(id) {
    const d = this.data;
    return Object.keys(d.progress?.[id] || {}).length > 0 || (d.lists?.[id] || []).length > 0 || Object.keys(d.ratings?.[id] || {}).length > 0 ||
      Object.entries(d.musicActivity || {}).some(([key, events]) => key.endsWith(`/${id}`) && events.length > 0);
  }
  dropUnusedPremade() {
    const premade = this.data.profiles.filter(p => PREMADE.includes(p.id));
    const drop = premade.filter(p => !this.profileHasData(p.id));
    for (const p of premade.filter(p => !drop.includes(p))) this.log.log(`Profilo predefinito «${p.name}» conservato: ha visti, lista o ascolti.`);
    if (!drop.length) return;
    this.data.profiles = this.data.profiles.filter(p => !drop.includes(p));
    this.log.log(`Profili predefiniti mai usati tolti: ${drop.map(p => p.name).join(', ')}. Si creano da «Chi guarda?».`);
  }
  async change(fn) {
    const task = this.queue.then(async () => {
      const next = structuredClone(this.data); const result = fn(next);
      await atomicJson(this.file, next); this.data = next; return result;
    });
    this.queue = task.catch(() => {}); return task;
  }
  profile(id) {
    if (!this.data.profiles.some(p => p.id === id)) throw fail(404, 'Profilo non trovato.');
    return this.data.progress[id] || {};
  }
  addProfile(name) {
    name = text(name, 35);
    return this.change(d => {
      if (d.profiles.length >= 20) throw fail(400, 'Ci sono già 20 profili.');
      const p = { id: randomUUID(), name }; d.profiles.push(p); return p;
    });
  }
  setAvatar(id, avatar) {
    this.profile(id);
    if (avatar !== null && (typeof avatar !== 'string' || !/^\/media\/avatar\/[a-f0-9]{24}\.jpg$/.test(avatar))) throw fail(400, 'Immagine del profilo non valida.');
    return this.change(d => Object.assign(d.profiles.find(p => p.id === id), { avatar }));
  }
  preferences(id, patch) {
    this.profile(id); const value = {};
    for (const key of ['autoSkip', 'autoNext']) if (key in patch) {
      if (typeof patch[key] !== 'boolean') throw fail(400, 'Preferenza non valida.');
      value[key] = patch[key];
    }
    return this.change(d => Object.assign(d.profiles.find(p => p.id === id), value));
  }
  // Valida un avanzamento (posizione, durata, visto, nascosto) senza ancora scriverlo.
  progressValue(patch) {
    const value = {};
    if ('position' in patch) value.position = number(patch.position, 0, 1e8);
    if ('duration' in patch) value.duration = number(patch.duration, 0, 1e8);
    if ('watched' in patch) {
      if (typeof patch.watched !== 'boolean') throw fail(400, 'Stato non valido.');
      value.watched = patch.watched;
    }
    // «Togli dalla riga»: il titolo esce da Continua a guardare finché non si riprende a guardarlo.
    if ('hidden' in patch) {
      if (typeof patch.hidden !== 'boolean') throw fail(400, 'Stato non valido.');
      value.hidden = patch.hidden;
    }
    return value;
  }
  applyProgress(d, profile, id, value) {
    d.progress[profile] ||= {};
    const old = d.progress[profile][id] || {};
    const next = { ...old, ...value, updated: 'hidden' in value && Object.keys(value).length === 1 ? old.updated || Date.now() : Date.now() };
    if ('position' in value && !('hidden' in value)) delete next.hidden;
    if (!next.hidden) delete next.hidden;
    // Il salvataggio automatico del lettore può solo AGGIUNGERE il «visto» (oltre il 95%): togliere un «visto» messo
    // a mano (o dal 95%) lo fa solo un comando esplicito, altrimenti basta aprire l’episodio un istante per perderlo.
    if (!('watched' in value) && next.duration > 0 && !next.watched) next.watched = next.position / next.duration >= 0.95;
    d.progress[profile][id] = next; return next;
  }
  progress(profile, id, patch) {
    this.profile(profile); const value = this.progressValue(patch);
    return this.change(d => this.applyProgress(d, profile, id, value));
  }
  // Più episodi in una sola scrittura: «Segna visto» su una serie intera è una richiesta sola, non una per episodio.
  progressMany(profile, ids, patch) {
    this.profile(profile); const value = this.progressValue(patch);
    if (!Array.isArray(ids) || !ids.length || ids.length > 3000) throw fail(400, 'Elenco di episodi non valido.');
    return this.change(d => Object.fromEntries(ids.map(id => [id, this.applyProgress(d, profile, id, value)])));
  }
  validateEdit(patch) {
    const value = {};
    if ('title' in patch) value.title = text(patch.title);
    if ('series' in patch) value.series = patch.series === '' || patch.series === null ? null : text(patch.series, 150);
    for (const [key, max] of [['season', 999], ['episode', 9999]]) if (key in patch) {
      if (!Number.isInteger(patch[key])) throw fail(400, 'Stagione ed episodio devono essere numeri interi.');
      value[key] = number(patch[key], 0, max);
    }
    if ('imagePath' in patch) value.imagePath = patch.imagePath === '' ? '' : text(patch.imagePath, 1500);
    if ('genres' in patch) {
      if (!Array.isArray(patch.genres) || patch.genres.length > 12) throw fail(400, 'Generi non validi.');
      value.genres = patch.genres.map(g => text(g, 40));
    }
    for (const key of ['description', 'seriesDescription']) if (key in patch) {
      if (patch[key] === '' || patch[key] === null) value[key] = '';
      else value[key] = text(patch[key], 2000);
    }
    for (const key of ['poster', 'backdrop']) if (key in patch) value[key] = artChoice(patch[key]);
    if ('introStart' in patch) value.introStart = number(patch.introStart, 0, 86400);
    if ('introEnd' in patch) value.introEnd = number(patch.introEnd, 0, 86400);
    return value;
  }
  edit(id, patch) { return this.editMany([{ id, patch }]); }
  // «La mia lista» per profilo: chiavi dei titoli (un film o una serie intera), le più recenti in cima.
  list(profile) { this.profile(profile); return (this.data.lists?.[profile] || []).slice(); }
  setListed(profile, key, on) {
    this.profile(profile); key = text(key, 400);
    if (typeof on !== 'boolean') throw fail(400, 'Scelta non valida.');
    return this.change(d => {
      d.lists ||= {}; const list = (d.lists[profile] || []).filter(entry => entry.key !== key);
      if (on) { if (list.length >= 500) throw fail(400, 'La lista è piena: togli qualche titolo.'); list.unshift({ key, added: Date.now() }); }
      d.lists[profile] = list; return list;
    });
  }
  // Voti da 1 a 5: ogni tocco sulle stelle è un voto nuovo e si somma ai precedenti (anche dello stesso profilo). La media e `counts` (i voti di ogni stella) contano tutti i voti;
  // `mine` è l'ultimo voto del profilo.
  ratingSummary() {
    const out = {}; const known = new Set(this.data.profiles.map(p=>p.id));
    for(const [id, votes] of Object.entries(this.data.ratings || {})) if(known.has(id)) for(const [key,raw] of Object.entries(votes || {})) {
      const list=voteList(raw);if(!list.length)continue;
      const entry=out[key] ||= {count:0,sum:0};entry.count+=list.length;entry.sum+=list.reduce((a,b)=>a+b,0);
    }
    return out;
  }
  ratings(key, profile = '') {
    key = text(key, 400); const counts = [0, 0, 0, 0, 0]; let sum = 0; let count = 0;
    const known = new Set(this.data.profiles.map(p => p.id));
    for (const [id, votes] of Object.entries(this.data.ratings || {})) {
      if (known.has(id)) for (const v of voteList(votes?.[key])) { counts[v - 1]++; sum += v; count++; }
    }
    if (profile) this.profile(profile);
    return { key, count, average: count ? Math.round(sum / count * 10) / 10 : null, counts, mine: (profile && voteList(this.data.ratings?.[profile]?.[key]).at(-1)) || null };
  }
  setRating(profile, key, value) {
    this.profile(profile); key = text(key, 400);
    if (value !== null && !(Number.isInteger(value) && value >= 1 && value <= 5)) throw fail(400, 'Il voto va da 1 a 5 stelle.');
    return this.change(d => {
      d.ratings ||= {}; const mine = { ...(d.ratings[profile] || {}) }; const list = voteList(mine[key]);
      if (value === null) { list.pop(); if (list.length) mine[key] = list; else delete mine[key]; } // senza valore si toglie l'ultimo voto
      else { if (!(key in mine) && Object.keys(mine).length >= 5000) throw fail(400, 'Troppi voti: toglierne qualcuno.'); mine[key] = [...list, value].slice(-500); }
      d.ratings[profile] = mine;
    }).then(() => this.ratings(key, profile));
  }
  renameProfile(id, name) {
    this.profile(id); name = text(name, 35);
    return this.change(d => { const p = d.profiles.find(x => x.id === id); p.name = name; return p; });
  }
  editMany(changes) {
    const values = changes.map(({ id, patch }) => ({ id, value: this.validateEdit(patch) }));
    return this.change(d => {
      const results = values.map(({ id, value }) => {
        const next = { ...d.edits[id], ...value, updated: Date.now() };
        if ((next.introEnd || 0) < (next.introStart || 0)) throw fail(400, 'La fine della sigla precede l’inizio.');
        d.edits[id] = next; return next;
      });
      return results[0];
    });
  }
}
