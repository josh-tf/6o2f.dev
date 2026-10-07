import { $, mountBar } from '/_/ui.js';
import { newLayer, PRESETS, shadowCss, shadowValue } from './lib.js';
import { colorFieldHtml, wireColorFields } from '/_/gradient/colorfield.js';
mountBar('Shadow');
let layers = structuredClone(PRESETS.Layered),
  text = false;
const num = (f, v, i, l, min, max) =>
  `<div><label for="${f}${i}">${l}</label><input id="${f}${i}" type="number" data-f="${f}" data-i="${i}" value="${v}" inputmode="decimal"${min != null ? ` min="${min}" max="${max}" step="${max === 1 ? 0.05 : 1}"` : ' step="1"'}></div>`;
function paint() {
  const v = shadowValue(layers, text);
  $('#el').style[text ? 'textShadow' : 'boxShadow'] = v.replace(/\n\s*/g, ' ');
  $('#el').style[text ? 'boxShadow' : 'textShadow'] = '';
  $('#el').style.borderRadius = text ? '' : $('#rad').value + 'px';
  $('#stage').className = [$('#bg').value === 'dark' && 'dark', text && 'text'].filter(Boolean).join(' ');
  $('#css').textContent = shadowCss(layers, text);
}
function render() {
  $('#layers').innerHTML = layers
    .map(
      (l, i) => `<fieldset class="layer"><legend>Layer ${i + 1}</legend>
${num('x', l.x, i, 'X')}${num('y', l.y, i, 'Y')}${num('blur', l.blur, i, 'Blur', 0, 200)}${text ? '' : num('spread', l.spread, i, 'Spread')}
<div><span class="lbl" aria-hidden="true">Color</span>${colorFieldHtml(`color${i}`, l.color, `color of layer ${i + 1}`)}</div>
${num('alpha', l.alpha, i, 'Alpha', 0, 1)}
${text ? '' : `<label class="chk"><input type="checkbox" data-f="inset" data-i="${i}"${l.inset ? ' checked' : ''}>Inset</label>`}
<button type="button" data-del="${i}" aria-label="Remove layer ${i + 1}">Remove</button></fieldset>`,
    )
    .join('');
  wireColorFields($('#layers'), (input, hex) => {
    layers[+input.id.slice(5)].color = hex;
    paint();
  });
  $('#empty').hidden = layers.length > 0;
  $('#f-rad').hidden = text;
  paint();
}
$('#presets').innerHTML = Object.keys(PRESETS)
  .map((k) => `<button type="button" data-p="${k}">${k}</button>`)
  .join('');
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.p) layers = structuredClone(PRESETS[t.dataset.p]);
  else if (t.dataset.del) layers.splice(+t.dataset.del, 1);
  else if (t.id === 'add') layers.push(newLayer());
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
  if (f) layers[+t.dataset.i][f] = t.type === 'checkbox' ? t.checked : f === 'alpha' ? Math.min(1, Math.max(0, +t.value || 0)) : +t.value || 0;
  else if (t.id === 'mode') {
    text = t.value === 'text';
    return render();
  } else if (t.id !== 'bg' && t.id !== 'rad') return;
  paint();
});
render();
