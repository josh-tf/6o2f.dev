import { $, mountBar } from '/_/ui.js';
import { parse, toHex } from '/_/color/lib.js';
import { makePicker } from '/_/color/picker.js';
import { constrain, drawOp, drawSeg, drawShape, history, load, pack, segments, streamline, style, visible } from './lib.js';
mountBar('Sketchpad');

const COLORS = [
  ['Black', '#111111'],
  ['White', '#ffffff'],
  ['Grey', '#8a8f98'],
  ['Red', '#e5484d'],
  ['Orange', '#f76b15'],
  ['Yellow', '#ffc53d'],
  ['Green', '#30a46c'],
  ['Teal', '#12a594'],
  ['Blue', '#0090ff'],
  ['Purple', '#8e4ec6'],
];
const KEY = 'draw:v1',
  BG = { white: '#ffffff', dark: '#16181d', transparent: null };
const paper = $('#paper'),
  over = $('#over'),
  pctx = paper.getContext('2d'),
  octx = over.getContext('2d');
const h = history();
let W = 0,
  H = 0,
  dpr = 1,
  cur = null,
  raw = null,
  drawn = 0,
  msgT,
  saveT;

$('#cols').innerHTML =
  COLORS.map(
    ([n, c], i) =>
      `<label class="dr-sw" title="${n}"><input type="radio" name="color" value="${c}"${i ? '' : ' checked'} aria-label="${n}"><span style="background:${c}"></span></label>`,
  ).join('') +
  '<label class="dr-sw" title="Custom"><input type="radio" name="color" value="custom" id="cRadio" aria-label="Custom colour"><span id="cSw" style="background:#0b7a35"></span></label>' +
  '<span class="pickwrap"><button id="cPick" type="button" class="swbtn dr-pick" aria-label="Pick a custom colour"></button></span><label for="cHex" class="vh">Custom colour hex</label><input id="cHex" value="#0b7a35" maxlength="30" autocomplete="off" spellcheck="false" autocapitalize="off" class="dr-hex">';
const picker = makePicker($('#cPick'), $('#cHex'), () => setCustom(true));
function setCustom(select) {
  const c = parse($('#cHex').value);
  if (!c) return;
  const hex = toHex({ ...c, a: 1 });
  $('#cSw').style.background = hex;
  picker.set(hex);
  if (select) $('#cRadio').checked = true;
}
$('#cHex').addEventListener('input', () => setCustom(true));
setCustom(false);

const pick = (n) => document.querySelector(`[name=${n}]:checked`).value;
const tool = () => pick('tool');
const color = () => {
  const v = pick('color');
  return v === 'custom' ? toHex({ ...(parse($('#cHex').value) ?? { r: 11, g: 122, b: 53 }), a: 1 }) : v;
};
const size = () => +$('#size').value;
function say(t) {
  $('#msg').textContent = t;
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 3000);
}

// Canvas sizing: CSS px coordinates, backing store scaled by devicePixelRatio.
function resize() {
  const r = $('#stage').getBoundingClientRect();
  dpr = Math.min(3, window.devicePixelRatio || 1);
  W = Math.round(r.width);
  H = Math.round(r.height);
  for (const c of [paper, over]) {
    c.width = W * dpr;
    c.height = H * dpr;
    c.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redraw();
}
function redraw() {
  pctx.save();
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, paper.width, paper.height);
  pctx.restore();
  for (const op of visible(h.ops)) drawOp(pctx, op);
  $('#undo').disabled = !h.canUndo;
  $('#redo').disabled = !h.canRedo;
}
// ponytail: every commit/undo replays the whole drawing; cache a bitmap per N ops if long sessions get slow
function commit(op) {
  h.push(op);
  redraw();
  save();
}
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ bg: pick('bg'), ops: visible(h.ops).map(pack) }));
    } catch {
      say('Autosave is off: this browser blocked storage or the drawing is too big. Download a PNG to keep it.');
    }
  }, 300);
}

// Pointer input
const pos = (e) => {
  const r = paper.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top, e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5];
};
paper.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || cur) return;
  paper.setPointerCapture(e.pointerId);
  e.preventDefault();
  const p = pos(e),
    t = tool();
  cur =
    t === 'pen' || t === 'eraser'
      ? { t: 'stroke', tool: t, color: color(), size: size(), pressure: $('#pressure').checked && e.pointerType === 'pen', pts: [p], id: e.pointerId }
      : { t, color: color(), size: size(), a: p.slice(0, 2), b: p.slice(0, 2), id: e.pointerId };
  raw = p;
  drawn = 0;
});
paper.addEventListener('pointermove', (e) => {
  if (!cur || e.pointerId !== cur.id) return;
  const evs = e.getCoalescedEvents?.() ?? [e];
  if (cur.t === 'stroke') {
    for (const ev of evs.length ? evs : [e]) {
      raw = streamline(cur.pts[cur.pts.length - 1], pos(ev), 0.45);
      cur.pts.push(raw);
    }
    style(pctx, cur); // draw the settled segments now; the tail is finished on pointerup
    const segs = segments(cur.pts);
    for (; drawn < segs.length - 1; drawn++) drawSeg(pctx, segs[drawn], cur.size, cur.pressure);
    pctx.globalCompositeOperation = 'source-over';
  } else {
    const p = pos(e).slice(0, 2);
    cur.b = e.shiftKey ? constrain(cur.t, cur.a, p) : p;
    octx.clearRect(0, 0, W, H);
    drawShape(octx, cur);
  }
});
function finish(e) {
  if (!cur || e.pointerId !== cur.id) return;
  const op = cur;
  cur = null;
  delete op.id;
  octx.clearRect(0, 0, W, H);
  if (op.t !== 'stroke' && Math.hypot(op.b[0] - op.a[0], op.b[1] - op.a[1]) < 2) return redraw(); // a click with a shape tool draws nothing
  commit(op);
}
paper.addEventListener('pointerup', finish);
paper.addEventListener('pointercancel', finish);

// Controls
const setTool = (t) => {
  const r = document.querySelector(`[name=tool][value=${t}]`);
  r.checked = true;
  say(`${r.parentElement.textContent.trim().split(' ')[0]} selected.`);
};
const setSize = (v) => {
  $('#size').value = String(Math.min(64, Math.max(1, v)));
  $('#sizev').textContent = `${$('#size').value}px`;
};
$('#size').addEventListener('input', () => setSize(+$('#size').value));
const undo = () => {
  if (h.undo()) {
    redraw();
    save();
  }
};
const redo = () => {
  if (h.redo()) {
    redraw();
    save();
  }
};
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#clear').addEventListener('click', () => {
  $('#confirm').hidden = false;
  $('#yes').focus();
});
const closeConfirm = () => {
  $('#confirm').hidden = true;
  $('#clear').focus();
};
$('#no').addEventListener('click', closeConfirm);
$('#confirm').addEventListener('keydown', (e) => e.key === 'Escape' && closeConfirm());
$('#yes').addEventListener('click', () => {
  commit({ t: 'clear' });
  closeConfirm();
  say('Cleared. Press Undo to bring it back.');
});
for (const r of document.querySelectorAll('[name=bg]'))
  r.addEventListener('change', () => {
    $('#stage').className = `dr-stage bg-${pick('bg')}`;
    save();
  });
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (e.target.closest('input:not([type=radio]):not([type=checkbox]):not([type=range]),textarea,select,[contenteditable]')) return;
  if (mod && k === 'z') {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if (mod && k === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (mod || e.altKey) return;
  const t = { p: 'pen', b: 'pen', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse' }[k];
  if (t) {
    setTool(t);
    return;
  }
  if (e.key === '[' || e.key === ']') setSize(+$('#size').value + (e.key === ']' ? 2 : -2));
});

// Export: the paper layer over the chosen background.
function exportCanvas() {
  const c = Object.assign(document.createElement('canvas'), { width: paper.width, height: paper.height }),
    x = c.getContext('2d');
  const bg = BG[pick('bg')];
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, c.width, c.height);
  }
  x.drawImage(paper, 0, 0);
  return c;
}
const toBlob = () => new Promise((res, rej) => exportCanvas().toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
$('#png').addEventListener('click', async () => {
  try {
    const b = await toBlob(),
      a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(b),
        download: `sketch-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.png`,
      });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    say('PNG downloaded.');
  } catch {
    say('Could not create the PNG.');
  }
});
$('#copy').addEventListener('click', async () => {
  if (!window.ClipboardItem || !navigator.clipboard?.write) return say('This browser cannot copy images. Use Download PNG instead.');
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toBlob() })]);
    say('Image copied. Paste it into a chat, doc or image editor.');
  } catch {
    say('Copying the image was blocked by the browser. Use Download PNG instead.');
  }
});

// Start: the saved drawing, or a small example sketch on the first visit.
function demo() {
  const s = Math.min(W / 800, H / 500) || 1,
    P = (x, y) => [x * s, y * s];
  const wave = Array.from({ length: 40 }, (_, i) => [...P(40 + i * 18, 420 + Math.sin(i / 3) * 14), 0.5]);
  return [
    { t: 'ellipse', color: '#ffc53d', size: 8, a: P(600, 50), b: P(700, 150) },
    { t: 'rect', color: '#111111', size: 6, a: P(160, 220), b: P(340, 380) },
    { t: 'line', color: '#e5484d', size: 6, a: P(140, 230), b: P(250, 140) },
    { t: 'line', color: '#e5484d', size: 6, a: P(250, 140), b: P(360, 230) },
    { t: 'rect', color: '#0090ff', size: 4, a: P(220, 300), b: P(280, 380) },
    { t: 'stroke', tool: 'pen', color: '#30a46c', size: 6, pressure: false, pts: wave },
  ];
}
setSize(6);
resize();
let saved = null;
try {
  saved = load(localStorage.getItem(KEY) ?? '');
} catch {}
if (saved) {
  h.reset(saved.ops);
  document.querySelector(`[name=bg][value=${saved.bg}]`).checked = true;
  $('#stage').className = `dr-stage bg-${saved.bg}`;
} else {
  h.reset(demo());
  say('An example sketch is loaded. Press Clear to start fresh.');
}
redraw();
new ResizeObserver(() => {
  const r = $('#stage').getBoundingClientRect();
  if (Math.round(r.width) !== W || Math.round(r.height) !== H) resize();
}).observe($('#stage'));
matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', resize);
