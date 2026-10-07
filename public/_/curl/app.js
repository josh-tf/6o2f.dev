import { $, esc, mountBar } from '/_/ui.js';
import { parse, TARGETS, jsonBody } from './lib.js';
mountBar('cURL');
const SAMPLE = `curl 'https://api.example.com/v1/orders?expand=items' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json' \\
  -H "Authorization: Bearer sk_test_51Hx" \\
  -b 'session=abc123; theme=dark' \\
  --data-raw $'{"customer":"cus_42","items":[{"sku":"TEE-M","qty":2}],"note":"it\\'s a gift"}' \\
  --compressed -L -m 30`;
const cmd = $('#cmd'),
  out = $('#out'),
  warn = $('#warn');
let lang = 'fetch',
  req = null;
try {
  lang = localStorage.getItem('curl-lang') || 'fetch';
} catch {}
if (!TARGETS[lang]) lang = 'fetch';
$('#langs').innerHTML = Object.entries(TARGETS)
  .map(([k, [name]]) => `<label><input type="radio" name="lang" value="${k}"${k === lang ? ' checked' : ''}><span>${esc(name)}</span></label>`)
  .join('');
cmd.value = SAMPLE;

function summary(r) {
  const rows = [
    ['Method', esc(r.method)],
    ['URL', esc(r.url)],
  ];
  if (r.headers.length) rows.push(['Headers', `<ul>${r.headers.map(([k, v]) => `<li><b>${esc(k)}:</b> ${esc(v)}</li>`).join('')}</ul>`]);
  if (r.auth) rows.push(['Auth', `Basic, user <code>${esc(r.auth.user)}</code>`]);
  if (r.cookies)
    rows.push([
      'Cookies',
      `<ul>${r.cookies
        .split(';')
        .filter((c) => c.trim())
        .map((c) => `<li>${esc(c.trim())}</li>`)
        .join('')}</ul>`,
    ]);
  if (r.body?.kind === 'form')
    rows.push([
      'Body',
      `multipart form<ul>${r.body.parts.map((p) => `<li><b>${esc(p.name)}:</b> ${p.file !== undefined ? `file ${esc(p.file)}` : esc(p.value)}${p.type ? ` (${esc(p.type)})` : ''}</li>`).join('')}</ul>`,
    ]);
  else if (r.body) {
    const j = jsonBody(r);
    rows.push(['Body', `<pre>${esc(j !== undefined ? JSON.stringify(j, null, 2) : r.body.text)}</pre>`]);
  }
  const opts = [
    r.follow ? 'follows redirects' : 'no redirects',
    r.insecure && 'TLS not verified',
    r.compressed && 'compressed',
    r.timeout && `timeout ${r.timeout}s`,
  ].filter(Boolean);
  rows.push(['Options', esc(opts.join(', '))]);
  return `<table><caption class="sr">Parsed request</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
}
function render() {
  const [name, gen] = TARGETS[lang];
  $('#langname').textContent = name;
  try {
    out.textContent = req ? gen(req) : '';
  } catch (e) {
    out.textContent = '';
    $('#err').textContent = `Couldn't generate ${name} code: ${e.message}`;
  }
  $('#copy').disabled = !req;
}
function run() {
  $('#err').textContent = '';
  warn.hidden = true;
  if (!cmd.value.trim()) {
    req = null;
    $('#summary').innerHTML = '<p class="muted">Paste a curl command above.</p>';
    render();
    return;
  }
  try {
    req = parse(cmd.value);
  } catch (e) {
    req = null;
    $('#err').textContent = e.message;
    $('#summary').innerHTML = '<p class="muted">Nothing to show until the command parses.</p>';
    render();
    return;
  }
  $('#summary').innerHTML = summary(req);
  if (req.warnings.length) {
    warn.innerHTML = req.warnings.map((w) => `<li>${esc(w)}</li>`).join('');
    warn.hidden = false;
  }
  render();
}
let t;
cmd.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(run, 100);
});
$('#langs').addEventListener('change', (e) => {
  lang = e.target.value;
  try {
    localStorage.setItem('curl-lang', lang);
  } catch {}
  render();
});
$('#sample').addEventListener('click', () => {
  cmd.value = SAMPLE;
  run();
  cmd.focus();
});
$('#clear').addEventListener('click', () => {
  cmd.value = '';
  run();
  cmd.focus();
});
$('#copy').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText(out.textContent);
    b.textContent = 'Copied';
    $('#status').textContent = `${TARGETS[lang][0]} code copied.`;
  } catch {
    getSelection().selectAllChildren(out);
    b.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1500);
});
run();
