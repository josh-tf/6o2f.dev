import { $, esc, mountBar } from '/_/ui.js';
import { CATS, convert, show, parseNum, sym } from './lib.js';
mountBar('Units');
let cat = 'length',
  from = 'km',
  to = 'mi',
  v = '10';
try {
  const s = JSON.parse(localStorage.unitsState || 'null');
  if (s && CATS[s.cat]?.[s.from] && CATS[s.cat][s.to]) ({ cat, from, to, v } = s);
} catch {}
const opts = (u, sel) =>
  Object.entries(CATS[u])
    .map(([k, [n]]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(n)}</option>`)
    .join('');
const num = () => parseNum(v);
function render(skip) {
  const x = num();
  const val = (u) => (x === null ? '' : show(convert(cat, from, u, x)));
  $('#res').textContent =
    x === null ? (v.trim() ? `"${v.trim().slice(0, 40)}" is not a number` : 'Enter a value') : `${show(x)} ${sym(cat, from)} = ${val(to)} ${sym(cat, to)}`;
  $('#res').classList.toggle('err', x === null && !!v.trim());
  $('#warn').hidden = !(cat === 'temperature' && x !== null && convert(cat, from, 'k', x) < -1e-9);
  if (skip !== 'v') $('#v').value = v;
  for (const u in CATS[cat]) {
    const i = $('#u-' + u);
    if (i && u !== skip) i.value = u === from ? v : val(u);
  }
  try {
    localStorage.unitsState = JSON.stringify({ cat, from, to, v });
  } catch {}
}
function setCat(c) {
  cat = c;
  const k = Object.keys(CATS[c]);
  if (!CATS[c][from]) from = k[0];
  if (!CATS[c][to] || to === from) to = k[1];
  $('#from').innerHTML = opts(c, from);
  $('#to').innerHTML = opts(c, to);
  $('#all').innerHTML = k
    .map(
      (u) =>
        `<div><label for="u-${u}">${esc(CATS[c][u][0])}</label><input id="u-${u}" data-u="${u}" inputmode="decimal" autocomplete="off" spellcheck="false"></div>`,
    )
    .join('');
  render();
}
$('#cat').innerHTML = Object.keys(CATS)
  .map((c) => `<option value="${c}"${c === cat ? ' selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`)
  .join('');
$('#cat').addEventListener('change', (e) => {
  from = to = '';
  v = '1';
  setCat(e.target.value);
});
$('#v').addEventListener('input', (e) => {
  v = e.target.value;
  render('v');
});
// From and To never match: choosing the same unit on one side moves the other to a different unit.
const other = (u) => Object.keys(CATS[cat]).find((x) => x !== u);
$('#from').addEventListener('change', (e) => {
  from = e.target.value;
  if (to === from) {
    to = other(from);
    $('#to').value = to;
  }
  render();
});
$('#to').addEventListener('change', (e) => {
  to = e.target.value;
  if (to === from) {
    from = other(to);
    $('#from').value = from;
  }
  render();
});
$('#swap').addEventListener('click', () => {
  [from, to] = [to, from];
  $('#from').value = from;
  $('#to').value = to;
  render();
});
$('#all').addEventListener('input', (e) => {
  const u = e.target.dataset.u;
  if (!u) return;
  from = u;
  v = e.target.value;
  $('#from').value = u;
  render(u);
});
$('#cp').addEventListener('click', async (e) => {
  const x = num();
  if (x === null) return;
  try {
    await navigator.clipboard.writeText(show(convert(cat, from, to, x)));
    e.target.textContent = 'Copied';
  } catch {
    e.target.textContent = 'Copy failed';
  }
  setTimeout(() => (e.target.textContent = 'Copy'), 1200);
});
setCat(cat);
