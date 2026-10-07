import { $, mountBar } from '/_/ui.js';
import { encode, decode, parse, build } from './lib.js';
mountBar('URL');

const full = () => $('input[name=mode]:checked').value === 'f';
function conv() {
  const s = $('#txt').value;
  $('#enc').value = encode(s, full());
  try {
    $('#dec').value = decode(s, full(), $('#plus').checked);
    $('#decerr').textContent = '';
  } catch (e) {
    $('#dec').value = '';
    $('#decerr').textContent = e.message;
  }
}
$('#txt').value = 'https://example.com/search?q=café au lait&tag=a/b';
for (const el of ['#txt', '#plus', 'input[name=mode]']) document.querySelectorAll(el).forEach((e) => e.addEventListener('input', conv));

let p;
const redraw = () => {
  $('#out').value = build(p, $('#qplus').checked);
};
function rows() {
  const tb = $('#rows');
  tb.replaceChildren();
  p.rows.forEach((r, i) => {
    const tr = tb.insertRow();
    [0, 1].forEach((j) => {
      const inp = Object.assign(document.createElement('input'), {
        value: r[j],
        ariaLabel: `${j ? 'Value' : 'Key'} ${i + 1}`,
        spellcheck: false,
        autocomplete: 'off',
        autocapitalize: 'off',
      });
      inp.oninput = () => {
        r[j] = inp.value;
        redraw();
      };
      tr.insertCell().append(inp);
    });
    const rm = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Remove', ariaLabel: `Remove parameter ${i + 1}` });
    rm.onclick = () => {
      p.rows.splice(i, 1);
      rows();
      redraw();
      ($('#rows').rows[i]?.querySelector('button') ?? $('#add')).focus();
    };
    tr.insertCell().append(rm);
  });
  if (!p.rows.length)
    Object.assign(tb.insertRow().insertCell(), { colSpan: 3, className: 'empty', textContent: 'No query parameters. Use Add parameter to add one.' });
}
function load() {
  try {
    p = parse($('#url').value);
  } catch {
    p = null;
  }
  $('#parts').hidden = !p;
  $('#urlerr').textContent = p || !$('#url').value.trim() ? '' : 'Not a valid absolute URL (it needs a scheme, e.g. https://).';
  if (!p) return;
  for (const k of ['protocol', 'host', 'port', 'path', 'hash']) $('#f-' + k).value = p[k];
  rows();
  redraw();
}
for (const k of ['protocol', 'host', 'port', 'path', 'hash'])
  $('#f-' + k).addEventListener('input', (e) => {
    p[k] = e.target.value;
    redraw();
  });
$('#add').onclick = () => {
  p.rows.push(['', '']);
  rows();
  redraw();
  $('#rows tr:last-child input').focus();
};
$('#qplus').onchange = redraw;
$('#url').addEventListener('input', load);
$('#url').value = 'https://user@shop.example.com:8443/items/new%20arrivals?q=red+shoes&size=9&size=10&note=50%25%20off#reviews';

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
conv();
load();
