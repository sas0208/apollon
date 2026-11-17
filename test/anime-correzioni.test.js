// Correzioni dall'audit Anime: sottotitoli testuali offline, lingue senza codice, e le protezioni di profilo/corsa del client.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { subtitleURLs } from '../public/video-offline.js';
import { languageBadges, languageName } from '../public/video-logic.js';

const source = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

test('video scaricati: i sottotitoli incorporati di testo si salvano, quelli a immagine no, senza doppioni', () => {
  const item = { id: 'x', subtitles: [{ language: 'it' }], streams: [{ type: 'subtitle', codec: 'subrip', index: 3 }, { type: 'subtitle', codec: 'hdmv_pgs_subtitle', index: 4 }, { type: 'audio', codec: 'aac', index: 1 }] };
  assert.deepEqual(subtitleURLs(item), ['/media/x/subtitle/0', '/media/x/subtitle/s3']);
  assert.deepEqual(subtitleURLs({ id: 'y' }), []);
});

test('lingue: audio senza lingua non rompe i badge e «und»/«zxx» non contano', () => {
  assert.doesNotThrow(() => languageBadges([{ streams: [{ type: 'audio' }, { type: 'audio', language: 'zxx' }] }], true));
  assert.deepEqual(languageBadges([{ streams: [{ type: 'audio', language: 'und' }], subtitles: [{}] }], true), []);
  assert.equal(languageName(12), '12');
});

test('profilo cambiato a metà richiesta: le risposte vecchie non sovrascrivono i dati del nuovo profilo', async () => {
  const app = await source('app.js'); const video = await source('video-app.js');
  assert.match(app, /const profile = state\.profile; const version = state\.progressVersion[^]*?state\.profile === profile && \(state\.progressVersion/);
  assert.match(video, /async function toggleList[^]*?if \(profile !== state\.profile\) return;[^]*?list = result\.items/);
  assert.match(video, /async function saveWatched[^]*?if \(profile !== state\.profile \|\| progress !== state\.progress\) return;/);
  assert.match(video, /async function hideContinue[^]*?if \(profile !== state\.profile \|\| progress !== state\.progress\) return;[^]*?state\.progress\[entry\.hideId\] = saved/);
});

test('voti: un errore viene ricordato, così il ridisegno non rilancia la richiesta all’infinito', async () => {
  const video = await source('video-app.js');
  assert.match(video, /ratingCache\.set\(key, null\)/);
});

test('lettore: la chiusura invalida un playItem in attesa, così non si riapre da solo', async () => {
  const app = await source('app.js');
  assert.match(app, /const request = \+\+videoPlayRequest;/);
  assert.match(app, /if \(request !== videoPlayRequest \|\| profile !== state\.profile\) return;/);
  assert.match(app, /'close', \(\) => \{[\s\S]{0,300}?videoPlayRequest\+\+;/);
});

test('lettore: Escape chiude solo il pannello, seek con testo accessibile, audio non supportato disattivato', async () => {
  const player = await source('video-player.js');
  assert.match(player, /event\.key === 'Escape' && !\$\('#vp-panel'\)\.hidden[^]*?closePanel\(\)/);
  assert.match(player, /aria-valuetext/);
  assert.match(player, /node\.disabled = unavailable/);
  assert.match(player, /exitPictureInPicture/);
});

test('scheda titolo: la stagione scelta resta quella scelta', async () => {
  assert.match(await source('video-app.js'), /point\.item\.season\) : null;\s*open\.season = season;/);
});

test('service worker: serve anche i sottotitoli sN e la cache è stata alzata', async () => {
  const sw = await source('sw.js');
  assert.ok(sw.includes(String.raw`/\/subtitle\/s?\d+$/`));
  assert.ok(Number(sw.match(/mediateca-shell-v(\d+)'/)?.[1]) >= 41);
});
