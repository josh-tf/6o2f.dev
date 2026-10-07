import { $, esc, mountBar } from '/_/ui.js';
import { analyze, clean, parseFind, NORMS } from './lib.js';
mountBar('Unicode');
const MAX = 1000;
// Sample: composed é, Cyrillic о in "wоrld", a zero-width space, a non-breaking space, a ZWJ emoji family, an RTL override.
$('#txt').value = 'café wоrld​ 👨‍👩‍👧 ‮abc';
const head = (cap) =>
  `<caption class="vh">${cap}</caption><thead><tr><th scope="col">Char</th><th scope="col">Code point</th><th scope="col">UTF-8</th><th scope="col">UTF-16</th><th scope="col">Category</th><th scope="col">Flags</th></tr></thead>`;
const tr = (r, hit) =>
  `<tr class="${hit ? 'hit' : ''} ${r.flags.length ? 'warn' : ''}"><td class="ch">${r.shown === r.g ? esc(r.g) : `<i>${esc(r.shown)}</i>`}</td><td class="m">${r.cp}</td><td class="m">${r.utf8}</td><td class="m">${r.utf16}</td><td>${esc(r.cat)}</td><td class="fl">${r.flags.map((f) => `<span class="tag">${esc(f)}</span>`).join('')}</td></tr>`;
function run() {
  const text = $('#txt').value,
    rows = analyze(text),
    q = parseFind($('#find').value);
  const cps = rows.reduce((n, r) => n + r.cps.length, 0),
    bytes = new TextEncoder().encode(text).length;
  $('#sum').textContent =
    `${rows.length} characters, ${cps} code points, ${bytes} UTF-8 bytes, ${text.length} UTF-16 units, ${rows.filter((r) => r.flags.length).length} flagged.`;
  const hit = (r) => q && r.cps.some((c) => q.includes(c));
  $('#tbl').innerHTML =
    head('Characters in the text, one row per grapheme') +
    '<tbody>' +
    (rows
      .slice(0, MAX)
      .map((r) => tr(r, hit(r)))
      .join('') || '<tr><td colspan="6" class="muted">Type or paste some text above.</td></tr>') +
    '</tbody>';
  $('#more').textContent = rows.length > MAX ? `Showing the first ${MAX} of ${rows.length} characters.` : '';
  const f = $('#find').value.trim();
  $('#found').hidden = !q;
  $('#ferr').textContent = f && !q ? 'Not a valid code point: use U+0000 to U+10FFFF, or paste the character itself.' : '';
  if (q)
    $('#ft').innerHTML =
      head('Looked-up characters') +
      '<tbody>' +
      analyze(q.map((c) => String.fromCodePoint(c)).join(''))
        .map((r) => tr(r))
        .join('') +
      '</tbody>';
  $('#fnote').textContent =
    q && !q.some((c) => rows.some((r) => r.cps.includes(c))) ? 'Not present in the text above.' : q ? 'Highlighted in the table below.' : '';
}
$('#txt').addEventListener('input', run);
$('#find').addEventListener('input', run);
for (const n of NORMS)
  $(`[data-n=${n}]`).addEventListener('click', () => {
    $('#txt').value = $('#txt').value.normalize(n);
    run();
  });
run();
$('#clean').addEventListener('click', () => {
  $('#txt').value = clean($('#txt').value);
  run();
});
$('#cp').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText($('#txt').value);
    b.textContent = 'Copied';
  } catch {
    $('#txt').select();
    b.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy text'), 1500);
});
