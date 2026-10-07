import { $, esc, mountBar } from '/_/ui.js';
import { parse, relative, toLocalInput } from './lib.js';
mountBar('Timestamp');
const rows = (list) =>
  list
    .map(
      ([k, v]) =>
        `<tr><th scope="row">${k}</th><td class="v">${esc(v)}</td><td class="c"><button type="button" data-v="${esc(v)}" aria-label="Copy ${k}">Copy</button></td></tr>`,
    )
    .join('');
const iso = (d) => d.toISOString();
const nowVals = () => {
  const n = new Date();
  return [Math.floor(n / 1000), +n, iso(n)];
};
function tick() {
  // update cells in place so Copy keeps focus and its "Copied" label
  const t = $('#now').tBodies[0],
    v = nowVals();
  if (!t.rows.length)
    t.innerHTML = rows([
      ['Epoch (s)', 0],
      ['Epoch (ms)', 0],
      ['ISO 8601', 0],
    ]);
  [...t.rows].forEach((r, i) => {
    r.cells[1].textContent = v[i];
    r.querySelector('button').dataset.v = v[i];
  });
  const rel = $('#out').tBodies[0].rows[5],
    p = rel && parse($('#in').value.trim()); // keep the Relative row live too
  if (p && rel.cells[1].textContent !== relative(p.date)) {
    rel.cells[1].textContent = rel.querySelector('button').dataset.v = relative(p.date);
  }
}
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
function show() {
  const v = $('#in').value.trim(),
    p = parse(v),
    m = $('#msg');
  $('#err').textContent = p || !v ? '' : 'Not a valid epoch or date. Try 1700000000 or 2023-11-14T22:13:20Z.';
  m.textContent = p ? `Read as ${p.kind}.` : v ? '' : 'Type an epoch or a date, or press Use now.';
  if (!p && v) $('#in').setAttribute('aria-invalid', 'true');
  else $('#in').removeAttribute('aria-invalid');
  if (!p) {
    $('#out').tBodies[0].innerHTML = '';
    return p;
  }
  const d = p.date;
  $('#dt').value = toLocalInput(d);
  $('#out').tBodies[0].innerHTML = rows([
    ['Epoch (s)', Math.floor(d / 1000)],
    ['Epoch (ms)', +d],
    ['ISO 8601', iso(d)],
    ['UTC', d.toUTCString()],
    [`Local (${tz})`, d.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'long' })],
    ['Relative', relative(d)],
  ]);
}
$('#in').addEventListener('input', show);
$('#dt').addEventListener('input', (e) => {
  const d = new Date(e.target.value);
  if (!isNaN(d)) {
    $('#in').value = +d;
    show();
  }
});
$('#usenow').addEventListener('click', () => {
  $('#in').value = Math.floor(Date.now() / 1000);
  show();
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-v]');
  if (!b) return;
  try {
    await navigator.clipboard.writeText(b.dataset.v);
    b.textContent = 'Copied';
  } catch {
    getSelection().selectAllChildren(b.closest('tr').cells[1]);
    b.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1200);
});
$('#in').value = Math.floor(Date.now() / 1000) - 3 * 3600; // example: three hours ago
show();
setInterval(tick, 250);
tick();
