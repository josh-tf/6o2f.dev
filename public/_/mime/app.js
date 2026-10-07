import { $, esc, mountBar } from '/_/ui.js';
import { CATS, search, typesForExt, lookupType, extOf, header, sniff, SNIFF_BYTES } from './lib.js';
mountBar('MIME types');
const LIMIT = 60;
$('#cat').insertAdjacentHTML('beforeend', CATS.map((c) => `<option>${esc(c)}</option>`).join(''));

const copyBtn = (text, label) => `<button type="button" class="cp" data-copy="${esc(text)}">${esc(label)}</button>`;
function best(qv) {
  const s = qv.trim();
  if (!s)
    return '<p class="muted">Type an extension like <code>webp</code>, a file name like <code>report.xlsx</code> or a type like <code>application/json</code>.</p>';
  if (s.includes('/')) {
    const r = lookupType(s);
    if (!r)
      return `<p class="err">No known type <code>${esc(s.split(';')[0])}</code>. Check the spelling; vendor types look like <code>application/vnd.…</code>.</p>`;
    return `<p class="k">MIME type</p><p class="big"><code>${esc(r.type)}</code></p>
      ${r.alias ? `<p class="muted"><code>${esc(r.alias)}</code> is an older or unofficial name for this type.</p>` : ''}
      <p>${r.exts.length ? `Extensions: ${r.exts.map((e) => `<code>.${esc(e)}</code>`).join(' ')}` : '<span class="muted">No file extension: used for request and response bodies.</span>'} <span class="muted">· ${esc(r.cat)}</span></p>
      <div class="row"><output class="hdr mono">${esc(header(r.type))}</output>${copyBtn(header(r.type), 'Copy header')}</div>`;
  }
  const ext = extOf(s);
  const ts = typesForExt(ext);
  if (!ts.length)
    return `<p class="err">No type known for <code>.${esc(ext || s)}</code>. Servers usually fall back to <code>application/octet-stream</code> (download) for unknown extensions.</p>`;
  const [t, ...alt] = ts;
  return `<p class="k">.${esc(ext)}</p><p class="big"><code>${esc(t)}</code></p>
    ${alt.length ? `<p class="muted">Also used: ${alt.map((a) => `<code>${esc(a)}</code>`).join(', ')}</p>` : ''}
    <div class="row"><output class="hdr mono">${esc(header(t))}</output>${copyBtn(header(t), 'Copy header')}</div>`;
}
function draw() {
  const qv = $('#q').value,
    hits = search(qv.includes('/') ? qv.split(';')[0] : extOf(qv) || qv, $('#cat').value);
  $('#best').innerHTML = best(qv);
  $('#rows').innerHTML =
    hits
      .slice(0, LIMIT)
      .map(
        (r) =>
          `<tr><td><code>${esc(r.type)}</code></td><td>${r.exts.map((e) => `.${esc(e)}`).join(' ') || '<span class="muted">none</span>'}</td><td class="hide-s muted">${esc(r.cat)}</td></tr>`,
      )
      .join('') || '<tr><td colspan="3" class="muted">No matches.</td></tr>';
  $('#more').textContent =
    hits.length > LIMIT ? `Showing ${LIMIT} of ${hits.length}. Type more to narrow it down.` : `${hits.length} type${hits.length === 1 ? '' : 's'}`;
}
$('#q').addEventListener('input', draw);
$('#cat').addEventListener('change', draw);

let msgT;
async function copy(text) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    try {
      ok = document.execCommand('copy');
    } catch {}
    t.remove();
  }
  $('#msg').textContent = ok ? `Copied ${text}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy]');
  if (b) copy(b.dataset.copy);
});

/* File check */
const hex = (b) => [...b.slice(0, 12)].map((x) => x.toString(16).padStart(2, '0')).join(' ');
const VERDICT = {
  match: ['ok', 'Matches extension'],
  text: ['ok', 'Text, fits extension'],
  mismatch: ['bad', 'Mismatch'],
  noext: ['', 'No extension'],
  unknown: ['', 'Not recognised'],
};
function row(name, size, bytes) {
  const r = sniff(bytes, name),
    [cls, word] = VERDICT[r.verdict];
  const why =
    r.verdict === 'mismatch'
      ? `.${esc(r.ext)} should be ${r.expected.length ? `<code>${esc(r.expected[0])}</code>` : 'an unknown type'}`
      : r.verdict === 'unknown'
        ? bytes.length
          ? 'No known signature; the extension is all there is.'
          : 'The file is empty, so there is nothing to check.'
        : '';
  return `<tr><td class="fn">${esc(name)}<span class="muted small"> ${size.toLocaleString()} bytes</span></td><td>${r.type ? `<code>${esc(r.type)}</code><br>` : ''}<span class="muted small">${esc(r.label)}</span></td><td><b class="v ${cls}">${word}</b>${why ? `<br><span class="small">${why}</span>` : ''}</td><td class="hide-s mono small">${hex(bytes)}</td></tr>`;
}
async function check(files) {
  $('#ferr').textContent = '';
  if (!files.length) return;
  const out = [];
  for (const f of files) {
    try {
      out.push(row(f.name, f.size, new Uint8Array(await f.slice(0, SNIFF_BYTES).arrayBuffer())));
    } catch {
      out.push(`<tr><td>${esc(f.name)}</td><td colspan="3" class="err">Could not read this file (it may be a folder or blocked by the browser).</td></tr>`);
    }
  }
  $('#scap').textContent = `${files.length} file${files.length === 1 ? '' : 's'} checked`;
  $('#srows').innerHTML = out.join('');
}
$('#file').addEventListener('change', (e) => check([...e.target.files]));
const drop = $('#drop');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  check([...e.dataTransfer.files]);
});
// Page-wide drop so a near miss does not navigate away to the file.
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  if (!drop.contains(e.target)) {
    e.preventDefault();
    check([...e.dataTransfer.files]);
  }
});

// Example: invoice.pdf that is really a ZIP, and a correctly named PNG.
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0, 0x21, 0x00]);
$('#srows').innerHTML = row('invoice.pdf', 48213, zip) + row('logo.png', 5120, png);
draw();
