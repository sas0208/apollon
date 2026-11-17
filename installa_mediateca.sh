#!/data/data/com.termux/files/usr/bin/bash
# Da eseguire a mano sul telefono, MAI avviato dagli agenti.
set -eu
MODE="${1:-video}"
case "$MODE" in video|music) ;; *) echo 'Usa: bash installa_mediateca.sh video   oppure   music'; exit 1;; esac
SOURCE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
DEST_DIR="$HOME/mediateca"
printf '\nPreparo Mediateca (%s). I file personali restano nelle loro cartelle.\n' "$MODE"
command -v pkg >/dev/null || { echo 'Esegui questo script in Termux sul telefono.'; exit 1; }
pkg install -y nodejs ffmpeg
if [ "$MODE" = video ]; then
  # The official Termux ffmpeg recipe omits the Chromaprint muxer.
  # The chromaprint tool subpackage supplies fpcalc and its library dependency.
  pkg install -y chromaprint
fi
if [ ! -d /storage/emulated/0/Server ]; then
  echo 'Serve il permesso di archiviazione. Si aprirà la richiesta Android.'
  termux-setup-storage
  echo 'Concedi il permesso, poi premi Invio.'
  read -r _answer
fi
test -r /storage/emulated/0 || { echo 'Archiviazione non accessibile: concedi il permesso a Termux e riprova.'; exit 1; }
mkdir -p "$DEST_DIR" /storage/emulated/0/Server/{Film,Anime,Musica,File}
if [ "$SOURCE_DIR" != "$DEST_DIR" ]; then
  # Copia soltanto il programma, mai config, chiavi, dati o file della demo.
  for dir in lib public scripts test; do mkdir -p "$DEST_DIR/$dir"; cp -R "$SOURCE_DIR/$dir/." "$DEST_DIR/$dir/"; done
  for file in server.js package.json config.example.json avvia_mediateca.sh GUIDA.md README.md; do cp "$SOURCE_DIR/$file" "$DEST_DIR/$file"; done
fi
cd "$DEST_DIR"
node scripts/setup.js "$MODE"
printf '\nPronto. Conserva la chiave mostrata sopra, se è il primo avvio.\n'
printf 'Avvia con: bash ~/mediateca/avvia_mediateca.sh\n'
printf 'Da un altro dispositivo apri: http://<indirizzo-di-questo-telefono>:8787\n'
printf 'Nessun avvio automatico è stato aggiunto. Lascia Termux aperto durante l’uso.\n'
