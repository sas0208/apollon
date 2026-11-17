import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Execute the real client handlers with a small DOM double. Geometry/native
// modality are checked separately in a real browser.
const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
function fixture() {
  const events = {}; const classes = new Set();
  const document = { body: {}, addEventListener: (name, fn) => { events[name] = fn; }, documentElement: { classList: {
    add: name => classes.add(name), toggle: (name, on) => on ? classes.add(name) : classes.delete(name)
  } } };
  const control = () => ({ tabIndex: 0, disabled: false, isConnected: true, getClientRects: () => [1], closest: () => null,
    focus() { document.activeElement = this; } });
  const opener = control(); opener.focus();
  const dialog = () => {
    const controls = [control(), control()]; const handlers = {};
    const node = { open: false, controls, contains: target => target === node || controls.includes(target),
      querySelectorAll: () => controls, querySelector: () => null, addEventListener: (name, fn) => { handlers[name] = fn; },
      showModal() { this.open = true; controls[0].focus(); },
      close() { this.open = false; }, closed() { handlers.close(); } };
    return node;
  };
  const player = dialog(); const menu = dialog(); const dialogs = { '#player': player, '#menu': menu };
  const context = vm.createContext({ document, $: id => dialogs[id], $$: () => Object.values(dialogs) });
  vm.runInContext(source.slice(source.indexOf('const dialogStack ='), source.indexOf('function closeDialogs()')), context);
  const show = id => context.showDialog(id);
  const tab = shiftKey => { let prevented = false; events.keydown({ key: 'Tab', shiftKey, preventDefault() { prevented = true; } }); return prevented; };
  return { document, events, classes, opener, player, menu, show, tab, control };
}

test('dialogo: focus iniziale, Tab/Shift+Tab ai bordi e ritorno al comando di apertura', () => {
  const f = fixture(); f.show('#player');
  assert.equal(f.document.activeElement, f.player.controls[0]); assert.ok(f.classes.has('has-dialog'));
  assert.equal(f.tab(true), true); assert.equal(f.document.activeElement, f.player.controls[1]);
  assert.equal(f.tab(false), true); assert.equal(f.document.activeElement, f.player.controls[0]);
  assert.equal(f.tab(false), false); // Interior movement is left to the browser.
  f.opener.focus(); f.events.focusin({ target: f.opener }); assert.equal(f.document.activeElement, f.player.controls[0]);
  f.player.close(); f.player.closed(); assert.equal(f.document.activeElement, f.opener); assert.ok(!f.classes.has('has-dialog'));
});

test('dialoghi sovrapposti: ordine di apertura, ritorno al padre e chiusure asincrone senza rubare focus', () => {
  const f = fixture(); f.show('#player'); f.show('#menu');
  f.menu.close(); f.menu.closed();
  assert.equal(f.document.activeElement, f.player.controls[0]); assert.ok(f.classes.has('has-dialog'));
  f.player.close(); f.opener.focus(); f.show('#menu');
  f.player.closed(); // Delayed close event after a different dialog was opened.
  assert.equal(f.document.activeElement, f.menu.controls[0]); assert.ok(f.classes.has('has-dialog'));
  f.menu.close(); f.menu.closed(); assert.equal(f.document.activeElement, f.opener);
  f.show('#player'); f.player.close();
  const destination = f.control(); destination.focus(); f.player.closed();
  assert.equal(f.document.activeElement, destination); // An explicit navigation owns its new focus.
});

test('un dialogo tolto dalla pagina mentre era aperto non ruba più il Tab al lettore', () => {
  // Collaudo 5/11/2026: dopo il giro B, Shift+Tab nel lettore del telefono restava fermo su «Chiudi».
  const f = fixture(); f.show('#menu'); f.menu.isConnected = false; // Rimosso dal DOM senza evento close.
  f.show('#player');
  f.player.controls[0].focus();
  assert.equal(f.tab(true), true); assert.equal(f.document.activeElement, f.player.controls[1]);
  f.player.close(); f.player.closed(); assert.ok(!f.classes.has('has-dialog'));
});

test('chiudendo la scheda si torna alla stessa card anche se il catalogo l’ha ricreata', () => {
  const f = fixture(); f.opener.dataset = { fk: 'anime|s:Campanelle' };
  f.show('#player'); f.opener.isConnected = false;
  const replacement = f.control(); replacement.dataset = { fk: f.opener.dataset.fk };
  f.document.querySelectorAll = () => [replacement];
  f.player.close(); f.document.activeElement = f.document.body; f.player.closed();
  assert.equal(f.document.activeElement, replacement);
});

test('i comandi dentro una sezione chiusa (equalizzatore) non contano come bordi del Tab', () => {
  // Collaudo 5/11/2026: le barre dell'equalizzatore chiuso hanno un riquadro ma non prendono il focus.
  const f = fixture();
  const closedDetails = { parentElement: null };
  const slider = { ...f.control(), parentElement: {}, matches: () => false, closest: sel => sel.startsWith('details') ? closedDetails : null };
  f.player.controls.push(slider);
  f.show('#player'); f.player.controls[0].focus();
  assert.equal(f.tab(true), true); assert.equal(f.document.activeElement, f.player.controls[1]);
  f.player.controls[1].focus();
  assert.equal(f.tab(false), true); assert.equal(f.document.activeElement, f.player.controls[0]);
});
