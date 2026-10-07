import { $, esc, mountBar } from '/_/ui.js';
import { LICENSES, COLUMNS, cell, fill, recommend } from './lib.js';
mountBar('Licenses');

const say = (t) => {
  $('#msg').textContent = t;
};
const ids = Object.keys(LICENSES);
const radio = (n) => document.querySelector(`input[name=${n}]:checked`).value;

$('#lic').innerHTML =
  `<optgroup label="Full text (put in LICENSE)">${ids
    .filter((i) => LICENSES[i].kind === 'full')
    .map((i) => `<option value="${i}">${esc(LICENSES[i].name)}</option>`)
    .join('')}</optgroup>` +
  `<optgroup label="Header notice (full text linked)">${ids
    .filter((i) => LICENSES[i].kind === 'notice')
    .map((i) => `<option value="${i}">${esc(LICENSES[i].name)}</option>`)
    .join('')}</optgroup>`;

// Comparison table
const groups = [
  ['perms', 'Permissions'],
  ['conds', 'Conditions'],
  ['limits', 'Limitations'],
];
$('#cmp').innerHTML =
  `<caption class="vh">What each licence permits, requires and limits</caption><thead>
<tr><td></td>${groups.map(([g, n]) => `<th scope="colgroup" colspan="${COLUMNS.filter((c) => c[2] === g).length}" class="g">${n}</th>`).join('')}</tr>
<tr><th scope="col">Licence</th>${COLUMNS.map(([, l]) => `<th scope="col">${esc(l)}</th>`).join('')}</tr></thead><tbody>` +
  ids
    .map(
      (i) =>
        `<tr data-id="${i}"><th scope="row">${esc(LICENSES[i].name)}</th>${COLUMNS.map(([k]) => {
          const v = cell(i, k);
          return v === 'yes'
            ? '<td class="y">yes</td>'
            : v === 'excluded'
              ? '<td class="x">excluded</td>'
              : v
                ? `<td class="y">${esc(v)}</td>`
                : '<td><span class="vh">no</span><span aria-hidden="true">–</span></td>';
        }).join('')}</tr>`,
    )
    .join('') +
  '</tbody>';

let rec;
function quiz() {
  const style = radio('style');
  $('#q2').disabled = style !== 'permissive';
  $('#q3').disabled = style !== 'strong';
  rec = recommend({ style, patents: radio('patents') === 'yes', network: radio('network') === 'yes' });
  $('#rec').textContent = LICENSES[rec.id].name === rec.id ? rec.id : `${LICENSES[rec.id].name} (${rec.id})`;
  $('#why').innerHTML = `${esc(rec.why)} <span class="muted">Also consider: ${rec.alt.map((a) => esc(LICENSES[a].name)).join(', ')}.</span>`;
  $('#use').textContent = `Use ${LICENSES[rec.id].name}`;
}

function render() {
  const id = $('#lic').value,
    l = LICENSES[id];
  const gnu = /GPL/.test(id);
  $('#f-project').hidden = !gnu;
  $('#year').disabled = $('#holder').disabled = !!l.noHolder;
  const { text, warnings } = fill(id, { year: $('#year').value, holder: $('#holder').value, project: $('#project').value });
  $('#out').value = text;
  $('#out').setSelectionRange(0, 0);
  $('#out').scrollTop = 0;
  $('#warn').textContent = warnings.join(' ');
  const link = (u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https:\/\//, ''))}</a>`;
  $('#how').innerHTML =
    l.kind === 'full'
      ? `Save as <code>LICENSE</code> in the repository root.${l.noHolder ? ' This text has no copyright line, so year and holder are not used.' : ''} SPDX: <code>${esc(id)}</code>. Canonical: ${link(l.url)}`
      : `Put this header at the top of each source file (in a comment) and save the full text from ${link(l.url)} as <code>LICENSE</code>${l.also ? `, plus the GPL text from ${link(l.also)} as <code>COPYING</code>` : ''}.${l.noHolder ? ' The MPL notice has no copyright line; you may add one above it.' : ''} SPDX: <code>${esc(id)}</code>.`;
  $('#outlabel').textContent = l.kind === 'full' ? 'LICENSE' : 'Source file header';
  $('#dl').textContent = l.kind === 'full' ? 'Download LICENSE' : 'Download header';
  for (const tr of document.querySelectorAll('#cmp tbody tr')) tr.classList.toggle('sel', tr.dataset.id === id);
}

$('#quiz').addEventListener('change', quiz);
$('#quiz').addEventListener('submit', (e) => e.preventDefault());
$('#use').addEventListener('click', () => {
  $('#lic').value = rec.id;
  render();
  say(`Showing ${LICENSES[rec.id].name}.`);
  $('#lic').focus();
});
for (const id of ['#lic', '#year', '#holder', '#project']) $(id).addEventListener('input', render);
$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#out').value);
    say('Copied.');
  } catch {
    $('#out').select();
    say(document.execCommand?.('copy') ? 'Copied.' : 'Copy blocked by the browser. The text is selected: press Ctrl+C.');
  }
});
$('#dl').addEventListener('click', () => {
  const name = LICENSES[$('#lic').value].kind === 'full' ? 'LICENSE' : 'license-header.txt';
  const a = Object.assign(document.createElement('a'), {
    download: name,
    href: URL.createObjectURL(new Blob([$('#out').value], { type: 'application/octet-stream' })),
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say(`Downloaded ${name}.`);
});

$('#year').value = String(new Date().getFullYear());
$('#holder').value = 'Ada Lovelace';
$('#project').value = 'frobnicator: turns widgets into gadgets';
$('#lic').value = 'MIT';
quiz();
render();
