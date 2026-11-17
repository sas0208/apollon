import test from 'node:test';
import assert from 'node:assert/strict';
import { gestureAxis, gestureAction, bindPlayerGesture } from '../public/music-gestures.js';
const swipe = (data = {}) => gestureAction({ mode: 'mini', axis: 'x', width: 390, height: 800, dx: 0, dy: 0, ...data });
test('gesti: zona morta e diagonali non catturano tocchi o scroll incerti', () => {
  assert.equal(gestureAxis(5, 8), null); assert.equal(gestureAxis(30, 28), null);
  assert.equal(gestureAxis(35, 15), 'x'); assert.equal(gestureAxis(10, -40), 'y');
});
test('gesti: mini e copertina, soglia, velocità e direzioni prima/dopo', () => {
  assert.equal(swipe({ dx: -40 }), null); assert.equal(swipe({ dx: -90 }), 'next');
  assert.equal(swipe({ mode: 'cover', dx: 90 }), 'previous');
  assert.equal(swipe({ dx: -30, vx: -.7 }), 'next');
  assert.equal(swipe({ dx: -20, vx: -3 }), null); assert.equal(swipe({ dx: -30, vx: 1 }), null);
  assert.equal(swipe({ axis: 'y', dy: -60 }), 'open'); assert.equal(swipe({ axis: 'y', dy: 60 }), null);
});
test('gesti: chiudi oltre 30% o colpo rapido, solo verso il basso e in cima', () => {
  assert.equal(swipe({ mode: 'cover', axis: 'y', dy: 239 }), null);
  assert.equal(swipe({ mode: 'cover', axis: 'y', dy: 241 }), 'close');
  assert.equal(swipe({ mode: 'handle', axis: 'y', dy: 40, vy: .8 }), 'close');
  assert.equal(swipe({ mode: 'cover', axis: 'y', dy: 400, atTop: false }), null);
  assert.equal(swipe({ mode: 'cover', axis: 'y', dy: -400 }), null);
  assert.equal(swipe({ mode: 'handle', dx: -200 }), null);
});
function surface() {
  const events = {}; const styles = {}; const classes = new Set();
  return { events, styles, classes, clientWidth: 390, clientHeight: 800, scrollTop: 0,
    style: { set transform(v) { styles.transform = v; }, removeProperty(k) { delete styles[k]; } },
    classList: { add: k => classes.add(k), remove: k => classes.delete(k) },
    addEventListener: (name, fn) => { events[name] = fn; },
    send(name, x, y, extra = {}) { events[name]?.({ pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0,
      clientX: x, clientY: y, timeStamp: 1000, target: { closest: () => false }, preventDefault() {}, ...extra }); }
  };
}
test('pointer: segue il dito, annullamento ripristina e un controllo non attiva gesti', () => {
  const n = surface(); const calls = [];
  bindPlayerGesture(n, { mode: 'mini', enabled: () => true, perform: a => calls.push(a) });
  n.send('pointerdown', 200, 10); n.send('pointermove', 60, 10);
  assert.equal(n.styles.transform, 'translateX(-140px)');
  n.send('pointercancel', 60, 10); assert.equal(n.styles.transform, undefined); assert.equal(calls.length, 0);
  n.send('pointerdown', 200, 10, { target: { closest: () => true } }); n.send('pointermove', 10, 10); n.send('pointerup', 10, 10);
  assert.equal(calls.length, 0);
  n.send('pointerdown', 200, 10); n.send('pointermove', 60, 10); n.send('pointerup', 60, 10);
  assert.deepEqual(calls, ['next']);
});
test('pointer: copertina scorre la pagina già spostata senza chiuderla; mouse escluso', () => {
  const n = surface(); n.scrollTop = 200; const calls = [];
  bindPlayerGesture(n, { mode: 'cover', scroller: n, enabled: () => true, perform: a => calls.push(a) });
  n.send('pointerdown', 30, 30); n.send('pointermove', 30, 400); n.send('pointerup', 30, 400);
  assert.equal(n.scrollTop, 0); assert.deepEqual(calls, []);
  n.send('pointerdown', 200, 10, { pointerType: 'mouse' }); n.send('pointermove', 10, 10); n.send('pointerup', 10, 10);
  assert.equal(calls.length, 0);
});
