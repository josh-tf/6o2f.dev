import { $, esc, mountBar } from '/_/ui.js';
import { parse, toHex, toRgb, toHsl, toOklch, nameOf, contrast, verdicts, over, ramp, pageTheme } from './lib.js';
import { makePicker } from './picker.js';
mountBar('Color');
const WHITE = { r: 255, g: 255, b: 255, a: 1 },
  BLACK = { r: 0, g: 0, b: 0, a: 1 };
const ink = (bg) => (contrast(bg, BLACK) >= contrast(bg, WHITE) ? '#000' : '#fff');
let msgT;
async function copy(text) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${text.length > 60 ? 'CSS variables' : text}`;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? `Copied ${text.length > 60 ? 'CSS variables' : text}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}
function draw() {
  const fg = parse($('#fg').value),
    bgIn = parse($('#bg').value);
  $('#err').textContent = fg ? '' : 'Not a color: try #0b7a35, rgb(11 122 53), hsl(142 83% 26%) or oklch(50% 0.13 150).';
  $('#fg').setAttribute('aria-invalid', String(!fg));
  $('#bgerr').textContent = bgIn ? '' : 'Not a color: the background needs a hex, rgb(), hsl(), oklch() value or a name.';
  $('#bg').setAttribute('aria-invalid', String(!bgIn));
  if (!fg || !bgIn) return;
  picks.fg.set(fg);
  picks.bg.set(bgIn);
  const dark = matchMedia('(prefers-color-scheme: dark)').matches; // tint the whole page from the chosen colour
  for (const [k, val] of Object.entries(pageTheme(fg, dark))) document.documentElement.style.setProperty(k, val);
  const rows = [
    ['HEX', toHex(fg)],
    ['RGB', toRgb(fg)],
    ['HSL', toHsl(fg)],
    ['OKLCH', toOklch(fg)],
  ];
  if (nameOf(fg)) rows.push(['Name', nameOf(fg)]);
  $('#fmt').innerHTML = rows
    .map(
      ([k, v]) =>
        `<tr><th scope="row">${k}</th><td class="mono">${esc(v)}</td><td><button type="button" data-c="${esc(v)}" aria-label="Copy ${k}">Copy</button></td></tr>`,
    )
    .join('');
  $('#fmt').insertAdjacentHTML('afterbegin', '<caption class="vh">The color in each format</caption>');
  $('#swatch').innerHTML = `<i style="background:${esc(toRgb(fg))}"></i>`;
  const bg = over(bgIn, WHITE),
    f = over(fg, bg),
    r = contrast(f, bg),
    v = verdicts(r);
  $('#ratio').textContent = `${(Math.floor(r * 100) / 100).toFixed(2)} : 1`;
  const cell = (ok) => `<td class="${ok ? 'pass' : 'fail'}">${ok ? 'Pass' : 'Fail'}</td>`;
  $('#ver').innerHTML =
    `<caption class="vh">WCAG contrast results</caption><thead><tr><th scope="col"><span class="vh">Text size</span></th><th scope="col">AA</th><th scope="col">AAA</th></tr></thead><tbody><tr><th scope="row">Normal text</th>${cell(v.aaNormal)}${cell(v.aaaNormal)}</tr><tr><th scope="row">Large text</th>${cell(v.aaLarge)}${cell(v.aaaLarge)}</tr></tbody>`;
  $('#sample').style.cssText = `background:${toRgb(bg)};color:${toRgb(f)}`;
  const steps = ramp(fg);
  $('#ramp').innerHTML = steps
    .map(
      (s) =>
        `<button type="button" style="background:${s.hex};color:${ink(parse(s.hex))}" data-c="${s.hex}" aria-label="Copy ${s.step} ${s.hex}"><b>${s.step}</b>${s.hex}</button>`,
    )
    .join('');
  $('#cramp').dataset.css = steps.map((s) => `--color-${s.step}: ${s.hex};`).join('\n');
}
// text boxes and pickers stay in sync without clobbering what is being typed
const picks = { fg: makePicker($('#fgp'), $('#fg'), () => draw()), bg: makePicker($('#bgp'), $('#bg'), () => draw()) };
for (const k of ['fg', 'bg']) $('#' + k).addEventListener('input', draw);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
$('#swap').addEventListener('click', () => {
  [$('#fg').value, $('#bg').value] = [$('#bg').value, $('#fg').value];
  draw();
});
$('#cramp').addEventListener('click', (e) => copy(e.target.dataset.css));
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-c]')?.dataset.c;
  if (c) copy(c);
});
$('#fg').value = '#0b7a35';
draw();
