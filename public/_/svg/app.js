import { $, esc, mountBar } from '/_/ui.js';
import { attr, base64Uri, cssBg, dataUri, fromDom, parseXml, process } from './lib.js';
mountBar('SVG');

const EXAMPLE = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!-- Created with Inkscape (http://www.inkscape.org/) -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" xmlns:xlink="http://www.w3.org/1999/xlink"
   width="240" height="240" viewBox="0 0 63.499999 63.500001" version="1.1" id="svg8"
   inkscape:version="1.3 (0e150ed6c4, 2023-07-21)" sodipodi:docname="leaf.svg" onload="alert('hi from the svg')">
  <metadata id="metadata5"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"></rdf:RDF></metadata>
  <sodipodi:namedview id="base" pagecolor="#ffffff" inkscape:zoom="2.8" inkscape:current-layer="layer1" />
  <defs id="defs2">
    <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0.000000" stop-color="#7dff9b" />
      <stop offset="1.000000" stop-color="#0b7a35" />
    </linearGradient>
  </defs>
  <script type="text/javascript">document.cookie</script>
  <g inkscape:label="Layer 1" inkscape:groupmode="layer" id="layer1" fill-opacity="1" opacity="1">
    <path style="stroke-linecap:round" fill="url(#grad)" stroke="#15281b" stroke-width="1.8520833"
       d="M 10.583333,52.916666 C 10.583333,26.458333 26.458333,10.583333 52.916666,10.583333 52.916666,37.041666 37.041666,52.916666 10.583333,52.916666 Z" />
    <path fill="none" stroke="#15281b" stroke-width="1.3229167" stroke-linecap="round"
       d="M 10.583333,52.916666 L 39.687499,23.812499" />
    <a xlink:href="javascript:alert(1)"><circle cx="47.625" cy="47.625" r="3.96875" fill="#0b7a35" /></a>
  </g>
</svg>`;

let svg = '',
  msgT,
  lastSrc = null;
const opts = () => ({
  comments: $('#o-comments').checked,
  metadata: $('#o-metadata').checked,
  editor: $('#o-editor').checked,
  defaults: $('#o-defaults').checked,
  whitespace: $('#o-whitespace').checked,
  round: $('#o-round').checked ? Math.min(8, Math.max(0, Math.round(+$('#dp').value) || 0)) : -1,
});
const bytes = (s) => new TextEncoder().encode(s).length;
const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`);

/** DOMParser (no scripts run in a parsed document) -> plain tree. */
function parse(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const pe = doc.querySelector('parsererror');
  if (pe)
    throw new Error(
      `Not well-formed XML: ${(pe.textContent || '')
        .replace(/\s+/g, ' ')
        .replace(/^.*?error on line/i, 'error on line')
        .replace(/Below is a rendering.*/i, '')
        .trim()
        .slice(0, 200)}`,
    );
  return fromDom(doc.documentElement);
}
function say(t) {
  $('#msg').textContent = t;
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}

function run() {
  const text = $('#src').value;
  $('#err').textContent = '';
  $('#src').removeAttribute('aria-invalid');
  if (!text.trim()) {
    svg = '';
    show();
    $('#empty').textContent = 'Paste or drop an SVG to see it here.';
    $('#removed').textContent = '';
    $('#stats').textContent = '';
    return;
  }
  try {
    if (text.length > 5e6) throw new Error('That file is over 5 MB. Try a smaller SVG.');
    const tree = typeof DOMParser === 'function' ? parse(text) : parseXml(text);
    if (text !== lastSrc) {
      lastSrc = text;
      $('#vb').value = attr(tree, 'viewBox') ?? '';
      $('#w').value = attr(tree, 'width') ?? '';
      $('#h').value = attr(tree, 'height') ?? '';
    }
    const r = process(tree, opts(), { viewBox: $('#vb').value, width: $('#w').value, height: $('#h').value });
    svg = r.svg;
    $('#removed').innerHTML = r.removed.length
      ? `<p><b>Removed for safety:</b></p><ul>${r.removed.map((x) => `<li>${esc(x.what)}${x.count > 1 ? ` × ${x.count}` : ''}</li>`).join('')}</ul>`
      : '<p>Nothing unsafe found.</p>';
    const a = bytes(text),
      b = bytes(svg);
    $('#stats').textContent = `${kb(a)} → ${kb(b)} (${b <= a ? '−' : '+'}${Math.abs(Math.round((1 - b / a) * 100))}%)`;
  } catch (e) {
    svg = '';
    $('#err').textContent = e.message;
    $('#src').setAttribute('aria-invalid', 'true');
    $('#removed').textContent = '';
    $('#stats').textContent = '';
    $('#empty').textContent = 'Nothing to preview until the SVG parses.';
  }
  show();
}
function show() {
  const img = $('#img');
  img.hidden = !svg;
  $('#empty').hidden = !!svg;
  if (svg) img.src = dataUri(svg);
  else img.removeAttribute('src');
  output();
}
function output() {
  const f = document.querySelector('[name=fmt]:checked').value;
  $('#out').value = !svg ? '' : f === 'uri' ? dataUri(svg) : f === 'b64' ? base64Uri(svg) : f === 'css' ? cssBg(svg) : svg;
}
async function load(file) {
  if (!file) return;
  if (!/svg/.test(file.type) && !/\.svg$/i.test(file.name)) {
    $('#err').textContent = `"${file.name}" is not an SVG file.`;
    return;
  }
  if (file.size > 5e6) {
    $('#err').textContent = 'That file is over 5 MB. Try a smaller SVG.';
    return;
  }
  $('#src').value = await file.text();
  run();
}

$('#src').addEventListener('input', run);
for (const id of ['o-comments', 'o-metadata', 'o-editor', 'o-defaults', 'o-whitespace', 'o-round', 'dp', 'vb', 'w', 'h'])
  $('#' + id).addEventListener('input', run);
$('#o-round').addEventListener('change', () => ($('#dp').disabled = !$('#o-round').checked));
for (const r of document.querySelectorAll('[name=fmt]')) r.addEventListener('change', output);
for (const r of document.querySelectorAll('[name=bg]')) r.addEventListener('change', (e) => ($('#stage').className = `sv-stage bg-${e.target.value}`));
$('#file').addEventListener('change', (e) => load(e.target.files[0]));
$('#ex').addEventListener('click', () => {
  $('#src').value = EXAMPLE;
  run();
});
$('#clr').addEventListener('click', () => {
  $('#src').value = '';
  run();
  $('#src').focus();
});
const src = $('#src');
src.addEventListener('dragover', (e) => {
  e.preventDefault();
  src.classList.add('over');
});
src.addEventListener('dragleave', () => src.classList.remove('over'));
src.addEventListener('drop', (e) => {
  if (e.dataTransfer.files[0]) {
    e.preventDefault();
    src.classList.remove('over');
    load(e.dataTransfer.files[0]);
  }
});
$('#copy').addEventListener('click', async () => {
  if (!svg) return say('Nothing to copy yet.');
  try {
    await navigator.clipboard.writeText($('#out').value);
    say('Copied.');
  } catch {
    $('#out').select();
    say(document.execCommand?.('copy') ? 'Copied.' : 'Copy blocked by the browser. The text is selected, press Ctrl+C.');
  }
});
$('#dl').addEventListener('click', () => {
  if (!svg) return say('Nothing to download yet.');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), download: 'clean.svg' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});
$('#src').value = EXAMPLE;
run();
