import { $, esc, mountBar } from '/_/ui.js';
import { diff, fold } from './lcs.js';
mountBar('Text diff');
const txt = (s) => (s.segs ? s.segs.map((g) => (g.changed ? `<mark>${esc(g.text)}</mark>` : esc(g.text))).join('') : esc(s.text));
// The visually hidden prefix tells screen readers what colour alone shows.
const cell = (s, cls, sr) =>
  s
    ? `<span class="n ${cls}">${s.n}</span><span class="${cls}">${sr ? `<span class="vh">${sr} </span>` : ''}${txt(s)}</span>`
    : '<span class="n none"></span><span class="none"></span>';
const skip = (r) => `<span class="skip">⋯ ${r.count} unchanged line${r.count === 1 ? '' : 's'}</span>`;
function run() {
  const d = diff($('#a').value, $('#b').value, { ignoreWs: $('#ws').checked });
  const unified = document.querySelector('[name=view]:checked').value === 'unified';
  const rows = $('#fold').checked ? fold(d.rows, 3) : d.rows;
  $('#count').innerHTML = `<span class="a">+${d.added}</span> <span class="r">−${d.removed}</span><span class="vh"> lines</span>`;
  let h = '';
  if (!unified)
    h = rows
      .map((r) =>
        r.t === 'skip'
          ? skip(r)
          : cell(r.l, r.t === 'eq' ? '' : 'del', r.t === 'eq' ? '' : 'removed:') + cell(r.r, r.t === 'eq' ? '' : 'add', r.t === 'eq' ? '' : 'added:'),
      )
      .join('');
  else
    for (let i = 0; i < rows.length;) {
      if (rows[i].t === 'skip') {
        h += skip(rows[i++]);
        continue;
      }
      if (rows[i].t === 'eq') {
        const { l, r } = rows[i++];
        h += `<span class="n">${l.n}</span><span class="n">${r.n}</span><span></span><span>${esc(r.text)}</span>`;
        continue;
      }
      const blk = [];
      while (i < rows.length && rows[i].t !== 'eq' && rows[i].t !== 'skip') blk.push(rows[i++]);
      for (const r of blk)
        if (r.l)
          h += `<span class="n del">${r.l.n}</span><span class="n del"></span><span class="del"><span aria-hidden="true">-</span><span class="vh">removed:</span></span><span class="del">${txt(r.l)}</span>`;
      for (const r of blk)
        if (r.r)
          h += `<span class="n add"></span><span class="n add">${r.r.n}</span><span class="add"><span aria-hidden="true">+</span><span class="vh">added:</span></span><span class="add">${txt(r.r)}</span>`;
    }
  const same = d.rows.length && !d.added && !d.removed;
  $('#out').innerHTML = !d.rows.length
    ? '<p class="muted">Paste text into both boxes to compare them.</p>'
    : (same ? `<p class="muted">The texts are identical${$('#ws').checked ? ' (ignoring whitespace)' : ''}.</p>` : '') +
      `<div class="d ${unified ? 'unified' : 'split'}">${h}</div>`;
}
document.querySelector('main').addEventListener('input', run);
document.querySelector('main').addEventListener('change', run);
$('#swap').addEventListener('click', () => {
  [$('#a').value, $('#b').value] = [$('#b').value, $('#a').value];
  run();
});
run();
