import { $, esc, mountBar } from '/_/ui.js';
import { ALGS, FORMATS, MAX_BYTES, digest, hmac, matches } from './lib.js';
mountBar('Hash');

let file = null,
  bytes = [],
  seq = 0;
const enc = new TextEncoder();

async function run() {
  const my = ++seq;
  $('#err').textContent = '';
  let data;
  if (file) {
    if (file.size > MAX_BYTES) {
      $('#err').textContent = `${file.name} is ${(file.size / 1048576).toFixed(0)} MB; the limit is 200 MB.`;
      $('#res tbody').innerHTML = '';
      return;
    }
    $('#cap').textContent = `Hashing ${file.name}…`;
    try {
      data = new Uint8Array(await file.arrayBuffer());
    } catch {
      $('#err').textContent = 'Could not read that file.';
      return;
    }
  } else data = enc.encode($('#txt').value);
  const key = $('#key').value,
    k = enc.encode(key);
  const out = await Promise.all(ALGS.map((a) => (key ? hmac(a, k, data) : digest(a, data))));
  if (my !== seq) return; // a newer run superseded this one
  bytes = out;
  $('#cap').textContent =
    `${key ? 'HMAC' : 'Hash'} of ${file ? `${file.name} (${file.size.toLocaleString()} bytes)` : `${data.length.toLocaleString()} bytes of text`}`;
  paint();
}

function paint() {
  const f = FORMATS[$('#fmt').value],
    e = $('#exp').value;
  let hit = '';
  $('#res tbody').innerHTML = ALGS.map((a, i) => {
    const m = matches(bytes[i], e);
    if (m) hit = a;
    return `<tr class="${m ? 'hit' : ''}"><th scope="row">${a}</th><td class="v" id="v${i}">${esc(f(bytes[i]))}</td><td class="c"><button type="button" data-i="${i}" aria-label="Copy ${a}">Copy</button></td></tr>`;
  }).join('');
  const c = $('#cmp');
  c.className = e.trim() ? (hit ? 'ok' : 'bad') : 'muted';
  c.textContent = !e.trim()
    ? 'Paste a hash to check it against the results above.'
    : hit
      ? `Match: ${hit}${$('#key').value ? ' (HMAC)' : ''}.`
      : 'Mismatch: no result above equals this value.';
}

function setFile(f) {
  file = f;
  $('#txt').hidden = !!f;
  $('label[for=txt]').hidden = !!f;
  $('#unfile').hidden = !f;
  $('#file').hidden = !f;
  if (f) $('#file').textContent = `File: ${f.name} (${f.size.toLocaleString()} bytes)`;
  if (!f) $('#pick').value = '';
  run();
}

$('#txt').addEventListener('input', run);
$('#key').addEventListener('input', run);
$('#fmt').addEventListener('change', paint);
$('#exp').addEventListener('input', paint);
$('#pick').addEventListener('change', () => $('#pick').files[0] && setFile($('#pick').files[0]));
$('#unfile').addEventListener('click', () => setFile(null));
const box = $('#drop');
box.addEventListener('dragover', (e) => {
  e.preventDefault();
  box.classList.add('over');
});
box.addEventListener('dragleave', () => box.classList.remove('over'));
box.addEventListener('drop', (e) => {
  e.preventDefault();
  box.classList.remove('over');
  if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
});
$('#res').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-i]');
  if (!b) return;
  try {
    await navigator.clipboard.writeText($('#v' + b.dataset.i).textContent);
    b.textContent = 'Copied';
  } catch {
    b.textContent = 'Press Ctrl+C';
    getSelection().selectAllChildren($('#v' + b.dataset.i));
  }
  setTimeout(() => (b.textContent = 'Copy'), 1200);
});
run();
