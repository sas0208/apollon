// Giro F: la logica (senza DOM) della parte video «da servizio di streaming»: titoli, righe della Home,
// titolo in evidenza del giorno, Continua a guardare, Novità, ricerca, badge delle lingue. Provata con node --test.
import { groupVideos, followingEpisode, quantity } from './logic.js';

const DAY = 86400000;
const unique = values => [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];
const fold = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('it');
export const hashText = text => [...String(text)].reduce((h, ch) => Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0, 2166136261);

const LANGUAGES = { ita: 'Italiano', it: 'Italiano', jpn: 'Giapponese', ja: 'Giapponese', jp: 'Giapponese', eng: 'Inglese', en: 'Inglese',
  fra: 'Francese', fre: 'Francese', fr: 'Francese', spa: 'Spagnolo', es: 'Spagnolo', deu: 'Tedesco', ger: 'Tedesco', de: 'Tedesco',
  kor: 'Coreano', ko: 'Coreano', chi: 'Cinese', zho: 'Cinese', zh: 'Cinese', por: 'Portoghese', pt: 'Portoghese' };
export function languageName(code) {
  const key = String(code || '').toLowerCase();
  if (!key || key === 'und' || key === 'sottotitoli') return 'Lingua non indicata';
  return LANGUAGES[key] || String(code).charAt(0).toUpperCase() + String(code).slice(1);
}
const isItalian = code => ['ita', 'it'].includes(String(code || '').toLowerCase());

export const episodeCode = item => item?.series ? `S${item.season}:E${item.episode}` : '';
export function durationText(seconds) {
  if (!(seconds > 0)) return '';
  const m = Math.max(1, Math.round(seconds / 60));
  return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
}
export function remainingText(position, duration) {
  const left = Math.max(0, (duration || 0) - (position || 0));
  if (!(duration > 0)) return '';
  const m = Math.ceil(left / 60);
  return m >= 60 ? `Mancano ${Math.floor(m / 60)} h ${m % 60} min` : `Mancano ${m} min`;
}

// SUB / DOPPIATO dalle lingue lette con ffprobe e dai sottotitoli accanto al file; HD/4K dalla risoluzione.
export function languageBadges(items, anime) {
  const audio = unique(items.flatMap(i => (i.streams || []).filter(s => s.type === 'audio').map(s => String(s.language || '').toLowerCase()))).filter(a => !['und', 'zxx'].includes(a));
  const subs = items.some(i => i.subtitles?.length || (i.streams || []).some(s => s.type === 'subtitle'));
  const height = Math.max(0, ...items.map(i => Math.max(0, ...(i.streams || []).filter(s => s.type === 'video').map(s => s.height || 0))));
  const badges = [];
  if (anime && audio.some(a => !isItalian(a) && a !== 'und') && subs) badges.push('SUB');
  if (anime && audio.some(isItalian)) badges.push('DOPPIATO');
  if (height >= 2000) badges.push('4K'); else if (height >= 700) badges.push('HD');
  return badges;
}

// Un «titolo» è un film o una serie intera, come nei servizi di streaming.
export function buildTitles(items, progress = {}) {
  return groupVideos(items, progress).map(group => {
    const all = group.episodes || [group.item];
    const kind = group.root === 'Anime' ? 'anime' : group.episodes ? 'series' : 'film';
    const key = group.episodes ? `s:${group.root}/${group.title}` : `f:${group.item.id}`;
    // Le immagini della serie vengono dall'episodio con una scelta fatta a mano, altrimenti dal primo.
    const art = [...all].sort((a,b) => artQuality(b) - artQuality(a))[0];
    const added = Math.max(0, ...all.map(i => i.added || i.mtime || 0));
    const firstAdded = Math.min(...all.map(i => i.added || i.mtime || 0));
    const years = all.map(i => i.year).filter(Boolean);
    const description = group.episodes ? (all.find(i => i.seriesDescription)?.seriesDescription || '') : (group.item.description || '');
    return { ...group, kind, key, art, added, firstAdded, year: group.year || (years.length ? Math.min(...years) : null),
      genres: unique(all.flatMap(i => i.genres || [])), tags: unique(all.flatMap(i => i.tags || [])), seasons: group.episodes ? unique(all.map(i => i.season)).sort((a, b) => a - b) : [],
      subs: all.some(i => i.subtitles?.length || (i.streams || []).some(s => s.type === 'subtitle')), description, score: all.find(i => i.onlineScore)?.onlineScore || null, badges: languageBadges(all, kind === 'anime'), duration: group.episodes ? null : group.item.duration || 0,
      remote: all.every(i => i.remote) ? all[0].remote : '', hasRemote: all.some(i => i.remote), remoteDown: all.every(i => i.remote && i.remoteDown),
      watched: all.every(i => progress[i.id]?.watched), started: all.some(i => progress[i.id]?.position > 0 || progress[i.id]?.watched) };
  });
}


// Le immagini dichiarate nell'API contano anche quando non esistono scelte manuali.
const artQuality = i => i ? (i.poster || i.backdrop || i.imagePath ? 8 : 0) + (i.images?.backdrop ? 4 : 0) + (i.images?.poster ? 2 : 0) + (i.images?.thumb || i.image ? 1 : 0) : 0;
export function artworkSources(title = {}, item, kind = 'thumb', size = 640) {
  const sources = []; const add = (i,k) => { if(i?.id && (i.images?.[k] || (k === 'thumb' && i.image))) sources.push(`/media/${i.id}/${k}?s=${size}&v=${encodeURIComponent(i.images?.v || 0)}`); };
  if(kind === 'thumb') add(item,'thumb');
  for(const k of kind === 'poster' ? ['poster','backdrop','thumb'] : ['backdrop','poster','thumb']) add(title.art || title.item || item,k);
  if(item !== title.art) for(const k of ['backdrop','poster','thumb']) add(item,k);
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const name=escape(String(title.title || item?.series || item?.title || 'Apollon').slice(0,85));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960" viewBox="0 0 640 960"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#62432d"/><stop offset="1" stop-color="#191715"/></linearGradient></defs><path fill="url(#a)" d="M0 0h640v960H0z"/><circle cx="510" cy="210" r="195" fill="none" stroke="#ff8c42" stroke-width="3"/><circle cx="510" cy="210" r="160" fill="none" stroke="#ff8c42" opacity=".3"/><path d="M230 290a105 105 0 1 0 130 130 95 95 0 0 1-130-130" fill="#ff8c42"/><foreignObject x="48" y="510" width="544" height="360"><div xmlns="http://www.w3.org/1999/xhtml" style="font:600 48px Arial;color:#f5f3ef;line-height:1.18;overflow-wrap:break-word">${name}</div></foreignObject></svg>`;
  return unique([...sources,`data:image/svg+xml,${encodeURIComponent(svg)}`]);
}

export const kindLabel = t => ({ film: 'Film', series: 'Serie TV', anime: 'Anime' }[t.kind]);
// Le due sezioni di Apollon (13/11): gli Anime da una parte, Film e Serie TV dall'altra.
export const SECTION_OF = { anime: 'anime', film: 'film-serie', series: 'film-serie' };
export const SECTION_NAMES = { anime: 'Anime', 'film-serie': 'Film e Serie TV' };
// Riga dati: anno · genere · durata, oppure «N stagioni» / «N episodi».
export function metaParts(t) {
  const length = t.episodes ? (t.seasons.length > 1 ? quantity(t.seasons.length, 'stagione', 'stagioni') : quantity(t.episodes.length, 'episodio', 'episodi')) : durationText(t.duration);
  return [t.year, t.genres[0] || kindLabel(t), length].filter(Boolean).map(String);
}

// Il titolo in evidenza cambia ogni giorno, preferendo quelli mai iniziati.
export function featuredTitle(titles, day = Math.floor(Date.now() / DAY)) {
  if (!titles.length) return null;
  const quality = t => (t.description?.trim() ? 2 : 0) + (artQuality(t.art) > 0 ? 1 : 0);
  const best = Math.max(...titles.map(quality)); const ready = titles.filter(t => quality(t) === best);
  const fresh = ready.filter(t => !t.started); const pool = fresh.length ? fresh : ready.filter(t => !t.watched).length ? ready.filter(t => !t.watched) : ready;
  const sorted = [...pool].sort((a, b) => a.key.localeCompare(b.key));
  return sorted[hashText(`giorno-${day}`) % sorted.length];
}

// I titoli che ruotano in evidenza sul telefono: prima quello del giorno, poi gli altri (mai iniziati per primi), sempre nello stesso ordine durante la giornata.
export function featuredTitles(titles, count = 6, day = Math.floor(Date.now() / DAY)) {
  const first = featuredTitle(titles, day); if (!first) return [];
  const rest = titles.filter(t => t.key !== first.key).sort((a, b) => Number(a.started) - Number(b.started) || hashText(`${day}${a.key}`) - hashText(`${day}${b.key}`));
  return [first, ...rest.slice(0, Math.max(0, count - 1))];
}
// Il tasto grande: «Riproduci» o «Continua E3»; nella scheda del titolo «Guarda E1» o «Continua E5».
export function shortPlayLabel(title, point, onSheet = false) {
  const code = title.episodes && point?.item ? (title.seasons.length > 1 ? `S${point.item.season} E${point.item.episode}` : `E${point.item.episode}`) : '';
  if (point?.resume) return code ? `Continua ${code}` : 'Continua';
  if (onSheet) return code ? `Guarda ${code}` : 'Guarda';
  return code && point.item !== title.episodes[0] ? `Riproduci ${code}` : 'Riproduci';
}
// Riga sotto la locandina e nella scheda: «11 episodi», «2 stagioni» o «Film».
export function shortKind(t, now = Date.now()) {
  if (!t.episodes) return 'Film';
  if (t.added - t.firstAdded > DAY && now - t.added < 7 * DAY) return 'Nuovo episodio';
  return t.seasons.length > 1 ? quantity(t.seasons.length, 'stagione', 'stagioni') : quantity(t.episodes.length, 'episodio', 'episodi');
}
// Generi separati da virgole e numero di episodi (o durata del film).
export function genreLine(t) {
  const length = t.episodes ? quantity(t.episodes.length, 'episodio', 'episodi') : durationText(t.duration);
  return [t.genres.slice(0, 4).join(', ') || kindLabel(t), length].filter(Boolean).join(' • ');
}

// Riga sopra le stelle nella scheda: «Sottotitolato» solo se ci sono sottotitoli, poi i generi (niente età: non la sappiamo).
export function detailLine(t) { return [t.subs ? 'Sottotitolato' : '', t.genres.slice(0, 4).join(', ') || kindLabel(t)].filter(Boolean).join(' • '); }

// «Altre info»: trama intera, durata, lingue dell'audio e dei sottotitoli (dai flussi e dai file accanto al video). Solo quello che c'è; il codice «und» non si mostra.
export function aboutInfo(t) {
  const items = t.episodes || [t.item].filter(Boolean);
  const names = codes => unique(codes.map(c => String(c || '').toLowerCase().split('.')[0]).filter(c => c && c !== 'und' && c !== 'sottotitoli' && c !== 'zxx').map(c => languageName(c)));
  const audio = names(items.flatMap(i => (i.streams || []).filter(s => s.type === 'audio').map(s => s.language)));
  const subs = names(items.flatMap(i => [...(i.streams || []).filter(s => s.type === 'subtitle').map(s => s.language), ...(i.subtitles || []).map(s => s.language)]));
  const duration = t.episodes ? [t.seasons.length > 1 ? quantity(t.seasons.length, 'Stagione', 'Stagioni') : '', quantity(t.episodes.length, 'Episodio', 'Episodi')].filter(Boolean).join(', ') : durationText(t.duration);
  return { description: t.description || '', duration, audio, subs };
}

// Da dove ripartire: l'episodio a metà, altrimenti il primo non visto dopo l'ultimo visto, altrimenti l'inizio.
export function resumePoint(title, items, progress = {}) {
  if (!title.episodes) {
    const p = progress[title.item.id];
    return { item: title.item, position: p && !p.watched ? p.position || 0 : 0, resume: !!(p?.position > 0 && !p.watched) };
  }
  // Si riparte dall'episodio a metà più recente oltre l'ultimo visto; altrimenti dal primo non visto dopo l'ultimo visto
  // (in qualunque ordine siano stati segnati); altrimenti dall'inizio. L'ordine in cui si preme «Segna visto» non conta.
  const ordered = title.episodes; const seen = i => !!progress[i.id]?.watched;
  const furthest = ordered.reduce((n, i, at) => seen(i) ? at : n, -1);
  const halfway = ordered.filter((i, at) => at >= Math.max(0, furthest) && !seen(i) && progress[i.id]?.position > 0)
    .sort((a, b) => (progress[b.id].updated || 0) - (progress[a.id].updated || 0))[0];
  if (halfway) return { item: halfway, position: progress[halfway.id].position, resume: true };
  const next = ordered.slice(furthest + 1).find(i => !seen(i));
  if (furthest >= 0 && next) return { item: next, position: 0, resume: true, next: true };
  const first = ordered.find(i => !seen(i)) || ordered[0];
  return { item: first, position: 0, resume: false };
}
export function playLabel(title, point) {
  if (!point) return 'Riproduci';
  const code = title.episodes ? ` ${episodeCode(point.item)}` : '';
  return point.resume ? `Riprendi${code}` : `Riproduci${title.episodes && point.item !== title.episodes[0] ? code : ''}`;
}

// «Continua a guardare»: un posto per titolo, il più recente in cima; «Togli dalla riga» lo nasconde.
export function continueEntries(titles, items, progress = {}) {
  const entries = [];
  for (const t of titles) {
    const touched = (t.episodes || [t.item]).filter(i => progress[i.id]?.updated);
    if (!touched.length) continue;
    const latest = touched.sort((a, b) => progress[b.id].updated - progress[a.id].updated)[0]; const p = progress[latest.id];
    if (p.hidden) continue;
    const point = resumePoint(t, items, progress);
    if (!point.resume) continue;
    const pp = progress[point.item.id] || {};
    entries.push({ title: t, item: point.item, position: point.position, duration: pp.duration || point.item.duration || 0, next: !!point.next, updated: p.updated, hideId: latest.id });
  }
  return entries.sort((a, b) => b.updated - a.updated).slice(0, 20);
}

export function similarTitles(title, titles, limit = 12) {
  const genres = new Set(title.genres);
  return titles.filter(t => t.key !== title.key).map(t => ({ t, score: t.genres.filter(g => genres.has(g)).length * 3 + (t.kind === title.kind ? 1 : 0) + (t.watched ? -2 : 0) }))
    .filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title, 'it')).slice(0, limit).map(x => x.t);
}
export function genreCounts(titles) {
  const counts = new Map();
  for (const t of titles) for (const g of t.genres) counts.set(g, (counts.get(g) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it')).map(([name, count]) => ({ name, count }));
}
// Famiglie da generi/tag ufficiali: nessuna deduzione dai titoli o dalle trame.
const ANIME_FAMILIES = [
  ['azione','Azione e battaglie',['action','azione','martial arts','battle royale','swordplay']],
  ['isekai','Isekai e altri mondi',['isekai','reincarnation','reincarnazione','alternate universe','virtual world']],
  ['fantasy','Fantasy',['fantasy','magic','magia']],
  ['dark-fantasy','Dark fantasy',['dark fantasy']],
  ['avventura','Avventura',['adventure','avventura']],
  ['soprannaturale','Soprannaturale',['supernatural','soprannaturale','demons','demoni','youkai','ghost']],
  ['psicologico','Psicologico e thriller',['psychological','psicologico','thriller','mystery','mistero','suspense']],
  ['commedia','Commedia',['comedy','commedia']],
  ['sport','Sport',['sports','sport']],
  ['mecha','Mecha e fantascienza',['mecha','sci-fi','science fiction','fantascienza','space','space opera']],
  ['romance','Romance',['romance','romantico','romantica']],
  ['quotidiano','Slice of life',['slice of life','vita quotidiana']]
];
const FILM_FAMILIES = [
  ['azione','Azione',['action','azione']],['avventura','Avventura',['adventure','avventura']],['commedia','Commedia',['comedy','commedia']],
  ['drammatico','Drammatico',['drama','drammatico']],['thriller','Thriller',['thriller','suspense']],['fantascienza','Fantascienza',['sci-fi','science fiction','fantascienza']],
  ['animazione','Animazione',['animation','animazione']],['famiglia','Famiglia',['family','kids & family','famiglia']],['fantasy','Fantasy',['fantasy']],
  ['horror','Horror',['horror']],['poliziesco','Poliziesco',['crime','poliziesco']],['romantico','Romantico',['romance','romantico','romantica']],
  ['documentario','Documentario',['documentary','documentario']],['storico','Storico',['history','storico']],['guerra','Guerra',['war','guerra']],['western','Western',['western']]
];
export function catalogCategories(titles, page = 'home') {
  const pool = titles.filter(t => !['anime','film','series'].includes(page) || t.kind === page);
  const out = []; const add = (id,name,entries) => { if(entries.length >= 3)out.push({id,name,entries}); };
  if(page === 'home' || page === 'new' || page === 'list') for(const kind of ['anime','film','series'])add(`tipo-${kind}`,{anime:'Anime',film:'Film',series:'Serie TV'}[kind],pool.filter(t=>t.kind===kind));
  const kinds = ['anime','film','series'].includes(page) ? [page] : ['anime','film','series'];
  for(const kind of kinds) for(const [id,name,aliases] of kind === 'anime' ? ANIME_FAMILIES : FILM_FAMILIES) {
    const entries=pool.filter(t=>t.kind===kind && [...(t.genres||[]),...(kind==='anime'?t.tags||[]:[])].some(g=>aliases.includes(fold(g))));
    add(`${kind}-${id}`,kinds.length>1?`${name} · ${{anime:'Anime',film:'Film',series:'Serie TV'}[kind]}`:name,entries);
  }
  return out;
}
// Voti domestici da 1?5 stelle: si raddoppiano, senza arrotondare la media.
// Per i titoli senza voto globale il prior neutro ? 5/10; k=3 evita scatti per un solo voto.
export function rankingScore(title, rating = {}) {
  const online=Number.isFinite(title.score)&&title.score>0?Math.min(10,title.score):5;
  const count=Number.isInteger(rating.count)&&rating.count>0?rating.count:0;
  const sum=count&&Number.isFinite(rating.sum)?Math.max(count,Math.min(count*5,rating.sum)):0;
  return count&&sum ? (online*3+sum*2)/(3+count) : online;
}
export function topTen(titles, ratings = {}) {
  return [...new Map(titles.map(t=>[t.key,t])).values()].sort((a,b)=>rankingScore(b,ratings[b.key])-rankingScore(a,ratings[a.key]) || a.key.localeCompare(b.key)).slice(0,10);
}
const byAdded = (a, b) => b.added - a.added || a.title.localeCompare(b.title, 'it');

// Serie con episodi arrivati di recente (dopo i primi): «Nuovi episodi».
export function newEpisodeTitles(titles, now = Date.now(), days = 14) {
  return titles.filter(t => t.episodes && now - t.added < days * DAY && t.added - t.firstAdded > DAY).sort(byAdded);
}

// Una sola prima card per titolo in Home. La classifica conserva sempre il suo ordine.
// Se l'unica ripresa coincide con il n.1, i suoi dati restano nella card della classifica.
function distinctRowLeads(rows) {
  const key=e=>(e.title?.key?e.title:e).key;
  const ranking=rows.find(r=>r.shape==='ranking');const continuing=rows.find(r=>r.id==='continua');
  const shared=ranking&&continuing?.entries.length===1&&key(continuing.entries[0])===key(ranking.entries[0]);
  const ranked=shared?{...ranking,entries:[continuing.entries[0],...ranking.entries.slice(1)]}:ranking;
  const used=new Set(ranked?[key(ranked.entries[0])]:[]);const out=[];
  for(const row of rows){
    if(row===ranking){out.push(ranked);continue;}
    const leader=row.entries.find(e=>!used.has(key(e)));if(!leader)continue;
    used.add(key(leader));out.push({...row,entries:[leader,...row.entries.filter(e=>e!==leader)]});
  }
  return out;
}
// Le righe della pagina. page: home | film | series | anime.
export function buildRows(titles, items, progress = {}, list = [], { page = 'home', now = Date.now(), genre = '', ratings = {}, tv = false } = {}) {
  const pool = page === 'home' ? titles : titles.filter(t => t.kind === page);
  const scoped = genre ? pool.filter(t => t.genres.includes(genre)) : pool;
  const rows = [];
  const add = (id, title, entries, shape = 'poster') => { if (entries.length) rows.push({ id, title, entries, shape }); };
  const keys = new Set(scoped.map(t => t.key));
  add('continua', 'Continua a guardare', continueEntries(titles, items, progress).filter(e => keys.has(e.title.key)), 'continue');
  const listed = list.map(l => titles.find(t => t.key === l.key)).filter(t => t && keys.has(t.key));
  add('lista', 'La mia lista', listed);
  if(tv) add('top10','I 10 migliori su Apollon',topTen(scoped,ratings),'ranking');
  const newEpisodes=newEpisodeTitles(scoped,now);const newKeys=new Set(newEpisodes.map(t=>t.key));
  const additions=tv?scoped.filter(t=>!newKeys.has(t.key)).sort((a,b)=>b.firstAdded-a.firstAdded||a.key.localeCompare(b.key)):[...scoped].sort(byAdded);
  add('recenti','Aggiunti di recente',additions.slice(0,15));
  if(page==='home'||page==='series'||page==='anime')add('nuovi-episodi','Nuovi episodi',newEpisodes);
  if (page === 'home' && !genre) {
    add('anime', 'Anime', scoped.filter(t => t.kind === 'anime').sort(byAdded));
    add('film', 'Film', scoped.filter(t => t.kind === 'film').sort((a, b) => a.title.localeCompare(b.title, 'it')));
    add('serie', 'Serie TV', scoped.filter(t => t.kind === 'series').sort((a, b) => a.title.localeCompare(b.title, 'it')));
  }
  const recent = titles.filter(t => t.started && keys.has(t.key)).map(t => ({ t, at: Math.max(0, ...(t.episodes || [t.item]).map(i => progress[i.id]?.updated || 0)) })).sort((a, b) => b.at - a.at)[0]?.t;
  const because = recent ? similarTitles(recent, scoped).filter(t => !t.watched) : [];
  const sections = page === 'home' ? ['anime','film-serie'].map(id => ({ id, pool: scoped.filter(t => SECTION_OF[t.kind] === id) })).filter(s => s.pool.length) : [{ id: '', pool: scoped }];
  const split = sections.length > 1;
  const categories = tv ? catalogCategories(scoped,page).map(g=>({name:g.name,id:g.id,entries:g.entries})) : sections.flatMap(s => genreCounts(s.pool).filter(g=>g.count>=2&&g.name!==genre).slice(0,split?5:8)
    .map(g=>({...g,name:split?`${g.name} · ${SECTION_NAMES[s.id]}`:g.name,id:split?`${s.id}-${g.name}`:g.name,entries:s.pool.filter(t=>t.genres.includes(g.name))})));
  for (const [index,g] of categories.entries()) {
    add(`genere-${g.id}`,g.name,[...g.entries].sort((a,b)=>Number(a.watched)-Number(b.watched)||(tv?rankingScore(b,ratings[b.key])-rankingScore(a,ratings[a.key])||a.key.localeCompare(b.key):byAdded(a,b))));
    if(index===1&&because.length>=2)add('perche',`Perché hai guardato ${recent.title}`,because);
  }
  if (because.length >= 2 && !rows.some(r => r.id === 'perche')) add('perche', `Perché hai guardato ${recent.title}`, because);
  add('rivedere', 'Da rivedere', scoped.filter(t => t.watched).sort(byAdded));
  if (genre && !rows.some(r => r.id === 'recenti')) add('tutti', genre, scoped);
  return tv&&page==='home'?distinctRowLeads(rows):rows;
}

// Novità: per data di aggiunta, a gruppi.
export function novitaGroups(titles, now = Date.now()) {
  const groups = [{ label: 'Questa settimana', entries: [] }, { label: 'Questo mese', entries: [] }, { label: 'Arrivati prima', entries: [] }];
  for (const t of [...titles].sort(byAdded)) {
    const age = now - t.added; const target = age < 7 * DAY ? 0 : age < 31 * DAY ? 1 : 2;
    const latest = t.episodes ? [...t.episodes].sort((a, b) => (b.added || 0) - (a.added || 0))[0] : null;
    const note = !t.episodes ? 'Nuovo film' : t.added - t.firstAdded > DAY ? (latest.episode === 1 ? `Nuova stagione: stagione ${latest.season}` : 'Nuovi episodi') : t.kind === 'anime' ? 'Nuovo anime' : 'Nuova serie';
    groups[target].entries.push({ title: t, note, item: latest || t.item });
  }
  return groups.filter(g => g.entries.length);
}

// Ricerca su titolo, episodi, generi e anno, senza badare agli accenti.
export function searchTitles(titles, query) {
  const q = fold(query).trim(); if (!q) return [];
  const words = q.split(/\s+/);
  const scored = titles.map(t => {
    const name = fold(t.title); const genres = t.genres.map(fold).join(' '); const episodes = (t.episodes || []).map(i => fold(i.title)).join(' ');
    const haystack = `${name} ${genres} ${episodes} ${t.year || ''} ${fold(kindLabel(t))}`;
    if (!words.every(w => haystack.includes(w))) return null;
    const score = (name.startsWith(q) ? 100 : 0) + (name.includes(q) ? 50 : 0) + (genres.includes(q) ? 20 : 0) + (String(t.year) === q ? 20 : 0);
    return { t, score };
  }).filter(Boolean);
  return scored.sort((a, b) => b.score - a.score || a.t.title.localeCompare(b.t.title, 'it')).map(x => x.t);
}
export function sortList(titles, list, order = 'aggiunti') {
  const at = new Map(list.map(l => [l.key, l.added]));
  const listed = list.map(l => titles.find(t => t.key === l.key)).filter(Boolean);
  if (order === 'titolo') return listed.sort((a, b) => a.title.localeCompare(b.title, 'it'));
  if (order === 'anno') return listed.sort((a, b) => (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title, 'it'));
  return listed.sort((a, b) => (at.get(b.key) || 0) - (at.get(a.key) || 0));
}

// Giro G: qualità. «Automatica» sceglie la versione leggera (480p) se la connessione è lenta o si è fuori casa.
const HOME_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)|\.local$|^[^.]+$/i;
export function connectionIsSlow({ host = '', effectiveType, downlink, saveData, measuredKbps } = {}) {
  if (host && !HOME_HOST.test(host)) return true; // fuori casa (indirizzi Tailscale 100.x, internet)
  if (saveData === true) return true;
  if (['slow-2g', '2g', '3g'].includes(effectiveType)) return true;
  if (Number.isFinite(downlink) && downlink > 0 && downlink < 1.5) return true;
  return Number.isFinite(measuredKbps) && measuredKbps > 0 && measuredKbps < 1500;
}
export function chooseQuality(preference, item, connection) {
  const light = !!item?.light;
  if (preference === '480') return light ? '480' : 'original';
  if (preference === 'original') return 'original';
  return light && connectionIsSlow(connection) ? '480' : 'original';
}
export function qualityOptions(item) {
  const height = (item?.streams || []).find(s => s.type === 'video')?.height;
  return [{ value: 'auto', label: 'Automatica', sub: 'Sceglie da sola in base alla connessione' },
    { value: 'original', label: height ? `Originale (${height}p)` : 'Originale', sub: 'La migliore qualità del file' },
    { value: '480', label: 'Risparmio dati (480p)', sub: item?.light ? 'Consuma meno dati' : 'Non ancora preparata: chiedila dalla pagina della serie', disabled: !item?.light }];
}
export const mediaUrl = (item, quality) => `/media/${item.id}${quality === '480' && item.light ? '?q=480' : ''}`;
