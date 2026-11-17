import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { playerFullscreen } from '../public/video-player.js';

// 13/11: «quando clicchi Riproduci te lo apre a mezzo schermo intero, poi devi premere Schermo intero».
// Chrome rifiutava lo schermo intero chiesto sul <dialog>: ora si chiede per il riquadro del video, come il tasto.
test('telefono, tablet e app: schermo intero subito', () => {
  assert.deepEqual(playerFullscreen({ tv: false, coarse: true, android: true }), { videoMode: true, fullscreen: true });
  assert.deepEqual(playerFullscreen({ tv: false, coarse: true, android: false }), { videoMode: false, fullscreen: true });
});

test('TV e computer: nessun cambio automatico', () => {
  assert.deepEqual(playerFullscreen({ tv: true, coarse: true, android: true }), { videoMode: false, fullscreen: false });
  assert.deepEqual(playerFullscreen({ tv: false, coarse: false, android: false }), { videoMode: false, fullscreen: false });
});

test('lo schermo intero automatico è chiesto al riquadro del video, mai al dialog', () => {
  const src = readFileSync(new URL('../public/video-player.js', import.meta.url), 'utf8');
  assert.match(src, /full\.fullscreen && !document\.fullscreenElement\) stage\.requestFullscreen/);
  assert.doesNotMatch(src, /dialog\.requestFullscreen/);
});

test('il video ha una copertina trasparente: niente immagine grigia/bianca di Android prima del primo fotogramma', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<video id="video"[^>]*poster="data:image\/gif;base64,/);
});
