import test from 'node:test';
import assert from 'node:assert/strict';
import { rectTransform, motionOptions } from '../public/music-motion.js';

test('player: percorso della copertina parte esattamente dal mini, con scala e posizione', () => {
  assert.equal(rectTransform({ left: 20, top: 700, width: 40, height: 40 }, { left: 30, top: 100, width: 300, height: 300 }), 'translate(-10px, 600px) scale(0.13333333333333333, 0.13333333333333333)');
  assert.equal(rectTransform({}, { width: 0, height: 0 }), 'none');
});
test('player: telefono 300 ms, desktop e TV più brevi, movimento ridotto 90 ms', () => {
  assert.equal(motionOptions({ phone: true }).duration, 300);
  assert.equal(motionOptions().duration, 180);
  assert.equal(motionOptions({ phone: true, tv: true }).duration, 180);
  assert.equal(motionOptions({ reduced: true, phone: true }).duration, 90);
});
