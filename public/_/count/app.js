import { $, esc, mountBar } from '/_/ui.js';
import { count, duration, topWords } from './lib.js';
mountBar('Counter');
const n = (x) => x.toLocaleString();
function run() {
  const t = $('#in').value,
    c = count(t);
  $('#stats').innerHTML = [
    ['Words', n(c.words)],
    ['Characters', n(c.chars)],
    ['No spaces', n(c.charsNoSpace)],
    ['Lines', n(c.lines)],
    ['Sentences', n(c.sentences)],
    ['Paragraphs', n(c.paragraphs)],
    ['UTF-8 bytes', n(c.bytes)],
    ['Reading (200 wpm)', duration(c.words, 200)],
    ['Speaking (130 wpm)', duration(c.words, 130)],
  ]
    .map(([l, v]) => `<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`)
    .join('');
  $('#hint').textContent = t ? '' : 'Empty. Type or paste something above.';
  const lim = Math.floor(+$('#lim').value),
    left = lim - c.chars;
  $('#rem').textContent = !(lim >= 1) ? 'Enter a limit of 1 or more.' : left >= 0 ? `${n(left)} left of ${n(lim)}` : `${n(-left)} over the limit of ${n(lim)}`;
  $('#rem').classList.toggle('over', left < 0);
  $('#bar').style.width = lim >= 1 ? Math.min(100, (c.chars / lim) * 100) + '%' : '0';
  $('#bar').classList.toggle('over', left < 0);
  const top = topWords(t, $('#stop').checked);
  $('#top').innerHTML = top.length ? top.map(([w, k]) => `<li><span>${esc(w)}</span><span>${k}</span></li>`).join('') : '<li class="muted">No words yet</li>';
}
$('#in').value =
  `The quick brown fox jumps over the lazy dog. The dog, being lazy, did not mind; the fox was quick and the day was bright.\n\nA second paragraph: café au lait costs 4 euros — is that a lot? Emoji count as one character each \u{1F468}‍\u{1F469}‍\u{1F467}\u{1F44D}.`;
$('#clear').onclick = () => {
  $('#in').value = '';
  run();
  $('#in').focus();
};
for (const e of ['#in', '#lim', '#stop']) $(e).addEventListener('input', run);
for (const b of document.querySelectorAll('[data-lim]'))
  b.onclick = () => {
    $('#lim').value = b.dataset.lim;
    run();
  };
run();
