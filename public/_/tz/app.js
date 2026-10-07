import { $, esc, mountBar } from '/_/ui.js';
import { city, dayDiff, fmtOffset, fromWall, isWork, offset, validZone, wall } from './lib.js';
mountBar('Time zones');
const DEF = ['UTC', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
const all = ['UTC', ...Intl.supportedValuesOf('timeZone')];
const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
let zones = DEF,
  base = all.includes(here) ? here : 'UTC',
  ms = Date.now();
try {
  const z = JSON.parse(localStorage.tzZones || 'null');
  if (Array.isArray(z) && z.every(validZone)) zones = z;
} catch {}
if (!zones.includes(base)) zones = [base, ...zones]; // the base zone is always listed, so day flags make sense
const save = () => {
  try {
    localStorage.tzZones = JSON.stringify(zones);
  } catch {}
};
const pad = (n) => String(n).padStart(2, '0');
const inputVal = () => {
  const w = wall(base, ms);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`;
};

function draw() {
  $('#list').innerHTML =
    zones
      .map((z, i) => {
        const w = wall(z, ms),
          dd = dayDiff(z, base, ms);
        const cells = Array.from({ length: 24 }, (_, h) => `<span class="${isWork(h) ? 'w' : ''}${h === w.h ? ' m' : ''}" title="${pad(h)}:00"></span>`).join(
          '',
        );
        return `<li><div class="top"><span class="n">${esc(city(z))} <small>${esc(z)}</small></span>
<time class="t" datetime="${pad(w.h)}:${pad(w.mi)}">${pad(w.h)}:${pad(w.mi)}</time><time datetime="${w.y}-${pad(w.mo)}-${pad(w.d)}">${new Date(Date.UTC(w.y, w.mo - 1, w.d)).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</time>
<span class="flag">${dd ? (dd > 0 ? '+' : '') + dd + (Math.abs(dd) === 1 ? ' day' : ' days') : ''}</span>
<span class="o">${fmtOffset(offset(z, ms))}</span><button type="button" class="x" data-i="${i}" aria-label="Remove ${esc(z)}">&times;</button></div><div class="strip" aria-hidden="true">${cells}</div></li>`;
      })
      .join('') || '<li class="muted">No zones. Add one above.</li>';
}
const sync = () => {
  $('#dt').value = inputVal();
  draw();
};

$('#base').innerHTML = all.map((z) => `<option${z === base ? ' selected' : ''}>${esc(z)}</option>`).join('');
$('#zones').innerHTML = all.map((z) => `<option value="${esc(z)}">`).join('');
$('#base').addEventListener('change', (e) => {
  base = e.target.value;
  sync();
}); // same instant, shown in the new base zone
$('#dt').addEventListener('input', (e) => {
  if (e.target.value) {
    ms = fromWall(base, e.target.value);
    draw();
  }
});
$('#now').addEventListener('click', () => {
  ms = Date.now();
  sync();
});
$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('.x');
  if (b) {
    zones.splice(+b.dataset.i, 1);
    save();
    draw();
  }
});
$('#add').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#zone').value.trim().toLowerCase().replace(/ /g, '_');
  const z = all.find((a) => a.toLowerCase() === q) ?? all.find((a) => a.toLowerCase().endsWith('/' + q));
  $('#err').textContent = '';
  $('#ok').textContent = '';
  if (!z) {
    $('#err').textContent = 'Unknown zone. Pick one from the list, e.g. Europe/Paris.';
    return;
  }
  if (!zones.includes(z)) {
    zones.push(z);
    save();
    draw();
    $('#ok').textContent = `Added ${z}.`;
  } else $('#ok').textContent = `${z} is already listed.`;
  $('#zone').value = '';
});
sync();
