import { $, mountBar } from '/_/ui.js';
await mountBar('Timer');
const BASE = document.title;
const now = Date.now;
const FRESH = () => ({
  mode: 'sw',
  sw: { acc: 0, start: null, laps: [] },
  cd: { dur: 300000, acc: 0, start: null },
  pomo: { phase: 'work', acc: 0, start: null, n: 0 },
});
let S = FRESH();
try {
  const o = JSON.parse(localStorage.timerState || 'null');
  if (o?.sw && o.cd && o.pomo) S = o;
} catch {}
const save = () => {
  try {
    localStorage.timerState = JSON.stringify(S);
  } catch {}
};
const dur = (m) => (m === 'sw' ? 0 : m === 'cd' ? S.cd.dur : (S.pomo.phase === 'work' ? 25 : 5) * 60000);
const elapsed = (m) => S[m].acc + (S[m].start ? now() - S[m].start : 0);
const pad = (n, w = 2) => String(n).padStart(w, '0');
function fmt(ms, cs) {
  if (!cs) ms = Math.ceil(ms / 1000) * 1000;
  const t = Math.floor(ms / 1000),
    h = Math.floor(t / 3600),
    c = pad(Math.floor((ms % 1000) / 10));
  return `${h ? h + ':' : ''}${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}${cs ? '.' + c : ''}`;
}
// Beep: the AudioContext is created on the first Start click, so browsers allow sound later.
let ac;
function beep() {
  try {
    if (!ac) return;
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(),
        g = ac.createGain(),
        t = ac.currentTime + i * 0.3;
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.22);
    }
  } catch {}
}
function finish() {
  // end of a countdown/pomodoro phase, detected from timestamps so background tabs stay exact
  let hit = false;
  if (S.cd.start && elapsed('cd') >= S.cd.dur) {
    S.cd.acc = S.cd.dur;
    S.cd.start = null;
    hit = true;
  }
  if (S.pomo.start && elapsed('pomo') >= dur('pomo')) {
    if (S.pomo.phase === 'work') S.pomo.n++;
    S.pomo.phase = S.pomo.phase === 'work' ? 'break' : 'work';
    S.pomo.acc = 0;
    S.pomo.start = null;
    hit = true;
  }
  if (hit) {
    save();
    beep();
  }
}
function draw() {
  const m = S.mode,
    s = S[m],
    el = elapsed(m),
    run = !!s.start;
  const shown = m === 'sw' ? fmt(el, true) : fmt(Math.max(0, dur(m) - el));
  $('#big').textContent = shown;
  document.title = run ? `${shown} - ${BASE}` : BASE;
  $('#go').textContent = run ? 'Stop' : el ? 'Resume' : 'Start';
  $('#lap').hidden = m !== 'sw';
  $('#lap').disabled = !run;
  $('#phase').textContent =
    m === 'pomo'
      ? `${S.pomo.phase === 'work' ? 'Focus' : 'Break'} · ${S.pomo.n} focus session${S.pomo.n === 1 ? '' : 's'} done`
      : m === 'cd' && !s.dur
        ? 'Set a length above zero to start.'
        : m === 'cd' && s.acc >= s.dur && !run
          ? 'Time is up.'
          : '';
}
function layout() {
  for (const b of document.querySelectorAll('#modes button')) b.setAttribute('aria-pressed', b.dataset.m === S.mode);
  $('#set').hidden = S.mode !== 'cd';
  const d = S.cd.dur / 1000;
  $('#hh').value = Math.floor(d / 3600);
  $('#mm').value = Math.floor(d / 60) % 60;
  $('#ss').value = d % 60;
  const sw = S.mode === 'sw',
    L = S.sw.laps;
  $('#laps').hidden = !sw || !L.length;
  $('#lb').innerHTML = L.map((t, i) => `<tr><td>${i + 1}</td><td>${fmt(t - (L[i - 1] ?? 0), true)}</td><td>${fmt(t, true)}</td></tr>`)
    .reverse()
    .join('');
  draw();
}
function toggle() {
  const s = S[S.mode];
  try {
    ac ??= new (window.AudioContext || window.webkitAudioContext)();
    ac.resume();
  } catch {}
  if (s.start) {
    s.acc = elapsed(S.mode);
    s.start = null;
  } else {
    if (S.mode === 'cd') {
      if (s.acc >= s.dur) s.acc = 0;
      if (!s.dur) return;
    }
    s.start = now();
  }
  save();
  draw();
}
function lap() {
  if (S.mode === 'sw' && S.sw.start) {
    S.sw.laps.push(elapsed('sw'));
    save();
    layout();
  }
}
function reset() {
  const m = S.mode,
    f = FRESH();
  if (m === 'cd') f.cd.dur = S.cd.dur;
  if (m === 'pomo') {
    f.pomo.n = S.pomo.n;
    f.pomo.phase = S.pomo.phase;
  }
  S[m] = f[m];
  save();
  layout();
}
$('#go').onclick = toggle;
$('#lap').onclick = lap;
$('#reset').onclick = reset;
$('#modes').onclick = (e) => {
  const m = e.target.dataset.m;
  if (m) {
    S.mode = m;
    save();
    layout();
  }
};
$('#set').oninput = () => {
  const v = (id, max) => Math.min(max, Math.max(0, parseInt($(id).value) || 0));
  S.cd.dur = (v('#hh', 99) * 3600 + v('#mm', 59) * 60 + v('#ss', 59)) * 1000;
  S.cd.acc = 0;
  S.cd.start = null;
  save();
  draw();
};
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    toggle();
  } else if (k === 'l') lap();
  else if (k === 'r') reset();
});
addEventListener('keyup', (e) => {
  if (e.key === ' ' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault();
});
setInterval(() => {
  finish();
  draw();
}, 100);
finish();
layout();
