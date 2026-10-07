import { $, esc, mountBar } from '/_/ui.js';
import { toRoman, toVinculum, fromRoman, toWords, ordinalWords, ordinalSuffix, chequeWords, fromWords, parseNumber } from './lib.js';
mountBar('Numerals');

let msgT;
async function copy(text, what) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}`;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}
const fmt = (n) => BigInt(n).toLocaleString('en');
const ordShort = (n) => ordinalSuffix(n).replace(/\d+/, (d) => fmt(d)); // 1,000th

function roman() {
  const s = $('#r').value.trim(),
    out = $('#rout'),
    err = $('#rerr'),
    note = $('#rnote');
  out.textContent = '';
  err.textContent = '';
  note.textContent = '';
  $('#rissues').innerHTML = '';
  $('#r').removeAttribute('aria-invalid');
  if (!s) {
    note.textContent = 'Type a number like 2024 or a numeral like MMXXIV.';
    return;
  }
  try {
    if (/^[\d\s,._+-]+$/.test(s)) {
      const { neg, int, frac } = parseNumber(s);
      if (frac) throw new Error('Roman numerals have no fractions: use a whole number.');
      const n = neg ? -Number(int) : Number(int);
      if (n > 3999 && n <= 3999999) {
        out.textContent = toVinculum(n);
        note.textContent = `${fmt(n)} is above 3999, so this uses vinculum notation: a bar over a letter multiplies it by 1000. Many fonts draw the bar faintly; there is no standard form without it.`;
        return;
      }
      if (n > 3999999) throw new Error('Even with the vinculum (×1000 bar) Roman numerals stop at 3,999,999.');
      out.textContent = toRoman(n);
      // one numeral per decimal place: 1994 = M (1000) + CM (900) + XC (90) + IV (4)
      const parts = [...String(n)].map((d, i, a) => +d * 10 ** (a.length - 1 - i)).filter(Boolean);
      note.textContent = parts.length > 1 ? `${fmt(n)} = ${parts.map((v) => `${toRoman(v)} (${v})`).join(' + ')}` : `${toRoman(n)} is the standard spelling.`;
    } else {
      const r = fromRoman(s);
      out.textContent = fmt(r.value);
      $('#rissues').innerHTML = r.issues.map((i) => `<li>${esc(i)}</li>`).join('');
      if (r.issues.length && r.canonical) note.textContent = `Not the standard form. Canonical spelling: ${r.canonical}.`;
      else if (!r.issues.length) note.textContent = `${r.canonical} is the standard spelling.`;
    }
  } catch (e) {
    err.textContent = e.message;
    $('#r').setAttribute('aria-invalid', 'true');
  }
}

function words() {
  const s = $('#n').value,
    body = $('#words tbody'),
    opts = { british: $('#brit').checked };
  $('#nerr').textContent = '';
  $('#n').removeAttribute('aria-invalid');
  if (!s.trim()) {
    body.innerHTML = '<tr><td class="muted" colspan="3">Type a number to see it in words.</td></tr>';
    return;
  }
  try {
    const p = parseNumber(s),
      card = toWords(s, opts),
      rows = [['Cardinal', card]];
    if (!p.frac) rows.push(['Ordinal', ordinalWords(card)], ['Ordinal, short', (p.neg ? '-' : '') + ordShort(p.int)]);
    if (!p.neg) {
      const c = chequeWords(s, $('#cur').value, opts);
      rows.push(['Cheque', c.words], ['Cheque, fraction', c.fraction]);
    }
    rows.push(['Digits', (p.neg ? '-' : '') + fmt(p.int) + (p.frac ? '.' + p.frac : '')]);
    body.innerHTML = rows
      .map(
        ([k, v]) =>
          `<tr><th scope="row">${k}</th><td>${esc(v)}</td><td><button type="button" data-c="${esc(v)}" aria-label="Copy ${k.toLowerCase()}">Copy</button></td></tr>`,
      )
      .join('');
  } catch (e) {
    body.innerHTML = '';
    $('#nerr').textContent = e.message;
    $('#n').setAttribute('aria-invalid', 'true');
  }
}

function back() {
  const s = $('#w').value;
  $('#wout').textContent = '';
  $('#werr').textContent = '';
  $('#w').removeAttribute('aria-invalid');
  if (!s.trim()) return;
  try {
    const r = fromWords(s);
    let n = fmt(r.value) + (r.frac ? '.' + r.frac : '');
    if (r.neg && r.value === 0n) n = '-' + n;
    $('#wout').textContent = r.ordinal ? `${n} (${ordShort(r.value)})` : n;
    $('#wout').dataset.v = `${r.value}${r.frac ? '.' + r.frac : ''}`;
  } catch (e) {
    $('#werr').textContent = e.message;
    $('#w').setAttribute('aria-invalid', 'true');
  }
}

$('#r').addEventListener('input', roman);
for (const id of ['#n', '#cur', '#brit']) $(id).addEventListener('input', words);
$('#w').addEventListener('input', back);
$('#words').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-c]');
  if (b) copy(b.dataset.c, b.getAttribute('aria-label').replace('Copy ', ''));
});
$('#rcopy').addEventListener('click', () => $('#rout').textContent && copy($('#rout').textContent, $('#rout').textContent));
$('#wcopy').addEventListener('click', () => $('#wout').dataset.v && copy($('#wout').dataset.v, $('#wout').dataset.v));
roman();
words();
back();
