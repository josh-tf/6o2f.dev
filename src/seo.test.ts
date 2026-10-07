import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEO } from './seo.ts';
import { tools } from './tools/index.ts';

test('every public tool has search copy of the right length, and nothing else does', () => {
  for (const t of tools.filter((t) => t.public)) assert.ok(SEO[t.name], `missing SEO entry for ${t.name}`);
  for (const [name, [title, desc]] of Object.entries(SEO)) {
    assert.ok(tools.find((t) => t.name === name)?.public, `${name} is not a public tool`);
    assert.ok(title.length <= 50, `${name} title is ${title.length} chars`);
    assert.ok(desc.length >= 110 && desc.length <= 160, `${name} description is ${desc.length} chars`);
  }
  assert.equal(new Set(Object.values(SEO).map(([t]) => t)).size, Object.keys(SEO).length, 'titles must be unique');
});
