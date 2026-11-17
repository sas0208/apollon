export function marqueePlan(overflow) {
  if (!Number.isFinite(overflow) || overflow <= 1) return null;
  const travel = overflow / 25 * 1000, duration = travel * 2 + 3200;
  return { duration, frames: [
    { transform: 'translateX(0)', offset: 0 }, { transform: 'translateX(0)', offset: 1600 / duration },
    { transform: `translateX(${-overflow}px)`, offset: (1600 + travel) / duration },
    { transform: `translateX(${-overflow}px)`, offset: (3200 + travel) / duration }, { transform: 'translateX(0)', offset: 1 }
  ] };
}
export function watchMarquees(nodes) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'); const animations = new Map(); let frame;
  const refresh = () => {
    cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      for (const node of nodes) {
        animations.get(node)?.cancel(); animations.delete(node);
        let text = node.firstElementChild;
        if (!text) { text = document.createElement('span'); text.className = 'marquee-text'; text.textContent = node.textContent; node.replaceChildren(text); }
        node.classList.add('marquee-title'); node.title = text.textContent;
        const plan = marqueePlan(text.scrollWidth - node.clientWidth);
        if (plan && typeof text.animate === 'function' && !reduced.matches && !document.hidden && node.getClientRects().length) {
          animations.set(node, text.animate(plan.frames, { duration: plan.duration, iterations: Infinity, easing: 'linear' }));
        }
      }
    });
  };
  if ('ResizeObserver' in globalThis) { const observer = new ResizeObserver(refresh); nodes.forEach(n => observer.observe(n)); }
  if (reduced.addEventListener) reduced.addEventListener('change', refresh); else reduced.addListener?.(refresh);
  document.addEventListener('visibilitychange', refresh);
  document.fonts?.ready.then(refresh); refresh(); return refresh;
}
export function vibrate(enabled, device = globalThis.navigator) {
  if (!enabled || typeof device?.vibrate !== 'function') return false;
  try { return device.vibrate(12); } catch { return false; }
}
let pageTransition;
export async function changeMusicPage(render, { enabled = true, doc = globalThis.document } = {}) {
  if (!enabled || typeof doc?.startViewTransition !== 'function') return render();
  pageTransition?.skipTransition(); let applied = false;
  const apply = () => { applied = true; return render(); };
  try {
    const transition = pageTransition = doc.startViewTransition(apply);
    transition.ready?.catch(() => {}); transition.finished?.catch(() => {});
    await transition.updateCallbackDone;
  } catch (error) { if (!applied) return apply(); throw error; }
}
// Small, original SVG geometry shared by the controls and list indicators.
export function musicIcon(name, filled = false) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', class: `music-icon icon-${name}`, 'aria-hidden': 'true', focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) svg.setAttribute(k, v);
  const paths = { heart: 'M12 20C8 17 3 13 3 8.5C3 3.5 9 3 12 7C15 3 21 3.5 21 8.5C21 13 16 17 12 20Z',
    play: 'M8 4L20 12L8 20Z', pause: 'M8 5V19M16 5V19', next: 'M5 5L16 12L5 19ZM19 5V19', previous: 'M19 5L8 12L19 19ZM5 5V19', close: 'M6 6L18 18M18 6L6 18' };
  if (name === 'bars') {
    for (let i = 0; i < 4; i++) {
      const rect = document.createElementNS(svg.namespaceURI, 'rect');
      for (const [k, v] of Object.entries({ x: 3 + i * 5, y: 5, width: 3, height: 15, rx: 1, fill: 'currentColor', stroke: 'none' })) rect.setAttribute(k, v);
      svg.append(rect);
    }
  } else {
    const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name] || paths.play);
    if (filled || name === 'play') path.setAttribute('fill', 'currentColor'); svg.append(path);
  }
  return svg;
}
export function setMusicIcon(button, name) {
  if (button.dataset.musicIcon === name) return;
  button.replaceChildren(musicIcon(name)); button.dataset.musicIcon = name;
}
