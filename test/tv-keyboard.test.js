import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardRows,editText } from '../public/tv/keyboard.js';
test('TV: tastiera completa, testo limitato, spazio e cancellazione unicode',()=>{
 const ids=keyboardRows().flatMap(r=>r.items);for(const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')assert(ids.includes(`key:${ch}`));
 assert.equal(editText('Lu','key:N',35),'Lun');assert.equal(editText('Luna','space',35),'Luna ');assert.equal(editText('Luna 🌙','delete',35),'Luna ');assert.equal(editText('x','clear',35),'');assert.equal(editText('a'.repeat(35),'key:B',35),'a'.repeat(35));assert.equal(editText('Luna','done',35),'Luna');
});
