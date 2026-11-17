// The server owns presence and command delivery; native audio stays on the receiver.
export const deviceConnection = (cryptoApi = globalThis.crypto) => Array.from(cryptoApi.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
const wireQueue = queue => queue.map(s => Object.fromEntries(['id', 'title', 'artist', 'album', 'albumId', 'artistId', 'coverArt', 'duration', 'addedBy'].filter(k => s[k] !== undefined).map(k => [k, s[k]])));
export class DeviceClient {
  constructor(c) {
    this.c = c; this.scope = c.key(); this.connection = deviceConnection(); this.sequence = 0; this.devices = []; this.guestOf = '';
    this.target = sessionStorage.getItem(`${this.scope}:target`) || ''; this.chain = Promise.resolve();
    try { this.seen = new Set(JSON.parse(sessionStorage.getItem(`${this.scope}:commands`) || '[]')); } catch { this.seen = new Set(); }
  }
  isRemote() { return !!this.guestOf || (!!this.target && this.target !== this.id); }
  remote() { return this.devices.find(d => d.id === this.target); }
  async post(path, data) { return this.c.api(`/api/music/devices/${path}`, { method: 'POST', data: { ...data, profile: this.profile } }); }
  async start() {
    const lifecycle = this.lifecycle = (this.lifecycle || 0) + 1;
    this.stopped = false;
    this.profile = this.c.state.profile;
    const key = `${this.scope}:device`;
    const previousId = sessionStorage.getItem(key);
    const d = await this.post('register', { id: previousId, connection: this.connection, name: sessionStorage.getItem(`${this.scope}:name`) || this.defaultName() });
    if (this.stopped || this.lifecycle !== lifecycle || this.c.key() !== this.scope) return;
    this.id = d.id; sessionStorage.setItem(key, d.id);
    if (!this.target || this.target === previousId) this.target = this.id;
    this.stream = new EventSource(`/api/music/devices/events?id=${encodeURIComponent(d.id)}&profile=${encodeURIComponent(this.profile)}`);
    this.stream.onmessage = e => { try { this.event(JSON.parse(e.data)); } catch { /* A later snapshot repairs a lost event. */ } };
    this.stream.onerror = () => { this.status('Ricollego i dispositivi di casa…'); };
    if (this.isRemote()) this.c.pauseLocal();
    else await this.publish();
    if (this.stopped || this.lifecycle !== lifecycle || this.c.key() !== this.scope) return;
    this.timer = setInterval(() => { if (!this.isRemote() && !this.executing) this.publish().catch(() => {}); }, 1000);
    this.capture = event => this.intercept(event); document.addEventListener('click', this.capture, true); document.addEventListener('input', this.capture, true);
  }
  defaultName() { return /Android|iPhone/i.test(navigator.userAgent) ? 'Telefono di casa' : 'Browser di casa'; }
  status(message) { const button = document.querySelector('#music-devices'); if (button) button.textContent = message || (this.guestOf ? 'In sessione insieme' : this.isRemote() ? `Su ${this.remote()?.name || 'altro dispositivo'}` : 'Dispositivi di casa'); }
  event(e) {
    if (this.stopped || this.c.key() !== this.scope) return;
    if (e.type === 'devices') this.devices = e.devices;
    if (e.type === 'state') {
      const at = this.devices.findIndex(d => d.id === e.device.id), previous = this.devices[at];
      const device = { ...e.device, state: { ...e.device.state, queue: e.device.state.queue ?? previous?.state?.queue ?? [] } };
      if (at < 0) this.devices.push(device); else if (device.version >= previous.version) this.devices[at] = device;
    }
    if (e.type === 'devices' || e.type === 'state') {
      const target = this.remote(); if (this.isRemote() && !this.guestOf && target?.state) this.c.mirror(target.state);
      this.status(this.isRemote() && !this.guestOf && !target?.online ? 'Dispositivo scollegato · scegli dove ascoltare' : ''); if (e.type === 'devices') this.draw?.();
    }
    if (e.type === 'session') this.guestOf = e.session.host !== this.id ? e.session.sid : '';
    if (e.type === 'session-end' && e.sid === this.guestOf) this.guestOf = '';
    if (e.type?.startsWith('session')) { this.status(); this.loadTogether().then(t => t.event(e)).catch(ex => this.c.notify(ex.message, true)); }
    if (e.type === 'command') {
      this.chain = this.chain.then(async () => {
        if (this.stopped || this.c.key() !== this.scope) return;
        this.executing = true; let error = '';
        try {
          if (!this.seen.has(e.commandId)) {
            this.seen.add(e.commandId); if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value);
            sessionStorage.setItem(`${this.scope}:commands`, JSON.stringify([...this.seen]));
            this.target = this.id; sessionStorage.setItem(`${this.scope}:target`, this.id);
            await this.c.execute(e.op, e.payload);
          }
        } catch (ex) { error = ex.message; this.c.notify(error, true); }
        finally { await this.publish(e.commandId, error).catch(() => {}); this.executing = false; }
      });
    }
    if (e.type === 'ack' && e.error) this.c.notify(e.error, true);
    if (e.type === 'replaced') { this.stop(); this.status('Pagina duplicata · ricarica per ricollegare'); }
  }
  async publish(commandId, error) {
    if (this.stopped) return;
    const snapshot = this.c.snapshot();
    const state = { ...snapshot, queue: wireQueue(snapshot.queue) }; const serialized = JSON.stringify(state), queue = JSON.stringify(state.queue);
    if (!commandId && serialized === this.lastPublished) return;
    const sequence = ++this.sequence;
    await this.post('state', { id: this.id, connection: this.connection, sequence, state: queue === this.lastQueue ? { ...state, queue: undefined } : state, commandId, error });
    if (sequence === this.sequence && !this.stopped) { this.lastPublished = serialized; this.lastQueue = queue; }
  }
  loadTogether() { return this.togetherReady ||= import('./music-session.js').then(m => this.together = new m.Together(this)); }
  async send(op, payload = {}) {
    if (this.guestOf) throw new Error('Stai ascoltando insieme: aggiungi i brani dalla finestra “Ascoltiamo insieme”.');
    if (!this.remote()?.online) throw new Error('Il dispositivo non è collegato. Riapri Apollon o scegli questo dispositivo.');
    if (payload.queue) payload = { ...payload, queue: wireQueue(payload.queue) };
    return this.post('command', { from: this.id, target: this.target, op, payload });
  }
  intercept(e) {
    if (!this.isRemote()) return;
    const target = e.target.closest('button,input'); if (!target) return;
    const id = target.id; let op, payload = {};
    if (e.type === 'click') {
      if (['audio-toggle', 'full-toggle'].includes(id)) op = (this.guestOf ? this.together?.state : this.remote()?.state)?.paused ? 'play' : 'pause';
      if (['audio-next', 'full-next'].includes(id)) op = 'next';
      if (['audio-prev', 'full-prev'].includes(id)) op = 'previous';
    } else {
      if (['audio-seek', 'full-seek'].includes(id)) { op = 'seek'; payload.position = Number(target.value); }
      if (id === 'volume') { op = 'volume'; payload.volume = Number(target.value); }
    }
    if (!op || (this.guestOf && !['play', 'pause', 'next'].includes(op))) return; e.preventDefault(); e.stopImmediatePropagation();
    (this.guestOf ? this.post('session/control', { id: this.id, op }) : this.send(op, payload)).catch(ex => this.c.notify(ex.message, true));
  }
  async select(id) {
    if (this.selecting || id === this.target) return;
    this.selecting = true;
    const previousTarget = this.target;
    const snapshot = this.isRemote() ? this.remote()?.state : this.c.snapshot();
    let paused = false;
    try {
      if (this.isRemote() && this.remote()?.online) await this.send('pause');
      this.c.pauseLocal(); paused = true; this.target = id; sessionStorage.setItem(`${this.scope}:target`, id);
      if (id === this.id) { if (snapshot) await this.c.execute('transfer', snapshot); await this.publish(); }
      else if (snapshot?.queue.length) await this.send('transfer', snapshot);
      else if (this.remote()?.state) this.c.mirror(this.remote().state);
    } catch (error) {
      this.target = previousTarget; sessionStorage.setItem(`${this.scope}:target`, previousTarget);
      if (paused && snapshot?.queue.length && !this.stopped && this.c.key() === this.scope) {
        try {
          if (previousTarget === this.id) await this.c.execute('transfer', snapshot);
          else if (this.remote()?.online) await this.send('transfer', snapshot);
        } catch { this.c.notify?.('Il passaggio non è riuscito. Tocca Riproduci sul dispositivo precedente.', true); }
      }
      throw error;
    } finally { this.selecting = false; this.status(); this.draw?.(); }
  }
  show() {
    const { el, action } = this.c; const dialog = el('dialog', { class: 'devices-dialog', 'aria-label': 'Dispositivi di casa' }); const list = el('div', { class: 'menu-actions' });
    const rename = el('input', { value: this.devices.find(d => d.id === this.id)?.name || this.defaultName(), maxlength: '50', 'aria-label': 'Nome di questo dispositivo' });
    this.draw = () => list.replaceChildren(...this.devices.map(d => el('button', { class: 'secondary', disabled: !d.online && d.id !== this.id, 'aria-pressed': d.id === this.target, 'data-device-id': d.id, onclick: action(() => this.select(d.id)) }, `${d.name}${d.id === this.id ? ' · questo dispositivo' : ''}${d.online ? '' : ' · scollegato'}`)));
    dialog.append(el('div', { class: 'dialog-heading' }, el('h2', {}, 'Dove vuoi ascoltare?'), el('button', { class: 'quiet', onclick: () => dialog.close(), 'aria-label': 'Chiudi dispositivi' }, 'Chiudi')), el('p', { class: 'muted' }, 'Apri Apollon con lo stesso utente e profilo sui dispositivi di casa. Sul dispositivo scelto può servire un primo tocco su Riproduci per consentire l’audio.'), list, el('div', { class: 'devices-sessions' }), el('button', { class: 'secondary', onclick: action(async () => { dialog.close(); (await this.loadTogether()).open(); }) }, 'Ascoltiamo insieme'), el('label', {}, 'Nome di questo dispositivo', rename), el('button', { class: 'secondary', onclick: action(async () => { const d = await this.post('register', { id: this.id, connection: this.connection, name: rename.value }); sessionStorage.setItem(`${this.scope}:name`, d.name); }) }, 'Salva nome'));
    dialog.addEventListener('close', () => { this.draw = null; dialog.remove(); }, { once: true }); document.body.append(dialog); this.draw(); this.c.showModal(dialog); this.loadTogether().then(t => t.fill(dialog.querySelector('.devices-sessions'))).catch(() => {});
  }
  stop() { this.stopped = true; this.lifecycle = (this.lifecycle || 0) + 1; this.stream?.close(); clearInterval(this.timer); document.removeEventListener('click', this.capture, true); document.removeEventListener('input', this.capture, true); }
}
