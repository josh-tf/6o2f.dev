import { $, mountBar } from '/_/ui.js';
import { DELIMS, detectDelimiter, parseCSV, rowsToJSON, jsonToRows, toCSV } from './lib.js';
import { parse } from '/_/json/lib.js'; // JSON error positions
mountBar('CSV');
const SAMPLE = `name,role,notes,score
"Ada Lovelace",engineer,"Wrote the first
program",99.5
"Smith, John",manager,"Says ""hello""",72
Grace Hopper,admiral,,100
`;
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error'),
  dir = $('#dir');
input.value = SAMPLE;
const c2j = () => dir.value === 'c2j';
function preview(rows, header) {
  const t = $('#prev');
  t.replaceChildren(t.caption);
  const w = Math.max(0, ...rows.slice(0, 50).map((r) => r.length));
  rows.slice(0, 50).forEach((r, i) => {
    const h = header && i === 0,
      tr = (h ? t.createTHead() : (t.tBodies[0] ?? t.createTBody())).insertRow();
    for (let j = 0; j < w; j++) {
      const c = document.createElement(h ? 'th' : 'td');
      if (h) c.scope = 'col';
      c.textContent = r[j] ?? '';
      c.title = r[j] ?? '';
      tr.append(c);
    }
  });
  $('#prev').closest('.scroll').hidden = !rows.length;
  $('#more').textContent = rows.length > 50 ? `Showing 50 of ${rows.length} rows.` : '';
}
function render() {
  $('#inl').textContent = c2j() ? 'CSV' : 'JSON';
  $('#outl').textContent = c2j() ? 'JSON' : 'CSV';
  $('#typel').hidden = !c2j();
  const header = $('#header').checked;
  error.textContent = '';
  if (!input.value.trim()) {
    out.value = '';
    status.textContent = `Paste ${c2j() ? 'CSV' : 'JSON'} above, or open a file.`;
    preview([], false);
    return;
  }
  try {
    let rows, note;
    if (c2j()) {
      const d = $('#delim').value === 'auto' ? detectDelimiter(input.value) : DELIMS[$('#delim').value];
      rows = parseCSV(input.value, d);
      out.value = JSON.stringify(rowsToJSON(rows, header, $('#types').checked), null, 2);
      note = `Delimiter: ${Object.keys(DELIMS).find((k) => DELIMS[k] === d)}.`;
    } else {
      const r = parse(input.value);
      if ('error' in r) throw new Error(`Invalid JSON at line ${r.line}, column ${r.col}: ${r.error}`);
      const d = DELIMS[$('#delim').value] ?? ',';
      rows = jsonToRows(r.value, header);
      out.value = toCSV(rows, d);
      note = `Delimiter: ${Object.keys(DELIMS).find((k) => DELIMS[k] === d)}.`;
    }
    const recs = header && rows.length ? rows.length - 1 : rows.length;
    status.textContent = `${recs.toLocaleString()} row${recs === 1 ? '' : 's'}${header && rows.length ? ' plus a header' : ''}. ${note}`;
    preview(rows, header);
  } catch (e) {
    out.value = '';
    status.textContent = '';
    error.textContent = e.message;
    preview([], false);
  }
}
function run() {
  render();
  $('#dl').disabled = $('#copy').disabled = !out.value;
}
let timer; // re-parse on every keystroke, but debounce big inputs so typing stays responsive
input.addEventListener('input', () => {
  clearTimeout(timer);
  if (input.value.length > 200000) timer = setTimeout(run, 300);
  else run();
});
$('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const text = await f.text();
  const json = /\.json$/i.test(f.name) || /^\s*[[{]/.test(text);
  if (json === c2j()) dir.value = json ? 'j2c' : 'c2j';
  input.value = text;
  e.target.value = '';
  run();
});
$('#dl').addEventListener('click', () => {
  if (!out.value) return;
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([out.value], { type: c2j() ? 'application/json' : 'text/csv' })),
    download: c2j() ? 'data.json' : 'data.csv',
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
for (const id of ['delim', 'header', 'types']) $('#' + id).addEventListener('change', run);
dir.addEventListener('change', () => {
  if (out.value) input.value = out.value;
  run();
}); // switching direction carries the output over as the new input
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
