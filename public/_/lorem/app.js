import { $, mountBar } from '/_/ui.js';
import { generate } from './lib.js';
mountBar('Lorem');
let rnd = 1;
const run = () => {
  const c = Math.min(1000, Math.max(1, Math.floor(+$('#count').value) || 1));
  const seed = $('#seed').value.trim() || rnd;
  $('#out').textContent = generate({
    kind: $('#kind').value,
    count: c,
    seed,
    start: $('#start').checked,
    html: $('#html').checked && $('#kind').value === 'paragraphs',
  });
  const t = $('#out').textContent;
  $('#info').textContent = `${(t.replace(/<\/?p>/g, '').match(/[a-z]+/gi) ?? []).length.toLocaleString()} words, ${t.length.toLocaleString()} characters`;
};
$('#html').addEventListener('change', () => {
  if ($('#html').checked) $('#kind').value = 'paragraphs';
  run();
});
$('#kind').addEventListener('input', () => {
  if ($('#kind').value !== 'paragraphs') $('#html').checked = false;
});
for (const id of ['kind', 'count', 'seed', 'start']) $('#' + id).addEventListener('input', run);
$('#go').addEventListener('click', () => {
  rnd = (Math.random() * 2 ** 31) | 0;
  run();
});
$('#copy').addEventListener('click', async (e) => {
  const b = e.target,
    t = $('#out').textContent;
  try {
    await navigator.clipboard.writeText(t);
    b.textContent = 'Copied';
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#out'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    b.textContent = 'Selected, press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1500);
});
run();
