import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { css, html, defaults, item, PRESETS, itemDecls, validBasis, hint } from '../../../public/_/flex/lib.js';

test('defaults emit only display and gap', () => {
  assert.equal(css(defaults()), '.container {\n  display: flex;\n  gap: 12px;\n}\n');
});
test('non-default container and item properties', () => {
  const s = { ...defaults(), direction: 'column', justify: 'space-between', alignItems: 'center', gap: 0 };
  s.items[1] = item('B', { grow: 1, basis: '200px', order: -1, alignSelf: 'flex-end' });
  assert.equal(
    css(s),
    '.container {\n  display: flex;\n  flex-direction: column;\n  justify-content: space-between;\n  align-items: center;\n  min-height: 100vh;\n}\n\n.item-2 {\n  flex: 1 1 200px;\n  order: -1;\n  align-self: flex-end;\n}\n',
  );
});
test('flex shorthand', () => {
  assert.deepEqual(itemDecls(item()), []);
  assert.deepEqual(itemDecls(item('', { grow: 1, basis: '0' })), [['flex', '1 1 0%']]);
  assert.deepEqual(itemDecls(item('', { shrink: 0 })), [['flex', 'none']]);
  assert.deepEqual(itemDecls(item('', { shrink: 0, basis: '50%' })), [['flex', '0 0 50%']]);
});
test('html escapes labels', () => {
  const s = { ...defaults(), items: [item('<b>&'), item('')] };
  assert.equal(html(s), '<div class="container">\n  <div class="item item-1">&lt;b&gt;&amp;</div>\n  <div class="item item-2">Item 2</div>\n</div>\n');
});
test('presets', () => {
  assert.match(css(PRESETS.centered.make()), /justify-content: center;\n {2}align-items: center;/);
  assert.match(css(PRESETS.grail.make()), /flex-wrap: wrap;[\s\S]*\.item-1 \{\n {2}flex: 0 1 100%;[\s\S]*\.item-3 \{\n {2}flex: 1 1 0%;/);
  assert.match(css(PRESETS.footer.make()), /flex-direction: column;[\s\S]*\.item-2 \{\n {2}flex: 1 1 auto;/);
  for (const p of Object.values(PRESETS) as any[]) assert.ok(p.make().items.length >= 1);
});
test('basis validation', () => {
  for (const v of ['auto', 'content', '0', '200px', '33.3%', '10rem']) assert.ok(validBasis(v), v);
  for (const v of ['', '-5px', '1fr', '12', 'abc', '10 px']) assert.ok(!validBasis(v), v);
});
test('hints follow the axis', () => {
  assert.match(hint('justify', { ...defaults(), justify: 'center', direction: 'column' }), /vertical/);
  assert.match(hint('alignContent', defaults()), /only has an effect when items wrap/i);
});
test('column layouts that grow get a height so the copied CSS works outside the preview', () => {
  assert.match(css(PRESETS.footer.make()), /min-height: 100vh;/);
  assert.doesNotMatch(css(PRESETS.nav.make()), /min-height/);
});
