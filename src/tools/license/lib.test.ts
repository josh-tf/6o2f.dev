import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { LICENSES, fill, recommend, cell, COLUMNS } from '../../../public/_/license/lib.js';

test('fill replaces year and holder everywhere and nothing else', () => {
  const { text, warnings } = fill('MIT', { year: '2026', holder: '  Ada   Lovelace ' });
  assert.deepEqual(warnings, []);
  assert.ok(text.startsWith('MIT License\n\nCopyright (c) 2026 Ada Lovelace\n\nPermission is hereby granted'));
  assert.ok(!/\{\{|\[year\]|\[copyright holder\]/.test(text));
  assert.match(fill('BSD-3-Clause', { year: '2019-2026', holder: 'ACME Ltd' }).text, /^BSD 3-Clause License\n\nCopyright \(c\) 2019-2026, ACME Ltd\n/);
  assert.match(fill('ISC', { year: '2024', holder: 'X' }).text, /Copyright \(c\) 2024, X\n/);
  assert.match(fill('Apache-2.0', { year: '2026', holder: 'ACME' }).text, /^Copyright 2026 ACME\n\nLicensed under the Apache License, Version 2.0/);
  const g = fill('GPL-3.0-or-later', { year: '2026', holder: 'Ada', project: 'frob: frobnicates widgets' }).text;
  assert.ok(g.startsWith('frob: frobnicates widgets\nCopyright (C) 2026  Ada\n'));
  assert.match(fill('AGPL-3.0-or-later', { year: '2026', holder: 'A' }).text, /GNU Affero General Public License/);
});
test('missing or bad input gives placeholders and warnings', () => {
  const r = fill('MIT', { year: '', holder: '' });
  assert.match(r.text, /Copyright \(c\) \[year\] \[copyright holder\]/);
  assert.equal(r.warnings.length, 2);
  assert.match(fill('MIT', { year: '26', holder: 'A' }).warnings[0], /year should look like/);
  assert.deepEqual(fill('Unlicense', {}).warnings, []);
  assert.equal(fill('CC0-1.0', { year: '2026', holder: 'A' }).text, LICENSES['CC0-1.0'].text);
  assert.throws(() => fill('WTFPL'), /Unknown licence/);
  assert.ok(Object.values<any>(LICENSES).every((l) => l.text && l.url.startsWith('https://')));
});
test('chooser', () => {
  assert.equal(recommend({ style: 'permissive', patents: false }).id, 'MIT');
  assert.equal(recommend({ style: 'permissive', patents: true }).id, 'Apache-2.0');
  assert.equal(recommend({ style: 'strong', network: true }).id, 'AGPL-3.0-or-later');
  assert.equal(recommend({ style: 'strong', network: false }).id, 'GPL-3.0-or-later');
  assert.equal(recommend({ style: 'weak' }).id, 'MPL-2.0');
  assert.equal(recommend({ style: 'none' }).id, '0BSD');
});
test('comparison cells', () => {
  assert.equal(cell('AGPL-3.0-or-later', 'network'), 'yes');
  assert.equal(cell('MIT', 'patent'), '');
  assert.equal(cell('CC0-1.0', 'patent'), 'excluded');
  assert.equal(cell('MPL-2.0', 'same'), 'per file');
  assert.equal(COLUMNS.length, 12);
});
