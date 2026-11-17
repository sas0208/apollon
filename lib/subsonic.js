import { createHash, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fail, text } from './util.js';

export class Subsonic {
  constructor(baseUrl) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Indirizzo Navidrome non valido.');
    this.base = baseUrl.replace(/\/$/, '');
  }
  credentials(username, password) {
    username = text(username, 150);
    if (typeof password !== 'string' || !password.length || password.length > 1000) throw fail(400, 'Scrivi la password della musica.');
    const salt = randomBytes(12).toString('hex');
    return { u: username, t: createHash('md5').update(password + salt).digest('hex'), s: salt };
  }
  // 6/11: «fiducia locale» — Navidrome sullo stesso telefono accetta l'utente dall'intestazione Remote-User
  // (ND_REVERSEPROXYWHITELIST=127.0.0.1/32), così nessuno deve sapere la password.
  headers(auth, extra = {}) { return auth?.proxy ? { ...extra, 'Remote-User': auth.u } : extra; }
  url(method, auth, params = {}) {
    if (!auth) throw fail(401, 'Accedi alla musica con il tuo utente Navidrome.');
    const url = new URL(`${this.base}/rest/${method}.view`);
    const { proxy, ...query } = auth;
    for (const [key, value] of Object.entries({ ...query, v: '1.16.1', c: 'Mediateca', f: 'json', ...params })) {
      if (value === undefined || value === null) continue;
      for (const part of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(part));
    }
    return url;
  }
  async request(method, auth, params = {}) {
    let response;
    const url = this.url(method, auth, params);
    // Playlist IDs in large libraries exceed URL/header limits. Subsonic accepts
    // the same parameters as a form POST; streams keep their Range GET below.
    const form = ['createPlaylist', 'updatePlaylist'].includes(method) ? new URLSearchParams(url.search) : null;
    if (form) url.search = '';
    try { response = await fetch(url, { headers: this.headers(auth), signal: AbortSignal.timeout(15000), redirect: 'error', ...(form ? { method: 'POST', body: form } : {}) }); }
    catch { throw fail(502, 'Navidrome non risponde. Controlla che sia acceso sul telefono.'); }
    if (!response.ok) { await response.body?.cancel(); throw fail(502, 'Navidrome non ha accettato la richiesta.'); }
    const raw = await response.text();
    if (raw.length > 8 * 1024 ** 2) throw fail(502, 'Risposta musicale troppo grande.');
    let data; try { data = JSON.parse(raw)['subsonic-response']; } catch { throw fail(502, 'Risposta Navidrome non valida.'); }
    if (!data || data.status !== 'ok') {
      const code = data?.error?.code;
      throw fail([40, 41, 42, 43, 44].includes(code) ? 401 : 502, code === 40 ? 'Utente o password della musica non corretti.' : 'Navidrome non può completare questa richiesta.');
    }
    return data;
  }
  async trust(username) { const auth = { u: text(username, 150), proxy: true }; await this.request('ping', auth); return auth; }
  async login(username, password) { const auth = this.credentials(username, password); await this.request('ping', auth); return auth; }
  async proxy(req, res, method, auth, params) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    res.on('close', () => controller.abort());
    let upstream;
    try { upstream = await fetch(this.url(method, auth, params), { method: req.method === 'HEAD' ? 'HEAD' : 'GET', headers: this.headers(auth, req.headers.range ? { Range: req.headers.range } : {}), signal: controller.signal, redirect: 'error' }); }
    catch { throw fail(502, 'Riproduzione musicale non disponibile. Controlla Navidrome.'); }
    finally { clearTimeout(timer); }
    if (!upstream.ok && upstream.status !== 416) { await upstream.body?.cancel(); throw fail(502, 'Brano o copertina non disponibili.'); }
    if (upstream.headers.get('content-type')?.includes('json') || upstream.headers.get('content-type')?.includes('xml')) {
      await upstream.body?.cancel(); throw fail(502, 'Navidrome non ha restituito il file richiesto.');
    }
    const headers = { 'Cache-Control': 'no-store' };
    for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) { const value = upstream.headers.get(name); if (value) headers[name] = value; }
    res.writeHead(upstream.status, headers);
    if (req.method === 'HEAD') { await upstream.body?.cancel(); res.end(); return; }
    try { await pipeline(Readable.fromWeb(upstream.body), res); } catch { res.destroy(); }
  }
}
