import { $, esc, mountBar } from '/_/ui.js';
import { calc, fmt } from './lib.js';
mountBar('Calculator');
let hist = [];
try {
  hist = JSON.parse(localStorage.calcHist || '[]');
} catch {}
const save = () => {
  try {
    localStorage.calcHist = JSON.stringify(hist.slice(0, 50));
  } catch {}
};
const ans = () => (hist[0] ? hist[0].r : 0);
let out = null;
function run() {
  const s = $('#x').value,
    r = $('#r');
  out = null;
  r.className = '';
  if (!s.trim()) {
    r.textContent = '';
    return;
  }
  try {
    out = calc(s, +ans());
    r.textContent = '= ' + fmt(out);
  } catch (e) {
    r.className = 'err';
    r.textContent = e.message;
  }
}
function draw() {
  $('#clr').disabled = !hist.length;
  $('#h').innerHTML =
    hist
      .map((h, i) => `<li><button type="button" data-i="${i}" title="Reuse this expression"><span>${esc(h.e)}</span><b>= ${esc(h.r)}</b></button></li>`)
      .join('') || '<li class="muted" style="padding:8px 6px">Nothing yet.</li>';
}
$('#x').addEventListener('input', run);
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  if (out === null) return;
  hist.unshift({ e: $('#x').value.trim(), r: fmt(out) });
  save();
  draw();
  $('#x').value = '';
  run();
});
$('#h').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) {
    $('#x').value = hist[b.dataset.i].e;
    run();
    $('#x').focus();
  }
});
$('#clr').addEventListener('click', () => {
  hist = [];
  save();
  draw();
  run();
});
$('#cp').addEventListener('click', async (e) => {
  if (out === null) return;
  let ok = true;
  try {
    await navigator.clipboard.writeText(fmt(out));
  } catch {
    ok = false;
    const g = getSelection(),
      rg = document.createRange();
    rg.selectNodeContents($('#r'));
    g.removeAllRanges();
    g.addRange(rg);
  } // fallback: select the result text
  e.target.textContent = ok ? 'Copied' : 'Copy failed';
  $('#cpmsg').textContent = ok ? 'Result copied' : 'Copy failed';
  setTimeout(() => {
    e.target.textContent = 'Copy';
    $('#cpmsg').textContent = '';
  }, 1200);
});
draw();
run();
