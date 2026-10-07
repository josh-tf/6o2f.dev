import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { splitTracks, parseTracks, areas, css, html, item, slug, PRESETS } from '../../../public/_/grid/lib.js';

test('splitTracks', () => {
  assert.deepEqual(splitTracks('1fr minmax(100px, 1fr) repeat(2, 50px 1fr)'), ['1fr', 'minmax(100px, 1fr)', 'repeat(2, 50px 1fr)']);
  assert.equal(splitTracks('minmax(1px, 1fr'), null);
  assert.equal(splitTracks('1fr)'), null);
});
test('parseTracks counts and validates', () => {
  assert.deepEqual(parseTracks('200px 1fr 200px'), { ok: true, count: 3, auto: false });
  assert.equal(parseTracks('repeat(3, 1fr) auto').count, 4);
  assert.equal(parseTracks('repeat(2, 100px 1fr)').count, 4);
  assert.deepEqual(parseTracks('repeat(auto-fit, minmax(160px, 1fr))'), { ok: true, count: null, auto: true });
  assert.equal(parseTracks('').count, 0);
  assert.equal(parseTracks('minmax(min-content, 2.5fr) 25% 10rem fit-content(300px) max-content').count, 5);
  for (const bad of ['1fx', 'repeat(auto-fit, 1fr)', 'minmax(1fr, 100px)', 'repeat(0, 1fr)', 'repeat(auto-fill, 100px) repeat(auto-fit, 100px)', 'red', '1fr)'])
    assert.ok(!parseTracks(bad).ok, bad);
});
test('named areas for the holy grail', () => {
  const s = PRESETS.grail.make();
  const a = areas(s, 3, 3);
  assert.deepEqual(a.rows, ['"header header header"', '"nav    main   aside"', '"footer footer footer"']);
  const out = css(s, 3, 3);
  assert.equal(out.areas, true);
  assert.equal(
    out.css,
    `.grid {
  display: grid;
  grid-template-columns: 160px 1fr 160px;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    "header header header"
    "nav    main   aside"
    "footer footer footer";
  gap: 12px;
}

.header { grid-area: header; }

.nav { grid-area: nav; }

.main { grid-area: main; }

.aside { grid-area: aside; }

.footer { grid-area: footer; }
`,
  );
  assert.match(html(s, true), /<div class="header">Header<\/div>/);
});
test('empty cells are dots; line numbers when areas are off or impossible', () => {
  const s = { columns: '1fr 1fr', rows: '', autoRows: '', rowGap: 8, colGap: 16, items: [item('A', 1, 2, 1, 2), item('B', 2, 3, 2, 3)] };
  assert.deepEqual(areas(s, 2, 0).rows, ['"a ."', '". b"']);
  const off = css(s, 2, 0, false);
  assert.equal(
    off.css,
    '.grid {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: 8px 16px;\n}\n\n.item-1 {\n  grid-column: 1;\n  grid-row: 1;\n}\n\n.item-2 {\n  grid-column: 2;\n  grid-row: 2;\n}\n',
  );
  const overlap = { ...s, items: [item('A', 1, 3, 1, 2), item('B', 2, 3, 1, 3)] };
  assert.match(areas(overlap, 2, 2).why, /overlaps/);
  assert.match(css(overlap, 2, 2).css, /grid-column: 1 \/ 3;/);
  assert.match(areas(PRESETS.gallery.make(), null, 0).why, /fixed number of columns/);
  assert.match(areas({ ...s, items: [item('A', 1, 2, 1, 2), item('a', 2, 3, 1, 2)] }, 2, 1).why, /same name/);
});
test('auto-placed items get no placement rules', () => {
  const r = css(PRESETS.gallery.make(), null, 0);
  assert.equal(
    r.css,
    '.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));\n  grid-auto-rows: 110px;\n  gap: 12px;\n}\n',
  );
  assert.match(html(PRESETS.gallery.make(), false), /class="item item-8">Photo 8</);
});
test('slug and escaping', () => {
  assert.equal(slug('Top bar', 0), 'top-bar');
  assert.equal(slug('2nd', 0), 'a2nd');
  assert.equal(slug('!!', 4), 'item5');
  assert.match(html({ items: [item('<x>', 1, 2, 1, 2)] }, false), /&lt;x&gt;/);
});
