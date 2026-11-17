import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { OnlineArt, normTitle } from '../lib/online-art.js';

const tool = createRequire(import.meta.url)('../tools/importa-loghi.cjs');
const tmp = () => mkdtemp(path.join(os.tmpdir(), 'loghi-'));
const rgba = (r, g, b, a, n = 50) => Buffer.from(Array.from({ length: n }, () => [r, g, b, a]).flat());

test('la normalizzazione dei titoli è la stessa nello strumento e nel server', () => {
  for (const title of ['Magi - The Labyrinth of Magic', 'Re:Zero’s “Café” – Ōkami/Kun', '  Chainsaw   Man ', '86 -Eighty Six-', 'Ishura']) assert.equal(tool.norm(title), normTitle(title));
  assert.equal(normTitle('Re:Zero’s Café – Ōkami/Kun'), 're zero s cafe okami kun');
});

test('classify: scuro e monocolore diventa bianco, colorato o chiaro resta com\'è, il trasparente conta zero', () => {
  assert.equal(tool.classify(rgba(0, 0, 0, 255)).white, true);
  assert.equal(tool.classify(rgba(20, 20, 30, 255)).white, true);
  assert.equal(tool.classify(Buffer.concat([rgba(200, 30, 30, 255, 25), rgba(10, 10, 10, 255, 25)])).white, false); // colorato (rosso e nero)
  assert.equal(tool.classify(rgba(240, 240, 240, 255)).white, false);
  assert.equal(tool.classify(Buffer.concat([rgba(0, 0, 0, 255, 90), rgba(220, 0, 0, 255, 10)])).white, false); // nero con contorno rosso (Gachiakuta)
  assert.equal(tool.classify(Buffer.concat([rgba(60, 60, 64, 255, 85), rgba(230, 230, 230, 255, 15)])).white, false); // fondo scuro con lettere chiare (Plunderer)
  assert.equal(tool.classify(Buffer.concat([rgba(0, 0, 0, 255, 10), rgba(255, 255, 255, 0, 500)])).white, true); // i pixel trasparenti non pesano
  assert.equal(tool.classify(rgba(0, 0, 0, 0)).white, false);
});

async function setup(files) {
  const dir = await tmp(); const logos = path.join(dir, 'loghi-locali'); await mkdir(logos);
  for (const [name] of Object.entries(files)) await writeFile(path.join(logos, name), 'png');
  await writeFile(path.join(logos, 'indice.json'), JSON.stringify(files));
  const online = await new OnlineArt({ dataDir: dir }, { data: {} }).init(); online.localEvery = 0;
  return { dir, logos, online };
}

test('logoFor: prima il logo locale (per titolo normalizzato), poi taizen', async () => {
  const { dir, logos, online } = await setup({ 'chainsaw-man.png': 'x' });
  await writeFile(path.join(logos, 'indice.json'), JSON.stringify({ 'chainsaw man': 'chainsaw-man.png', 'ghost entry': 'manca.png' }));
  assert.equal(online.logoFor('anime', { title: 'Chainsaw Man' }), path.join(logos, 'chainsaw-man.png'));
  assert.equal(online.logoFor('anime', { title: 'CHAINSAW  man!' }), path.join(logos, 'chainsaw-man.png'));
  assert.ok(online.logoVersion({ title: 'Chainsaw Man' }) > 0);
  assert.equal(online.logoFor('anime', { title: 'Ghost Entry' }), null); // nell'indice ma il file manca
  assert.equal(online.logoVersion({ title: 'Altro' }), 0);
  // Senza logo locale si usa quello di taizen scaricato.
  const key = online.keyFor('anime', { title: 'Black Clover' }); online.index[key] = { logo: 'bc-logo.png' };
  assert.equal(online.logoFor('anime', { title: 'Black Clover' }), path.join(dir, 'copertine-online', 'bc-logo.png'));
  // Se c'è entrambi vince il locale.
  await writeFile(path.join(logos, 'bc.png'), 'png'); await writeFile(path.join(logos, 'indice.json'), JSON.stringify({ 'black clover': 'bc.png' }));
  // Su Windows due scritture ravvicinate possono avere la stessa ora di modifica: la si sposta in avanti, come nel test sotto.
  const dopo = new Date(Date.now() + 5000); await utimes(path.join(logos, 'indice.json'), dopo, dopo);
  assert.equal(online.logoFor('anime', { title: 'Black Clover' }), path.join(logos, 'bc.png'));
});

test('l\'indice dei loghi locali si rilegge quando il file cambia (e non a ogni richiesta)', async () => {
  const { logos, online } = await setup({ 'a.png': 'x' });
  await writeFile(path.join(logos, 'indice.json'), JSON.stringify({ a: 'a.png' }));
  assert.ok(online.logoFor('anime', { title: 'A' }));
  await writeFile(path.join(logos, 'b.png'), 'png'); await writeFile(path.join(logos, 'indice.json'), JSON.stringify({ a: 'a.png', b: 'b.png' }));
  const later = new Date(Date.now() + 5000); await utimes(path.join(logos, 'indice.json'), later, later);
  const before = online.localAt; assert.ok(online.logoFor('anime', { title: 'B' })); assert.notEqual(online.localAt, before);
  online.localEvery = 60000; await writeFile(path.join(logos, 'indice.json'), '{}'); await utimes(path.join(logos, 'indice.json'), new Date(Date.now() + 9000), new Date(Date.now() + 9000));
  assert.ok(online.logoFor('anime', { title: 'B' }), 'entro l\'intervallo non rilegge');
});

test('config: localLogosDir personalizzata e posterConTitolo', async () => {
  const dir = await tmp(); const other = path.join(dir, 'altrove'); await mkdir(other);
  await writeFile(path.join(other, 'x.png'), 'png'); await writeFile(path.join(other, 'indice.json'), JSON.stringify({ x: 'x.png' }));
  const online = await new OnlineArt({ dataDir: dir, localLogosDir: other, posterConTitolo: ['abc'] }, { data: {} }).init();
  assert.equal(online.logoFor('anime', { title: 'X' }), path.join(other, 'x.png'));
  online.keyFor = () => 'abc'; assert.equal(online.posterHasTitle('anime', { title: 'X' }), true);
  online.keyFor = () => 'zzz'; assert.equal(online.posterHasTitle('anime', { title: 'X' }), false);
});

test('logoSmall: una sola conversione ffmpeg a 320 px, poi file in cache; senza ffmpeg torna l\'originale', async () => {
  const { logos, online } = await setup({ 'a.png': 'x' }); const calls = [];
  online.ffmpeg = async args => { calls.push(args); await writeFile(args.at(-1), 'piccolo'); };
  const file = path.join(logos, 'a.png');
  const [one, two] = await Promise.all([online.logoSmall(file), online.logoSmall(file)]);
  assert.equal(one, path.join(logos, 'piccoli', 'a-320.png')); assert.equal(two, one); assert.equal(calls.length, 1);
  assert.ok(calls[0].includes('-threads') && calls[0].join(' ').includes('min(320,iw)'));
  online.small.clear(); await online.logoSmall(file); assert.equal(calls.length, 1, 'riusa il file già fatto');
  const { logos: l2, online: o2 } = await setup({ 'b.png': 'x' }); assert.equal(await o2.logoSmall(path.join(l2, 'b.png')), path.join(l2, 'b.png'));
});
