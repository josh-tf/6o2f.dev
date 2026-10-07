import { $, esc, mountBar } from '/_/ui.js';
import { fmt, round, pctOf, whatPct, change, adjust, original, points, stack } from './lib.js';
mountBar('Percent');

let msgT;
async function copy(text) {
  const say = (m) => {
    $('#msg').textContent = m;
    clearTimeout(msgT);
    msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
  };
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${text}`);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? `Copied ${text}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
const n = (id) => {
  const v = $(id).value.trim();
  return v === '' ? NaN : Number(v);
};
const sgn = (v, dp) => `${v > 0 ? '+' : ''}${fmt(v, dp)}`;

const CALC = {
  of: (dp) => {
    const r = pctOf(n('#of-x'), n('#of-y'), dp);
    return r.error ? r : { ...r, text: fmt(r.value, dp) };
  },
  what: (dp) => {
    const r = whatPct(n('#wh-x'), n('#wh-y'), dp);
    return r.error ? r : { ...r, text: `${fmt(r.value, dp)}%` };
  },
  chg: (dp) => {
    const r = change(n('#ch-a'), n('#ch-b'), dp);
    return r.error ? r : { ...r, text: `${sgn(r.value, dp)}%`, sub: r.word };
  },
  adj: (dp) => {
    const d = Number($('#ad-d').value),
      r = adjust(n('#ad-y'), n('#ad-x'), d, dp);
    return r.error ? r : { ...r, text: fmt(r.value, dp), sub: `${sgn(r.delta, dp)} from ${fmt(n('#ad-y'), 10)}` };
  },
  rev: (dp) => {
    const r = original(n('#rv-f2'), n('#rv-x'), Number($('#rv-d').value), dp);
    return r.error ? r : { ...r, text: fmt(r.value, dp), sub: 'original value' };
  },
  pts: (dp) => {
    const r = points(n('#pt-a'), n('#pt-b'), dp);
    return r.error ? r : { ...r, text: `${sgn(r.value, dp)} pp`, sub: r.rel === null ? 'relative change undefined' : `${sgn(r.rel, dp)}% relative` };
  },
  stk: (dp) => {
    const p = n('#st-p'),
      r = stack(n('#st-a'), n('#st-b'), Number.isFinite(p) ? p : undefined, dp);
    return r.error ? r : { ...r, text: `${fmt(r.value, dp)}% off`, sub: r.final === null ? 'combined discount' : `pay ${fmt(r.final, dp)}` };
  },
};
function run() {
  const raw = Number($('#dp').value),
    dp = Number.isInteger(raw) && raw >= 0 && raw <= 10 ? raw : 2;
  for (const sec of document.querySelectorAll('.calc')) {
    const r = CALC[sec.dataset.k](dp),
      out = $('output', sec),
      btn = $('.cp', sec);
    out.classList.toggle('err', !!r.error);
    out.innerHTML = r.error ? esc(r.error) : `<b>${esc(r.text)}</b>${r.sub ? ` <span class="muted">${esc(r.sub)}</span>` : ''}`;
    $('.how', sec).textContent = r.error ? '' : r.steps;
    btn.disabled = !!r.error;
    btn.dataset.c = r.error ? '' : String(round(r.value, dp));
    btn.setAttribute('aria-label', `Copy result: ${sec.querySelector('h2').textContent}`);
    for (const i of sec.querySelectorAll('input'))
      i.setAttribute('aria-invalid', String(!!r.error && (i.value.trim() === '' || !Number.isFinite(Number(i.value)))));
  }
}
document.addEventListener('input', run);
document.addEventListener('change', run);
document.addEventListener('click', (e) => {
  const b = e.target.closest('button.cp');
  if (b?.dataset.c) copy(b.dataset.c);
});
run();
