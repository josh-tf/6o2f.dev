import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { TEMPLATES, GROUPS, combine, search } from '../../../public/_/gitignore/lib.js';

test('combining keeps a header per template and de-duplicates patterns', () => {
  const out = combine(['node', 'logs', 'macos']);
  assert.ok(out.startsWith('### Node ###\nnode_modules/\n'));
  assert.ok(out.includes('\n### Logs ###\n'));
  assert.ok(out.includes('\n### macOS ###\n.DS_Store\n'));
  const pats = out.split('\n').filter((l: string) => l && !l.startsWith('#'));
  assert.equal(pats.length, new Set(pats).size, 'no duplicate patterns');
  assert.equal(out.match(/^npm-debug\.log\*$/gm)!.length, 1);
  assert.ok(out.indexOf('npm-debug.log*') < out.indexOf('### Logs ###'), 'first occurrence wins');
  assert.ok(out.endsWith('\n'));
});
test('fully duplicated template still gets its header and a note', () => {
  const out = combine(['java', 'kotlin']);
  assert.ok(out.includes('### Kotlin ###\n.kotlin/\nout/\n'));
  assert.ok(out.includes('!gradle/wrapper/gradle-wrapper.jar'));
  const again = combine(['linux', 'linux']);
  assert.match(again, /### Linux ###\n# \(every pattern is already listed above\)/);
});
test('comments are dropped when their patterns were all duplicates, kept otherwise', () => {
  const out = combine(['python', 'coverage']);
  assert.ok(out.includes('# Tools\n.tox/'));
  const cov = out.slice(out.indexOf('### Coverage ###'));
  assert.ok(!cov.includes('htmlcov/'));
  assert.ok(cov.includes('coverage/'));
  assert.throws(() => combine(['nope']), /Unknown template/);
  assert.equal(combine([]), '');
});
test('templates are well formed and searchable', () => {
  assert.ok(Object.keys(TEMPLATES).length >= 29);
  for (const [id, t] of Object.entries<any>(TEMPLATES)) {
    assert.ok(GROUPS.includes(t.group), id);
    assert.ok(
      t.lines.some((l: string) => l && !l.startsWith('#')),
      id,
    );
    assert.ok(
      t.lines.every((l: string) => l === l.trim()),
      id,
    );
  }
  assert.deepEqual(search('intellij'), ['jetbrains']);
  assert.equal(search('java')[0], 'java'); // not Node, whose alias "javascript" contains it
  assert.equal(search('c')[0], 'c');
  assert.equal(search('go')[0], 'go');
  assert.ok(search('flutter').includes('dart'));
  assert.equal(search('').length, Object.keys(TEMPLATES).length);
  assert.ok(combine(['emacs']).includes('\n\\#*\\#\n'));
});
