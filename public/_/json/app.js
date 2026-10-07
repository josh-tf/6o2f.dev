import { $, mountBar } from '/_/ui.js';
import { parse, stringify, bytes, lossy } from './lib.js';
mountBar('JSON');
const SAMPLE = '{"name":"6o2f.dev","tools":["json","yaml","csv"],"nested":{"b":true,"a":null,"n":1.5e3},"unicode":"héllo"}';
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error'),
  warn = $('#warn');
let at = 0;
input.value = SAMPLE;
const fmt = (n) => n.toLocaleString() + ' B';
function run() {
  const r = parse(input.value);
  error.hidden = warn.hidden = true;
  if (!input.value.trim()) {
    out.value = '';
    status.textContent = 'Paste JSON above to format or validate it.';
    return;
  }
  if ('error' in r) {
    out.value = '';
    status.textContent = '';
    at = r.at;
    $('#errmsg').textContent = `Invalid JSON at line ${r.line}, column ${r.col}: ${r.error}`;
    error.hidden = false;
    return;
  }
  const m = $('#mode').value;
  out.value = stringify(r.value, m === 'tab' ? '\t' : +m, $('#sort').checked);
  const a = bytes(input.value),
    b = bytes(out.value);
  status.textContent = `Valid JSON. ${fmt(a)} in, ${fmt(b)} out (${b <= a ? '' : '+'}${(((b - a) / a) * 100).toFixed(1)}%).`;
  const n = lossy(input.value);
  if (n) {
    warn.hidden = false;
    warn.textContent = `Heads up: ${n} number${n === 1 ? '' : 's'} too large or precise for a JavaScript double, so the output rounds ${n === 1 ? 'it' : 'them'}. Keep such values as strings.`;
  }
}
// ponytail: debounced main-thread parse; fine to tens of MB, move to a worker if it ever stutters
let t;
input.addEventListener('input', () => {
  status.textContent = 'Working...';
  clearTimeout(t);
  t = setTimeout(run, input.value.length > 200000 ? 400 : 60);
});
$('#mode').addEventListener('change', run);
$('#sort').addEventListener('change', run);
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
