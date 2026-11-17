// Giro F: il catalogo finto della demo. Titoli, trame e generi inventati; nessun titolo, immagine o testo di servizi veri.
// I quattro film storici e «Il giardino delle stelle» (episodi da 12 s con sottotitoli .it.srt) restano: li usano i test.
const DAY = 86400000;

// days = quanti giorni fa il file è "arrivato" nella raccolta (Novità, Aggiunti di recente, Nuovi episodi).
export const FILMS = [
  { title: 'Una sera a colori', year: 2026, minutes: 104, days: 2, genres: ['Commedia', 'Romantico'], scene: { hue: 185, hue2: 235, time: 'tramonto', land: 'citta' },
    description: 'Una pittrice senza ispirazione e un tassista notturno attraversano la città in una sola sera, fra mostre chiuse, cene improvvisate e un murale da finire prima dell’alba.' },
  { title: 'Il viaggio delle lanterne', year: 2025, minutes: 112, days: 9, genres: ['Avventura', 'Famiglia'], scene: { hue: 250, hue2: 220, time: 'tramonto', land: 'bosco', lanterns: true },
    description: 'Due fratelli seguono le lanterne che ogni autunno lasciano il loro paese, convinti che portino alla nonna partita anni prima.' },
  { title: 'Orizzonti di carta', year: 2024, minutes: 97, days: 41, genres: ['Drammatico'], scene: { hue: 200, hue2: 185, time: 'giorno', land: 'mare', figure: true, figureX: .62 },
    description: 'Un cartografo in pensione accetta l’ultimo incarico: disegnare la mappa di un’isola che, secondo tutti, non esiste.' },
  { title: 'Piccole meraviglie', year: 2026, minutes: 88, days: 5, genres: ['Famiglia', 'Animazione'], scene: { hue: 205, hue2: 150, time: 'giorno', land: 'monti', figure: true, figureSize: .14 },
    description: 'In un villaggio di montagna una bambina scopre che gli oggetti dimenticati si raccontano storie di notte.' },
  { title: 'La città sotto la neve', year: 2023, minutes: 118, days: 33, genres: ['Mistero', 'Drammatico'], scene: { hue: 220, hue2: 250, time: 'notte', land: 'neve', figure: true, figureX: .4 },
    description: 'Una nevicata isola la città per una settimana. Nel silenzio, una giornalista riapre un caso che nessuno voleva ricordare.' },
  { title: 'Il faro dei gabbiani', year: 2022, minutes: 101, days: 52, genres: ['Avventura', 'Famiglia'], scene: { hue: 215, hue2: 240, time: 'tramonto', land: 'mare', figure: true, figureX: .3 },
    description: 'L’ultimo guardiano del faro e un gabbiano testardo devono salvare il porto dalla tempesta del secolo.' },
  { title: 'Ultimo treno per il mare', year: 2025, minutes: 109, days: 18, genres: ['Romantico', 'Drammatico'], scene: { hue: 190, hue2: 30, time: 'tramonto', land: 'mare' },
    description: 'Lei scende sempre una fermata prima, lui sempre una dopo. Un’estate intera per incontrarsi a metà strada.' },
  { title: 'Le mani del pasticcere', year: 2024, minutes: 95, days: 46, genres: ['Commedia'], scene: { hue: 230, hue2: 45, time: 'giorno', land: 'citta' },
    description: 'Un pasticcere famoso perde il gusto alla vigilia della gara più importante. Lo aiuta l’unica persona che non sopporta.' },
  { title: 'Notte di vetro', year: 2026, minutes: 121, days: 1, genres: ['Thriller', 'Mistero'], scene: { hue: 235, hue2: 190, time: 'notte', land: 'citta' },
    description: 'Un custode notturno vede dal ventesimo piano qualcosa che non doveva vedere. Fino all’alba nessuno può uscire dal grattacielo.' },
  { title: 'Il circo delle ombre', year: 2021, minutes: 115, days: 58, genres: ['Fantasy', 'Avventura'], scene: { hue: 275, hue2: 200, time: 'notte', land: 'bosco', lanterns: true, lanternHue: 220 },
    description: 'Un circo arriva in paese solo nelle notti senza luna, e chi entra sotto il tendone ne esce con un’ombra diversa.' },
  { title: 'Passi sul ghiaccio', year: 2023, minutes: 106, days: 27, genres: ['Drammatico', 'Sport'], scene: { hue: 195, hue2: 220, time: 'giorno', land: 'neve', figure: true },
    description: 'Una pattinatrice tornata dopo un infortunio allena una squadra di ragazzi che non ha mai vinto niente.' },
  { title: 'La biblioteca segreta', year: 2025, minutes: 99, days: 12, genres: ['Mistero', 'Famiglia'], scene: { hue: 260, hue2: 40, time: 'notte', land: 'monti', figure: true, cape: true },
    description: 'Dietro uno scaffale della biblioteca comunale c’è una porta. Dietro la porta, tutti i libri che nessuno ha mai scritto.' },
  { title: 'Rotta verso Sirio', year: 2026, minutes: 132, days: 3, genres: ['Fantascienza', 'Avventura'], scene: { hue: 245, hue2: 185, time: 'notte', land: 'spazio', moons: true, figure: true },
    description: 'L’equipaggio di una nave da carico riceve un segnale da una stella vicina. Rispondere significa non tornare più a casa.' },
  { title: 'Il giardino di nonna Ada', year: 2024, minutes: 92, days: 38, genres: ['Famiglia', 'Commedia'], scene: { hue: 160, hue2: 90, time: 'giorno', land: 'bosco' },
    description: 'Tre cugini ereditano un giardino incolto e un anno di tempo per farlo fiorire, altrimenti la casa andrà venduta.' },
];

// seasons: [stagione] = elenco di [titolo episodio, descrizione]; days = giorni fa del PRIMO episodio della stagione.
export const SERIES = [
  { name: 'Casa Moretti', root: 'Film', folder: 'Serie', minutes: 28, genres: ['Commedia', 'Famiglia'], scene: { hue: 25, hue2: 235, time: 'tramonto', land: 'citta' },
    description: 'Tre generazioni sotto lo stesso tetto, un solo bagno e nessuna voglia di cedere il telecomando.',
    seasons: [
      { days: 55, episodes: [['Il trasloco', 'La nonna arriva con dodici valigie e un pappagallo.'], ['La cena della domenica', 'Ognuno porta un ospite, nessuno lo dice agli altri.'], ['Il bagno conteso', 'Viene istituito un calendario. Dura quattro ore.'], ['La gita', 'Il furgone a nolo ha idee sue sulla strada da fare.'], ['Compleanno a sorpresa', 'Organizzare una sorpresa in una casa senza segreti.'], ['Tutti in salotto', 'Un temporale, la luce che salta e un gioco da tavolo antico.']] },
      { days: 4, episodes: [['Si ricomincia', 'Settembre porta un nuovo vicino e un vecchio rancore.'], ['Il cane', 'Nessuno ha preso un cane. Eppure c’è un cane.'], ['Lezioni di guida', 'Il nonno insegna a guidare. Il nonno non ha la patente.'], ['La festa del quartiere', 'Casa Moretti contro il resto del condominio.']] },
    ] },
  { name: 'Il porto di nebbia', root: 'Film', folder: 'Serie', minutes: 52, genres: ['Mistero', 'Thriller'], scene: { hue: 205, hue2: 220, time: 'notte', land: 'mare', figure: true, figureX: .35 },
    description: 'In un porto dove la nebbia non si alza mai, una commissaria appena arrivata indaga sulle barche che tornano vuote.',
    seasons: [
      { days: 30, episodes: [['La barca vuota', 'All’alba torna in porto un peschereccio senza equipaggio.'], ['Il registro', 'Qualcuno ha strappato tre pagine dal registro della capitaneria.'], ['Sotto il molo', 'Un’immersione notturna rivela un passaggio dimenticato.'], ['La sirena', 'La sirena del faro suona da sola alle tre di notte.'], ['Il patto', 'I vecchi pescatori sanno, ma non parlano.'], ['La nebbia si alza', 'Per la prima volta in trent’anni il porto vede il sole.']] },
    ] },
  { name: 'Laboratorio 9', root: 'Film', folder: 'Serie', minutes: 47, genres: ['Fantascienza', 'Mistero'], scene: { hue: 180, hue2: 260, time: 'notte', land: 'spazio', moons: true },
    description: 'Una base scientifica sotto il ghiaccio, nove ricercatori e un esperimento che cambia il tempo ogni volta che qualcuno dorme.',
    seasons: [
      { days: 50, episodes: [['Il primo giorno', 'La nuova biologa arriva quando tutti gli altri sono già stanchi.'], ['L’orologio', 'Gli orologi della base non sono d’accordo fra loro.'], ['La porta 9', 'Una porta che non compare nella pianta.'], ['Il segnale', 'Dal ghiaccio arriva un ritmo regolare.'], ['Il ritorno', 'Uno di loro torna da un turno che non ha mai iniziato.']] },
      { days: 16, episodes: [['Sei mesi dopo', 'La base è stata riaperta. Non da chi l’aveva chiusa.'], ['Le registrazioni', 'Le voci nei nastri sono le loro, ma dicono cose mai dette.'], ['Disgelo', 'Il ghiaccio si scioglie dove nessuno lo scalda.'], ['Nove', 'Il numero non era un caso.']] },
    ] },
  { name: 'Cucine di quartiere', root: 'Film', folder: 'Serie', minutes: 32, genres: ['Documentario', 'Cucina'], scene: { hue: 245, hue2: 40, time: 'giorno', land: 'citta' },
    description: 'Ogni puntata un quartiere diverso e le ricette di chi ci vive da sempre, raccontate nelle cucine di casa.',
    seasons: [
      { days: 22, episodes: [['Il mercato coperto', 'Le bancarelle all’alba e il brodo della signora Lina.'], ['La via dei forni', 'Tre panettieri, una sola strada, nessuna rivalità (quasi).'], ['Sapori dal porto', 'Il pesce del giorno e la zuppa dei pescatori.'], ['Le nonne del sabato', 'Pasta fatta a mano per venti persone.'], ['Dolci di festa', 'Le ricette segrete che si tramandano solo a voce.'], ['La cena finale', 'Tutto il quartiere a una sola tavola.']] },
    ] },
  { name: 'Le sorelle Valli', root: 'Film', folder: 'Serie', minutes: 50, genres: ['Drammatico', 'Romantico'], scene: { hue: 200, hue2: 20, time: 'tramonto', land: 'monti', figure: true, figureX: .58 },
    description: 'Quattro sorelle tornano nella casa di famiglia per vendere la vigna. Nessuna di loro, in fondo, vuole davvero farlo.',
    seasons: [
      { days: 44, episodes: [['Il ritorno', 'La casa è come l’avevano lasciata. Loro no.'], ['La vendemmia', 'Un raccolto da salvare in tre giorni.'], ['Lettere in soffitta', 'Una scatola di lettere mai spedite.'], ['La festa', 'Il paese le invita. Il paese non dimentica.'], ['La scelta', 'Una firma su un contratto, quattro risposte diverse.']] },
      { days: 6, episodes: [['Un anno dopo', 'La vigna ha un nuovo nome e qualche nuovo debito.'], ['Ospiti', 'Arriva un enologo con troppe opinioni.'], ['Grandine', 'In dieci minuti il cielo decide per tutti.']] },
    ] },
  { name: 'Pianeta in bici', root: 'Film', folder: 'Serie', minutes: 44, genres: ['Documentario', 'Avventura'], scene: { hue: 190, hue2: 95, time: 'giorno', land: 'monti', figure: true, figureSize: .13 },
    description: 'Due amici attraversano il mondo in bicicletta, con una tenda, una telecamera e pochissimo senso dell’orientamento.',
    seasons: [
      { days: 36, episodes: [['La partenza', 'Mille chilometri di pianura e la prima foratura.'], ['Le montagne', 'Salite infinite e discese che valgono tutto.'], ['Il deserto', 'Acqua contata e notti piene di stelle.'], ['Verso il mare', 'L’ultima tappa, la più lunga.']] },
    ] },
];

// Ventisei episodi per provare i blocchi 1–12, 13–24, 25–26 della pagina serie (titoli e trame inventati).
const CREPUSCOLO = ['La recluta', 'Il primo turno', 'La torre accesa', 'Ombre sul ponte', 'Il fabbro senza nome', 'Cena alla guarnigione', 'La mappa strappata', 'Il cavallo bianco', 'Lettere dal nord', 'La nebbia lunga', 'Il torneo', 'Una promessa a metà',
  'Il custode', 'Fuoco nel cortile', 'Gli archivi', 'La lanterna spenta', 'Sora e il re', 'Il passo dei corvi', 'Tregua', 'La bandiera nera', 'Il ritorno di Ilan', 'Tempesta d’autunno', 'Il giuramento', 'La torre cade', 'L’alba dopo', 'Il crepuscolo non finisce']
  .map((title, i) => [title, ['Un nuovo turno alla torre porta una notizia che nessuno vuole dare.', 'Sora impara che accendere la luce costa più che spegnerla.', 'Un messaggero arriva senza cavallo e senza spiegazioni.'][i % 3]]);

// Anime: audio giapponese; «dub» aggiunge il doppiaggio italiano; «subs»: 'srt' (file accanto) o 'interni' (traccia nel video).
export const ANIME = [
  { name: 'Hoshizora Express', minutes: 24, genres: ['Fantascienza', 'Avventura'], dub: true, subs: 'interni', scene: { hue: 250, hue2: 200, time: 'notte', land: 'spazio', moons: true, figure: true, cape: true },
    description: 'Un treno che viaggia fra le stelle accoglie solo passeggeri con un desiderio. Mio, capotreno a quindici anni, deve portarli a destinazione.',
    seasons: [
      { days: 20, episodes: [['Biglietto di sola andata', 'Il primo turno di Mio comincia con un passeggero senza nome.'], ['La stazione di cristallo', 'Una fermata che appare solo ogni cento anni.'], ['Il bambino del vagone 7', 'Un passeggero clandestino con un orologio rotto.'], ['Pioggia di meteore', 'Il treno deve attraversare una tempesta di luce.'], ['Il macchinista', 'Chi guida davvero l’Hoshizora Express?'], ['Capolinea', 'Ogni viaggio finisce. Non tutti i passeggeri scendono.']] },
    ] },
  { name: 'Lama d’argento', minutes: 24, genres: ['Azione', 'Fantasy'], dub: false, subs: 'srt', scene: { hue: 225, hue2: 190, time: 'notte', land: 'monti', figure: true, cape: true, figureX: .44 },
    description: 'Kaede eredita una spada che sceglie da sola chi colpire. Per liberarsene deve trovare il fabbro che l’ha forgiata, tre secoli fa.',
    seasons: [
      { days: 48, episodes: [['La spada nel pozzo', 'Kaede trova una lama che brilla anche al buio.'], ['Il villaggio dei corvi', 'Un villaggio dove nessuno guarda in alto.'], ['Il duello del ponte', 'Uno spadaccino aspetta da sette giorni sul ponte.'], ['Fuoco e cenere', 'La fucina abbandonata racconta qualcosa.'], ['La promessa', 'Fine del primo viaggio, inizio del secondo.']] },
      { days: 5, episodes: [['La seconda lama', 'Esiste un’altra spada. E qualcuno la sta usando.'], ['La scuola del vento', 'Un maestro che insegna senza armi.'], ['Il fabbro', 'L’incontro che Kaede cercava, o temeva.']] },
    ] },
  { name: 'Piccola strega di Kumo', minutes: 23, genres: ['Fantasy', 'Commedia'], dub: true, subs: 'srt', scene: { hue: 220, hue2: 200, time: 'giorno', land: 'monti', figure: true, figureSize: .16 },
    description: 'Hana, apprendista strega, apre un servizio di consegne su una scopa che ha paura dell’altezza.',
    seasons: [
      { days: 25, episodes: [['La scopa fifona', 'Prima consegna, primo atterraggio su un tetto sbagliato.'], ['Il gatto del panettiere', 'Un cliente a quattro zampe con molte pretese.'], ['Nuvole basse', 'Consegne nella nebbia e una mappa disegnata male.'], ['La festa delle campane', 'Tutta Kumo prepara la festa, Hana deve portare le campane.'], ['Pioggia di pozioni', 'Una pozione rovesciata fa piovere al contrario.'], ['Il primo stipendio', 'Cosa compra una strega con i primi soldi guadagnati?']] },
    ] },
  { name: 'Ritmo di campanelle', minutes: 24, genres: ['Musicale', 'Commedia'], dub: false, subs: 'srt', scene: { hue: 280, hue2: 240, time: 'tramonto', land: 'citta' },
    description: 'Il club di musica del liceo ha quattro iscritti, un pianoforte scordato e un mese per vincere il concorso cittadino.',
    seasons: [
      { days: 14, episodes: [['Il club vuoto', 'Rin trova un’aula di musica abbandonata e un volantino strappato.'], ['Quattro strumenti', 'Un violino, un tamburo, un flauto e nessuno che legga le note.'], ['Prove sul tetto', 'Il preside vieta le prove. Il tetto non ha regole.'], ['Stonati', 'La prima esibizione è un disastro memorabile.'], ['Il concorso', 'Tre minuti sul palco per un mese di lavoro.']] },
    ] },
  { name: 'Cavalieri del crepuscolo', minutes: 24, genres: ['Azione', 'Fantasy'], dub: true, subs: 'interni', scene: { hue: 12, hue2: 230, time: 'tramonto', land: 'monti', figure: true, cape: true, figureX: .55 },
    description: 'Dodici cavalieri tengono accesa l’ultima torre del regno. Quando la luce si indebolisce, la recluta Sora scopre che il crepuscolo ha un custode.',
    seasons: [{ days: 8, episodes: CREPUSCOLO }] },
];
export const GARDEN = { name: 'Il giardino delle stelle', genres: ['Avventura', 'Famiglia'],
  description: 'Una bambina e un robot giardiniere coltivano un giardino su una piccola luna, aspettando la nave che li riporterà a casa.',
  episodes: [['La partenza', 'Il giardino perde la sua ultima stella. Bisogna trovarne un’altra.'], ['Il ponte', 'Un ponte di luce collega la luna al pianeta vicino.'], ['A casa', 'La nave arriva. Ma il giardino ha bisogno di loro.']],
  scene: { hue: 240, hue2: 165, time: 'notte', land: 'monti', figure: true, figureSize: .15, moons: true } };

const pad = n => String(n).padStart(2, '0');
// Tutti i file della demo, con il percorso dentro la radice e cosa serve per generarli.
export function demoFiles(now = Date.now()) {
  const files = [];
  for (const f of FILMS) files.push({ root: 'Film', rel: `${f.title} (${f.year}).mp4`, seconds: f.minutes * 60, added: now - f.days * DAY - 3600000 * (f.days % 7), kind: 'film', title: f.title,
    scene: { ...f.scene, seed: f.title }, audio: ['ita'], meta: f });
  for (const s of SERIES) s.seasons.forEach((season, si) => season.episodes.forEach(([title], ei) => files.push({ root: s.root,
    rel: `${s.folder}/${s.name}/Stagione ${si + 1}/${s.name} S${pad(si + 1)}E${pad(ei + 1)} ${title}.mp4`, seconds: s.minutes * 60 + ((ei * 37 + si * 11) % 120),
    added: now - season.days * DAY + ei * 3600000 * 5, kind: 'episode', series: s.name, season: si + 1, episode: ei + 1, title,
    scene: { ...s.scene, seed: `${s.name} ${si + 1}x${ei + 1}`, figureX: s.scene.figure ? .25 + ((ei * 0.17 + si * .3) % .5) : undefined }, audio: ['ita'], meta: s })));
  for (const a of ANIME) a.seasons.forEach((season, si) => season.episodes.forEach(([title], ei) => files.push({ root: 'Anime',
    rel: `${a.name}/Stagione ${si + 1}/${a.name} S${pad(si + 1)}E${pad(ei + 1)} ${title}.mp4`, seconds: a.minutes * 60 + ((ei * 13) % 50),
    added: now - season.days * DAY + ei * 3600000 * 7, kind: 'episode', series: a.name, season: si + 1, episode: ei + 1, title,
    scene: { ...a.scene, seed: `${a.name} ${si + 1}x${ei + 1}`, figureX: a.scene.figure ? .3 + ((ei * .19) % .4) : undefined }, audio: a.dub ? ['jpn', 'ita'] : ['jpn'], subs: a.subs, meta: a })));
  GARDEN.episodes.forEach(([title], ei) => files.push({ root: 'Anime', rel: `${GARDEN.name}/Stagione 1/${GARDEN.name} S01E${pad(ei + 1)} ${title}.mp4`, seconds: 12,
    added: now - 60 * DAY + ei * 3600000, kind: 'episode', series: GARDEN.name, season: 1, episode: ei + 1, title, test: true,
    scene: { ...GARDEN.scene, seed: `${GARDEN.name} 1x${ei + 1}`, figureX: .35 + ei * .15 }, audio: ['jpn'], subs: 'srt', meta: GARDEN }));
  return files;
}
export function episodeDescription(file) {
  const seasons = file.meta.seasons ? file.meta.seasons[file.season - 1].episodes : file.meta.episodes;
  return seasons?.[file.episode - 1]?.[1] || '';
}
export const SUBTITLE_TEXT = '1\n00:00:00,500 --> 00:00:04,000\nQuesto è un episodio di prova, generato al computer.\n\n2\n00:00:05,000 --> 00:00:10,000\nNessun video personale è stato usato.\n';

// Stato di partenza della demo per il primo profilo: dal più vecchio al più recente (l'ultimo è in cima a «Continua a guardare»).
export const DEMO_SEED = {
  progress: [
    ['Orizzonti di carta (2024).mp4', 1, true],
    ['Le mani del pasticcere (2024).mp4', 1, true],
    ['Serie/Il porto di nebbia/Stagione 1/Il porto di nebbia S01E01 La barca vuota.mp4', 1, true],
    ['Serie/Il porto di nebbia/Stagione 1/Il porto di nebbia S01E02 Il registro.mp4', .38],
    ['Lama d’argento/Stagione 1/Lama d’argento S01E01 La spada nel pozzo.mp4', 1, true],
    ['Hoshizora Express/Stagione 1/Hoshizora Express S01E01 Biglietto di sola andata.mp4', 1, true],
    ['Hoshizora Express/Stagione 1/Hoshizora Express S01E02 La stazione di cristallo.mp4', .45],
    ['Rotta verso Sirio (2026).mp4', .42],
    ['Serie/Casa Moretti/Stagione 1/Casa Moretti S01E01 Il trasloco.mp4', 1, true],
    ['Serie/Casa Moretti/Stagione 1/Casa Moretti S01E02 La cena della domenica.mp4', 1, true],
    ['Serie/Casa Moretti/Stagione 1/Casa Moretti S01E03 Il bagno conteso.mp4', .6],
  ],
  list: [
    { rel: 'La biblioteca segreta (2025).mp4' },
    { rel: 'Serie/Laboratorio 9/Stagione 1/Laboratorio 9 S01E01 Il primo giorno.mp4' },
    { rel: 'Piccola strega di Kumo/Stagione 1/Piccola strega di Kumo S01E01 La scopa fifona.mp4' },
    { rel: 'Il faro dei gabbiani (2022).mp4' },
    { rel: 'Lama d’argento/Stagione 1/Lama d’argento S01E01 La spada nel pozzo.mp4' },
    { rel: 'Notte di vetro (2026).mp4' },
  ],
};
