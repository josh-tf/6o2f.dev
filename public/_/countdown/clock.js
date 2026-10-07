// Renders d/h/m/s boxes into a container (shared by the preview and the viewer).
import { pad2, parts } from './lib.js';
export function drawClock(el, ms) {
  const p = parts(ms);
  const units = [
    ['d', 'days', String(p.d)],
    ['h', 'hours', pad2(p.h)],
    ['m', 'minutes', pad2(p.m)],
    ['s', 'seconds', pad2(p.s)],
  ];
  if (el.children.length !== 4)
    el.replaceChildren(
      ...units.map(([k, label]) => {
        const d = document.createElement('div');
        d.dataset.k = k;
        d.append(document.createElement('b'), Object.assign(document.createElement('span'), { textContent: label }));
        return d;
      }),
    );
  units.forEach(([, , v], i) => {
    const b = el.children[i].firstChild;
    if (b.textContent !== v) b.textContent = v;
  });
  return p;
}
/** Calls fn every second, aligned to the wall clock, and immediately when the tab becomes visible (timers are throttled in background tabs; values are always recomputed from Date.now()). */
export function everySecond(fn) {
  let t;
  const tick = () => {
    clearTimeout(t);
    if (fn() === false) return;
    t = setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  };
  document.addEventListener('visibilitychange', () => !document.hidden && tick());
  tick();
}
