import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { escape, unescape, unescapeBasic } from '../../../public/_/html/lib.js';

test('escape', () => {
  assert.equal(escape(`<a href="x">Tom & 'Jerry'</a>`, false), '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
  assert.equal(escape('café ✓ 😀', false), 'café ✓ 😀');
  assert.equal(escape('café ✓ 😀', true), 'caf&#233; &#10003; &#128512;');
});
test('unescapeBasic: numeric, hex, named, unknown, invalid', () => {
  assert.equal(unescapeBasic('&#65;&#x42;&#X43; &amp;lt; &copy; &nosuch; &#0; &#xD800;'), 'ABC &lt; © &nosuch; � �');
  assert.equal(unescapeBasic(escape('<b>"hi" & \'bye\'</b>', false)), '<b>"hi" & \'bye\'</b>');
});
test('unescape with a detached textarea never builds DOM from the input', () => {
  const evil = '<img src=x onerror=alert(1)> &lt;b&gt; &hearts;';
  const made: string[] = [];
  const attached: unknown[] = [];
  (globalThis as any).document = {
    createElement(tag: string) {
      made.push(tag);
      return {
        set innerHTML(v: string) {
          this.value = unescapeBasic(v).replace('&hearts;', '♥');
        },
        value: '',
        appendChild: (n: unknown) => attached.push(n),
      };
    },
    body: { appendChild: (n: unknown) => attached.push(n) },
  };
  try {
    assert.equal(unescape(evil), '<img src=x onerror=alert(1)> <b> ♥');
    assert.deepEqual(made, ['textarea']); // only a textarea, only ever detached
    assert.equal(attached.length, 0);
  } finally {
    delete (globalThis as any).document;
  }
});
