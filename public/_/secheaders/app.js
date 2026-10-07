import { $, api, mountBar } from '/_/ui.js';
mountBar('Sec Headers');
let last = null;
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const LABEL = { pass: 'Pass', warn: 'Warn', fail: 'Fail', info: 'Info' };

function render(r) {
  last = r;
  const g = $('#grade');
  g.textContent = r.grade;
  g.className = `badge ${r.grade.startsWith('A') ? 'g-good' : r.grade === 'B' || r.grade === 'C' ? 'g-mid' : 'g-bad'}`;
  g.setAttribute('aria-label', `Grade ${r.grade}`);
  $('#final').textContent = r.finalUrl;
  const n = (s) => r.checks.filter((c) => c.status === s).length;
  $('#gsub').textContent =
    `Score ${r.score}/100 · ${n('pass')} passed, ${n('warn')} warnings, ${n('fail')} failed · HTTP ${r.status} in ${r.ms} ms` +
    (r.chain.length > 1 ? ` after ${r.chain.length - 1} redirect${r.chain.length > 2 ? 's' : ''}` : '');
  $('#checks').replaceChildren(
    ...r.checks.map((c) => {
      const tr = el('tr');
      const st = el('td');
      st.append(el('span', `pill s-${c.status}`, LABEL[c.status]));
      const d = el('td', 'd', c.detail);
      if (c.fix && (c.status === 'fail' || c.status === 'warn')) {
        const p = el('pre');
        p.append(el('code', '', c.fix));
        d.append(p);
      }
      tr.append(el('td', '', c.name), st, d);
      return tr;
    }),
  );
  $('#raw').replaceChildren(
    ...r.headers.map(([k, v]) => {
      const tr = el('tr');
      const th = el('th', '', k);
      th.scope = 'row';
      tr.append(th, el('td', '', v));
      return tr;
    }),
  );
  $('#rawn').textContent = `(${r.headers.length})`;
  $('#res').hidden = false;
}

async function scan() {
  const url = $('#url').value.trim();
  $('#msg').textContent = '';
  if (!url) {
    $('#msg').textContent = 'Enter a URL such as https://example.com or just example.com.';
    $('#url').focus();
    return;
  }
  $('#go').disabled = true;
  $('#busy').textContent = `Scanning ${url}…`;
  try {
    const r = await api('/api/scan', { method: 'POST', body: { url } });
    render(r);
    $('#busy').textContent = `Scanned: grade ${r.grade}.`;
  } catch (e) {
    $('#busy').textContent = '';
    $('#msg').textContent = `Could not scan: ${e.message}`;
  } finally {
    $('#go').disabled = false;
  }
}
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  scan();
});
$('#copy').addEventListener('click', async () => {
  if (!last) return;
  const s = $('#copied');
  try {
    await navigator.clipboard.writeText(last.markdown);
    s.textContent = 'Copied';
  } catch {
    const t = document.createElement('textarea');
    t.value = last.markdown;
    t.setAttribute('aria-hidden', 'true');
    document.body.append(t);
    t.select();
    s.textContent = document.execCommand?.('copy') ? 'Copied' : 'Copy blocked: select the text and press Ctrl+C.';
    t.remove();
  }
  setTimeout(() => (s.textContent = ''), 2500);
});
scan(); // realistic example on first view
