import { $, esc, mountBar } from '/_/ui.js';
import { parse, summary, SAMPLES } from './lib.js';
mountBar('User agent');
const ta = $('#ua');
const KIND = {
  search: 'Search engine crawler',
  ai: 'AI crawler or assistant fetcher',
  social: 'Link preview / social bot',
  seo: 'SEO crawler',
  monitor: 'Uptime monitor',
  client: 'HTTP client library or CLI',
  automation: 'Browser automation (headless)',
  generic: 'Self-declared bot (generic match)',
};
const EXPLAIN = {
  browser: 'The app making the request, from its product token (e.g. Edg/, SamsungBrowser/, Firefox/).',
  version: 'Browser version. Chromium reports only the major version accurately (x.0.0.0).',
  engine: 'Rendering engine: Blink (Chrome, Edge, Opera, Samsung), Gecko (Firefox), WebKit (Safari and every iOS browser).',
  os: 'Operating system from the platform token in parentheses.',
  device: 'Form factor: mobile, tablet, desktop, tv or console. Android without "Mobile" is treated as a tablet.',
  vendor: 'Device maker, guessed from model codes such as SM- (Samsung) or Pixel (Google).',
  model: 'Device model as sent. Hidden by reduced UAs ("K") and by iOS.',
  bot: 'Matches a known crawler, bot or HTTP client. Self-reported: easy to fake.',
};
const row = (k, val, why) =>
  `<tr><th scope="row">${esc(k)}</th><td>${val === '' || val == null ? '<span class="muted">unknown</span>' : `<code>${esc(val)}</code>`}${why ? `<span class="why-s muted">${esc(why)}</span>` : ''}</td><td class="hide-s muted">${esc(why)}</td></tr>`;
let last;
function draw() {
  const r = (last = parse(ta.value));
  $('#uaerr').textContent = r.empty
    ? 'Paste a User-Agent header value, for example from your server logs.'
    : ta.value.length > 2000
      ? 'That is unusually long for a user agent; servers often cap headers at 8 KB.'
      : '';
  $('#sum').textContent = summary(r);
  $('#rows').innerHTML = r.empty
    ? ''
    : [
        row('Browser', r.browser.name, EXPLAIN.browser),
        row('Version', r.browser.version, EXPLAIN.version),
        row('Engine', [r.engine.name, r.engine.version].filter(Boolean).join(' '), EXPLAIN.engine),
        row('OS', [r.os.name, r.os.version].filter(Boolean).join(' ') + (r.os.distro ? ` (${r.os.distro})` : ''), EXPLAIN.os),
        row('Device type', r.device.type, EXPLAIN.device),
        row('Vendor', r.device.vendor, EXPLAIN.vendor),
        row('Model', r.device.model, EXPLAIN.model),
        row(
          'Bot',
          r.bot ? `${r.bot.name}${r.bot.version ? ` ${r.bot.version}` : ''}` : 'no',
          r.bot ? `${KIND[r.bot.kind]}${r.bot.owner ? `, ${r.bot.owner}` : ''}. ${EXPLAIN.bot}` : EXPLAIN.bot,
        ),
      ].join('');
  $('#notes').innerHTML = r.notes.map((n) => `<li>${esc(n)}</li>`).join('');
}
ta.addEventListener('input', draw);
$('#samples').innerHTML = SAMPLES.map(([n], i) => `<button type="button" data-i="${i}">${esc(n)}</button>`).join('');
$('#samples').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-i]');
  if (b) {
    ta.value = SAMPLES[+b.dataset.i][1];
    draw();
  }
});
$('#mine').addEventListener('click', () => {
  ta.value = navigator.userAgent;
  draw();
});

let msgT;
async function copy(text, what) {
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
  $('#msg').textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}
$('#cpjson').addEventListener('click', () => copy(JSON.stringify(last, null, 2), 'JSON'));

/* Client hints */
const CH = [
  ['brands', 'Low-entropy browser brands with major versions. "Not A Brand" entries are deliberate noise (GREASE) so sites cannot match exact lists.'],
  ['mobile', 'True on phones (the Sec-CH-UA-Mobile header).'],
  ['platform', 'Operating system name, e.g. Windows, macOS, Android (Sec-CH-UA-Platform).'],
  ['platformVersion', 'Real OS version. On Windows, 13.0.0 or higher means Windows 11.'],
  ['architecture', 'CPU architecture: x86 or arm.'],
  ['bitness', '32 or 64-bit.'],
  ['wow64', 'A 32-bit browser on 64-bit Windows.'],
  ['model', 'Device model on Android (empty on desktop).'],
  ['fullVersionList', 'Brands with full version numbers.'],
  ['formFactors', 'Desktop, Mobile, Tablet, XR, EInk and so on (newer Chromium only).'],
];
const fmt = (k, val) =>
  val == null
    ? ''
    : k === 'brands' || k === 'fullVersionList'
      ? val.map((b) => `${b.brand} ${b.version}`).join(', ')
      : Array.isArray(val)
        ? val.join(', ')
        : String(val);
async function hints() {
  const d = navigator.userAgentData;
  if (!d) {
    $('#chrows').innerHTML =
      `<tr><td colspan="3" class="muted">Your browser does not support <code>navigator.userAgentData</code> (Firefox and Safari do not). Only the User-Agent string above is available.</td></tr>`;
    return;
  }
  let hi = {};
  try {
    hi = await d.getHighEntropyValues(['architecture', 'bitness', 'model', 'platformVersion', 'fullVersionList', 'wow64', 'formFactors']);
  } catch {}
  const vals = { brands: d.brands, mobile: d.mobile, platform: d.platform, ...hi };
  $('#chrows').innerHTML = CH.filter(([k]) => k in vals)
    .map(([k, why]) => row(k, fmt(k, vals[k]), why))
    .join('');
}

ta.value = navigator.userAgent;
draw();
hints();
