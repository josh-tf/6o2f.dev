import { $, esc, mountBar } from '/_/ui.js';
import { bits, passphrase, password, phraseBits, sets, verdict } from './lib.js';
mountBar('Passwords');

const mode = () => document.querySelector('[name=mode]:checked').value;
const names = () => [...document.querySelectorAll('[name=set]:checked')].map((e) => e.value);
const one = () =>
  mode() === 'pw'
    ? password(+$('#len').value, names(), $('#nolook').checked)
    : passphrase(+$('#words').value, { sep: $('#sep').value, cap: $('#cap').checked, num: $('#num').checked });

function entropy() {
  const b =
    mode() === 'pw' ? bits([...sets(names(), $('#nolook').checked).join('')].length, +$('#len').value) : phraseBits(+$('#words').value, $('#num').checked);
  const [v, why] = verdict(b);
  $('#ent').innerHTML = `<b>~${Math.round(b)} bits</b> of entropy: <b>${v}</b>. <span class="muted">${why}</span>`;
}
function gen() {
  $('#lenv').textContent = $('#len').value;
  $('#wordsv').textContent = $('#words').value;
  $('#pw').hidden = mode() !== 'pw';
  $('#pp').hidden = mode() !== 'pp';
  try {
    $('#res').textContent = one();
    entropy();
  } catch {
    $('#res').textContent = '';
    $('#ent').innerHTML = '<span class="err">Pick at least one character set.</span>';
  }
  $('#list').hidden = true;
}
async function copy(text, el, msg) {
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = 'Copied.';
  } catch {
    getSelection().selectAllChildren(el);
    msg.textContent = 'Selected: press Ctrl+C.';
  }
  setTimeout(() => (msg.textContent = ''), 2000);
}
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  gen();
});
document.addEventListener('input', (e) => e.target.closest('#f, .tabs') && gen());
$('#copy').addEventListener('click', () => copy($('#res').textContent, $('#res'), $('#msg')));
$('#ten').addEventListener('click', () => {
  try {
    $('#ul').innerHTML = Array.from(
      { length: 10 },
      (_, i) => `<li><code>${esc(one())}</code><button type="button" aria-label="Copy item ${i + 1}">Copy</button></li>`,
    ).join('');
    $('#list').hidden = false;
  } catch {}
});
$('#ul').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) {
    const c = b.previousElementSibling;
    copy(c.textContent, c, {
      set textContent(t) {
        b.textContent = t || 'Copy';
      },
    });
  }
});
$('#copyall').addEventListener('click', (e) =>
  copy([...document.querySelectorAll('#ul code')].map((c) => c.textContent).join('\n'), $('#ul'), {
    set textContent(t) {
      e.target.textContent = t || 'Copy all';
    },
  }),
);
gen();
