// Sketchpad model: a drawing is a list of ops replayed onto a canvas, so undo/redo, resizing and autosave are all just "replay".
// Ops: { t: 'stroke', tool: 'pen'|'eraser', color, size, pts: [[x, y, pressure]] } | { t: 'line'|'rect'|'ellipse', color, size, a: [x, y], b: [x, y] } | { t: 'clear' }

/** Undo/redo stack. `done` is the drawing; a new op clears the redo list. */
export function history(done = []) {
  let undone = [];
  return {
    get ops() {
      return done;
    },
    get canUndo() {
      return done.length > 0;
    },
    get canRedo() {
      return undone.length > 0;
    },
    push(op) {
      done = [...done, op];
      undone = [];
    },
    undo() {
      if (!done.length) return false;
      undone = [...undone, done[done.length - 1]];
      done = done.slice(0, -1);
      return true;
    },
    redo() {
      if (!undone.length) return false;
      done = [...done, undone[undone.length - 1]];
      undone = undone.slice(0, -1);
      return true;
    },
    reset(ops = []) {
      done = ops;
      undone = [];
    },
  };
}
/** Ops visible after the last clear. */
export const visible = (ops) => ops.slice(ops.map((o) => o.t).lastIndexOf('clear') + 1);

/** Pull a raw pointer sample toward the previous smoothed point (0 = raw input, 0.9 = very smooth). */
export const streamline = (prev, raw, k) => (prev ? [prev[0] + (raw[0] - prev[0]) * (1 - k), prev[1] + (raw[1] - prev[1]) * (1 - k), raw[2]] : raw);
/** Stroke width for a pressure 0..1 (0.5 = mouse/touch, so plain input draws exactly `size`). */
export const widthFor = (size, p = 0.5) => Math.max(0.5, size * (0.3 + 1.4 * Math.min(1, Math.max(0, p))));

/** Midpoint quadratic segments through the points: n points -> n-1 segments (1 dot for a single point).
 *  Each: { from, ctrl, to, p }. All but the last are final once the next point arrives, so live drawing and replay match. */
export function segments(pts) {
  if (!pts.length) return [];
  if (pts.length === 1) return [{ from: pts[0], ctrl: pts[0], to: pts[0], p: pts[0][2] ?? 0.5, dot: true }];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const out = [];
  let from = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const to = mid(pts[i], pts[i + 1]);
    out.push({ from, ctrl: pts[i], to, p: ((pts[i - 1][2] ?? 0.5) + (pts[i][2] ?? 0.5)) / 2 });
    from = to;
  }
  const last = pts[pts.length - 1];
  out.push({ from, ctrl: mid(from, last), to: last, p: ((pts[pts.length - 2][2] ?? 0.5) + (last[2] ?? 0.5)) / 2 });
  return out;
}
/** Shift-constrained end point: lines snap to 45°, rectangles/ellipses become squares/circles. */
export function constrain(t, a, b) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  if (t === 'line') {
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4),
      len = Math.hypot(dx, dy);
    return [a[0] + Math.cos(ang) * len, a[1] + Math.sin(ang) * len];
  }
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  return [a[0] + Math.sign(dx || 1) * m, a[1] + Math.sign(dy || 1) * m];
}

/** Draw one segment (ctx is any CanvasRenderingContext2D-like object). */
export function drawSeg(ctx, s, size, pressure) {
  const w = widthFor(size, pressure ? s.p : 0.5);
  if (s.dot) {
    ctx.beginPath();
    ctx.arc(s.to[0], s.to[1], w / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(s.from[0], s.from[1]);
  ctx.quadraticCurveTo(s.ctrl[0], s.ctrl[1], s.to[0], s.to[1]);
  ctx.stroke();
}
export function style(ctx, op) {
  ctx.globalCompositeOperation = op.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = op.tool === 'eraser' ? '#000' : op.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
export function drawShape(ctx, op) {
  style(ctx, op);
  ctx.lineWidth = op.size;
  ctx.beginPath();
  const [x0, y0] = op.a,
    [x1, y1] = op.b;
  if (op.t === 'line') {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  } else if (op.t === 'rect') ctx.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  else ctx.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
}
export function drawOp(ctx, op) {
  if (op.t === 'stroke') {
    style(ctx, op);
    for (const s of segments(op.pts)) drawSeg(ctx, s, op.size, op.pressure);
  } else if (op.t !== 'clear') drawShape(ctx, op);
  ctx.globalCompositeOperation = 'source-over';
}
/** Parse saved JSON defensively: only well-formed ops survive. */
export function load(json) {
  let d;
  try {
    d = JSON.parse(json);
  } catch {
    return null;
  }
  if (!d || !Array.isArray(d.ops)) return null;
  const pt = (p) => Array.isArray(p) && p.length >= 2 && p.slice(0, 3).every(Number.isFinite);
  const col = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const ops = d.ops.filter(
    (o) =>
      o &&
      (o.t === 'clear' ||
        (o.t === 'stroke' && ['pen', 'eraser'].includes(o.tool) && col(o.color) && o.size > 0 && Array.isArray(o.pts) && o.pts.length && o.pts.every(pt)) ||
        (['line', 'rect', 'ellipse'].includes(o.t) && col(o.color) && o.size > 0 && pt(o.a) && pt(o.b))),
  );
  return { ops, bg: ['transparent', 'white', 'dark'].includes(d.bg) ? d.bg : 'white' };
}
/** Round coordinates for storage (1/10 px is plenty). */
export const pack = (op) => (op.t === 'stroke' ? { ...op, pts: op.pts.map((p) => p.map((v) => Math.round(v * 10) / 10)) } : op);
