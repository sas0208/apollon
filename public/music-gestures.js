export function gestureAxis(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 10) return null;
  if (Math.abs(dx) > Math.abs(dy) * 1.2) return 'x';
  if (Math.abs(dy) > Math.abs(dx) * 1.2) return 'y';
  return null;
}
export function gestureAction({ mode, axis, dx, dy, width, height, vx = 0, vy = 0, atTop = true }) {
  if (axis === 'x' && mode !== 'handle' && (Math.abs(dx) >= Math.max(48, Math.min(100, width * .22)) || (Math.abs(dx) > 24 && Math.abs(vx) > .55 && Math.sign(vx) === Math.sign(dx)))) return dx < 0 ? 'next' : 'previous';
  if (axis === 'y' && mode === 'mini' && (dy < -56 || (dy < -24 && vy < -.55))) return 'open';
  if (axis === 'y' && mode !== 'mini' && atTop && (dy > height * .3 || (dy > 32 && vy > .65))) return 'close';
  return null;
}

// Pointer capture starts only after intent is clear. Buttons/ranges, multi-touch,
// lists and native playlist drag never enter this handler.
export function bindPlayerGesture(surface, { mode, moving = surface, scroller, enabled, perform, feedback = () => {} }) {
  let drag; let blockClick = false; let reset;
  const targets = [...new Set([surface, moving])];
  const restore = () => { for (const node of targets) { node.style.removeProperty('transform'); node.classList.remove('player-dragging'); } };
  const settle = () => {
    for (const node of targets) { node.classList.remove('player-dragging'); node.style.removeProperty('transform'); }
    clearTimeout(reset); reset = setTimeout(restore, 180);
  };
  const finish = (event, cancelled = false) => {
    if (!drag || event.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (surface.hasPointerCapture?.(d.id)) surface.releasePointerCapture(d.id);
    if (!d.axis) return;
    blockClick = true; setTimeout(() => { blockClick = false; }, 400);
    const last = d.samples.at(-1); const recent = d.samples.find(s => last.t - s.t <= 100) || last;
    const dt = Math.max(1, event.timeStamp - recent.t);
    const action = cancelled || d.scrolling ? null : gestureAction({ mode, axis: d.axis, dx: d.dx, dy: d.dy,
      width: surface.clientWidth, height: scroller?.clientHeight || surface.clientHeight,
      vx: (event.clientX - recent.x) / dt, vy: (event.clientY - recent.y) / dt, atTop: d.top <= 1 });
    if (action === 'close') {
      // Read the dragged geometry before removing its transform for the flight.
      const rect = moving.getBoundingClientRect();
      moving.style.transition = 'none'; restore(); moving.getBoundingClientRect(); moving.style.removeProperty('transition');
      if (perform(action, rect) !== false) feedback();
    } else {
      if (action && perform(action) !== false) feedback();
      settle();
    }
  };
  surface.addEventListener('pointerdown', event => {
    if (drag && event.pointerId !== drag.id) { finish({ ...event, pointerId: drag.id }, true); return; }
    if (!enabled() || !event.isPrimary || event.pointerType === 'mouse' || event.button !== 0) return;
    if (event.target.closest('input,select,a,button:not(#open-music-player)')) return;
    clearTimeout(reset); restore();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, top: scroller?.scrollTop || 0,
      samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }] };
  });
  surface.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const d = drag; d.dx = event.clientX - d.x; d.dy = event.clientY - d.y;
    d.axis ||= gestureAxis(d.dx, d.dy);
    if (!d.axis) return;
    if (mode === 'handle' && d.axis === 'x') { drag = null; return; }
    event.preventDefault(); if (event.isTrusted) surface.setPointerCapture?.(event.pointerId);
    d.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp }); d.samples = d.samples.slice(-12);
    if (scroller && d.axis === 'y' && (d.top > 1 || d.dy < 0)) {
      d.scrolling = true; scroller.scrollTop = Math.max(0, d.top - d.dy); return;
    }
    const target = mode === 'cover' && d.axis === 'x' ? surface : moving;
    target.classList.add('player-dragging');
    target.style.transform = d.axis === 'x' ? `translateX(${d.dx}px)` : `translateY(${mode === 'mini' ? Math.min(0, d.dy) : Math.max(0, d.dy)}px)`;
  }, { passive: false });
  surface.addEventListener('pointerup', event => finish(event));
  surface.addEventListener('pointercancel', event => finish(event, true));
  // Implicit capture on a child (e.g. the mini cover) is transferred to this
  // surface after intent is clear; its bubbling loss must not cancel the drag.
  surface.addEventListener('lostpointercapture', event => { if (event.target === surface) finish(event, true); });
  surface.addEventListener('click', event => { if (blockClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
}
