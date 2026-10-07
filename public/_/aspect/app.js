import { $, esc, mountBar } from '/_/ui.js';
import { simplify, nearestName, heightFor, widthFor, fit, crop, ppi, resolutionsFor, round, PRESETS } from '/_/aspect/lib.js';
await mountBar('Aspect');

const num = (id) => {
  const v = $('#' + id).value;
  return v === '' ? NaN : Number(v);
};
const ok = (x) => Number.isFinite(x) && x > 0 && x <= 1e6;
const px = (x) => round(x, 2);

$('#presets').innerHTML = PRESETS.map(([l], i) => `<button type="button" data-p="${i}" aria-pressed="false">${esc(l)}</button>`).join('');
$('#tp').innerHTML += PRESETS.map(([l], i) => `<option value="${i}">${esc(l)}</option>`).join('');

/** A scaled stage inside a mini diagram; rects are [class, x, y, w, h] in stage units. */
function stage(el, ew, eh, rects) {
  const pct = (v, of) => `${(v / of) * 100}%`;
  el.innerHTML =
    `<div style="position:absolute;inset:0;margin:auto;aspect-ratio:${ew}/${eh};width:min(90%, ${(108 * ew) / eh}px);max-height:90%">` +
    rects.map(([c, x, y, w, h]) => `<i class="${c}" style="left:${pct(x, ew)};top:${pct(y, eh)};width:${pct(w, ew)};height:${pct(h, eh)}"></i>`).join('') +
    '</div>';
}

function resize(from) {
  const w = num('w'),
    h = num('h');
  if (!ok(w) || !ok(h)) return;
  if ($('#lock').checked) {
    if (from === 'nh') {
      const v = num('nh');
      $('#nw').value = Number.isFinite(v) ? px(widthFor(v, w, h)) : '';
    } else {
      const v = num('nw');
      $('#nh').value = Number.isFinite(v) ? px(heightFor(v, w, h)) : '';
    }
  }
  const nw = num('nw'),
    nh = num('nh');
  let note;
  if (ok(nw) && ok(nh)) {
    const exact = Number.isInteger(nw) && Number.isInteger(nh) && Math.abs(nw / nh - w / h) < 1e-12;
    const distort = nw / nh / (w / h) - 1;
    note =
      `${px(nw)} × ${px(nh)}, ${Math.round((nw / w) * 1000) / 10}% of the original. ` +
      (Math.abs(distort) > 0.0005
        ? `Stretched ${distort > 0 ? 'wider' : 'taller'} by ${round(Math.abs(distort) * 100, 1)}%.`
        : exact
          ? 'Exact whole pixels, no distortion.'
          : 'Not whole pixels; round to the nearest pixel when exporting.');
  } else note = 'Enter a new width or height.';
  $('#rznote').textContent = note;
}

function update() {
  const w = num('w'),
    h = num('h');
  const bad = !ok(w) || !ok(h);
  $('#err').textContent = bad ? 'Enter a width and height greater than 0 (up to 1,000,000).' : '';
  for (const s of ['#res', '.pv', 'main>section']) document.querySelectorAll(s).forEach((e) => (e.hidden = bad));
  if (bad) return;
  const [a, b] = simplify(w, h),
    nm = nearestName(w, h);
  $('#o-r').textContent = a > 9999 || b > 9999 ? `${round(w / h, 4)}:1` : `${a}:${b}`;
  $('#o-d').textContent = `${round(w / h, 4)}:1`;
  $('#o-d').title = `Inverse ${round(h / w, 4)}`;
  $('#o-n').textContent = nm ? `${nm.name}${nm.exact ? '' : ' (approx.)'}` : 'none nearby';
  document.querySelectorAll('#presets button').forEach((bt) => {
    const [, pw, ph] = PRESETS[bt.dataset.p];
    bt.setAttribute('aria-pressed', String(Math.abs(pw / ph / (w / h) - 1) < 0.001));
  });
  const r = $('#rect');
  r.style.aspectRatio = `${w}/${h}`;
  r.style.width = `min(100%, ${(196 * w) / h}px)`;
  $('#rlabel').textContent = w / h > 0.35 ? `${px(w)} × ${px(h)}` : '';
  resize('nw');
  // fit / crop
  const tw = num('tw'),
    th = num('th');
  if (ok(tw) && ok(th)) {
    const f = fit(w, h, tw, th),
      c = crop(w, h, tw, th),
      [ta, tb] = simplify(tw, th);
    stage($('#m-contain'), tw, th, [
      ['box', 0, 0, tw, th],
      ['img', (tw - f.contain.w) / 2, (th - f.contain.h) / 2, f.contain.w, f.contain.h],
    ]);
    stage($('#m-cover'), f.cover.w, f.cover.h, [
      ['img', 0, 0, f.cover.w, f.cover.h],
      ['box', (f.cover.w - tw) / 2, (f.cover.h - th) / 2, tw, th],
    ]);
    stage($('#m-crop'), w, h, [
      ['img', 0, 0, w, h],
      ['keep', c.x, c.y, c.w, c.h],
    ]);
    const bars = f.bars.x ? `${f.bars.x} px of bars left and right` : f.bars.y ? `${f.bars.y} px of bars top and bottom` : 'no bars';
    const cut = f.cropped.x ? `${f.cropped.x} px cut from the sides` : f.cropped.y ? `${f.cropped.y} px cut from top and bottom` : 'nothing cut';
    $('#o-contain').innerHTML = `<b>${f.contain.w} × ${f.contain.h}</b> at ${round(f.contain.scale * 100, 1)}%; ${bars}.`;
    $('#o-cover').innerHTML = `<b>${f.cover.w} × ${f.cover.h}</b> at ${round(f.cover.scale * 100, 1)}%; ${cut}.`;
    $('#o-crop').innerHTML = `Keep <b>${c.w} × ${c.h}</b> (${ta > 9999 ? round(tw / th, 3) + ':1' : `${ta}:${tb}`}) from x ${c.x}, y ${c.y}; no scaling.`;
  } else
    for (const id of ['contain', 'cover', 'crop']) {
      $('#m-' + id).innerHTML = '';
      $('#o-' + id).textContent = 'Enter a target width and height.';
    }
  // ppi
  const dg = num('diag');
  if (ok(dg)) {
    const p = ppi(w, h, dg),
      cm = (x) => round(x * 2.54, 1);
    $('#o-ppi').innerHTML =
      `<b>${round(p.ppi, 2)} PPI</b>, dot pitch ${round(p.pitchMm, 3)} mm. Visible area ${round(p.widthIn, 1)} × ${round(p.heightIn, 1)} in (${cm(p.widthIn)} × ${cm(p.heightIn)} cm).`;
  } else $('#o-ppi').textContent = 'Enter the screen diagonal in inches.';
  // resolutions
  let rows = resolutionsFor(w, h),
    computed = false;
  if (!rows.length) {
    computed = true;
    rows = [360, 480, 720, 1080, 1440, 2160].map((hh) => {
      const ww = widthFor(hh, w, h);
      return [Math.round(ww), hh, Number.isInteger(+ww.toFixed(6)) ? 'Exact' : `Width rounded from ${round(ww, 2)}`];
    });
  }
  $('#th2').textContent = computed ? 'Sizes at common heights' : 'Common resolutions at this ratio';
  $('#tbl tbody').innerHTML = rows
    .map(
      ([rw, rh, name]) =>
        `<tr${rw === w && rh === h ? ' class="cur"' : ''}><td>${rw}</td><td>${rh}</td><td>${esc(name)}</td><td><button type="button" data-use="${rw}x${rh}" aria-label="Use ${rw} by ${rh}">Use</button></td></tr>`,
    )
    .join('');
}

const set = (w, h) => {
  $('#w').value = w;
  $('#h').value = h;
  update();
};
$('#w').addEventListener('input', update);
$('#h').addEventListener('input', update);
for (const id of ['tw', 'th', 'diag'])
  $('#' + id).addEventListener('input', () => {
    if (id !== 'diag') $('#tp').value = '';
    update();
  });
$('#nw').addEventListener('input', () => resize('nw'));
$('#nh').addEventListener('input', () => resize('nh'));
$('#lock').addEventListener('change', () => resize('nw'));
$('#swap').addEventListener('click', () => set($('#h').value, $('#w').value));
$('#presets').addEventListener('click', (e) => {
  const bt = e.target.closest('button');
  if (!bt) return;
  const [, pw, ph] = PRESETS[bt.dataset.p],
    w = ok(num('w')) ? num('w') : 1920;
  set(w, px(heightFor(w, pw, ph)));
});
$('#tp').addEventListener('change', () => {
  if ($('#tp').value === '') return;
  const [, pw, ph] = PRESETS[$('#tp').value],
    tw = ok(num('tw')) ? num('tw') : 1080;
  $('#th').value = px(heightFor(tw, pw, ph));
  update();
});
$('#tbl').addEventListener('click', (e) => {
  const u = e.target.closest('[data-use]')?.dataset.use;
  if (u) {
    const [w, h] = u.split('x');
    set(w, h);
    $('#w').focus();
  }
});
update();
