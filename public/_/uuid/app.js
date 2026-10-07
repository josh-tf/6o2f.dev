import { $, esc, mountBar } from '/_/ui.js';
import { format, make, parse, v7 } from './lib.js';
mountBar('UUID');

let ids = [];
function show() {
  // format options only reformat the current ids; they don't generate new ones
  const o = { upper: $('#upper').checked, hyphens: !$('#nodash').checked, braces: $('#braces').checked };
  $('#out').value = ids.map((x) => format(x, o)).join('\n');
  $('#out').rows = Math.min(Math.max(ids.length, 2), 12);
}
function gen() {
  const n = Math.min(1000, Math.max(1, Math.trunc($('#n').valueAsNumber) || 1));
  ids = make($('#kind').value, n);
  show();
}
function inspect() {
  const v = $('#in').value,
    r = v.trim() && parse(v);
  $('#info').innerHTML = !r
    ? '<dt>Result</dt><dd class="muted">Paste a UUID (any version, with or without hyphens, braces or urn:uuid:) or a ULID.</dd>'
    : r.error
      ? `<dt>Result</dt><dd class="err">${esc(r.error)}</dd>`
      : `<dt>Type</dt><dd>${r.kind}</dd>` +
        (r.version !== undefined ? `<dt>Version</dt><dd>${r.version}</dd><dt>Variant</dt><dd>${esc(r.variant)}</dd>` : '') +
        (r.ms !== undefined && !isNaN(new Date(r.ms))
          ? `<dt>Timestamp</dt><dd><time datetime="${new Date(r.ms).toISOString()}">${new Date(r.ms).toISOString()}</time> <span class="muted">(${r.ms} ms)</span></dd>`
          : '');
}
$('#gen').addEventListener('submit', (e) => {
  e.preventDefault();
  gen();
});
$('#gen').addEventListener('change', (e) => (e.target.type === 'checkbox' ? show() : e.target.id !== 'out' && gen()));
$('#copy').addEventListener('click', async () => {
  const o = $('#out'),
    m = $('#msg');
  try {
    await navigator.clipboard.writeText(o.value);
    m.textContent = 'Copied.';
  } catch {
    o.select();
    m.textContent = 'Selected: press Ctrl+C.';
  }
  setTimeout(() => (m.textContent = ''), 2000);
});
$('#in').addEventListener('input', inspect);
$('#in').value = v7();
gen();
inspect();
