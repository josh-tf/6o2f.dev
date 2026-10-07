import { $, mountBar } from '/_/ui.js';
import { fluid, sizeAt } from './lib.js';
mountBar('Fluid type');
const WIDTHS = [320, 375, 768, 1024, 1440, 1920],
  f = (x) => +x.toFixed(2);
const read = () => ({ min: +$('#min').value, max: +$('#max').value, minVw: +$('#minvw').value, maxVw: +$('#maxvw').value, unit: $('#unit').value });
function draw() {
  const p = read(),
    r = $('#min').value && $('#max').value && fluid(p);
  $('#err').textContent = r ? '' : 'Enter sizes of 0 or more and a max viewport larger than the min viewport.';
  $('#out').hidden = !r;
  if (!r) return;
  $('#css').textContent = r.css;
  const w = +$('#vw').value,
    s = sizeAt(p, w);
  $('#vwv').textContent = `${w}px`;
  $('#size').textContent = `Computed: ${f(s)}px = ${f(s / 16)}rem`;
  $('#prev').style.fontSize = s + 'px';
  $('#tbl tbody').innerHTML = WIDTHS.map(
    (x) => `<tr><th scope="row" class="n">${x}px</th><td class="n">${f(sizeAt(p, x))}</td><td class="n">${f(sizeAt(p, x) / 16)}</td></tr>`,
  ).join('');
}
document.addEventListener('input', draw);
$('#copy').addEventListener('click', async (e) => {
  const b = e.currentTarget,
    t = $('#css').textContent;
  try {
    await navigator.clipboard.writeText(t);
    b.textContent = 'Copied';
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#css'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    b.textContent = 'Selected, press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1500);
});
draw();
