import { $, mountBar } from '/_/ui.js';
import { convert } from './lib.js';
mountBar('YAML');
const SAMPLE = `# A service definition
name: api
replicas: 3
ports: [80, 443]
env:
  LOG_LEVEL: info
  FEATURES:
    - search
    - billing
healthcheck:
  path: /healthz
  interval: 30s
notes: |
  multi-line text
  is kept as is
`;
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error'),
  dir = $('#dir');
input.value = SAMPLE;
function run() {
  const y = dir.value === 'y2j',
    from = y ? 'YAML' : 'JSON';
  $('#inl').textContent = from;
  $('#outl').textContent = y ? 'JSON' : 'YAML';
  $('#sort').closest('label').hidden = y;
  error.textContent = '';
  if (!input.value.trim()) {
    out.value = '';
    status.textContent = `Paste ${from} above.`;
    $('#copy').disabled = true;
    return;
  }
  try {
    const r = convert(input.value, dir.value, window.jsyaml, { indent: +$('#indent').value, sortKeys: $('#sort').checked });
    out.value = r.text;
    status.textContent = r.docs > 1 ? `Converted ${r.docs} documents into a JSON array.` : 'Converted.';
  } catch (e) {
    out.value = '';
    status.textContent = '';
    error.textContent = `Invalid ${from}${e.line ? ` at line ${e.line}, column ${e.col}` : ''}: ${e.message}`;
  }
  $('#copy').disabled = !out.value;
}
input.addEventListener('input', run);
for (const id of ['dir', 'indent', 'sort']) $('#' + id).addEventListener('change', run);
$('#swap').addEventListener('click', () => {
  if (out.value) input.value = out.value;
  dir.value = dir.value === 'y2j' ? 'j2y' : 'y2j';
  run();
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
