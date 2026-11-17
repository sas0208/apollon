import { followingEpisode, storyEndOf } from '../logic.js';
export function nextEpisode(items, item) { const next = item?.series ? followingEpisode(items, item) : null; return next && !next.remoteDown ? next : null; }
export const backLayer = state => state.panel ? 'panel' : state.scrub ? 'scrub' : state.overlay ? 'overlay' : 'exit';
// 12/11: il conto alla rovescia parte solo da dove la storia è sicuramente finita. Prima partiva all'inizio della sigla finale
// (o a 20 secondi dalla fine) e dopo 10 secondi cambiava episodio: tagliava la scena dopo i titoli e le ultime battute.
export const nextPrompt = (item,duration,position,hasNext) => { const end = Number.isFinite(duration) && duration > 0 ? storyEndOf(item,duration) : null; return !!hasNext && end !== null && position >= end && position < duration; };
