// Giro F, Gestisci: locandina e sfondo scelti a mano (da un fotogramma del video o da un'immagine accanto al file),
// descrizione del titolo e della serie, immagini da rifare. Tutto in casa: nessun servizio esterno, nessuna chiave.
export function createArtEditor(c) {
  const { $, el, state, api, action, notify } = c;
  let frames = null; let pictures = null; let target = 'poster'; let request = 0;
  const selected = () => state.items.find(i => i.id === $('#edit-item').value);
  const ver = item => item?.images?.v || 0;

  function preview(item, kind) {
    const src = item.images?.[kind] ? `/media/${item.id}/${kind}?s=${kind === 'poster' ? 260 : 640}&v=${ver(item)}` : '';
    const box = el('span', { class: `art-preview ${kind}` }, src ? el('img', { src, alt: '', loading: 'lazy' }) : el('span', { class: 'muted' }, 'In preparazione'));
    const choice = item[kind] || (item.imagePath ? { path: item.imagePath } : null);
    const how = !choice ? 'Automatica, dal video' : choice.immagine ? 'Immagine scelta sul fisso' : choice.path ? `Immagine: ${choice.path.split('/').pop()}` : `Fotogramma a ${Math.round(choice.at)} s`;
    return el('div', { class: 'art-slot' }, el('h3', {}, kind === 'poster' ? 'Locandina (verticale)' : 'Sfondo (16:9)'), box, el('p', { class: 'muted' }, how),
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'secondary', 'aria-pressed': frames && target === kind, onclick: action(() => showFrames(kind)) }, 'Da un fotogramma'),
        el('button', { type: 'button', class: 'secondary', 'aria-pressed': pictures && target === kind, onclick: action(() => showPictures(kind)) }, 'Da un’immagine'),
        choice ? el('button', { type: 'button', class: 'quiet', onclick: action(() => save(kind, null)) }, 'Torna automatica') : null));
  }
  async function save(kind, choice) {
    const item = selected(); if (!item) return;
    await api('/api/manage/edit', { method: 'POST', data: { id: item.id, [kind]: choice } });
    frames = null; pictures = null; await c.reloadLibrary();
    notify(kind === 'poster' ? 'Locandina scelta. La preparo, ci vuole un attimo.' : 'Sfondo scelto. Lo preparo, ci vuole un attimo.');
  }
  async function showFrames(kind) {
    const item = selected(); target = kind; pictures = null;
    const duration = item.duration || 0; if (!duration) throw new Error('La durata del video non è ancora pronta: riprova fra poco.');
    frames = [0.08, 0.18, 0.3, 0.42, 0.55, 0.67, 0.78, 0.9].map(share => Math.round(duration * share));
    paint();
  }
  async function showPictures(kind) {
    const item = selected(); target = kind; frames = null;
    pictures = (await api(`/api/manage/pictures?id=${encodeURIComponent(item.id)}`)).pictures || [];
    paint();
  }
  // I fotogrammi si chiedono uno alla volta: il server ne prepara uno per volta e risponde «riprova» se è occupato.
  function frameStrip(item) {
    const mine = ++request;
    const cells = frames.map(at => el('button', { type: 'button', class: 'frame-cell', 'aria-label': `Usa il fotogramma a ${at} secondi`, onclick: action(() => save(target, { at })) },
      el('span', { class: 'frame-wait' }, `${at} s`)));
    (async () => {
      for (const [i, at] of frames.entries()) {
        if (mine !== request) return;
        for (let attempt = 0; attempt < 3; attempt++) {
          const ok = await new Promise(resolve => {
            const img = el('img', { alt: '', src: `/media/${item.id}/frame?t=${at}&r=${attempt}`, onload: () => resolve(img), onerror: () => resolve(null) });
          });
          if (mine !== request) return;
          if (ok) { cells[i].replaceChildren(ok, el('small', {}, `${at} s`)); break; }
          await new Promise(r => setTimeout(r, 600));
        }
      }
    })();
    return el('div', { class: 'frame-strip' }, ...cells);
  }
  function pictureStrip(item) {
    if (!pictures.length) return el('p', { class: 'muted' }, 'Nessuna immagine JPG, PNG o WebP nella cartella del video o in quella sopra. Caricala con «Aggiungi file», poi riprova.');
    return el('div', { class: 'frame-strip' }, ...pictures.map(path => el('button', { type: 'button', class: 'frame-cell', 'aria-label': `Usa ${path}`, onclick: action(() => save(target, { path })) },
      el('img', { src: `/api/manage/picture?id=${encodeURIComponent(item.id)}&path=${encodeURIComponent(path)}`, alt: '', loading: 'lazy' }), el('small', {}, path.split('/').pop()))));
  }
  function paint() {
    const box = $('#art-editor'); const item = selected();
    if (!item) { box.replaceChildren(el('p', { class: 'muted' }, 'Scegli un titolo in «Sistema titoli» qui sopra.')); return; }
    if (!$('#art-panel').open) return;
    const description = el('textarea', { id: 'art-description', rows: '4', maxlength: '2000' }); description.value = item.description || '';
    const seriesDescription = item.series ? el('textarea', { id: 'art-series-description', rows: '4', maxlength: '2000' }) : null;
    if (seriesDescription) seriesDescription.value = item.seriesDescription || '';
    box.replaceChildren(...[
      el('p', { class: 'muted' }, `${item.series ? `${item.series} · ${episodeLabel(item)} · ` : ''}${item.title}. Le immagini scelte valgono per tutta la serie.`),
      el('div', { class: 'art-slots' }, preview(item, 'poster'), preview(item, 'backdrop')),
      frames ? el('section', { class: 'art-pick' }, el('h3', {}, `Scegli un fotogramma per ${target === 'poster' ? 'la locandina' : 'lo sfondo'}`), frameStrip(item)) : null,
      pictures ? el('section', { class: 'art-pick' }, el('h3', {}, `Scegli un’immagine per ${target === 'poster' ? 'la locandina' : 'lo sfondo'}`), pictureStrip(item)) : null,
      el('form', { class: 'edit-form', onsubmit: action(async event => {
        event.preventDefault();
        await api('/api/manage/edit', { method: 'POST', data: { id: item.id, description: description.value.trim(), ...(seriesDescription ? { seriesDescription: seriesDescription.value.trim(), scope: 'series' } : {}) } });
        await c.reloadLibrary(); notify('Descrizione salvata.');
      }) },
      el('label', { for: 'art-description' }, item.series ? 'Descrizione dell’episodio' : 'Descrizione del film', description),
      seriesDescription ? el('label', { for: 'art-series-description' }, 'Descrizione della serie (vale per tutti gli episodi)', seriesDescription) : null,
      el('p', { class: 'muted' }, 'Generi e sigla si cambiano nei pannelli «Sistema titoli» e «Salta riassunto, sigla e finale».'),
      el('div', { class: 'actions' }, el('button', { class: 'primary', type: 'submit' }, 'Salva la descrizione'),
        el('button', { class: 'secondary', type: 'button', onclick: action(async () => {
          await api('/api/manage/art', { method: 'POST', data: { id: item.id, scope: item.series ? 'series' : 'episode' } });
          notify('Rifaccio le immagini, una alla volta. Puoi continuare a usare Apollon.');
        }) }, item.series ? 'Rifai le immagini della serie' : 'Rifai le immagini')))].filter(Boolean));
  }
  const episodeLabel = item => `S${item.season}:E${item.episode}`;
  $('#art-panel').addEventListener('toggle', () => { if ($('#art-panel').open) paint(); });
  $('#edit-item').addEventListener('change', () => { frames = null; pictures = null; request++; paint(); });
  return { paint };
}
