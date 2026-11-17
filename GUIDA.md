# Apollon

Film, serie, anime e musica sul Wi-Fi di casa. I telefoni devono essere accesi,
collegati alla rete e con Apollon avviata in Termux.

**Apri la raccolta**

- Film e anime: **http://<indirizzo del telefono dei video>:8787**
- Musica: **http://<indirizzo del telefono della musica>:8787**

Dal PC usa Edge o Chrome. Dal telefono usa il browser Android. Dalla TV apri
l’indirizzo nel browser e scegli **Modalità TV**: frecce per spostarti, OK per
scegliere, Indietro o Esc per chiudere. Puoi usare anche il server DLNA già presente.
Il collegamento “Apri l’altra raccolta” passa da un telefono all’altro.

**Guarda qualcosa**

La prima volta Apollon chiede **Crea il primo profilo**: tocca **Aggiungi** e scrivi un nome. Non ci sono
profili già fatti: esistono solo quelli che create voi (poi **Chi guarda?** li mostra a ogni apertura e
**Gestisci profili** li rinomina). Apri un titolo,
poi scegli il film o l’episodio. **Riprendi da dove eri** conserva il punto di
ripresa di ciascuno. Puoi segnare i titoli come visti e cercarli per nome o genere.
Alla fine di un episodio parte il successivo, se la casella nel lettore è attiva.

Negli anime compaiono **Salta riassunto**, **Salta sigla** e **Prossimo episodio**
quando servono. Puoi scegliere **Salta sempre in automatico**: la scelta resta
solo sul tuo profilo. Se dopo i titoli c’è ancora una scena, **Salta sigla finale**
porta alla scena, senza passare subito all’episodio seguente. In modalità TV,
con il video selezionato, **OK** preme il salto disponibile.

Per i sottotitoli metti il file `.srt`, `.ass` o `.vtt` nella stessa cartella del
video, con lo stesso nome: `Titolo.mp4` e `Titolo.it.srt`. Sceglili nei comandi del
lettore. Gli stili complessi ASS vengono semplificati. Se il browser non legge un
video o una traccia audio, aprilo con VLC o DLNA sulla TV: Apollon non lo ricodifica.

**Ascolta la musica**

Apri il telefono della musica: si apre da sola, senza utente né password. Va collegata **una volta sola**
(vedi «Collegare la musica una volta sola» qui sotto). Se compare «La musica non è ancora collegata», quel passaggio non è stato fatto.
Nella pagina **Per te** scegli un mood (Energia, Relax, Notte…) o un genere,
poi **Ascolta tutto**. Ritrovi anche artisti, album e playlist; **+ Coda** aggiunge un brano. Nella coda puoi cambiare
l’ordine, togliere brani e salvare una playlist in Navidrome. La barra in basso
continua a suonare mentre sfogli le pagine. Il sottofondo a schermo spento dipende
dal browser e dal risparmio energetico Android; escludi Termux dal risparmio batteria.
I mood usano il catalogo già presente sul telefono musica: non devi ricalcolarli. Se il catalogo
manca, album e playlist continuano a funzionare. I brani non ancora collegati
vengono segnalati: aggiorna l’indice in Navidrome. La coda contiene fino a 2000 brani.

Tocca il nome del brano nella barra per aprire la **copertina grande**; scegli
**Testo** per seguire le parole. La riga che stai ascoltando si illumina e resta
al centro: tocca una riga per saltare a quel punto. Sulla TV usa frecce e OK.
Sul telefono alterna **Copertina** e **Testo**. Le parole senza tempi si leggono
scorrendo; se mancano compare un messaggio. Navidrome legge i `.lrc` e `.txt`
accanto agli mp3 con lo stesso nome: non devi importarli in Apollon.

**Sistema i file dal telefono**

In **Gestisci** inserisci la **chiave di casa**, mostrata al primo setup. Puoi caricare
file, creare cartelle, rinominare e spostare file anche fra raccolte. I nomi esistenti
non vengono sovrascritti. Per video grandi serve spazio temporaneo aggiuntivo.
**Nel cestino** conserva il file: **Apri il cestino → Ripristina** lo rimette al suo
posto. Il cestino occupa ancora spazio. Sposta/rinomina anche i sottotitoli associati.
**Aggiorna la raccolta** cerca i file aggiunti con altri strumenti. In “Sistema
titoli…” puoi correggere titolo, nome della serie, stagione ed episodio.
Per una copertina tua, carica un JPG/PNG nella raccolta del video e scrivi il
percorso nel campo **Copertina dalla raccolta** (esempio: `Copertine/Titolo.jpg`).
Lascia vuoto per tornare all’anteprima automatica. Puoi applicare nome serie,
copertina e generi a tutta la stagione o alla serie; il titolo dell’episodio e il
numero restano individuali. Nella scheda di una serie scegli la stagione dal menu.

Per i salti scegli prima un episodio in “Sistema titoli”, poi apri **Salta riassunto,
sigla e finale negli anime → Analizza la stagione**. L’analisi lavora in locale:
premi **Aggiorna i risultati** quando ha finito. Puoi correggere inizio e fine in
secondi; due campi vuoti disattivano quel salto. La casella della stessa sigla
applica la correzione solo agli episodi riconosciuti uguali, mantenendo i loro
punti di inizio. **AniSkip è spento**: accendilo solo se vuoi il suo aiuto online,
con l’ID MyAnimeList della stagione corretta. Nessun video viene inviato.

**Tieni l’icona a portata di mano**

Nel menu del browser scegli **Aggiungi a schermata iniziale / Crea collegamento**.
“Installa Apollon” compare solo dove il browser consente la PWA: serve HTTPS o
localhost. I normali indirizzi HTTP di casa restano utilizzabili dal browser.
Cast non è integrato; puoi usare duplicazione schermo o DLNA.

**Prima installazione sui telefoni**

Porta la cartella `app` sul telefono. In Termux esegui
`bash installa_mediateca.sh video` sul telefono dei video, `bash installa_mediateca.sh music`
sul telefono della musica. Lo script installa Node/ffmpeg se necessario, chiede il permesso di
archiviazione e mostra la nuova chiave. Avvia con
`bash ~/mediateca/avvia_mediateca.sh`.

Usa l’app soltanto nella rete di casa; non esporre la porta 8787 su Internet.

## Collegare la musica una volta sola (niente login in casa)

Apollon parla con Navidrome al posto vostro. Chi ha la chiave di casa lo collega in uno di questi due modi,
una volta sola, e da quel momento tutti i telefoni e la TV aprono la musica subito:

1. **Da Gestisci** (più semplice): apri Apollon sul telefono della musica → **Gestisci** → scrivi la chiave di casa →
   **Collega la musica** → utente e password di Navidrome → **Collega**. Sul telefono resta soltanto un gettone
   (`data/musica-collegata.json`), mai la password.
2. **Dal file di configurazione** (resiste anche se si cancella il gettone): sul telefono della musica apri
   `config.json` nella cartella di Apollon e aggiungi, accanto a `navidromeUrl`:
   `"navidromeUser": "nome-utente-navidrome", "navidromePassword": "password-navidrome"`
   poi riavvia Apollon (`./avvia_mediateca.sh`). Se Navidrome è spento all’avvio, Apollon ci riprova da solo ogni
   15 secondi. Se la password è sbagliata, **Gestisci → Collega la musica** lo dice chiaramente.

Navidrome ascolta solo su 127.0.0.1 del telefono: utente e password non girano mai per la rete di casa e non
arrivano mai al browser. Il vecchio accesso «solo su questo dispositivo» resta in fondo alla pagina come ripiego.

## Musica: libreria, scoperta e ascolto in casa

In **La tua musica** scegli Playlist, Album, Artisti o Scaricati. Puoi ordinare,
passare da Elenco a Griglia e fissare fino a quattro raccolte con la puntina.
Ogni profilo ricorda le proprie scelte. **Sfoglia** mostra mood e generi; mentre
scrivi compaiono i risultati. Le ultime dieci ricerche scelte si possono cancellare.

In fondo alle playlist trovi consigli dalla sola musica di casa: **+** li salva
nella playlist, **Aggiorna consigli** ne cerca altri. **Il tuo momento** cambia
selezione durante la giornata. In **Il tuo mese** puoi sfogliare anche l'anno:
i minuti contano il tempo realmente ascoltato da questo profilo.

Nel lettore apri **Dispositivi di casa**, dai un nome ai browser e scegli dove
suonare. Accedi con lo stesso utente musicale e lo stesso profilo sui due lati.
Il primo avvio dell'audio può richiedere un tocco sul dispositivo scelto.
Chiudere il telecomando non ferma l'altro dispositivo. Ricaricare il ricevente
lo riporta in pausa; puoi farlo ripartire dal telecomando.

**Scarica** su album o playlist salva una copia su questo dispositivo: prima
vedi la stima, puoi scegliere un limite di spazio, annullare o rimuovere il
download. Senza rete trovi solo le raccolte scaricate per il profilo scelto.
Il browser può liberare la memoria se non concede la conservazione persistente.
Sul telefono questa funzione richiede Apollon aperta in **HTTPS**: il semplice
indirizzo HTTP di casa non abilita i service worker.

**Ascoltiamo insieme.** Nella pagina Musica o nel player premi **Ascoltiamo insieme**.
Sul dispositivo che suona scegli **Apri una sessione qui**: compare un codice di 4 cifre.
Gli altri (anche con un altro profilo di casa) scelgono la sessione dall'elenco o scrivono
il codice. Gli ospiti vedono cosa suona, aggiungono brani alla coda comune (si vede chi li ha
messi) e, se l'interruttore è acceso, usano Riproduci, Pausa e Successivo. Chi ha aperto può
togliere una persona o chiudere. Se il dispositivo che suona resta scollegato più di 2 minuti
la sessione finisce. Si può essere in 8.

**Miscela.** In **La tua musica** scegli **Miscela con** un altro profilo: 30 brani che mescolano
i vostri gusti, con la percentuale di sintonia e chi ama cosa. Cambia da sola ogni giorno e
puoi salvarla come playlist. Servono almeno 10 ascolti a testa (contano dopo 20 secondi).

