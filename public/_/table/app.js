import { $, esc, mountBar } from '/_/ui.js';
import { parse, toMarkdown, toHTML, toASCII, toCSV } from './lib.js';
mountBar('Table');

const MAX_CELLS = 5000; // ponytail: grid editing stops here (one textarea per cell); outputs still cover the whole table
const NAMES = { csv: 'CSV', tsv: 'TSV', ssv: 'semicolon-separated', markdown: 'Markdown', html: 'HTML', json: 'JSON' };
let t = { rows: [], aligns: [] },
  cur = { r: 0, c: 0 };

let msgT;
const say = (s) => {
  $('#msg').textContent = s;
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
};
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${what}`);
  } catch {
    $('#out').select();
    say(document.execCommand?.('copy') ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
const col = (i) => {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
};

function fromInput() {
  $('#perr').textContent = '';
  $('#in').removeAttribute('aria-invalid');
  try {
    const r = parse($('#in').value, $('#fmt').value);
    t = { rows: r.rows, aligns: r.aligns };
    $('#pstat').textContent = r.rows.length
      ? `Read as ${NAMES[r.format]}: ${r.rows.length - 1} row${r.rows.length === 2 ? '' : 's'} + header, ${r.aligns.length} column${r.aligns.length === 1 ? '' : 's'}${r.ragged ? '. Short rows were padded with empty cells.' : '.'}`
      : 'Paste a table above, or start typing in the grid.';
  } catch (e) {
    $('#perr').textContent = e.message;
    $('#in').setAttribute('aria-invalid', 'true');
    return;
  }
  if (!t.rows.length)
    t = {
      rows: [
        ['', ''],
        ['', ''],
      ],
      aligns: ['', ''],
    };
  cur = { r: Math.min(cur.r, t.rows.length - 1), c: Math.min(cur.c, t.aligns.length - 1) };
  grid();
  out();
}

function grid(focus) {
  const cells = t.rows.length * t.aligns.length;
  $('#gnote').textContent =
    cells > MAX_CELLS
      ? `This table has ${cells.toLocaleString()} cells; the grid is limited to ${MAX_CELLS.toLocaleString()}. Edit the input instead; the output below covers every row.`
      : '';
  for (const id of ['#addr', '#delr', '#addc', '#delc']) $(id).disabled = cells > MAX_CELLS;
  if (cells > MAX_CELLS) {
    $('#grid').innerHTML = '<caption class="vh">Table too large to edit</caption><tr><th scope="row">Grid off</th></tr>';
    return;
  }
  const ta = (r, c) =>
    `<textarea rows="1" data-r="${r}" data-c="${c}" aria-label="${r ? `Row ${r}` : 'Header'}, column ${col(c)}" spellcheck="false" autocomplete="off"${r === cur.r && c === cur.c ? ' class="cur"' : ''}>${esc(t.rows[r][c])}</textarea>`;
  const al = t.aligns
    .map(
      (a, c) =>
        `<th scope="col"><select data-al="${c}" aria-label="Column ${col(c)} alignment">${[
          ['', 'Default'],
          ['l', 'Left'],
          ['c', 'Center'],
          ['r', 'Right'],
        ]
          .map(([v, n]) => `<option value="${v}"${a === v ? ' selected' : ''}>${n}</option>`)
          .join('')}</select></th>`,
    )
    .join('');
  $('#grid').innerHTML =
    `<caption class="vh">Editable table. First row is the header.</caption><thead><tr class="al"><td></td>${al}</tr><tr><th scope="row" class="rn"><span class="vh">Header</span></th>${t.rows[0].map((_, c) => `<th scope="col">${ta(0, c)}</th>`).join('')}</tr></thead><tbody>${t.rows
      .slice(1)
      .map((row, i) => `<tr><th scope="row" class="rn">${i + 1}</th>${row.map((_, c) => `<td>${ta(i + 1, c)}</td>`).join('')}</tr>`)
      .join('')}</tbody>`;
  if (focus) cell(cur.r, cur.c)?.focus();
}
const cell = (r, c) => $(`#grid textarea[data-r="${r}"][data-c="${c}"]`);

function out() {
  const o = document.querySelector('[name=o]:checked').value;
  $('#mdopt').hidden = o !== 'md';
  $('#asopt').hidden = o !== 'ascii';
  $('#out').value =
    o === 'md' ? toMarkdown(t, { compact: $('#compact').checked }) : o === 'html' ? toHTML(t) : o === 'ascii' ? toASCII(t, $('#box').value) : toCSV(t);
  $('#out').rows = Math.min(20, Math.max(4, $('#out').value.split('\n').length + 1));
}

$('#grid').addEventListener('input', (e) => {
  if (e.target.dataset.al !== undefined) t.aligns[+e.target.dataset.al] = e.target.value;
  else t.rows[+e.target.dataset.r][+e.target.dataset.c] = e.target.value;
  out();
});
$('#grid').addEventListener('focusin', (e) => {
  if (!e.target.matches('textarea')) return;
  document.querySelector('#grid .cur')?.classList.remove('cur');
  e.target.classList.add('cur');
  cur = { r: +e.target.dataset.r, c: +e.target.dataset.c };
});
$('#grid').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey || e.altKey || !e.target.matches('textarea')) return;
  e.preventDefault();
  const r = +e.target.dataset.r + (e.ctrlKey || e.metaKey ? -1 : 1),
    c = +e.target.dataset.c;
  if (r < 0) return;
  if (r >= t.rows.length) {
    t.rows.push(Array(t.aligns.length).fill(''));
    cur = { r, c };
    grid(true);
    out();
    say(`Added row ${r}`);
    return;
  }
  cell(r, c).focus();
});

function edit(fn, msg) {
  fn();
  grid(true);
  out();
  say(msg);
}
$('#addr').addEventListener('click', () =>
  edit(() => {
    t.rows.splice(cur.r + 1, 0, Array(t.aligns.length).fill(''));
    cur.r++;
  }, 'Row added below the current one'),
);
$('#delr').addEventListener('click', () => {
  if (t.rows.length < 2) return say('A table needs at least its header row.');
  const head = cur.r === 0;
  edit(
    () => {
      t.rows.splice(cur.r, 1);
      cur.r = Math.min(cur.r, t.rows.length - 1);
    },
    head ? 'Header row deleted; the first row is now the header' : 'Row deleted',
  );
});
$('#addc').addEventListener('click', () =>
  edit(() => {
    t.rows.forEach((r) => r.splice(cur.c + 1, 0, ''));
    t.aligns.splice(cur.c + 1, 0, '');
    cur.c++;
  }, 'Column added to the right'),
);
$('#delc').addEventListener('click', () => {
  if (t.aligns.length < 2) return say('A table needs at least one column.');
  edit(
    () => {
      t.rows.forEach((r) => r.splice(cur.c, 1));
      t.aligns.splice(cur.c, 1);
      cur.c = Math.min(cur.c, t.aligns.length - 1);
    },
    `Column ${col(cur.c)} deleted`,
  );
});

let timer;
$('#in').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(fromInput, 200);
});
$('#fmt').addEventListener('change', fromInput);
$('#clear').addEventListener('click', () => {
  $('#in').value = '';
  fromInput();
  $('#in').focus();
});
for (const el of document.querySelectorAll('[name=o], #compact, #box')) el.addEventListener('change', out);
$('#copy').addEventListener('click', () => copy($('#out').value, document.querySelector('[name=o]:checked').nextElementSibling.textContent));

$('#in').value =
  'Plan,Price (USD/mo),Seats,Notes\nFree,0,1,"Community support, 1 project"\nPro,12,5,"Priority email\nCustom domains"\nTeam,49,25,SSO | audit log\nEnterprise,,Unlimited';
fromInput();
t.aligns = ['l', 'r', 'c', ''];
grid();
out();
