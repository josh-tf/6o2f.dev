import { $, esc, mountBar } from '/_/ui.js';
import { decode, status, verifyHS } from './jwt.js';
mountBar('JWT decoder');
const EXAMPLE = $('#tok').value,
  DEMO_SECRET = 'your-256-bit-secret';
$('#sec').value = DEMO_SECRET;
let d,
  seq = 0;
const when = (s) => {
  const t = new Date(s * 1000);
  return isNaN(t) ? null : t;
};
async function sig() {
  const alg = d.header.alg,
    s = $('#sig'),
    hs = /^HS(256|384|512)$/.test(alg),
    my = ++seq;
  $('#sigset').disabled = !hs;
  const say = (cls, text) => {
    if (my === seq) {
      s.className = cls;
      s.textContent = text;
    }
  };
  if (!hs) return say('muted', `Algorithm ${alg ?? '(none)'}: decoded but not verified. Only HS256, HS384 and HS512 can be checked here.`);
  if (!$('#sec').value) return say('muted', `${alg}: enter the secret to verify the signature.`);
  try {
    const ok = await verifyHS(alg, d.input, d.sig, $('#sec').value, $('#secb64').checked);
    say(ok ? 'ok' : 'err', ok ? `Signature verified (${alg}).` : 'Invalid signature: wrong secret or a tampered token.');
  } catch (e) {
    say('err', e.message);
  }
}
function run() {
  const raw = $('#tok').value;
  $('#hint').hidden = raw !== EXAMPLE;
  try {
    d = decode(raw);
    $('#err').textContent = '';
    $('#out').hidden = false;
    $('#h').textContent = JSON.stringify(d.header, null, 2);
    $('#p').textContent = JSON.stringify(d.payload, null, 2);
    const rows = [
      ['exp', 'Expires'],
      ['nbf', 'Not before'],
      ['iat', 'Issued at'],
    ].filter(([k]) => typeof d.payload?.[k] === 'number' && when(d.payload[k]));
    $('#times').hidden = !rows.length;
    $('#tt').innerHTML = rows
      .map(([k, l]) => {
        const st = status(k, d.payload[k]),
          t = when(d.payload[k]);
        return `<tr><th scope="row">${l} <code>${k}</code></th><td><time datetime="${t.toISOString()}">${esc(t.toLocaleString())}</time><br><span class="muted">${t.toISOString().replace('T', ' ').slice(0, 19)} UTC</span></td><td class="${st.ok ? 'muted' : 'err'}">${esc(st.text)}</td></tr>`;
      })
      .join('');
    sig();
  } catch (e) {
    d = null;
    $('#out').hidden = true;
    $('#err').className = raw.trim() ? 'err' : 'muted';
    $('#err').textContent = raw.trim() ? e.message : 'Paste a JWT above to decode it.';
  }
}
$('#tok').addEventListener('input', () => {
  if ($('#tok').value !== EXAMPLE && $('#sec').value === DEMO_SECRET) $('#sec').value = ''; // the demo secret is only for the example
  run();
});
for (const id of ['#sec', '#secb64']) $(id).addEventListener('input', () => d && sig());
document.querySelector('main').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-copy]');
  if (!b) return;
  const text = $('#' + b.dataset.copy).textContent;
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = 'Copied';
  } catch {
    getSelection().selectAllChildren($('#' + b.dataset.copy));
    b.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1200);
});
run();
