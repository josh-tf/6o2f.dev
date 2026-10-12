import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('Whois');
async function run() {
  $('#msg').textContent = '';
  $('#go').disabled = true;
  try {
    const q = $('#q').value;
    const r = await api(`/api/rdap?q=${encodeURIComponent(q)}`).catch(async (x) => {
      // The registry refused our server (usually a rate limit on its shared IP): ask it from this browser instead.
      if (!x.data?.direct) throw x;
      const raw = await fetch(x.data.direct, { referrerPolicy: 'no-referrer' })
        .then((d) => (d.ok ? d.json() : Promise.reject()))
        .catch(() => Promise.reject(x));
      return api('/api/rdap', { method: 'POST', body: { q, source: new URL(x.data.direct).hostname, raw } });
    });
    $('#title').textContent = `${r.kind === 'asn' ? 'AS' : ''}${r.value} (from ${r.source})`;
    $('#rows').innerHTML =
      r.summary.map((x) => `<tr><th scope="row" class="k">${esc(x.label)}</th><td class="v">${esc(x.value)}</td></tr>`).join('') ||
      '<tr><td colspan="2">No summary fields in this record; see the raw JSON.</td></tr>';
    $('#raw').textContent = JSON.stringify(r.raw, null, 2);
    $('#out').hidden = false;
  } catch (x) {
    $('#msg').textContent = x.message;
    $('#out').hidden = true;
  }
  $('#go').disabled = false;
}
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  run();
});
$('#rawb').onclick = () => {
  const h = ($('#raw').hidden = !$('#raw').hidden);
  $('#rawb').setAttribute('aria-expanded', String(!h));
};
run();
