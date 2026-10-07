import { $, esc, mountBar } from '/_/ui.js';
import { slugify } from './lib.js';
mountBar('Slug');
function run() {
  const o = { sep: $('#sep').value, lower: $('#lower').checked, max: Math.max(0, +$('#max').value || 0), accents: $('#acc').checked, stop: $('#stop').checked };
  const src = $('#batch').checked ? $('#in').value.split(/\r?\n/) : [$('#in').value];
  const out = src.map((s) => slugify(s, o));
  $('#out').value = out.join('\n');
  const pairs = src.map((s, i) => [s.trim(), out[i]]).filter(([s]) => s);
  $('#ba').innerHTML = pairs.length
    ? pairs.map(([a, b]) => `<li><span>${esc(a)}</span><i>&rarr;</i><span>${esc(b) || '<em class="muted">(empty)</em>'}</span></li>`).join('')
    : '<li class="muted">Nothing to convert</li>';
}
$('#in').value = 'Hello, World! A Beginner’s Guide\nCrème Brûlée & Straße: the Øresund Łódź trip\nThe 10 Best Cafés of 2024 (Updated)';
for (const e of document.querySelectorAll('.opts select,.opts input,#in')) e.addEventListener('input', run);
document.addEventListener('click', async (e) => {
  const id = e.target.dataset?.copy;
  if (!id) return;
  const t = $('#' + id),
    old = e.target.textContent;
  try {
    await navigator.clipboard.writeText(t.value);
    e.target.textContent = 'Copied';
  } catch {
    t.select();
    e.target.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (e.target.textContent = old), 1400);
});
run();
