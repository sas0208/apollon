import test from 'node:test';
import assert from 'node:assert/strict';
import { marqueePlan, vibrate, changeMusicPage } from '../public/music-feedback.js';
test('titoli: nessuna animazione se entrano; 25 px/s e pause di 1,6 s ai bordi', () => {
  for (const value of [0, 1, -20, NaN]) assert.equal(marqueePlan(value), null);
  const plan = marqueePlan(100); assert.equal(plan.duration, 11200);
  assert.equal(plan.frames[1].offset * plan.duration, 1600);
  assert.equal(plan.frames[2].offset * plan.duration, 5600);
  assert.equal(plan.frames[3].transform, 'translateX(-100px)');
});
test('vibrazione: opzionale, assenza e rifiuto API non interrompono il gesto', () => {
  const calls = []; const device = { vibrate: value => { calls.push(value); return true; } };
  assert.equal(vibrate(false, device), false); assert.deepEqual(calls, []);
  assert.equal(vibrate(true, device), true); assert.deepEqual(calls, [12]);
  assert.equal(vibrate(true, {}), false); assert.equal(vibrate(true, { vibrate() { throw Error(); } }), false);
});
test('pagine: rendering identico con/senza transizioni o API che rifiuta prima di renderizzare', async () => {
  let calls = 0; const render = () => { calls++; };
  await changeMusicPage(render, { doc: {} }); assert.equal(calls, 1);
  await changeMusicPage(render, { doc: { startViewTransition() { throw Error(); } } }); assert.equal(calls, 2);
  const doc = { startViewTransition(fn) { fn(); return { skipTransition() {}, updateCallbackDone: Promise.resolve(), finished: Promise.resolve() }; } };
  await changeMusicPage(render, { doc }); assert.equal(calls, 3);
  await changeMusicPage(render, { enabled: false, doc }); assert.equal(calls, 4);
});
