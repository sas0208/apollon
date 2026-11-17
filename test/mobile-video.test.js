import test from 'node:test';
import assert from 'node:assert/strict';
import { tapGesture } from '../public/video-player.js';
import { fixture } from './helpers.js';

test('doppio/triplo tocco: ±10/20 secondi, cambio lato e pausa ricominciano il gesto', () => {
  for (const [x,sign] of [[.1,-1],[.9,1]]) {
    const first=tapGesture(null,x,1000), second=tapGesture(first,x,1100), third=tapGesture(second,x,1200);
    assert.equal(first.seconds,0); assert.equal(second.seconds,sign*10); assert.equal(third.seconds,sign*10); assert.equal(third.total,sign*20);
    assert.equal(tapGesture(third,1-x,1300).seconds,0);
    assert.equal(tapGesture(third,x,1600).seconds,0);
    assert.equal(tapGesture(third,.5,1300).seconds,0);
  }
});

test('anteprima mobile mancante non avvia ffmpeg né cambia la coda TV', async t => {
  const f=await fixture();t.after(()=>f.close());const item=await f.video();
  const r=await f.request(`/media/${item.id}/trickplay?cached=1&playing=1`);
  assert.equal(r.status,202);assert.equal((await r.json()).ready,false);assert.equal(f.app.trickplay.queue.size,0);assert.equal(f.app.trickplay.task,null);
});
