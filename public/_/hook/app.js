import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('Webhook inspector');
let cur = null,
  timer = 0,
  newest = 0,
  items = [];
const open = new Set();
const fmt = (ms) => new Date(ms).toLocaleString();
const time = (ms) => `<time datetime="${new Date(ms).toISOString()}">${esc(fmt(ms))}</time>`;
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
  setTimeout(() => (btn.textContent = label), 1500);
}
async function list() {
  try {
    const hs = await api('/api/hooks');
    $('#list').innerHTML =
      hs
        .map((h) => {
          const n = h.name || h.id.slice(0, 8);
          return `<tr><th scope="row" style="font-weight:400"><button type="button" data-s="${esc(h.id)}" data-u="${esc(h.url)}" data-n="${esc(n)}" aria-pressed="${h.id === cur}">${esc(n)}</button></th><td class="muted">${time(h.created_at)}</td><td class="act"><button type="button" class="danger" data-d="${esc(h.id)}" aria-label="Delete ${esc(n)}">Delete</button></td></tr>`;
        })
        .join('') || '<tr><td colspan="3" class="muted">No endpoints yet. Create one above.</td></tr>';
  } catch (x) {
    $('#msg').textContent = `Could not load endpoints: ${x.message}`;
  }
}
function body(r) {
  if (!r.body) return '<p class="muted">No body.</p>';
  const note = (r.truncated ? ' (truncated at 256KB)' : '') + (r.encoding === 'base64' ? ' (binary, base64)' : '');
  let txt = r.body;
  if (r.encoding === 'text')
    try {
      txt = JSON.stringify(JSON.parse(r.body), null, 2);
    } catch {}
  return `<p class="muted">Body${esc(note)}</p><pre>${esc(txt)}</pre>`;
}
function render() {
  $('#empty').hidden = items.length > 0;
  $('#reqs').innerHTML = items
    .map(
      (r) =>
        `<details class="card rq" data-q="${r.seq}"${open.has(r.seq) ? ' open' : ''}><summary><span class="m">${esc(r.method)}</span><span class="p">${esc(r.path)}</span><span class="muted">${time(r.ts)}${r.ip ? ' · ' + esc(r.ip) : ''}</span></summary><div class="bd"><table><caption class="vh">Headers of request ${r.seq}</caption><tbody>${Object.entries(
          r.headers,
        )
          .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
          .join('')}</tbody></table>${body(r)}</div></details>`,
    )
    .join('');
}
async function poll() {
  clearTimeout(timer);
  if (!cur) return;
  const id = cur;
  try {
    const fresh = await api(`/api/hooks/${id}/requests?since=${newest}`);
    if (id !== cur) return;
    $('#live').textContent = '';
    if (fresh.length) {
      newest = fresh[0].seq;
      items = [...fresh, ...items].slice(0, 100);
      render();
      $('#live').textContent = `${fresh.length} new request${fresh.length > 1 ? 's' : ''}.`;
    }
  } catch (x) {
    if (id === cur) $('#live').textContent = `Connection problem (${x.message}). Retrying…`;
  }
  timer = setTimeout(poll, 3000);
}
const curl = (url) => `curl -X POST '${url}?hello=world' \\\n  -H 'content-type: application/json' \\\n  -d '{"event":"test","ok":true}'`;
function select(id, url, name) {
  cur = id;
  newest = 0;
  items = [];
  open.clear();
  $('#live').textContent = '';
  $('#detail').hidden = false;
  $('#title').textContent = name;
  $('#url').textContent = url;
  $('#curl').textContent = curl(url);
  render();
  poll();
  document.querySelectorAll('#list [data-s]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === id)));
}
$('#new').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  try {
    const h = await api('/api/hooks', { method: 'POST', body: { name: $('#name').value } });
    $('#name').value = '';
    select(h.id, h.url, h.name || h.id.slice(0, 8));
    await list();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
});
const armed = new Map();
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.s) return select(b.dataset.s, b.dataset.u, b.dataset.n);
  const id = b.dataset.d;
  if (!id) return;
  if (!armed.has(id)) {
    b.textContent = 'Confirm?';
    armed.set(
      id,
      setTimeout(() => {
        armed.delete(id);
        b.textContent = 'Delete';
      }, 3000),
    );
    return;
  } // two-step instead of confirm()
  clearTimeout(armed.get(id));
  armed.delete(id);
  try {
    await api(`/api/hooks/${id}`, { method: 'DELETE' });
    if (cur === id) {
      cur = null;
      clearTimeout(timer);
      $('#detail').hidden = true;
    }
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  list();
});
$('#reqs').addEventListener(
  'toggle',
  (e) => {
    const q = +e.target.dataset.q;
    e.target.open ? open.add(q) : open.delete(q);
  },
  true,
);
$('#copy').addEventListener('click', (e) => copyText($('#url').textContent, e.target, 'Copy URL'));
$('#copycurl').addEventListener('click', (e) => copyText($('#curl').textContent, e.target, 'Copy curl'));
$('#clear').addEventListener('click', async (e) => {
  const b = e.target;
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = 'Confirm clear?';
    setTimeout(() => {
      delete b.dataset.armed;
      b.textContent = 'Clear requests';
    }, 3000);
    return;
  }
  delete b.dataset.armed;
  b.textContent = 'Clear requests';
  try {
    await api(`/api/hooks/${cur}/requests`, { method: 'DELETE' });
    items = [];
    open.clear();
    render();
  } catch (x) {
    $('#live').textContent = x.message;
  }
});
list();
