import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('DNS');
const TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA', 'SRV', 'DS', 'DNSKEY', 'PTR'];
$('#chips').innerHTML = TYPES.map((t, i) => `<label><input type="radio" name="type" value="${t}"${i ? '' : ' checked'}>${t}</label>`).join('');
const type = () => (/^[\d.]+$|:/.test($('#name').value.trim()) ? 'PTR' : $('input[name=type]:checked').value); // an IP always means a reverse lookup

const badges = (r) =>
  r.error
    ? `<span class="badge bad">${esc(r.error)}</span>`
    : `<span class="badge ${r.status === 'NOERROR' ? 'ok' : 'bad'}">${esc(r.status)}</span><span class="badge ${r.ad ? 'ok' : ''}" title="Authenticated Data: the resolver validated DNSSEC">${r.ad ? 'DNSSEC validated' : 'not DNSSEC validated'}</span>`;
const table = (r, showType) =>
  r.error
    ? ''
    : r.answers.length
      ? `<table><thead><tr><th>Name</th>${showType ? '<th>Type</th>' : ''}<th>TTL</th><th>Data</th></tr></thead><tbody>${r.answers.map((a) => `<tr><td>${esc(a.name)}</td>${showType ? `<td>${esc(a.type)}</td>` : ''}<td>${a.ttl}</td><td class="d mono">${esc(a.data)}</td></tr>`).join('')}</tbody></table>`
      : `<p class="muted">${r.status === 'NXDOMAIN' ? 'This name does not exist (NXDOMAIN).' : 'No records of this type.'}</p>`;

const views = {
  one: async (n) => {
    const r = await api(`/api/dns?name=${n}&type=${type()}`);
    return `<h2>${esc(r.type)} for ${esc(r.name)}</h2><div class="card"><p>${badges(r)}</p>${table(r)}</div>`;
  },
  all: async (n) => {
    const r = await api(`/api/dns/all?name=${n}`);
    return `<h2>All records for ${esc(r.name)}</h2><div class="cols">${Object.entries(r.results)
      .map(([t, x]) => `<div class="card"><h3>${t}</h3><p>${badges(x)}</p>${table(x)}</div>`)
      .join('')}</div>`;
  },
  cmp: async (n) => {
    const r = await api(`/api/dns/compare?name=${n}&type=${type()}`);
    const verdict =
      r.cloudflare.error || r.google.error
        ? '<p class="err">Could not compare: a resolver failed.</p>'
        : r.differences.length
          ? `<p class="err">The resolvers disagree:</p><ul class="diff">${r.differences.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>`
          : '<p><span class="badge ok">Same answers</span> TTLs are ignored.</p>';
    return `<h2>${esc(r.type)} for ${esc(r.name)}</h2>${verdict}<div class="cols">${[
      ['Cloudflare', r.cloudflare],
      ['Google', r.google],
    ]
      .map(([t, x]) => `<div class="card"><h3>${t}</h3><p>${badges(x)}</p>${table(x)}</div>`)
      .join('')}</div>`;
  },
};
let view = 'one';
$('#f').addEventListener('click', (e) => {
  if (e.target.dataset.v) view = e.target.dataset.v;
});
$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  $('#f')
    .querySelectorAll('button')
    .forEach((b) => (b.disabled = true));
  try {
    $('#out').innerHTML = await views[view](encodeURIComponent($('#name').value));
    $('#out').hidden = false;
  } catch (x) {
    $('#msg').textContent = x.message;
    $('#out').hidden = true;
  }
  $('#f')
    .querySelectorAll('button')
    .forEach((b) => (b.disabled = false));
});
$('#f').requestSubmit();
