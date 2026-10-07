import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { history, visible, streamline, widthFor, segments, constrain, drawOp, load, pack } from '../../../public/_/draw/lib.js';

test('undo/redo stack', () => {
  const h = history();
  assert.equal(h.canUndo, false);
  assert.equal(h.undo(), false);
  h.push('a');
  h.push('b');
  h.push('c');
  assert.deepEqual(h.ops, ['a', 'b', 'c']);
  assert.equal(h.undo(), true);
  assert.equal(h.undo(), true);
  assert.deepEqual(h.ops, ['a']);
  assert.equal(h.canRedo, true);
  assert.equal(h.redo(), true);
  assert.deepEqual(h.ops, ['a', 'b']);
  h.push('d'); // a new op drops the redo branch
  assert.equal(h.canRedo, false);
  assert.equal(h.redo(), false);
  assert.deepEqual(h.ops, ['a', 'b', 'd']);
  const before = h.ops;
  h.push('e');
  assert.deepEqual(before, ['a', 'b', 'd']); // ops arrays are not mutated
  h.reset(['x']);
  assert.deepEqual(h.ops, ['x']);
  assert.equal(h.canRedo, false);
});
test('clear is an op, so it can be undone', () => {
  const h = history([{ t: 'line' }]);
  h.push({ t: 'clear' });
  h.push({ t: 'rect' });
  assert.deepEqual(visible(h.ops), [{ t: 'rect' }]);
  h.undo();
  h.undo();
  assert.deepEqual(visible(h.ops), [{ t: 'line' }]);
});
test('segments: n points give n-1 smooth segments that start and end on the input', () => {
  assert.deepEqual(segments([]), []);
  assert.equal(segments([[1, 2, 0.5]])[0].dot, true);
  const pts = [
    [0, 0, 0.5],
    [10, 0, 0.5],
    [10, 10, 0.5],
    [0, 10, 0.5],
  ];
  const s = segments(pts);
  assert.equal(s.length, 3);
  assert.deepEqual(s[0].from, [0, 0, 0.5]);
  assert.deepEqual(s[2].to, [0, 10, 0.5]);
  for (let i = 1; i < s.length; i++) assert.deepEqual(s[i].from, s[i - 1].to); // continuous
  assert.deepEqual(s[0].ctrl, [10, 0, 0.5]);
  assert.deepEqual(s[0].to, [10, 5]); // control on the corner, ends on the midpoint
  // live drawing: segments already drawn do not change when more points arrive
  assert.deepEqual(segments(pts.slice(0, 3)).slice(0, 1), s.slice(0, 1));
});
test('streamline smooths jitter and converges', () => {
  let p: number[] | null = null;
  const xs: number[] = [];
  for (let i = 0; i < 40; i++) {
    p = streamline(p, [i, i % 2 ? 4 : -4, 0.5], 0.6);
    xs.push(p![1]);
  }
  const raw = 8,
    smooth = Math.max(...xs.slice(10)) - Math.min(...xs.slice(10));
  assert.ok(smooth < raw / 2, `wobble ${smooth}`);
  assert.deepEqual(streamline(null, [3, 4, 0.2], 0.9), [3, 4, 0.2]);
  assert.deepEqual(streamline([0, 0, 0.5], [10, 10, 0.7], 0), [10, 10, 0.7]);
});
test('pressure width: 0.5 draws the chosen size, ranges and clamps', () => {
  assert.equal(widthFor(10, 0.5), 10);
  assert.equal(widthFor(10, 0), 3);
  assert.equal(widthFor(10, 1), 17);
  assert.equal(widthFor(10, 5), 17);
  assert.equal(widthFor(1, 0), 0.5);
});
test('shift constraints', () => {
  const [x, y] = constrain('line', [0, 0], [10, 1]);
  assert.ok(Math.abs(y) < 1e-9 && Math.abs(x - Math.hypot(10, 1)) < 1e-9);
  assert.deepEqual(constrain('rect', [0, 0], [10, -4]), [10, -10]);
  assert.deepEqual(constrain('ellipse', [5, 5], [2, 6]), [2, 8]);
});
test('replay calls the canvas API and resets compositing after the eraser', () => {
  const calls: string[] = [];
  const ctx = new Proxy({ globalCompositeOperation: 'source-over' } as Record<string, unknown>, {
    get: (t, k: string) => (k in t ? t[k] : (...a: unknown[]) => calls.push(`${k}(${a.length})`)),
    set: (t, k: string, v) => {
      t[k] = v;
      return true;
    },
  });
  drawOp(ctx, {
    t: 'stroke',
    tool: 'eraser',
    color: '#000000',
    size: 8,
    pts: [
      [0, 0, 0.5],
      [5, 5, 0.5],
      [9, 2, 0.5],
    ],
  });
  assert.equal(calls.filter((c) => c.startsWith('quadraticCurveTo')).length, 2);
  assert.equal(ctx.globalCompositeOperation, 'source-over');
  calls.length = 0;
  drawOp(ctx, { t: 'ellipse', color: '#ff0000', size: 3, a: [0, 0], b: [10, 20] });
  assert.ok(calls.includes('ellipse(7)'));
});
test('saved data is validated and packed', () => {
  assert.equal(load('nope'), null);
  assert.equal(load('{"ops":3}'), null);
  const d = load(
    JSON.stringify({
      bg: 'evil',
      ops: [
        { t: 'clear' },
        { t: 'line', color: 'red', size: 2, a: [0, 0], b: [1, 1] },
        { t: 'rect', color: '#ff0000', size: 2, a: [0, 0], b: [1, 1] },
        { t: 'stroke', tool: 'pen', color: '#000000', size: 2, pts: [[0, 'x']] },
      ],
    }),
  );
  assert.deepEqual(d, { bg: 'white', ops: [{ t: 'clear' }, { t: 'rect', color: '#ff0000', size: 2, a: [0, 0], b: [1, 1] }] });
  assert.deepEqual(pack({ t: 'stroke', pts: [[1.234, 5.678, 0.55555]] }).pts, [[1.2, 5.7, 0.6]]);
});
