import { $, mountBar } from '/_/ui.js';
import { hslToRgb, parse, toHex } from '/_/color/lib.js';
import { makePicker } from '/_/color/picker.js';
import { blobPath, newSeed, parseHash, toClip, toSvg } from './lib.js';
mountBar('Blobs');

const st = { seed: 'sprout', n: 7, r: 0.55 };
Object.assign(st, parseHash(location.hash));
const hex6 = (v) => {
  const c = parse(v);
  return c ? toHex({ ...c, a: 1 }) : null;
};
const good = { ca: '#0b7a35', cb: '#7dff9b', cs: '#15281b' };
const pickers = {};
for (const [id, p] of [
  ['ca', 'cap'],
  ['cb', 'cbp'],
  ['cs', 'csp'],
])
  pickers[id] = makePicker($('#' + p), $('#' + id), render);
const locks = { shape: false, color: false };
let svg = '',
  msgT;

const num = (el, lo, hi, d) => {
  const v = Number(el.value);
  return el.value !== '' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
};
function render() {
  const bad = [];
  for (const id of ['ca', 'cb', 'cs']) {
    const h = hex6($('#' + id).value);
    if (h) good[id] = h;
    else bad.push(id);
  }
  $('#err').textContent = bad.length
    ? `Not a color: "${$('#' + bad[0]).value}". Try #0b7a35, rgb(11 122 53) or a name like teal. Showing the last valid one.`
    : '';
  for (const id of ['ca', 'cb', 'cs']) pickers[id].set(good[id]);
  st.seed = $('#seed').value || 'blob';
  st.n = num($('#n'), 3, 12, 7);
  st.r = num($('#r'), 0, 1, 0.55);
  const size = Math.round(num($('#size'), 50, 2000, 400));
  $('#nv').textContent = st.n;
  $('#rv').textContent = st.r.toFixed(2);
  $('#angv').textContent = `${$('#ang').value}°`;
  const gradient = document.querySelector('[name=mode]:checked').value === 'gradient';
  $('#gradRow').hidden = !gradient;
  $('#strokeRow').hidden = !$('#so').checked;
  const d = blobPath({ seed: st.seed, n: st.n, randomness: st.r, size });
  svg = toSvg({
    d,
    size,
    fill: { mode: gradient ? 'gradient' : 'solid', a: good.ca, b: good.cb, angle: +$('#ang').value },
    stroke: { on: $('#so').checked, color: good.cs, width: num($('#sw'), 1, 40, 6) },
  });
  $('#stage').innerHTML = svg; // generated here from validated numbers and #rrggbb colors only
  $('#code').value = svg;
  $('#css').value = toClip(d);
  try {
    history.replaceState(null, '', `#seed=${encodeURIComponent(st.seed)}&n=${st.n}&r=${st.r}`);
  } catch {}
}
function say(t) {
  $('#msg').textContent = t;
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${what}.`);
  } catch {
    const t = $(what === 'SVG' ? '#code' : '#css');
    if (what === 'link') {
      say('Copy blocked. The link is in the address bar.');
      return;
    }
    t.select();
    say(document.execCommand?.('copy') ? `Copied ${what}.` : 'Copy blocked by the browser. The text is selected, press Ctrl+C.');
  }
}
function save(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function randomColors() {
  const h = Math.random() * 360,
    c = (hh, s, l) => toHex({ ...hslToRgb(((hh % 360) + 360) % 360, s, l), a: 1 });
  $('#ca').value = c(h, 65 + Math.random() * 25, 45 + Math.random() * 15);
  $('#cb').value = c(h + 40 + Math.random() * 80, 65 + Math.random() * 25, 55 + Math.random() * 15);
  $('#cs').value = c(h, 40, 18);
}
function randomize() {
  if (!locks.shape) {
    $('#seed').value = newSeed();
    $('#n').value = 3 + Math.floor(Math.random() * 10);
    $('#r').value = (0.25 + Math.random() * 0.6).toFixed(2);
  }
  if (!locks.color) randomColors();
  render();
}
$('#seed').value = st.seed;
$('#n').value = st.n;
$('#r').value = st.r;
document.addEventListener('input', (e) => {
  if (e.target.closest('.bl-ctl')) render();
});
$('#rnd').addEventListener('click', randomize);
for (const k of ['shape', 'color'])
  $(k === 'shape' ? '#lockShape' : '#lockColor').addEventListener('click', (e) => {
    locks[k] = !locks[k];
    e.currentTarget.setAttribute('aria-pressed', String(locks[k]));
  });
document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.target.closest('input,textarea,select,[contenteditable]')) randomize();
});
$('#share').addEventListener('click', () => copy(location.href, 'link'));
$('#cpSvg').addEventListener('click', () => copy(svg, 'SVG'));
$('#cpCss').addEventListener('click', () => copy($('#css').value, 'CSS'));
$('#dlSvg').addEventListener('click', () => save(new Blob([svg], { type: 'image/svg+xml' }), `blob-${st.seed}.svg`));
$('#dlPng').addEventListener('click', () => {
  const img = new Image(),
    size = Math.round(num($('#size'), 50, 2000, 400));
  img.onload = () => {
    const cv = Object.assign(document.createElement('canvas'), { width: size, height: size });
    cv.getContext('2d').drawImage(img, 0, 0, size, size);
    cv.toBlob((b) => (b ? (save(b, `blob-${st.seed}.png`), say('PNG downloaded.')) : say('Could not create the PNG.')), 'image/png');
  };
  img.onerror = () => say('Could not render the PNG.');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); // data: is allowed by the CSP, blob: is not
});
addEventListener('hashchange', () => {
  const h = parseHash(location.hash);
  if (h.seed) {
    $('#seed').value = h.seed;
    if (h.n) $('#n').value = h.n;
    if (h.r !== undefined) $('#r').value = h.r;
    render();
  }
});
render();
