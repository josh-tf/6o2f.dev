// Shared helpers for every tool page. Usage: <script type="module"> import { api, esc, mountBar } from '/_/ui.js'
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const $ = (sel, root = document) => root.querySelector(sel);

/** fetch JSON from this origin's API; throws Error(message) on non-2xx; sends you to login on 401. */
export async function api(path, opts = {}) {
  const init = { ...opts, headers: { ...(opts.body ? { 'content-type': 'application/json' } : {}), ...opts.headers } };
  if (opts.body && typeof opts.body !== 'string') init.body = JSON.stringify(opts.body);
  const r = await fetch(path, init);
  if (r.status === 401) location.href = `https://${location.hostname.split('.').slice(-2).join('.')}/auth/login?next=${encodeURIComponent(location.href)}`;
  if (r.status === 204) return null;
  const data = (r.headers.get('content-type') || '').includes('json') ? await r.json() : await r.text();
  if (!r.ok) throw new Error(data?.error || r.statusText);
  return data;
}

/** Renders the top bar into <header class="bar">: logo → apex, tool title, avatar + sign out. */
export async function mountBar(title) {
  const apex = `https://${location.hostname.split('.').slice(-2).join('.')}`;
  const bar = $('header.bar') ?? document.body.prepend(Object.assign(document.createElement('header'), { className: 'bar' })) ?? $('header.bar');
  const path = title ? `~/${title.toLowerCase().replace(/\s+/g, '-')}` : '~';
  let me = null;
  try {
    me = await (await fetch('/_me')).json();
  } catch {}
  // Signed in: terminal-style tab title. Visitors (and search engines) keep the descriptive <title> the Worker wrote.
  // Set before returning, so a page can still set its own title after `await mountBar()`.
  if (me?.id) document.title = `dev@6o2f:${path}$`;
  bar.innerHTML =
    `<a class="logo" href="${apex}">dev@6o2f<span class="path">:${esc(path)}</span><span class="pr">$</span></a><span class="sp"></span>` +
    (me?.id
      ? `${me.avatarUrl ? `<img src="${esc(me.avatarUrl)}" alt="">` : ''}<span>${esc(me.name)}</span><button id="signout" type="button">Sign out</button>`
      : `<a class="btn primary" href="${apex}/auth/login?next=${encodeURIComponent(location.href)}">Sign in with Discord</a>`);
  $('#signout')?.addEventListener('click', async () => {
    await fetch('/_logout', { method: 'POST' });
    location.href = apex;
  });
  return me?.id ? me : null;
}

/* Number inputs get themed − / + steppers (the browser's own spinners clash with the theme). Applies to every number input on every page,
   including ones added later. Keyboard arrows still work on the input; buttons repeat while held. */
function enhanceNumber(input) {
  if (input.dataset.num || input.closest('.num') || !input.parentElement) return;
  input.dataset.num = '1';
  const w = input.getBoundingClientRect().width;
  const wrap = document.createElement('span');
  wrap.className = 'num';
  if (input.style.width.endsWith('%')) wrap.style.width = input.style.width;
  else if (w > 0) wrap.style.width = `${w}px`; // keep the field's original size
  const step = (dir) => {
    if (input.disabled || input.readOnly) return;
    if (input.step === 'any') {
      const lo = Number(input.min),
        hi = Number(input.max),
        d = input.max !== '' && input.min !== '' && hi - lo <= 10 ? 0.1 : 1;
      const v = Math.round(((Number(input.value) || 0) + dir * d) * 1e10) / 1e10;
      input.value = String(Math.min(input.max !== '' ? hi : Infinity, Math.max(input.min !== '' ? lo : -Infinity, v)));
    } else {
      try {
        dir > 0 ? input.stepUp() : input.stepDown();
      } catch {}
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const btn = (dir) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'stp';
    b.tabIndex = -1;
    b.textContent = dir > 0 ? '+' : '−';
    b.setAttribute('aria-label', dir > 0 ? 'Increase' : 'Decrease');
    let t, iv;
    const stop = () => {
      clearTimeout(t);
      clearInterval(iv);
    };
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      step(dir);
      t = setTimeout(() => (iv = setInterval(() => step(dir), 70)), 400);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    return b;
  };
  input.before(wrap);
  wrap.append(btn(-1), input, btn(1));
}
const scanNumbers = (root = document) => root.querySelectorAll?.('input[type=number]').forEach(enhanceNumber);
scanNumbers();
new MutationObserver((ms) =>
  ms.forEach((m) => m.addedNodes.forEach((n) => n.nodeType === 1 && (n.matches('input[type=number]') ? enhanceNumber(n) : scanNumbers(n)))),
).observe(document.documentElement, { childList: true, subtree: true });

/* Themed tooltips instead of the browser's: any element with a title shows a small bubble on mouse hover (after a short
   delay) or keyboard focus. The title moves to data-tip so the native tooltip doesn't also appear; if it was the element's
   only accessible name, it becomes aria-label. Pages can keep setting el.title at any time: the newest value wins. */
const tip = Object.assign(document.createElement('div'), { className: 'tip', id: 'ui-tip', hidden: true });
tip.setAttribute('role', 'tooltip');
let tipFor = null,
  tipTimer = 0;
function tipShow(el) {
  if (el.title) {
    el.dataset.tip = el.title;
    if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', el.title);
    el.removeAttribute('title');
  }
  if (!el.dataset.tip || !el.isConnected) return;
  tipFor = el;
  tip.textContent = el.dataset.tip;
  if (!tip.isConnected) document.body.append(tip);
  tip.hidden = false;
  const r = el.getBoundingClientRect(),
    w = tip.offsetWidth,
    h = tip.offsetHeight;
  tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  tip.style.top = `${r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8}px`; // above, or below when there's no room
}
function tipHide() {
  clearTimeout(tipTimer);
  tipFor = null;
  tip.hidden = true;
}
const tipTarget = (e) => e.target.closest?.('[title],[data-tip]');
document.addEventListener('pointerover', (e) => {
  if (e.pointerType !== 'mouse') return; // touch has no hover; long-press menus would fight a bubble
  const el = tipTarget(e);
  if (el === tipFor) return;
  tipHide();
  if (el) tipTimer = setTimeout(() => tipShow(el), 400);
});
document.addEventListener('focusin', (e) => {
  const el = tipTarget(e);
  if (el && el.matches(':focus-visible')) {
    tipHide();
    tipShow(el);
  }
});
document.addEventListener('focusout', tipHide);
document.addEventListener('pointerdown', tipHide);
document.addEventListener('keydown', (e) => e.key === 'Escape' && tipHide());
addEventListener('scroll', tipHide, true);
