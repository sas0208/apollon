import test from 'node:test';
import assert from 'node:assert/strict';
import { parseName } from '../lib/library.js';
import { rangeFor, subtitlesToVtt } from '../lib/media.js';
import { validRelative } from '../lib/files.js';

test('riconosce serie, stagioni e anime con numerazione assoluta', () => {
  const serie = parseName('Viaggio/Season 02/Viaggio.S02E03.Il.ritorno.1080p.mkv', 'Film');
  assert.equal(serie.series, 'Viaggio'); assert.equal(serie.season, 2); assert.equal(serie.episode, 3); assert.equal(serie.title, 'Il ritorno');
  assert.equal(parseName('Viaggio - 024 [1080p].mp4', 'Anime').episode, 24);
  assert.equal(parseName('Casa 1x07.mp4', 'Film').season, 1);
  assert.equal(parseName('Casa S01.E07.mp4', 'Film').episode, 7);
  assert.equal(parseName('Casa/Stagione 2/03 - Ritorno.mp4', 'Film').series, 'Casa');
  assert.equal(parseName('Casa/Stagione 2/03 - Ritorno.mp4', 'Film').season, 2);
  assert.equal(parseName('Un film (2024).mp4', 'Film').year, 2024);
  assert.equal(parseName('Un film (2024).mp4', 'Film').title, 'Un film');
  assert.equal(parseName('Sole.mp4', 'Anime').kind, 'anime');
});
test('range aperti, suffissi, limiti e richieste malformate', () => {
  assert.deepEqual(rangeFor('bytes=2-5', 10), { start: 2, end: 5 });
  assert.deepEqual(rangeFor('bytes=8-', 10), { start: 8, end: 9 });
  assert.deepEqual(rangeFor('bytes=-3', 10), { start: 7, end: 9 });
  assert.deepEqual(rangeFor('bytes=0-999', 10), { start: 0, end: 9 });
  for (const range of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=-', 'x']) assert.throws(() => rangeFor(range, 10), { status: 416 });
});
test('SRT e ASS convertiti per il browser senza comandi di stile', () => {
  assert.match(subtitlesToVtt('1\n00:00:01,000 --> 00:00:02,000\nCiao', '.srt'), /WEBVTT[\s\S]*00:00:01.000/);
  const ass = '[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.20,0:00:03.40,Default,,0,0,0,,{\\i1}Ciao\\Nmondo, qui';
  assert.match(subtitlesToVtt(ass, '.ass'), /00:00:01.200 --> 00:00:03.400\nCiao\nmondo, qui/);
  assert.doesNotMatch(subtitlesToVtt(ass, '.ass'), /\\i1/);
});
test('nomi pericolosi e cartelle nascoste sono rifiutati', () => {
  for (const value of ['../a.mp4', '/a.mp4', 'a/../../b', 'C:/a', 'x\\y.mp4', '.segreto/a', 'a//b', 'CON.mp4', 'fine./a', 'a:stream']) assert.throws(() => validRelative(value));
  assert.equal(validRelative('Serie/Stagione 1/È casa S01E02.mp4'), 'Serie/Stagione 1/È casa S01E02.mp4');
});

test('gli anime scaricati «Titolo - Ep 37» diventano episodi della serie', () => {
  assert.deepEqual(parseName('Stellar Sentinels/Stellar Sentinels - Ep 37.mp4', 'Anime'), { title: 'Episodio 37', series: 'Stellar Sentinels', season: 1, episode: 37, year: null, kind: 'episode' });
  assert.equal(parseName('Hunter x Hunter (2011)/Hunter x Hunter (2011) - Ep 115.mp4', 'Film').series, 'Hunter x Hunter (2011)');
  assert.equal(parseName('Step Up.mkv', 'Film').series, null);
  assert.equal(parseName('Pep Guardiola.mp4', 'Film').series, null);
});

test('cartella di stagione: il nome prima di S01E02 è il titolo dell\'episodio (15/11)', () => {
  const e = parseName('Dark/S01/Bugie S01E02 [1080p].mkv', 'Serie');
  assert.equal(e.series, 'Dark'); assert.equal(e.title, 'Bugie'); assert.equal(e.season, 1); assert.equal(e.episode, 2);
  assert.equal(parseName("Dark Matter/S02/Ogni cosa e bellezza, ogni cosa e spaventosa S02E03 [1080p].mkv", 'Serie').series, 'Dark Matter');
  assert.equal(parseName('Viaggio/Season 02/Viaggio.S02E03.Il.ritorno.1080p.mkv', 'Film').title, 'Il ritorno');
  assert.equal(parseName('Dark/S01/Dark S01E02.mkv', 'Serie').title, 'Episodio 2');
  assert.equal(parseName('Bugie S01E02.mkv', 'Serie').series, 'Bugie');
});

test('17/11: nei film il nome del file dopo l anno non entra nel titolo', () => {
  const f = parseName('Film/The Cloverfield Paradox (2018)/The.Cloverfield.Paradox.2018.iTA.ENG.AC3.SUB.iTA.ENG.BluRay.HEVC.1080p.x265.gruppo-Rilascio.mkv', 'Film');
  assert.equal(f.title, 'The Cloverfield Paradox'); assert.equal(f.year, 2018);
  assert.equal(parseName('Film/The Cloverfield Paradox (2018) [720p].mkv', 'Film').title, 'The Cloverfield Paradox');
  assert.equal(parseName('Blade Runner 2049.mkv', 'Film').title, 'Blade Runner 2049');
  assert.equal(parseName('Blade.Runner.2049.2017.1080p.mkv', 'Film').title, 'Blade Runner 2049');
  assert.equal(parseName('Blade.Runner.2049.2017.1080p.mkv', 'Film').year, 2017);
  assert.equal(parseName('2001 Odissea nello spazio.mkv', 'Film').title, '2001 Odissea nello spazio');
  assert.equal(parseName('Un film (2024).mp4', 'Film').title, 'Un film');
});
