import { $, esc, mountBar } from '/_/ui.js';
import { CODES, CATEGORIES, RETRY, search, byCode } from './codes.js';
mountBar('HTTP codes');
let cat = 0,
  current = 404;
const q = $('#q'),
  list = $('#list');

$('#cats').innerHTML = [[0, 'All'], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.short])]
  .map(([k, l]) => `<label class="opt"><input type="radio" name="cat" value="${k}"${+k === 0 ? ' checked' : ''}><span>${l}</span></label>`)
  .join('');

function drawList() {
  const hits = search(q.value, cat);
  list.innerHTML = hits
    .map(
      (x) =>
        `<li><a href="#${x.code}" data-code="${x.code}" class="c${Math.floor(x.code / 100)}"${x.code === current ? ' aria-current="true"' : ''}><b>${x.code}</b><span>${esc(x.name)}</span></a></li>`,
    )
    .join('');
  $('#empty').hidden = hits.length > 0;
  $('#count').textContent = hits.length === CODES.length ? `${CODES.length} codes` : `${hits.length} of ${CODES.length} codes`;
  return hits;
}

function drawDetail(code) {
  const x = byCode(code);
  if (!x) {
    $('#detail').innerHTML =
      `<p class="err" role="alert">${esc(code)} is not a registered HTTP status code.</p><p class="muted">Registered codes run from 100 to 511. Unregistered ones (like 499 or 520) are vendor-specific.</p>`;
    return;
  }
  current = x.code;
  const k = Math.floor(x.code / 100),
    cg = CATEGORIES[k];
  const try_ =
    k === 1
      ? '<p class="muted small">1xx responses are interim and cannot be produced on demand.</p>'
      : `<a class="btn" href="https://mock.6o2f.dev/s/${x.code}" target="_blank" rel="noopener noreferrer">Try it: mock.6o2f.dev/s/${x.code}<span class="vh"> (opens in a new tab)</span></a>`;
  $('#detail').innerHTML = `
    <p class="cat c${k}">${esc(cg.short)} ${esc(cg.name)}</p>
    <h2 id="dh"><span class="bign c${k}">${x.code}</span> ${esc(x.name)}</h2>
    <p class="lead">${esc(x.meaning)}</p>
    <ul class="flags" aria-label="Hints">
      <li class="${x.cache ? 'yes' : 'no'}"><b>${x.cache ? 'Cacheable by default' : 'Not cached by default'}</b><span>${x.cache ? 'Caches may store it without explicit headers.' : 'Only cached with explicit Cache-Control or Expires.'}</span></li>
      <li class="r-${x.retry}"><b>${x.retry === 'yes' ? 'Retryable' : x.retry === 'maybe' ? 'Retry with care' : 'Do not retry as is'}</b><span>${esc(RETRY[x.retry])}</span></li>
    </ul>
    <h3>When to use it</h3><p>${esc(x.use)}</p>
    <h3>Common mistakes</h3><p>${esc(x.mistakes)}</p>
    ${x.headers.length ? `<h3>Related headers</h3><ul class="hdrs">${x.headers.map((h) => `<li><code>${esc(h)}</code></li>`).join('')}</ul>` : ''}
    <p class="muted small">Defined in ${esc(x.spec)}</p>
    <div class="row">${try_}<button type="button" id="cplink">Copy link</button><button type="button" id="cpline">Copy status line</button></div>`;
  list.querySelectorAll('a').forEach((a) => (+a.dataset.code === x.code ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
}

let msgT;
async function copy(text) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    try {
      ok = document.execCommand('copy');
    } catch {}
    t.remove();
  }
  $('#msg').textContent = ok ? `Copied ${text}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}
$('#detail').addEventListener('click', (e) => {
  const x = byCode(current);
  if (e.target.id === 'cplink') copy(`${location.origin}${location.pathname}#${current}`);
  if (e.target.id === 'cpline') copy(`HTTP/1.1 ${x.code} ${x.name.replace(/ \(OBSOLETED\)|\(Unused\) /, '')}`);
});

function fromHash(focus) {
  let h;
  try {
    h = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  if (!/^\d{3}$/.test(h)) return;
  drawDetail(+h);
  if (focus) {
    $('#detail').focus({ preventScroll: true });
    if (matchMedia('(max-width:760px)').matches)
      $('#detail').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
}
addEventListener('hashchange', () => fromHash(true));

q.addEventListener('input', drawList);
q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const a = list.querySelector('a');
    if (a) {
      e.preventDefault();
      if (location.hash === `#${a.dataset.code}`) fromHash(true);
      else location.hash = a.dataset.code;
    }
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    list.querySelector('a')?.focus();
  }
});
$('#cats').addEventListener('change', (e) => {
  cat = +e.target.value;
  drawList();
});
list.addEventListener('keydown', (e) => {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const as = [...list.querySelectorAll('a')],
    i = as.indexOf(document.activeElement);
  e.preventDefault();
  if (e.key === 'ArrowUp' && i <= 0) return q.focus();
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? as.length - 1 : Math.max(0, Math.min(as.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
  as[n]?.focus();
});
addEventListener('keydown', (e) => {
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) {
    e.preventDefault();
    q.focus();
    q.select();
  }
});

drawList();
drawDetail(current);
fromHash(false);
