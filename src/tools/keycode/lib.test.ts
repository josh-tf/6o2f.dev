import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module served to the browser
import { describe, shortcut, snippets, keyLabel, COMMON } from '../../../public/_/keycode/lib.js';

const ev = (o: Record<string, unknown>) => ({
  key: '',
  code: '',
  keyCode: 0,
  which: 0,
  location: 0,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  repeat: false,
  isComposing: false,
  ...o,
});

test('labels and shortcuts', () => {
  assert.equal(keyLabel(' '), 'Space');
  assert.equal(shortcut(ev({ key: 'k', ctrlKey: true, shiftKey: true })), 'Ctrl+Shift+K');
  assert.equal(shortcut(ev({ key: ' ', altKey: true })), 'Alt+Space');
  assert.equal(shortcut(ev({ key: 'Control', ctrlKey: true })), 'Ctrl');
  assert.equal(shortcut(ev({ key: 'Shift', shiftKey: true })), 'Shift');
  assert.equal(shortcut(ev({ key: 'ArrowUp', metaKey: true })), 'Meta+ArrowUp');
});

test('describe: location, modifiers, virtual keyboards', () => {
  const d = describe(ev({ key: 'Enter', code: 'NumpadEnter', keyCode: 13, which: 13, location: 3 }));
  assert.equal(d.locationName, 'Numpad');
  assert.deepEqual(d.modifiers, []);
  assert.equal(d.virtual, false);
  assert.equal(describe(ev({ key: 'Unidentified', keyCode: 229 })).virtual, true);
  assert.equal(describe(ev({ key: 'a' })).code, '(none)');
});

test('snippets', () => {
  // Shift is implied by key "K", but needed for code
  assert.deepEqual(snippets(ev({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true })), {
    key: 'e.key === "K" && e.ctrlKey',
    code: 'e.code === "KeyK" && e.ctrlKey && e.shiftKey',
  });
  assert.deepEqual(snippets(ev({ key: 'Enter', code: 'Enter', shiftKey: true })), {
    key: 'e.key === "Enter" && e.shiftKey',
    code: 'e.code === "Enter" && e.shiftKey',
  });
  // A lone modifier doesn't require itself
  assert.deepEqual(snippets(ev({ key: 'Control', code: 'ControlLeft', ctrlKey: true })), { key: 'e.key === "Control"', code: 'e.code === "ControlLeft"' });
  assert.equal(snippets(ev({ key: '"', code: 'Quote', shiftKey: true })).key, 'e.key === "\\""');
});

test('reference table: unique codes, sane keyCodes', () => {
  assert.equal(new Set(COMMON.map((r: unknown[]) => r[1])).size, COMMON.length);
  for (const [, , kc] of COMMON) assert.ok(Number.isInteger(kc) && kc > 0 && kc < 256);
});
