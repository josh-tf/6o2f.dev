import { $, mountBar } from '/_/ui.js';
import { decode, decodeBytes, encode, hex } from './codec.js';
mountBar('Base64');
const mode = () => document.querySelector('[name=mode]:checked').value;
const n = (x, w) => `${x.toLocaleString('en-US')} ${w}${x === 1 ? '' : 's'}`;
function run() {
  const enc = mode() === 'enc',
    src = $('#in').value;
  $('#inl').textContent = enc ? 'Text to encode' : 'Base64 to decode';
  $('#outl').textContent = enc ? 'Base64' : 'Decoded text';
  $('#encopts').disabled = !enc;
  $('#err').textContent = '';
  $('#msg').textContent = '';
  if (!src.trim()) {
    $('#out').value = '';
    $('#msg').textContent = enc ? 'Type or paste text to encode.' : 'Paste Base64 to decode.';
    return;
  }
  try {
    if (enc) {
      $('#out').value = encode(src, { url: $('#url').checked, pad: $('#pad').checked });
      $('#msg').textContent = `${n(new TextEncoder().encode(src).length, 'byte')} → ${n($('#out').value.length, 'character')}`;
    } else {
      try {
        $('#out').value = decode(src);
        $('#msg').textContent = `${n(decodeBytes(src).length, 'byte')} of UTF-8 text`;
      } catch (e) {
        if (!/UTF-8/.test(e.message)) throw e;
        const b = decodeBytes(src); // binary data: show it as hex instead of failing
        $('#out').value = hex(b);
        $('#outl').textContent = 'Decoded bytes (hex)';
        $('#msg').textContent = `${n(b.length, 'byte')} of binary data (not UTF-8 text), shown as hex`;
      }
    }
  } catch (e) {
    $('#out').value = '';
    $('#err').textContent = e.message;
  }
}
document.querySelector('main').addEventListener('input', run);
document.querySelector('main').addEventListener('change', run);
$('#swap').addEventListener('click', () => {
  if (mode() === 'dec' && $('#outl').textContent.includes('hex')) {
    $('#err').textContent = 'Binary output cannot be swapped back as text.';
    return;
  }
  $('#in').value = $('#out').value;
  document.querySelector(`[name=mode][value=${mode() === 'enc' ? 'dec' : 'enc'}]`).checked = true;
  run();
  $('#in').focus();
});
$('#copy').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText($('#out').value);
    b.textContent = 'Copied';
  } catch {
    $('#out').select();
    b.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1200);
});
run();
