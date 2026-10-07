import { $, esc, mountBar } from '/_/ui.js';
import { digitsOf, fmt, split, toMinor } from '/_/tip/lib.js';
await mountBar('Tip');
const CUR = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'SGD', 'JPY', 'CHF', 'INR', 'CNY', 'MXN', 'ZAR', 'KRW'];
const names = new Intl.DisplayNames(undefined, { type: 'currency' });
$('#cur').innerHTML = CUR.map((c) => `<option value="${c}">${c} ${esc(names.of(c))}</option>`).join('');
const DEF = { bill: '186.40', cur: 'AUD', tip: '15', tax: '10', n: '4' };
let shares = [],
  last = null;

function reset() {
  for (const [k, v] of Object.entries(DEF)) $('#' + k).value = v;
  $('#inc').checked = $('#pre').checked = true;
  $('#up').checked = false;
  shares = [];
  $('#uneven').open = false;
}
function sharesUI(n) {
  shares.length = n;
  for (let i = 0; i < n; i++) shares[i] ??= 1;
  const box = $('#shares');
  if (box.children.length !== n) {
    box.innerHTML = shares
      .map(
        (s, i) =>
          `<div><label for="s${i}">Person ${i + 1}</label><input id="s${i}" data-i="${i}" type="number" min="0" step="0.5" inputmode="decimal" value="${s}" style="width:100%"></div>`,
      )
      .join('');
  }
}
function update() {
  const cur = $('#cur').value,
    d = digitsOf(cur),
    n = Math.round(Number($('#n').value));
  $('#bill').step = d ? String(10 ** -d) : '1';
  const tip = Number($('#tip').value);
  document.querySelectorAll('#presets button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === tip && $('#tip').value !== '')));
  let err = '';
  if (!Number.isInteger(n) || n < 1 || n > 30) err = 'Enter between 1 and 30 people.';
  else if ($('#bill').value === '') err = 'Enter the bill amount.';
  else if ($('#tip').value === '') err = 'Enter a tip percentage, or 0 for none.';
  if (!err) sharesUI(n);
  const r = err
    ? { error: err }
    : split({
        bill: toMinor($('#bill').value, d),
        tipPct: tip,
        taxPct: Number($('#tax').value || 0),
        taxIncluded: $('#inc').checked,
        tipOnPreTax: $('#pre').checked,
        weights: shares.map(Number),
        roundUp: $('#up').checked,
        unit: 10 ** d,
      });
  $('#err').textContent = r.error || '';
  $('#out').hidden = !!r.error;
  if (r.error) return;
  const f = (m) => fmt(m, cur);
  const same = r.people.every((p) => p.total === r.people[0].total);
  $('#l-each').textContent = same ? 'Each person pays' : 'Per person (average)';
  $('#o-each').textContent = f(Math.round(r.total / r.people.length));
  $('#o-tip').textContent = `${f(r.tip)} (${+r.tipPct.toFixed(1)}%)`;
  $('#o-tot').textContent = f(r.total);
  const bits = [`Subtotal ${f(r.subtotal)}`, r.tax ? `tax ${f(r.tax)}` : '', `tip ${f(r.tip)}`].filter(Boolean);
  $('#note').textContent =
    `${bits.join(' + ')} = ${f(r.total)}. ${same ? '' : 'Shares are uneven. '}Leftover cents are handed out one at a time so the payments add up exactly.`;
  $('#tbl tbody').innerHTML = r.people
    .map(
      (p, i) =>
        `<tr><th scope="row">Person ${i + 1}</th><td class="r">${+p.share}</td><td class="r">${f(p.base)}</td><td class="r">${f(p.tip)}</td><td class="r"><b>${f(p.total)}</b></td></tr>`,
    )
    .join('');
  $('#tbl tfoot').innerHTML =
    `<tr><th scope="row">Total</th><td class="r">${+r.people.reduce((a, p) => a + p.share, 0)}</td><td class="r">${f(r.pre)}</td><td class="r">${f(r.tip)}</td><td class="r">${f(r.total)}</td></tr>`;
  last =
    `Bill ${f(r.subtotal)}${r.tax ? ` + tax ${f(r.tax)}` : ''} + tip ${f(r.tip)} = ${f(r.total)}\n` +
    r.people.map((p, i) => `Person ${i + 1}: ${f(p.total)}`).join('\n');
}
async function copy(text) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = 'Copied.';
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? 'Copied.' : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
}
$('#f').addEventListener('input', (e) => {
  if (e.target.dataset.i) shares[+e.target.dataset.i] = e.target.value === '' ? 0 : Number(e.target.value);
  update();
});
$('#f').addEventListener('change', update);
$('#f').addEventListener('submit', (e) => e.preventDefault());
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) {
    $('#tip').value = b.dataset.v;
    update();
  }
});
$('#reset').addEventListener('click', () => {
  reset();
  $('#shares').innerHTML = '';
  update();
});
$('#copy').addEventListener('click', () => last && copy(last));
reset();
update();
