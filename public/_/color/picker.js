import { hsvToRgb, parse, rgbToHsv, toHex } from './lib.js';

/** Themed colour picker: a button showing the colour opens a saturation/brightness square, a hue slider and (where supported) an eyedropper.
 *  Writes #rrggbb into `input` and calls onChange(); `set(color)` updates it from outside without calling onChange. */
export function makePicker(btn, input, onChange) {
  let h = 0,
    s = 0,
    v = 0;
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.hidden = true;
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Pick a color');
  pop.innerHTML = `<div class="sv" tabindex="0" role="application" aria-label="Saturation and brightness. Arrow keys move, hold Shift for bigger steps."><i></i></div>
    <label class="hl">Hue<input class="hue" type="range" min="0" max="360" step="1"></label>${window.EyeDropper ? '<button type="button" class="eye">Pick from screen</button>' : ''}`;
  btn.after(pop);
  const sv = pop.querySelector('.sv'),
    knob = sv.firstChild,
    hue = pop.querySelector('.hue');
  const cur = () => hsvToRgb(h, s, v);
  const paint = () => {
    sv.style.setProperty('--hue', `hsl(${h} 100% 50%)`);
    knob.style.left = `${s * 100}%`;
    knob.style.top = `${(1 - v) * 100}%`;
    hue.value = String(Math.round(h));
    btn.style.background = toHex(cur());
  };
  const emit = () => {
    paint();
    input.value = toHex(cur());
    onChange();
  };
  const fromPoint = (e) => {
    const r = sv.getBoundingClientRect();
    s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    v = 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    emit();
  };
  sv.addEventListener('pointerdown', (e) => {
    sv.setPointerCapture(e.pointerId);
    sv.focus();
    fromPoint(e);
  });
  sv.addEventListener('pointermove', (e) => {
    if (sv.hasPointerCapture(e.pointerId)) fromPoint(e);
  });
  sv.addEventListener('keydown', (e) => {
    const d = e.shiftKey ? 0.05 : 0.01;
    const m = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }[e.key];
    if (!m) return;
    e.preventDefault();
    s = Math.min(1, Math.max(0, s + m[0]));
    v = Math.min(1, Math.max(0, v + m[1]));
    emit();
  });
  hue.addEventListener('input', () => {
    h = Number(hue.value);
    emit();
  });
  pop.querySelector('.eye')?.addEventListener('click', async () => {
    try {
      const { sRGBHex } = await new window.EyeDropper().open();
      set(sRGBHex);
      input.value = sRGBHex;
      onChange();
    } catch {}
  });
  const close = () => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', String(!pop.hidden));
    if (!pop.hidden) sv.focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) close();
  });
  pop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      btn.focus();
    }
  });
  function set(color) {
    const c = typeof color === 'string' ? parse(color) : color;
    if (!c) return;
    const n = rgbToHsv(c);
    s = n.s;
    v = n.v;
    if (n.s > 0.001 && n.v > 0.001) h = n.h; // keep the hue when the colour is grey or black
    paint();
  }
  return { set };
}
