import { $, mountBar } from '/_/ui.js';
import { escape, unescape } from './lib.js';
mountBar('HTML entities');
const esc = () => $('input[name=dir]:checked').value === 'esc';
function run() {
  $('#naw').hidden = !esc();
  $('#out').value = esc() ? escape($('#in').value, $('#na').checked) : unescape($('#in').value);
}
$('#in').value = `<a href="/search?q=café&lang=fr">Café “Crème” — Tom & Jerry's</a>`;
for (const e of document.querySelectorAll('#in,#na,input[name=dir]')) e.addEventListener('input', run);
$('#swap').onclick = () => {
  $('#in').value = $('#out').value;
  $('input[name=dir][value=' + (esc() ? 'unesc' : 'esc') + ']').checked = true;
  run();
};
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
