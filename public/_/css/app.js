import { $, mountBar } from '/_/ui.js';
import { beautify, minify, stats, gzipSize } from './lib.js';
mountBar('CSS');
const SAMPLE = `/*! Theme v1.4 | MIT */
@import url("fonts.css") screen;
:root{--brand:#0b7a35;--radius:8px;--shadow:0 1px 2px rgb(0 0 0 / .2),0 4px 12px rgb(0 0 0 / .1);--empty:;}
/* Buttons */
.btn,.btn-primary>.icon,a[href$=".pdf"]::after{display:inline-flex;align-items:center;gap:.5em;padding:6px 14px;border-radius:var(--radius);background:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=) no-repeat right 8px center;font:500 14px/1.4 "Inter",system-ui,sans-serif}
.btn:hover{box-shadow:var(--shadow);transform:translateY(-1px)}
.btn::before{content:"\\2192  ; {}";}
.card{padding:calc( var(--radius) * 2 );&:hover{border-color:var(--brand)}& > h2{margin:0 0 .5em}}
@media (min-width:600px) and (prefers-reduced-motion:no-preference){.btn{transition:transform .15s ease-out,box-shadow .15s}}
@supports (display:grid){.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}}`;
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error'),
  warn = $('#warn');
const IND = { 2: '  ', 4: '    ', tab: '\t' };
let at = 0,
  seq = 0;
input.value = SAMPLE;
const B = (n) => `${n.toLocaleString()} B`;
const pct = (a, b) => (a ? `${b <= a ? '−' : '+'}${Math.abs(((b - a) / a) * 100).toFixed(1)}%` : '');
async function run() {
  const my = ++seq,
    src = input.value,
    mode = $('#mode').value;
  error.hidden = warn.hidden = true;
  $('#indent').disabled = mode === 'minify';
  $('#lastsemi').disabled = mode !== 'minify';
  for (const id of ['rawIn', 'rawOut', 'rawD', 'gzIn', 'gzOut', 'gzD']) $('#' + id).value = '';
  if (!src.trim()) {
    out.value = '';
    status.textContent = 'Paste CSS above to beautify or minify it.';
    return;
  }
  let r;
  try {
    const comments = !$('#nocomments').checked,
      sort = $('#sort').checked;
    r =
      mode === 'minify'
        ? minify(src, { comments, sort, lastSemicolon: $('#lastsemi').checked })
        : beautify(src, { indent: IND[$('#indent').value], comments, sort });
  } catch (e) {
    out.value = '';
    status.textContent = '';
    at = e.at ?? 0;
    $('#errmsg').textContent = `Can't parse this CSS: ${e.message}.`;
    error.hidden = false;
    return;
  }
  out.value = r.css;
  if (r.warnings.length) {
    warn.replaceChildren(...r.warnings.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
    warn.hidden = false;
  }
  const s = stats(src);
  status.textContent = `${s.rules} rule${s.rules === 1 ? '' : 's'}, ${s.decls} declaration${s.decls === 1 ? '' : 's'}, ${s.at} at-rule${s.at === 1 ? '' : 's'}.`;
  const a = new Blob([src]).size,
    b = new Blob([r.css]).size;
  $('#rawIn').value = B(a);
  $('#rawOut').value = B(b);
  $('#rawD').value = pct(a, b);
  try {
    const [ga, gb] = await Promise.all([gzipSize(src), gzipSize(r.css)]);
    if (my !== seq) return;
    $('#gzIn').value = B(ga);
    $('#gzOut').value = B(gb);
    $('#gzD').value = pct(ga, gb);
  } catch {
    $('#gzIn').value = 'n/a';
  }
}
let t;
input.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(run, input.value.length > 200000 ? 300 : 80);
});
for (const id of ['mode', 'indent', 'nocomments', 'lastsemi', 'sort']) $('#' + id).addEventListener('change', run);
$('#clear').addEventListener('click', () => {
  input.value = '';
  run();
  input.focus();
});
$('#swap').addEventListener('click', () => {
  if (!out.value) return;
  input.value = out.value;
  run();
  input.focus();
});
$('#goto').addEventListener('click', () => {
  input.focus();
  input.setSelectionRange(at, Math.min(at + 1, input.value.length));
});
$('#copy').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText(out.value);
    b.textContent = 'Copied';
  } catch {
    out.select();
    b.textContent = document.execCommand?.('copy') ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1500);
});
run();
