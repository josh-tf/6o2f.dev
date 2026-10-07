import { $, api, esc, mountBar } from '/_/ui.js';
await mountBar('Link preview');
const row = (k, v) => `<tr><th scope="row" class="k">${esc(k)}</th><td class="v">${esc(v)}</td></tr>`;
const safe = (u) => (/^https?:\/\//i.test(u) ? u : '#');

async function run() {
  $('#msg').textContent = '';
  $('#go').disabled = true;
  try {
    const r = await api('/api/og', { method: 'POST', body: { url: $('#url').value.trim() } });
    const m = (...ks) => {
      for (const k of ks) {
        const v = r.meta.find(([n]) => n === k)?.[1];
        if (v) return v;
      }
      return '';
    };
    const title = m('og:title', 'twitter:title') || r.title,
      desc = m('og:description', 'twitter:description') || r.description,
      image = m('og:image', 'og:image:url', 'twitter:image');
    const warn = [
      ['og:title', m('og:title')],
      ['og:description', m('og:description')],
      ['og:image', image],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => `Missing ${k}`);
    $('#warn').innerHTML = warn.map((w) => `<p role="status">&#9888; ${esc(w)}</p>`).join('');
    $('#card').href = safe(m('og:url') || r.url);
    $('#site').textContent = m('og:site_name') || new URL(r.url).hostname;
    $('#t').textContent = title || '(no title)';
    $('#d').textContent = desc;
    $('#img').hidden = !/^https?:\/\//i.test(image);
    if (!$('#img').hidden) $('#img').src = `/api/img?u=${encodeURIComponent(image)}`;
    $('#img').onerror = () => {
      $('#img').hidden = true;
      $('#warn').insertAdjacentHTML('beforeend', '<p>&#9888; The preview image could not be loaded (unsupported type, too large or unreachable).</p>');
    };
    $('#page').innerHTML =
      [
        ['Final URL', r.url],
        ['Title', r.title],
        ['Description', r.description],
        ['Canonical', r.canonical],
        ['Language', r.lang],
        ['Theme color', r.themeColor],
        ...r.icons.map((i) => [`Icon (${i.rel}${i.sizes ? ' ' + i.sizes : ''})`, i.href]),
      ]
        .map(([k, v]) => row(k, v || '-'))
        .join('') + (r.truncated ? row('Note', 'Page truncated at 256 KB') : '');
    $('#tags').innerHTML = r.meta.map(([k, v]) => row(k, v)).join('') || '<tr><td colspan="2" class="muted">This page sets no meta tags.</td></tr>';
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
run();
