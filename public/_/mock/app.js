import { $, mountBar } from '/_/ui.js';
mountBar('Mock API');
const f = $('#f');
const url = () => {
  const q = new URLSearchParams();
  for (const k of ['delay', 'fail', 'failcode', 'retry', 'body', 'type']) if (f[k].value !== '') q.set(k, f[k].value);
  if (q.get('delay') === '0') q.delete('delay');
  if (!q.has('type') && q.has('body')) {
    try {
      JSON.parse(q.get('body'));
      q.set('type', 'json');
    } catch {}
  } // Auto: JSON-looking bodies get a JSON content type
  f.failcode.disabled = !Number(q.get('fail')); // fail status only matters with a fail chance
  if (f.failcode.disabled) {
    q.delete('fail');
    q.delete('failcode');
  }
  if (q.has('retry') && ![f.status.value, q.get('failcode')].some((s) => s === '429' || s === '503')) q.delete('retry'); // ignored by the server otherwise
  return `${location.origin}/s/${encodeURIComponent(f.status.value || '200')}${q.size ? `?${q}` : ''}`;
};
const sh = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const curl = () => `curl -i${$('#method').value === 'GET' ? '' : ` -X ${$('#method').value}`} ${sh(url())}`;
const bad = () => [...f.querySelectorAll('input')].find((i) => !i.checkValidity());
function show() {
  const b = bad();
  $('#err').textContent = b ? `${b.labels[0].textContent}: ${b.validationMessage}` : '';
  $('#go').disabled = !!b;
  $('#url').textContent = url();
  $('#curl').textContent = curl();
}
f.addEventListener('input', show);
f.addEventListener('change', show);
$('#method').addEventListener('change', show);
f.addEventListener('submit', (e) => e.preventDefault());
$('#echo').textContent = `curl -X POST -d 'hello' ${location.origin}/echo/test?x=1`;
show();
const copy = (btn, get) =>
  btn.addEventListener('click', async () => {
    const label = btn.textContent;
    try {
      await navigator.clipboard.writeText(get());
      btn.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren(btn === $('#cu') ? $('#url') : $('#curl'));
      btn.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => (btn.textContent = label), 1500);
  });
copy($('#cu'), url);
copy($('#cc'), curl);
$('#go').addEventListener('click', async () => {
  const t = performance.now(),
    res = $('#res'),
    out = $('#out'),
    go = $('#go');
  res.className = 'mono muted';
  res.textContent = 'Waiting…';
  out.hidden = true;
  go.disabled = true;
  try {
    const r = await fetch(url(), { method: $('#method').value, cache: 'no-store' });
    const text = await r.text();
    res.className = r.ok ? 'mono' : 'mono err';
    res.textContent = `${r.status} ${r.statusText} · ${Math.round(performance.now() - t)} ms`;
    const hdrs = ['content-type', 'retry-after'].filter((h) => r.headers.get(h)).map((h) => `${h}: ${r.headers.get(h)}`);
    out.textContent = `${hdrs.join('\n')}${hdrs.length ? '\n\n' : ''}${text || '(no body)'}`;
    out.hidden = false;
  } catch (e) {
    res.className = 'mono err';
    res.textContent = `Request failed: ${e.message}`;
  } finally {
    go.disabled = !!bad();
  }
});
