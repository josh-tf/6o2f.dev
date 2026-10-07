import { $, mountBar } from '/_/ui.js';
import { backgroundCss, gradientCss, PRESETS, randomGradient } from './lib.js';
import { colorFieldHtml, wireColorFields } from './colorfield.js';
mountBar('Gradient');
let g = { angle: 90, shape: 'circle', x: 50, y: 50, ...structuredClone(PRESETS.Sunset) };
const btn = (a, i, t, l, dis) => `<button type="button" data-a="${a}" data-i="${i}" aria-label="${l} stop ${i + 1}"${dis ? ' disabled' : ''}>${t}</button>`;
function render(full = true) {
  $('#preview').style.background = gradientCss(g);
  $('#css').textContent = backgroundCss(g);
  if (!full) return;
  $('#type').value = g.type;
  $('#angle').value = g.angle;
  $('#shape').value = g.shape;
  $('#x').value = g.x;
  $('#y').value = g.y;
  $('#f-angle').hidden = g.type === 'radial';
  $('#f-shape').hidden = g.type !== 'radial';
  $('#f-pos').hidden = g.type === 'linear';
  $('#stops').innerHTML = g.stops
    .map(
      (s, i) => `<div class="stop" role="group" aria-label="Stop ${i + 1}">${colorFieldHtml(`c${i}`, s.color, `color of stop ${i + 1}`)}
<span class="pos"><input type="number" min="0" max="100" step="1" inputmode="numeric" value="${s.pos}" data-f="pos" data-i="${i}" aria-label="Position of stop ${i + 1} (%)" style="width:112px">%</span>
<span class="acts">${btn('up', i, '&uarr;', 'Move up', !i)}${btn('down', i, '&darr;', 'Move down', i === g.stops.length - 1)}${btn('del', i, '&times;', 'Remove', g.stops.length < 3)}</span></div>`,
    )
    .join('');
  wireColorFields($('#stops'), (input, hex) => {
    g.stops[+input.id.slice(1)].color = hex;
    render(false);
  });
}
$('#presets').innerHTML = Object.keys(PRESETS)
  .map((k) => `<button type="button" data-p="${k}">${k}</button>`)
  .join('');
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const { a, i, p } = t.dataset,
    k = +i;
  if (p) g = { angle: 90, shape: 'circle', x: 50, y: 50, ...structuredClone(PRESETS[p]) };
  else if (t.id === 'rand') g = randomGradient();
  else if (t.id === 'add') g.stops.push({ color: '#ffffff', pos: 100 });
  else if (a === 'del') g.stops.splice(k, 1);
  else if (a) g.stops.splice(k + (a === 'up' ? -1 : 1), 0, g.stops.splice(k, 1)[0]);
  else if (t.id === 'copy') {
    try {
      await navigator.clipboard.writeText($('#css').textContent);
      t.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren($('#css'));
      t.textContent = 'Press Ctrl+C';
    }
    return setTimeout(() => (t.textContent = 'Copy CSS'), 1500);
  } else return;
  render();
});
document.addEventListener('input', (e) => {
  const t = e.target,
    f = t.dataset.f;
  if (f) g.stops[+t.dataset.i][f] = Math.min(100, Math.max(0, +t.value || 0));
  else if (['type', 'angle', 'shape', 'x', 'y'].includes(t.id)) g[t.id] = t.type === 'number' ? (t.value === '' ? '' : +t.value) : t.value;
  else return;
  render(t.id === 'type');
});
render();
