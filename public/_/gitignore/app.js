import { $, esc, mountBar } from '/_/ui.js';
import { TEMPLATES, GROUPS, combine, search } from './lib.js';
mountBar('.gitignore');

const say = (t) => {
  $('#msg').textContent = t;
};
const ids = Object.keys(TEMPLATES);
// Keep the user's pick order so the output follows it.
let picked = [];

$('#chips').innerHTML = GROUPS.map(
  (g) =>
    `<fieldset><legend>${esc(g)}</legend><div class="chips">${ids
      .filter((id) => TEMPLATES[id].group === g)
      .map((id) => `<label class="chip" data-id="${id}"><input type="checkbox" value="${id}">${esc(TEMPLATES[id].name)}</label>`)
      .join('')}</div></fieldset>`,
).join('');

function render() {
  for (const cb of document.querySelectorAll('#chips input')) cb.checked = picked.includes(cb.value);
  const text = combine(picked);
  $('#out').value = text || '# Pick one or more templates.\n';
  $('#out').setSelectionRange(0, 0);
  const n = text.split('\n').filter((l) => l && !l.startsWith('#')).length;
  $('#stats').textContent = picked.length ? `${picked.length} template${picked.length === 1 ? '' : 's'}, ${n} patterns` : '';
  $('#copy').disabled = $('#dl').disabled = !picked.length;
  history.replaceState(null, '', picked.length ? `#${picked.join(',')}` : location.pathname);
}
function filter() {
  const hits = new Set(search($('#q').value));
  for (const l of document.querySelectorAll('.chip')) l.hidden = !hits.has(l.dataset.id);
  for (const f of document.querySelectorAll('#chips fieldset')) f.hidden = !f.querySelector('.chip:not([hidden])');
  $('#count').textContent = $('#q').value.trim()
    ? hits.size
      ? `${hits.size} matching template${hits.size === 1 ? '' : 's'}.`
      : 'No template matches. Try a language or tool name.'
    : `${ids.length} templates.`;
}

$('#chips').addEventListener('change', (e) => {
  const id = e.target.value;
  picked = e.target.checked ? [...picked, id] : picked.filter((x) => x !== id);
  render();
});
$('#q').addEventListener('input', filter);
$('#q').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const best = search($('#q').value)[0],
    first = best && document.querySelector(`#chips input[value="${best}"]`);
  if (first) {
    e.preventDefault();
    first.click();
    say(`${first.checked ? 'Added' : 'Removed'} ${TEMPLATES[first.value].name}.`);
  }
});
$('#none').addEventListener('click', () => {
  picked = [];
  render();
  say('Cleared the selection.');
});
$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#out').value);
    say('Copied the .gitignore.');
  } catch {
    $('#out').select();
    say(document.execCommand?.('copy') ? 'Copied the .gitignore.' : 'Copy blocked by the browser. The text is selected: press Ctrl+C.');
  }
});
$('#dl').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), {
    download: '.gitignore',
    href: URL.createObjectURL(new Blob([$('#out').value], { type: 'application/octet-stream' })),
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say('Downloaded. Some browsers drop the leading dot: rename the file to .gitignore if so.');
});

let hash = location.hash.slice(1);
try {
  hash = decodeURIComponent(hash);
} catch {}
const fromHash = hash.split(',').filter((x) => TEMPLATES[x]);
picked = fromHash.length ? [...new Set(fromHash)] : ['node', 'dotenv', 'logs', 'macos', 'vscode'];
filter();
render();
