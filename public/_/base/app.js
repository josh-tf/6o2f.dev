import { $, mountBar } from '/_/ui.js';
import { bytes, fits64, format, parse, toggle } from './lib.js';
const PFX = { 2: '0b', 8: '0o', 16: '0x' };
const digitsOf = (b) => (b <= 10 ? `0-${b - 1}` : `0-9 and a-${'abcdefghijklmnopqrstuvwxyz'[b - 11]}`);
mountBar('Bases');

const fields = [...document.querySelectorAll('input[data-b]'), $('#bx')];
const baseOf = (el) => (el.id === 'bx' ? +$('#base').value : +el.dataset.b);
const grid = $('#grid');
grid.innerHTML = Array.from(
  { length: 64 },
  (_, k) => `<button type="button" data-i="${63 - k}" data-v="0" aria-pressed="false" aria-label="Bit ${63 - k}"></button>`,
).join('');
let val = 0n;

function render(skip) {
  const ok = $('#base').checkValidity() && +$('#base').value >= 2 && +$('#base').value <= 36;
  $('#base').setAttribute('aria-invalid', String(!ok));
  for (const el of fields) {
    if (el === skip) continue;
    el.value = el === $('#bx') && !ok ? '' : format(val, baseOf(el));
    el.removeAttribute('aria-invalid');
  }
  const b = bytes(val);
  $('#be').textContent = b.join(' ');
  $('#le').textContent = [...b].reverse().join(' ');
  const fit = fits64(val),
    u = BigInt.asUintN(64, val);
  grid.toggleAttribute('data-off', !fit);
  for (const k of grid.children) {
    const on = fit && (u >> BigInt(k.dataset.i)) & 1n;
    k.dataset.v = on ? '1' : '0';
    k.setAttribute('aria-pressed', String(!!on));
  }
  $('#err').textContent = !ok ? 'Custom base must be a whole number from 2 to 36.' : fit ? '' : 'Needs more than 64 bits: the bit grid is disabled.';
}
$('.fields').addEventListener('input', (e) => {
  const el = e.target;
  if (!fields.includes(el) && el.id !== 'base') return;
  if (el.id === 'base') return render(null);
  const n = parse(el.value, baseOf(el));
  if (n === null) {
    if (!el.value.trim()) {
      val = 0n;
      render(el);
      return;
    }
    const b = baseOf(el);
    el.setAttribute('aria-invalid', 'true');
    $('#err').textContent = `Not a base ${b} number: digits are ${digitsOf(b)}, with an optional - sign${PFX[b] ? ` and ${PFX[b]} prefix` : ''}.`;
    return;
  }
  val = n;
  render(el);
});
grid.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && fits64(val)) {
    val = toggle(val, +b.dataset.i);
    render(null);
  }
});
val = 3735928559n;
render(null);
