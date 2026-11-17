import test from 'node:test';
import assert from 'node:assert/strict';
import * as ui from '../public/tv/ui.js';
test('Giro 2: geometria poster e selezione 16:9 senza sovrapposizioni né animazione delle dimensioni',()=>{
  assert.equal(typeof ui.railLayout,'function');
  const layout=ui.railLayout(20,4,true);
  assert.equal(layout.cards[4].width/layout.height,16/9);
  assert.equal(layout.cards[3].width/layout.height,2/3);
  for(let i=1;i<layout.cards.length;i++)assert(layout.cards[i].left>=layout.cards[i-1].left+layout.cards[i-1].width+23);
  assert(layout.visible.length<=10);assert(layout.visible.includes(4));
  const last=ui.railLayout(20,19,true);assert(last.cards[19].left-last.offset+last.cards[19].width<=1680.01);
});
test('Giro 2: Top 10 riserva spazio al numero anche quando è 10',()=>{
  assert.equal(typeof ui.railLayout,'function');const layout=ui.railLayout(10,9,true,true);
  assert(layout.numberWidth>=100);assert(layout.cards[9].left-layout.offset+layout.cards[9].width<=1680.01);
  assert(layout.visible.includes(9));
});
