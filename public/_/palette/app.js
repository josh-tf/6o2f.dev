import { $, esc, mountBar } from '/_/ui.js';
import { contrast, parse, toHsl, toRgb } from '/_/color/lib.js';
import { makePicker } from '/_/color/picker.js';
import { HARMONIES, exportAs, harmony, kmeans } from './lib.js';
mountBar('Palettes');

const WHITE = { r: 255, g: 255, b: 255, a: 1 },
  BLACK = { r: 0, g: 0, b: 0, a: 1 };
let colors = [],
  msgT,
  lastImage = null;
$('#kind').innerHTML = Object.entries(HARMONIES)
  .map(([k, v]) => `<option value="${k}">${v}</option>`)
  .join('');
$('#kind').value = 'analogous';

function say(t) {
  $('#msg').textContent = t;
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 3000);
}
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${what}.`);
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? `Copied ${what}.` : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
const grade = (r) => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'fail');
function show(list, source, sh = null) {
  colors = list;
  $('#src').textContent = `· ${source}`;
  $('#pal').innerHTML = list
    .map((hex, i) => {
      const c = parse(hex),
        w = contrast(c, WHITE),
        b = contrast(c, BLACK),
        ink = b >= w ? '#000' : '#fff';
      const f = (r) => `${(Math.floor(r * 100) / 100).toFixed(2)} <span class="${r >= 4.5 ? 'pass' : 'fail'}">${grade(r)}</span>`;
      return `<li><button type="button" class="pl-sw" style="background:${hex};color:${ink}" data-c="${hex}" aria-label="Copy ${hex}"><b>${hex}</b>${sh ? `<span>${Math.round(sh[i] * 100)}%</span>` : ''}</button>
      <dl><dt>RGB</dt><dd>${esc(toRgb(c))}</dd><dt>HSL</dt><dd>${esc(toHsl(c))}</dd><dt>On white</dt><dd>${f(w)}</dd><dt>On black</dt><dd>${f(b)}</dd></dl></li>`;
    })
    .join('');
  output();
}
function output() {
  $('#out').value = colors.length ? exportAs(colors, $('#fmt').value, $('#name').value || 'palette') : '';
}

function fromBase() {
  const c = parse($('#base').value);
  $('#baseErr').textContent = c ? '' : 'Not a colour: try #0b7a35, rgb(11 122 53), hsl(142 83% 26%) or a name like teal.';
  $('#base').setAttribute('aria-invalid', String(!c));
  if (!c) return;
  picker.set(c);
  const space = document.querySelector('[name=space]:checked').value;
  show(harmony({ ...c, a: 1 }, $('#kind').value, space), `${HARMONIES[$('#kind').value].toLowerCase()} (${space.toUpperCase()})`);
}
const picker = makePicker($('#basep'), $('#base'), fromBase);
$('#base').addEventListener('input', fromBase);
$('#kind').addEventListener('change', fromBase);
for (const r of document.querySelectorAll('[name=space]')) r.addEventListener('change', fromBase);
$('#fmt').addEventListener('change', output);
$('#name').addEventListener('input', output);
$('#copy').addEventListener('click', () => copy($('#out').value, `${$('#fmt').selectedOptions[0].text}`));
$('#pal').addEventListener('click', (e) => {
  const c = e.target.closest('[data-c]')?.dataset.c;
  if (c) copy(c, c);
});

// Images: decode, downscale to 160px on a canvas, cluster.
function extract(src, label) {
  const cv = $('#thumb'),
    s = Math.min(1, 160 / Math.max(src.width, src.height));
  cv.width = Math.max(1, Math.round(src.width * s));
  cv.height = Math.max(1, Math.round(src.height * s));
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  cv.hidden = false;
  lastImage = { src, label };
  const k = Math.min(8, Math.max(5, Math.round(+$('#k').value) || 6));
  const out = kmeans(ctx.getImageData(0, 0, cv.width, cv.height).data, k, 1);
  if (!out.length) {
    say('That image is fully transparent: no colours to extract.');
    return;
  }
  show(
    out.map((c) => c.hex),
    `extracted from ${label}`,
    out.map((c) => c.share),
  );
  say(`Extracted ${out.length} colours from ${label}.`);
}
async function load(file) {
  if (!file) return;
  if (!/^image\//.test(file.type)) {
    say(`"${file.name}" is not an image.`);
    return;
  }
  try {
    extract(await createImageBitmap(file), file.name || 'the pasted image');
  } catch {
    say(`Could not decode "${file.name}". Try a PNG, JPEG, WebP or GIF.`);
  }
}
function sample() {
  // a small sunset landscape drawn on a canvas, so the extractor has something to chew on without a download
  const c = Object.assign(document.createElement('canvas'), { width: 320, height: 200 }),
    x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 120);
  sky.addColorStop(0, '#2b2d6e');
  sky.addColorStop(0.6, '#e8706a');
  sky.addColorStop(1, '#ffc37a');
  x.fillStyle = sky;
  x.fillRect(0, 0, 320, 130);
  x.fillStyle = '#fff2c4';
  x.beginPath();
  x.arc(220, 112, 26, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#3c2f5c';
  x.beginPath();
  x.moveTo(0, 130);
  x.lineTo(60, 70);
  x.lineTo(120, 120);
  x.lineTo(170, 85);
  x.lineTo(250, 130);
  x.fill();
  const sea = x.createLinearGradient(0, 130, 0, 200);
  sea.addColorStop(0, '#1f6f8b');
  sea.addColorStop(1, '#0c2c3d');
  x.fillStyle = sea;
  x.fillRect(0, 128, 320, 72);
  x.fillStyle = '#d9a441';
  x.beginPath();
  x.ellipse(160, 210, 200, 34, 0, 0, Math.PI * 2);
  x.fill();
  extract(c, 'the sample image');
}
$('#file').addEventListener('change', (e) => load(e.target.files[0]));
$('#sample').addEventListener('click', sample);
$('#k').addEventListener('change', () => lastImage && extract(lastImage.src, lastImage.label));
const drop = $('#imgSec');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  $('#drop').classList.add('over');
});
drop.addEventListener('dragleave', () => $('#drop').classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  $('#drop').classList.remove('over');
  load(e.dataTransfer.files[0]);
});
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
  if (f) {
    e.preventDefault();
    load(f);
  }
});

fromBase();
