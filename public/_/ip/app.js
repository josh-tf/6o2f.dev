import { $, esc, mountBar } from '/_/ui.js';
mountBar('IP');
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' && Number.isInteger(v) ? v.toLocaleString('en-US') : String(v));
const copies = [];
const rowsHtml = (pairs) =>
  pairs
    .map(([k, v]) => {
      copies.push(String(v ?? ''));
      return `<tr><th scope="row">${esc(k).replaceAll('_', '_<wbr>')}</th><td class="mono v">${esc(show(v))}</td><td class="act"><button type="button" data-i="${copies.length - 1}" aria-label="Copy ${esc(k)}">Copy</button></td></tr>`;
    })
    .join('');
async function copyText(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    btn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (btn.textContent = label), 1200);
}
try {
  const [info, hdrText] = await Promise.all([fetch('/json').then((r) => r.json()), fetch('/headers').then((r) => r.text())]);
  const headers = hdrText
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i), l.slice(i + 2)];
    });
  $('#ip').textContent = info.ip || 'unknown';
  $('#rows').innerHTML = rowsHtml(Object.entries(info));
  $('#hdrs').innerHTML = rowsHtml(headers);
} catch (x) {
  $('#ip').textContent = 'unavailable';
  $('#err').textContent = `Could not load your details: ${x.message}`;
}
$('#copyip').addEventListener('click', (e) => copyText($('#ip').textContent, e.target, 'Copy IP'));
document.querySelector('main').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (b) copyText(copies[b.dataset.i], b, 'Copy');
});
