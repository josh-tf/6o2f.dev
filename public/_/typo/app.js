import { $, esc, mountBar } from '/_/ui.js';
import { RATIOS, STACKS, format, scale } from './lib.js';
mountBar('Type scale');

const opts = RATIOS.map(([n, v], i) => `<option value="${i}">${n} (${+v.toFixed(3)})</option>`).join('');
$('#ratio').innerHTML = opts + '<option value="custom">Custom…</option>';
$('#fratio').innerHTML = opts;
$('#ratio').value = '3';
$('#fratio').value = '4'; // major third -> perfect fourth on big screens
$('#fonts').innerHTML = Object.keys(STACKS)
  .map(
    (k, i) => `<label class="opt"><input type="radio" name="font" value="${k}"${i ? '' : ' checked'}><span>${k[0].toUpperCase() + k.slice(1)}</span></label>`,
  )
  .join('');
let msgT;
const num = (id) => {
  const el = $('#' + id);
  return el.value === '' ? NaN : Number(el.value);
};
const pick = (n) => document.querySelector(`[name=${n}]:checked`).value;

function settings() {
  const custom = $('#ratio').value === 'custom',
    mode = $('#rule').value;
  $('#customRow').hidden = !custom;
  $('#flRow').hidden = !$('#fl').checked;
  $('#lhvl').textContent = mode === 'gap' ? 'Gap at the base size (px)' : 'Line height (× size)';
  $('#ruleHelp').textContent =
    mode === 'gap'
      ? 'Line box = size + gap, so big headings get tighter. Smaller steps keep the base ratio.'
      : 'Every step uses the same unitless line height.';
  const o = {
    base: num('base'),
    ratio: custom ? num('custom') : RATIOS[+$('#ratio').value][1],
    up: Math.round(num('up')),
    down: Math.round(num('down')),
    root: num('root'),
    rule: { mode, value: num('lhv'), grid: num('grid') || 0, base: num('base') },
    unit: pick('unit'),
  };
  if ($('#fl').checked) o.fluid = { base: num('fbase'), ratio: RATIOS[+$('#fratio').value][1], minVw: num('minvw'), maxVw: num('maxvw') };
  const errs = [];
  for (const el of document.querySelectorAll('.ty-set input[type=number]')) {
    // the fields' own min/max (keeps the specimen from rendering absurd sizes)
    if (el.closest('[hidden]') || el.value === '' || !(el.validity.rangeUnderflow || el.validity.rangeOverflow)) continue;
    errs.push(`${el.labels[0].textContent.replace(/\s*\(.*\)$/, '')} must be between ${el.min} and ${el.max}.`);
  }
  if (!(o.base >= 1)) errs.push('Base size must be a positive number of pixels.');
  if (!(o.ratio > 1)) errs.push('The ratio must be greater than 1 (try 1.2).');
  if (!(o.up >= 0) || !(o.down >= 0)) errs.push('Steps must be 0 or more.');
  if (!(o.root > 0)) errs.push('Root font size must be positive.');
  if (!(o.rule.value >= 0) || (mode === 'fixed' && !(o.rule.value > 0)))
    errs.push(mode === 'gap' ? 'The gap must be 0 or more pixels.' : 'The line height must be above 0 (try 1.5).');
  if (o.fluid && !(o.fluid.base >= 1)) errs.push('The large-screen base size must be a positive number.');
  if (o.fluid && !(o.fluid.maxVw > o.fluid.minVw && o.fluid.minVw >= 0)) errs.push('The large screen must be wider than the small screen.');
  return { o, errs };
}
function render() {
  const { o, errs } = settings();
  $('#err').textContent = errs.join(' ');
  const rows = errs.length ? null : scale(o);
  if (!rows) return;
  const preview = o.fluid ? scale({ ...o, unit: 'px' }) : rows; // px clamp so the specimen ignores this page's own root size
  const stack = STACKS[pick('font')],
    text = esc($('#sample').value || 'The quick brown fox jumps over the lazy dog');
  $('#spec').innerHTML = rows
    .map(
      (x, i) => `<div class="ty-row"><p class="ty-meta"><b>${x.step}</b> ${o.fluid ? `${x.px}→${x.max}px` : `${x.px}px · ${x.rem}rem`} · lh ${x.lh}</p>
    <p class="ty-txt" style="font-family:${esc(stack)};font-size:${o.fluid ? preview[i].clamp : `${x.px}px`};line-height:${x.lh}">${text}</p></div>`,
    )
    .join('');
  const fl = !!o.fluid;
  $('#tab').innerHTML =
    `<caption class="vh">Sizes for each step</caption><thead><tr><th scope="col">Step</th><th scope="col">${fl ? 'Small' : 'px'}</th>${fl ? '<th scope="col">Large</th><th scope="col">clamp()</th>' : '<th scope="col">rem</th>'}<th scope="col">Line height</th></tr></thead><tbody>` +
    rows
      .map(
        (x) =>
          `<tr${x.step === 0 ? ' class="ty-base"' : ''}><th scope="row">${x.step}</th><td>${x.px}px</td>${fl ? `<td>${x.max}px</td><td><code>${esc(x.clamp)}</code></td>` : `<td>${x.rem}rem</td>`}<td>${x.lh}</td></tr>`,
      )
      .join('') +
    '</tbody>';
  $('#out').value = format(rows, pick('fmt'), o.unit, $('#prefix').value);
}
document.addEventListener('input', (e) => {
  if (e.target.closest('main') && e.target.id !== 'out') render();
});
document.addEventListener('change', (e) => {
  if (e.target.matches('select,[type=radio],[type=checkbox]')) render();
});
$('#rule').addEventListener('change', () => {
  $('#lhv').value = $('#rule').value === 'gap' ? '8' : '1.5';
  render();
});
$('#copy').addEventListener('click', async () => {
  const say = (t) => {
    $('#msg').textContent = t;
    clearTimeout(msgT);
    msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
  };
  try {
    await navigator.clipboard.writeText($('#out').value);
    say('Copied.');
  } catch {
    $('#out').select();
    say(document.execCommand?.('copy') ? 'Copied.' : 'Copy blocked by the browser. The text is selected, press Ctrl+C.');
  }
});
render();
