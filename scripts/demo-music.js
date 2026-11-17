import path from 'node:path';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';

export function demoLyrics(id) {
  const versions = id === 'demo-1' ? [{ synced: true, lang: 'ita', line: [
    { start: 0, value: 'Una luce si accende piano' }, { start: 2000, value: 'La stanza si riempie di noi' },
    { start: 4000, value: 'Ogni nota trova la sua casa' }, { start: 6000, value: 'E il tempo si ferma un po’' },
    { start: 8000, value: 'Segui il suono, resta qui' }, { start: 10000, value: 'La sera sorride con noi' }
  ] }] : id === 'demo-2' ? [{ synced: false, lang: 'ita', line: [
    { value: 'Dopo la pioggia torna il sereno.' }, { value: 'Un passo leggero sul nostro cammino.' }, { value: 'Queste sono soltanto parole inventate per la prova.' }
  ] }] : [];
  return { lyricsList: { structuredLyrics: versions } };
}

// Only called with the synthetic demo folder or a temporary test fixture.
export async function prepareDemoMusic(root) {
  const folder = path.join(root, 'Libreria'); await mkdir(folder, { recursive: true });
  const songs = [1, 2, 3].map((n, i) => ({ id: `demo-${n}`, title: ['Luce di casa', 'Dopo la pioggia', 'L’ultima finestra'][i],
    path: `Libreria/Brano finto ${n}.wav`, artist: 'Suoni di prova', album: 'Una stanza tutta nostra', albumId: 'demo-album',
    artistId: 'demo-artist', coverArt: `demo-cover-${n}`, duration: 12, suffix: 'wav', bitRate: 353 }));
  for (const song of songs) await copyFile(path.join(root, 'Luce di casa.wav'), path.join(root, song.path));
  const data = { versione: 1, creato: '2026-11-04T00:00:00',
    mood: [{ nome: 'Energia', descrizione: 'Un po’ di slancio per cominciare.', brani: 1 }, { nome: 'Relax', descrizione: 'Rallenta. Questo momento è tuo.', brani: 2 },
      { nome: 'Concentrazione', descrizione: 'Spazio ai tuoi pensieri.', brani: 1 }, { nome: 'Notte', descrizione: 'Una luce accesa, il resto può aspettare.', brani: 1 }],
    generi: [{ nome: 'Elettronica', brani: 1 }, { nome: 'Suoni di prova', brani: 2 }],
    brani: songs.map((song, i) => ({ file: path.posix.basename(song.path), titolo: song.title, artista: song.artist, album: song.album,
      anno: '2026', durata: 12, genere: i ? 'Suoni di prova' : 'Elettronica', mood: [['Energia', 'Concentrazione'], ['Relax'], ['Relax', 'Notte']][i],
      energia: [85, 25, 18][i], bpm: [128, 75, 65][i], tonalita: 'La minore', playlist_utente: ['Playlist finta'] })) };
  await writeFile(path.join(folder, 'catalogo_musica.json'), JSON.stringify(data, null, 2));
  for (const [type, groups] of [['Mood', data.mood], ['Generi', data.generi]]) {
    const dir = path.join(folder, type); await mkdir(dir, { recursive: true });
    for (const group of groups) {
      const entries = data.brani.filter(b => type === 'Mood' ? b.mood.includes(group.nome) : b.genere === group.nome);
      await writeFile(path.join(dir, `${group.nome}.m3u8`), '#EXTM3U\n' + entries.map(b => `../${b.file}`).join('\n') + '\n');
    }
  }
  return songs;
}
