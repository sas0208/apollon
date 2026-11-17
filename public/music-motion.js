// Geometry is separate from DOM work so the same path can be tested both ways.
export function rectTransform(from, to) {
  if (!to.width || !to.height) return 'none';
  return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}
export function motionOptions({ reduced = false, phone = false, tv = false } = {}) {
  return { duration: reduced ? 90 : phone && !tv ? 300 : 180, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' };
}

export class PlayerMotion {
  constructor(dialog, mini, cover, miniCover) { Object.assign(this, { dialog, mini, cover, miniCover }); }
  async run(opening, startRect) {
    this.cancel();
    const { dialog, mini, cover, miniCover } = this;
    if (!dialog.open || !dialog.animate) return;
    const options = motionOptions({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
      phone: matchMedia('(max-width:650px)').matches, tv: document.documentElement.classList.contains('tv') });
    const animations = []; const temporary = []; const restores = [];
    const animate = (node, frames) => { const a = node.animate(opening ? frames : [...frames].reverse(), options); animations.push(a); };
    const hide = node => { const old = node.style.visibility; node.style.visibility = 'hidden'; restores.push(() => { node.style.visibility = old; }); };
    if (options.duration === 90) animate(dialog, [{ opacity: 0 }, { opacity: 1 }]);
    else {
      const full = dialog.getBoundingClientRect();
      const layer = (name, rect) => {
        const node = document.createElement('div'); node.className = name; node.setAttribute('aria-hidden', 'true');
        Object.assign(node.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        dialog.append(node); temporary.push(node); return node;
      };
      const surface = layer('player-surface', full);
      animate(surface, [{ transform: rectTransform(mini.getBoundingClientRect(), full), borderRadius: '12px' }, { transform: startRect ? rectTransform(startRect, full) : 'none', borderRadius: getComputedStyle(dialog).borderRadius }]);
      const rect = cover.getBoundingClientRect();
      if (rect.width && rect.height) {
        const flight = layer('player-flight', rect); const img = miniCover.cloneNode(); img.removeAttribute('id'); img.alt = ''; flight.append(img);
        const shifted = startRect ? { ...rect.toJSON(), top: rect.top + startRect.top - full.top } : rect;
        animate(flight, [{ transform: rectTransform(miniCover.getBoundingClientRect(), rect) }, { transform: rectTransform(shifted, rect) }]);
        hide(cover); hide(miniCover);
      }
      for (const child of [...dialog.children]) if (!temporary.includes(child)) animate(child, [{ opacity: 0 }, { opacity: 1 }]);
      dialog.classList.add('player-moving');
    }
    const cleanup = () => { animations.forEach(a => a.cancel()); temporary.forEach(n => n.remove()); restores.forEach(fn => fn()); dialog.classList.remove('player-moving'); };
    this.cleanup = cleanup;
    await Promise.allSettled(animations.map(a => a.finished));
    if (this.cleanup === cleanup) { cleanup(); this.cleanup = null; }
  }
  cancel() { this.cleanup?.(); this.cleanup = null; }
}
