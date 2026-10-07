import { $, esc, mountBar } from '/_/ui.js';
import { caesar, rot13, rot47, atbash, vigenere, railFence, affine, AFFINE_A, bruteForce } from './lib.js';
mountBar('Ciphers');
$('#aa').innerHTML = AFFINE_A.map((a) => `<option${a === 5 ? ' selected' : ''}>${a}</option>`).join('');
const SYM = new Set(['rot13', 'rot47', 'atbash']); // their own inverse: no direction needed
let msgT,
  lastBt = '';
async function copy(text) {
  const say = (m) => {
    $('#msg').textContent = m;
    clearTimeout(msgT);
    msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
  };
  try {
    await navigator.clipboard.writeText(text);
    say('Copied.');
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? 'Copied.' : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
function run() {
  const mode = $('#mode').value,
    s = $('#in').value,
    dec = document.querySelector('input[name=dir]:checked').value === 'dec';
  $('#dirset').hidden = SYM.has(mode);
  for (const d of document.querySelectorAll('[data-for]')) d.hidden = d.dataset.for !== mode;
  $('#brute').hidden = mode !== 'caesar';
  $('#shiftv').textContent = $('#shift').value;
  let out = '',
    err = '';
  const k = Number($('#shift').value);
  if (mode === 'rot13') out = rot13(s);
  else if (mode === 'rot47') out = rot47(s);
  else if (mode === 'atbash') out = atbash(s);
  else if (mode === 'caesar') out = caesar(s, dec ? -k : k);
  else if (mode === 'vigenere') {
    const r = vigenere(s, $('#key').value, dec);
    if (r == null) err = 'The key needs at least one letter (A to Z).';
    else out = r;
  } else if (mode === 'rail') {
    const n = Number($('#rails').value);
    if (!Number.isInteger(n) || n < 2 || n > 50) err = 'Rails must be a whole number from 2 to 50.';
    else out = railFence(s, n, dec);
  } else {
    const b = Number($('#bb').value);
    if (!Number.isInteger(b) || b < 0 || b > 25) err = 'b must be a whole number from 0 to 25.';
    else out = affine(s, Number($('#aa').value), b, dec);
  }
  $('#out').textContent = err ? '' : out;
  $('#err').textContent = err;
  $('#copy').disabled = !!err || !out;
  if (mode === 'caesar') {
    const { rows, best } = bruteForce(s);
    const html = s.trim()
      ? rows
          .map(
            (r, i) =>
              `<tr${i === best ? ' class="best"' : ''}><td>${r.shift}</td><td class="mono">${esc(r.text.length > 140 ? r.text.slice(0, 140) + '…' : r.text)}</td><td><button type="button" data-k="${r.shift}" aria-label="Use shift ${r.shift}">Use</button></td></tr>`,
          )
          .join('')
      : '<tr><td colspan="3" class="muted">Type some text to see all shifts.</td></tr>';
    if (html !== lastBt) $('#bt').innerHTML = lastBt = html; // re-rendering on a blur 'change' would swap the Use button out from under the click
  }
}
document.addEventListener('input', (e) => {
  if (e.target.closest('.card')) run();
});
document.addEventListener('change', (e) => {
  if (e.target.closest('.card')) run();
});
$('#copy').addEventListener('click', () => copy($('#out').textContent));
$('#bt').addEventListener('click', (e) => {
  const k = e.target.closest('[data-k]')?.dataset.k;
  if (!k) return;
  $('#shift').value = k;
  document.querySelector('input[name=dir][value=dec]').checked = true;
  run(); // rows show the decryption
  $('#out').scrollIntoView({ block: 'nearest' });
});
run();
