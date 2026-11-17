import path from 'node:path';
import { readJson, atomicJson } from './util.js';
import { unlink } from 'node:fs/promises';

// La musica si collega una sola volta: da Gestisci (sul disco resta solo il gettone Subsonic: utente, sale e impronta,
// mai la password) oppure da config.json (navidromeUser/navidromePassword, scritti una volta sul telefono della musica).
// In tutti e due i casi nessuno in casa scrive utente e password nel browser. Il gettone non torna mai al browser.
export class MusicLink {
  constructor(dir, music, fallback = null) {
    this.file = path.join(dir, 'musica-collegata.json'); this.music = music; this.auth = null; this.source = '';
    this.fallback = fallback?.username && fallback?.password ? { username: String(fallback.username), password: String(fallback.password) }
      : fallback?.trustUser ? { trustUser: String(fallback.trustUser) } : null;
    this.lastTry = 0; this.lastError = '';
  }
  async init() {
    const saved = await readJson(this.file, null).catch(() => null);
    if (saved && ['u', 't', 's'].every(k => typeof saved[k] === 'string' && saved[k])) { this.auth = { u: saved.u, t: saved.t, s: saved.s }; this.source = 'gestisci'; }
    await this.ensure();
    return this;
  }
  // Con le credenziali in config.json il collegamento si fa da solo; se Navidrome è spento si riprova fra 15 secondi.
  async ensure() {
    if (this.auth || !this.fallback || Date.now() - this.lastTry < 15000) return this.auth;
    this.lastTry = Date.now();
    try { this.auth = this.fallback.trustUser ? await this.music.trust(this.fallback.trustUser) : await this.music.login(this.fallback.username, this.fallback.password); this.source = 'config'; this.lastError = ''; }
    catch (error) { this.lastError = error.message; }
    return this.auth;
  }
  status() { return { linked: !!this.auth, user: this.auth?.u || '', source: this.auth ? this.source : '', configured: !!this.fallback, error: this.auth ? '' : this.lastError }; }
  async link(username, password) {
    const auth = await this.music.login(username, password);
    await atomicJson(this.file, auth); this.auth = auth; this.source = 'gestisci'; return this.status();
  }
  async unlink() {
    this.auth = null; this.source = ''; await unlink(this.file).catch(e => { if (e.code !== 'ENOENT') throw e; });
    if (this.fallback) { this.lastTry = 0; await this.ensure(); }
    return this.status();
  }
}
