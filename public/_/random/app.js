import { $, esc, mountBar } from '/_/ui.js';
import { randInt, randRange, shuffle } from './lib.js';
import { parseDice, roll } from './dice.js';
mountBar('Random');

const hist = [];
function show(form, html, label, text) {
  $('.out', $('#' + form)).innerHTML = html;
  hist.unshift([label, text]);
  hist.length = Math.min(hist.length, 20);
  $('#hist').innerHTML = hist.map(([l, t]) => `<li><b>${esc(l)}</b> ${esc(t)}</li>`).join('');
  $('#hist-empty').hidden = hist.length > 0;
}
const err = (form, msg) => {
  $('.out', $('#' + form)).innerHTML = `<span class="err" role="alert">${esc(msg)}</span>`;
};
const on = (id, fn) =>
  $('#' + id).addEventListener('submit', (e) => {
    e.preventDefault();
    fn(e.submitter?.value);
  });

on('dice', () => {
  const d = parseDice($('#d-in').value);
  if (!d) return err('dice', 'Use NdM+K, e.g. 3d6+2, d20 or 2d10-1 (up to 1000 dice).');
  const r = roll(d),
    shown = d.n > 20 ? `${r.rolls.slice(0, 20).join(' + ')} + ...` : r.rolls.join(' + ');
  show(
    'dice',
    `${r.total}<small>[${esc(shown)}]${d.k ? ` ${d.k > 0 ? '+' : '-'} ${Math.abs(d.k)}` : ''}</small>`,
    $('#d-in').value.trim(),
    `${r.total} (${r.rolls.length > 20 ? r.rolls.length + ' dice' : r.rolls.join(', ')})`,
  );
});
on('coin', () => {
  const h = randInt(2) === 0;
  show('coin', h ? 'Heads' : 'Tails', 'coin', h ? 'Heads' : 'Tails');
});
on('num', () => {
  const a = Math.trunc($('#n-min').valueAsNumber),
    b = Math.trunc($('#n-max').valueAsNumber);
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || b < a || b - a >= 2 ** 53) return err('num', 'Enter whole numbers with min <= max.');
  const n = randRange(a, b);
  show('num', String(n), `${a}..${b}`, String(n));
});
on('color', () => {
  const c = '#' + randInt(0x1000000).toString(16).padStart(6, '0');
  show('color', `<span class="sw" style="background:${c}"></span>${c}`, 'color', c);
});
on('list', (mode) => {
  const items = $('#l-in')
    .value.split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return err('list', 'Add at least one item.');
  const s = shuffle(items);
  if (mode === 'shuffle') return show('list', s.map((x, i) => `${i + 1}. ${esc(x)}`).join('<br>'), 'shuffle', s.join(', '));
  const k = Math.min(Math.max(1, Math.trunc($('#l-k').valueAsNumber) || 1), items.length),
    p = s.slice(0, k);
  show('list', p.map(esc).join('<br>'), k > 1 ? `pick ${k}` : 'pick', p.join(', '));
});
$('#clear').addEventListener('click', () => {
  hist.length = 0;
  $('#hist').innerHTML = '';
  $('#hist-empty').hidden = false;
});
$('#dice').requestSubmit();
