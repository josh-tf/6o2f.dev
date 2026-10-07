import { $, mountBar } from '/_/ui.js';
import { FORMATS, fitSize, fmtBytes, MAX_BYTES, saved } from './lib.js';
import { colorFieldHtml, wireColorFields } from '/_/gradient/colorfield.js';
mountBar('Image');
$('#c-fill').innerHTML = colorFieldHtml('fill', '#ffffff', 'JPEG background color');
let fill = '#ffffff';
wireColorFields($('#c-fill'), (_, hex) => {
  fill = hex;
  run();
});
let src,
  file,
  seq = 0;
const cv = $('#cv'),
  ctx = cv.getContext('2d');
const msg = (t) => ($('#msg').textContent = t);
async function load(f) {
  msg('');
  if (f.size > MAX_BYTES) return msg(`${f.name} is ${fmtBytes(f.size)}. Files over 50 MB are not accepted.`);
  try {
    src = await createImageBitmap(f);
  } catch {
    return msg('This browser cannot decode that file as an image.');
  }
  file = f;
  $('#mw').value = $('#mh').value = '';
  run();
}
async function run() {
  if (!src) return;
  const id = ++seq,
    [w, h] = fitSize(src.width, src.height, $('#mw').value, $('#mh').value, $('#lock').checked),
    fmt = $('#fmt').value,
    [type, ext] = FORMATS[fmt];
  $('#q').disabled = fmt === 'png';
  $('#f-fill').hidden = fmt !== 'jpeg';
  $('#qv').textContent = fmt === 'png' ? 'n/a' : $('#q').value;
  cv.width = w;
  cv.height = h;
  if (fmt === 'jpeg') {
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  const blob = await new Promise((r) => cv.toBlob(r, type, $('#q').value / 100));
  if (id !== seq) return; // a newer change superseded this encode
  if (!blob) return msg('Encoding failed (the image may be too large for this browser).');
  msg(blob.type !== type ? `This browser cannot encode ${fmt.toUpperCase()}; it produced ${blob.type || 'nothing'} instead.` : '');
  $('#stats tbody').innerHTML =
    `<tr><th scope="row">Original</th><td>${src.width} &times; ${src.height} &middot; ${fmtBytes(file.size)}</td></tr><tr><th scope="row">Result</th><td>${w} &times; ${h} &middot; ${fmtBytes(blob.size)}</td></tr><tr><th scope="row">Change</th><td>${saved(file.size, blob.size)}</td></tr>`;
  URL.revokeObjectURL($('#dl').href);
  Object.assign($('#dl'), {
    href: URL.createObjectURL(blob),
    download: file.name.replace(/\.[^.]*$/, '') + '.' + (blob.type === type ? ext : blob.type.split('/')[1] || ext),
    hidden: false,
  });
  $('#dl').textContent = `Download ${$('#dl').download}`;
}
// Example: a generated image with transparent corners, so the JPEG fill and size changes are visible at once.
function sample() {
  const c = document.createElement('canvas');
  c.width = 1600;
  c.height = 1000;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 1600, 1000);
  g.addColorStop(0, '#f97316');
  g.addColorStop(1, '#6366f1');
  x.beginPath();
  x.roundRect(0, 0, 1600, 1000, 160);
  x.fillStyle = g;
  x.fill();
  x.fillStyle = 'rgba(255,255,255,.85)';
  x.beginPath();
  x.arc(1100, 380, 220, 0, 7);
  x.fill();
  x.fillStyle = '#fff';
  x.font = '700 150px sans-serif';
  x.fillText('example.png', 120, 820);
  c.toBlob((b) => load(new File([b], 'example.png', { type: 'image/png' })));
}
$('#file').addEventListener('change', (e) => e.target.files[0] && load(e.target.files[0]));
const drop = $('#drop');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  e.dataTransfer.files[0] && load(e.dataTransfer.files[0]);
});
document.addEventListener('paste', (e) => {
  const f = e.clipboardData?.files[0];
  f && load(f);
});
for (const id of ['fmt', 'q', 'mw', 'mh', 'lock']) $('#' + id).addEventListener('input', run);
sample();
