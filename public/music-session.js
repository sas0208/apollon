// "Ascoltiamo insieme": caricato solo quando serve. Usa lo stesso canale dei dispositivi di casa (DeviceClient).
const ENDINGS = { closed: 'La sessione è stata chiusa.', removed: 'Chi ha aperto la sessione ti ha tolto.', hostgone: 'La sessione si è chiusa: il dispositivo che suonava è rimasto scollegato.', absent: 'Sei uscito dalla sessione: eri scollegato da troppo tempo.', left: 'Hai lasciato la sessione.' };
export const endMessage = reason => ENDINGS[reason] || 'La sessione è finita.';
export const addedLabel = song => song?.addedBy ? `Aggiunto da ${song.addedBy}` : '';
export const canControl = (view, id) => !!view && (view.host === id || view.guestsControl);
export const spacedCode = code => String(code).split('').join(' ');
export const queueSignature = state => state ? `${state.index}/${state.paused}/${(state.queue || []).map(s => `${s.id}:${s.addedBy || ''}`).join(',')}` : '';
const song = s => Object.fromEntries(['id', 'title', 'artist', 'album', 'albumId', 'artistId', 'coverArt', 'duration'].filter(k => s[k] !== undefined).map(k => [k, s[k]]));
export class Together {
  constructor(d) { this.d = d; this.c = d.c; this.view = null; this.state = null; this.version = -1; this.sessions = []; this.layout = ''; this.queueSig = ''; }
  get guest() { return !!this.view && this.view.host !== this.d.id; }
  post(verb, data = {}) { return this.d.post(`session/${verb}`, { id: this.d.id, ...data }); }
  event(e) {
    const wasGuest = this.guest;
    if (e.type === 'session') {
      this.view = e.session; if (e.state !== undefined) { this.state = e.state; this.version = -1; }
      if (this.guest && !wasGuest) this.c.pauseLocal();
      if (this.guest && this.state) this.c.mirror({ volume: 0.8, ...this.state });
    } else if (e.type === 'session-state' && this.view?.sid === e.sid && e.version >= this.version) {
      this.version = e.version; this.state = { ...e.state, queue: e.state.queue ?? this.state?.queue ?? [] };
      if (this.guest) this.c.mirror({ volume: 0.8, ...this.state });
    } else if (e.type === 'session-end' && this.view?.sid === e.sid) {
      this.view = null; this.state = null;
      if (wasGuest) this.c.mirror({ queue: [], index: 0, paused: true, position: 0, volume: 0.8 });
      this.c.notify(endMessage(e.reason));
    }
    this.draw(); this.paint();
  }
  async load() {
    const q = `?id=${encodeURIComponent(this.d.id)}&profile=${encodeURIComponent(this.d.profile)}`;
    const [list, mine] = await Promise.all([this.c.api(`/api/music/devices/session/list${q}`), this.c.api(`/api/music/devices/session/mine${q}`)]);
    if (mine.session) { this.d.event({ type: 'session', ...mine }); return false; }
    this.sessions = list.sessions; return true;
  }
  async refresh() { if (!this.view && this.dialog && await this.load()) this.draw(); }
  async enter(data) { const r = await this.post('join', data); this.d.event({ type: 'session', ...r }); this.c.notify('Sei dentro: ora ascolti insieme.'); }
  open() {
    if (this.dialog?.isConnected) return;
    const { el } = this.c; const dialog = this.dialog = el('dialog', { class: 'together-dialog', 'aria-label': 'Ascoltiamo insieme' });
    this.body = el('div', { class: 'together-body' }); this.layout = ''; this.queueSig = '';
    dialog.append(el('div', { class: 'dialog-heading' }, el('h2', {}, 'Ascoltiamo insieme'), el('button', { class: 'quiet', 'aria-label': 'Chiudi ascoltiamo insieme', onclick: () => dialog.close() }, 'Chiudi')), this.body);
    dialog.addEventListener('close', () => { clearInterval(this.poll); this.searchRequest?.abort(); this.dialog = null; dialog.remove(); }, { once: true });
    document.body.append(dialog); this.draw(); this.c.showModal(dialog);
    this.refresh().catch(e => this.c.notify(e.message, true)); let ticks = 0; this.poll = setInterval(() => { if (this.view) this.paint(); else if (++ticks % 5 === 0) this.refresh().catch(() => {}); }, 1000);
  }
  // Elenco delle sessioni della casa dentro la finestra dei dispositivi.
  async fill(box) {
    const { el, action } = this.c; if (this.view || !(await this.load().catch(() => false)) || !box.isConnected) return;
    box.replaceChildren(...this.sessions.map(s => el('button', { class: 'secondary', disabled: s.full, onclick: action(async () => { box.closest('dialog')?.close(); await this.enter({ sid: s.sid }); }) }, `Entra nella sessione di ${s.hostName}${s.device ? ` · ${s.device}` : ''} · ${s.people} ${s.people === 1 ? 'persona' : 'persone'}${s.full ? ' · piena' : ''}`)));
  }
  draw() {
    if (!this.dialog) return;
    const sig = JSON.stringify([this.view, this.view ? '' : this.sessions, this.d.isRemote(), this.c.state.queue.length > 0]);
    if (sig === this.layout) return; this.layout = sig; this.queueSig = '';
    const key = document.activeElement?.dataset?.k;
    this.body.replaceChildren(...(this.view ? this.session() : this.start()));
    if (key) this.body.querySelector(`[data-k="${key}"]`)?.focus();
    this.paint();
  }
  start() {
    const { el, action } = this.c; const can = !this.d.isRemote() && this.c.state.queue.length > 0;
    const code = el('input', { 'data-k': 'code', inputmode: 'numeric', maxlength: '4', pattern: '[0-9]{4}', autocomplete: 'off', required: true, 'aria-describedby': 'together-code-help' });
    return [el('p', { class: 'muted' }, 'Ascoltate insieme in casa: chi apre la sessione fa suonare la musica, gli altri entrano con un codice di 4 cifre, vedono cosa suona e aggiungono i loro brani alla coda comune.'),
      el('section', { class: 'together-section' }, el('h3', {}, 'Apri una sessione'),
        el('p', { class: 'muted' }, can ? 'La musica resta su questo dispositivo. Gli altri la vedono e aggiungono brani.' : 'Per aprire una sessione metti prima in ascolto un brano su questo dispositivo.'),
        el('button', { class: 'primary', 'data-k': 'open', disabled: !can, onclick: action(async () => { const r = await this.post('open'); this.d.event({ type: 'session', ...r }); }) }, 'Apri una sessione qui')),
      el('section', { class: 'together-section' }, el('h3', {}, 'Entra in una sessione'),
        el('div', { class: 'menu-actions together-list' }, ...(this.sessions.length ? this.sessions.map(s => el('button', { class: 'secondary', 'data-k': `s-${s.sid}`, disabled: s.full, onclick: action(() => this.enter({ sid: s.sid })) }, `Sessione di ${s.hostName}${s.device ? ` · ${s.device}` : ''} · ${s.people} ${s.people === 1 ? 'persona' : 'persone'}${s.full ? ' · piena' : ''}`)) : [el('p', { class: 'muted' }, 'Non ci sono sessioni aperte in casa.')])),
        el('form', { class: 'together-join', onsubmit: action(async e => { e.preventDefault(); await this.enter({ code: code.value.trim() }); }) },
          el('label', {}, 'Oppure scrivi il codice di 4 cifre', code), el('p', { id: 'together-code-help', class: 'muted' }, 'Lo trovi sul dispositivo che suona.'), el('button', { class: 'secondary', type: 'submit', 'data-k': 'join' }, 'Entra')))];
  }
  session() {
    const { el, action } = this.c; const v = this.view, host = !this.guest, me = this.d.id;
    this.nowText = el('p', { class: 'together-now' }); this.toggle = el('button', { class: 'primary', 'data-k': 'toggle', onclick: action(() => this.post('control', { op: this.state?.paused ? 'play' : 'pause' })) });
    this.next = el('button', { class: 'secondary', 'data-k': 'next', onclick: action(() => this.post('control', { op: 'next' })) }, 'Successivo');
    this.note = el('p', { class: 'muted', role: 'status' }); this.queueList = el('ol', { class: 'together-queue', 'aria-label': 'Coda comune' });
    const leave = host ? el('button', { class: 'secondary', 'data-k': 'close', onclick: action(async () => { await this.post('close'); }) }, 'Chiudi la sessione')
      : el('button', { class: 'secondary', 'data-k': 'leave', onclick: action(async () => { await this.post('leave'); this.d.event({ type: 'session-end', sid: v.sid, reason: 'left' }); }) }, 'Esci dalla sessione');
    return [el('section', { class: 'together-section' }, el('p', { class: 'muted' }, host ? 'Sessione aperta. Chi è in casa può entrare con questo codice:' : 'Stai ascoltando insieme. Il codice della sessione è:'),
        el('strong', { class: 'together-code', 'aria-label': `Codice ${spacedCode(v.code)}` }, v.code)),
      el('section', { class: 'together-section' }, el('h3', {}, `Chi partecipa (${v.members.length} su ${v.max})`),
        el('ul', { class: 'together-members' }, ...v.members.map(m => el('li', {}, el('span', {}, `${m.name}${m.id === me ? ' · tu' : ''}${m.host ? ' · ha aperto la sessione' : ''}${m.online ? '' : ' · scollegato'}`),
          ...(host && !m.host ? [el('button', { class: 'quiet', 'data-k': `kick-${m.id}`, 'aria-label': `Togli ${m.name} dalla sessione`, onclick: action(() => this.post('kick', { member: m.id })) }, 'Togli')] : [])))),
        ...(host ? [el('label', { class: 'check' }, el('input', { type: 'checkbox', 'data-k': 'allow', checked: v.guestsControl, onchange: action(e => this.post('setting', { guestsControl: e.target.checked })) }), 'Gli ospiti possono controllare la musica')] : [])),
      el('section', { class: 'together-section' }, el('h3', {}, 'Cosa suona'), this.nowText, ...(host ? [] : [el('div', { class: 'actions' }, this.toggle, this.next), this.note]), this.queueList),
      this.search(), el('div', { class: 'actions' }, leave)];
  }
  paint() {
    if (!this.dialog || !this.view || !this.nowText?.isConnected) return;
    const s = this.guest ? this.state : this.c.snapshot(), current = s?.queue?.[s.index], allowed = canControl(this.view, this.d.id);
    this.nowText.textContent = current ? `${s.paused ? 'In pausa' : 'Suona ora'}: ${current.title}${current.artist ? ` · ${current.artist}` : ''}` : 'Per ora non suona niente.';
    this.toggle.textContent = s?.paused ? 'Riproduci' : 'Pausa'; this.toggle.disabled = this.next.disabled = !allowed || !current;
    this.note.textContent = allowed ? '' : 'Chi ha aperto la sessione ha tolto i comandi agli ospiti. Puoi sempre aggiungere brani.';
    const sig = queueSignature(s); if (sig === this.queueSig) return; this.queueSig = sig;
    const { el } = this.c;
    this.queueList.replaceChildren(...(s?.queue || []).map((q, i) => el('li', { class: 'together-song', ...(i === s.index ? { 'aria-current': 'true' } : {}) },
      el('strong', {}, q.title), el('small', {}, [q.artist, i === s.index ? 'In ascolto' : '', addedLabel(q)].filter(Boolean).join(' · ')))));
  }
  search() {
    if (this.box) return this.box;
    const { el, action, api } = this.c;
    const input = el('input', { type: 'search', 'data-k': 'search', maxlength: '100', 'aria-label': 'Cerca un brano da aggiungere' }), message = el('p', { class: 'muted', role: 'status' }), results = el('ul', { class: 'together-results' });
    const form = el('form', { class: 'together-search', onsubmit: action(async e => {
      e.preventDefault(); this.searchRequest?.abort();
      const request = this.searchRequest = new AbortController();
      const q = input.value.trim(); if (!q) { message.textContent = ''; results.replaceChildren(); return; } message.textContent = 'Cerco…';
      try {
      const found = ((await api(`/api/music/search?q=${encodeURIComponent(q)}`, { signal: request.signal })).searchResult3?.song || []).slice(0, 8);
      if (request.signal.aborted || this.searchRequest !== request) return;
      message.textContent = found.length ? '' : 'Nessun brano trovato. Prova con altre parole.';
      results.replaceChildren(...found.map(s => el('li', {}, el('span', {}, el('strong', {}, s.title), ' ', el('small', {}, s.artist || '')),
        el('button', { class: 'secondary', 'aria-label': `Aggiungi ${s.title} alla coda comune`, onclick: action(async () => { await this.post('add', { songs: [song(s)] }); this.c.notify('Brano aggiunto alla coda comune.'); }) }, 'Aggiungi'))));
      } catch (error) { if (!request.signal.aborted) throw error; }
    }) }, input, el('button', { class: 'secondary', type: 'submit' }, 'Cerca'));
    return this.box = el('section', { class: 'together-section' }, el('h3', {}, 'Aggiungi un brano alla coda comune'), form, message, results);
  }
}
