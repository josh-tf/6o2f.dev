import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { generate, singular, pascal, goField } from '../../../public/_/jsonts/lib.js';

test('naming: PascalCase, singular for array items, Item suffix, prefix on clash', () => {
  assert.equal(singular('categories'), 'category');
  assert.equal(singular('addresses'), 'address');
  assert.equal(singular('boxes'), 'box');
  assert.equal(singular('people'), 'person');
  assert.equal(singular('status'), 'status');
  assert.equal(singular('analysis'), 'analysis');
  assert.equal(pascal('order_items'), 'OrderItems');
  assert.equal(pascal('first-name'), 'FirstName');
  assert.equal(pascal('createdAt'), 'CreatedAt');
  assert.equal(pascal('3d'), 'T3d');
  assert.equal(goField('user_id'), 'UserID');
  assert.equal(goField('apiUrl'), 'APIURL');
  const out = generate({ users: [{ id: 1 }], data: [{ x: 1 }], billing: { address: { a: 1 } }, shipping: { address: { b: 1 } } });
  assert.match(out, /users: User\[\];/);
  assert.match(out, /data: DataItem\[\];/);
  assert.match(out, /interface Address \{\n {2}a: number;/);
  assert.match(out, /interface ShippingAddress \{\n {2}b: number;/);
});

test('merging array elements: optional keys, unions, null, identical shapes reuse one type', () => {
  const v = {
    items: [
      { id: 1, name: 'a', tag: null },
      { id: 2.5, extra: true, tag: 'x' },
    ],
    a: { p: 1 },
    b: { p: 2 },
  };
  assert.equal(
    generate(v),
    [
      'export interface Root {',
      '  items: Item[];',
      '  a: A;',
      '  b: A;',
      '}',
      '',
      'export interface Item {',
      '  id: number;',
      '  name?: string;',
      '  tag: null | string;',
      '  extra?: boolean;',
      '}',
      '',
      'export interface A {',
      '  p: number;',
      '}',
      '',
    ].join('\n'),
  );
});

test('root arrays and primitives, readonly, type aliases', () => {
  assert.equal(
    generate([{ a: 1 }], { readonly: true, style: 'type', rootName: 'user' }),
    'export type UserList = readonly User[];\n\nexport type User = {\n  readonly a: number;\n};\n',
  );
  assert.equal(generate([1, 'x']), 'export type RootList = (number | string)[];\n');
  assert.equal(generate('hi'), 'export type Root = string;\n');
});

test('JSON Schema 2020-12', () => {
  const s = JSON.parse(generate({ when: '2026-10-01T10:00:00Z', day: '2026-10-01', n: [1, 2], kids: [{ k: 1 }, { k: 2, z: null }] }, { lang: 'schema' }));
  assert.equal(s.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.deepEqual(s.properties.when, { type: 'string', format: 'date-time' });
  assert.deepEqual(s.properties.day, { type: 'string', format: 'date' });
  assert.deepEqual(s.properties.n, { type: 'array', items: { type: 'integer' } });
  assert.deepEqual(s.$defs.Kid, { type: 'object', properties: { k: { type: 'integer' }, z: { type: 'null' } }, required: ['k'] });
  const noDates = JSON.parse(generate({ when: '2026-10-01T10:00:00Z' }, { lang: 'schema', dates: false }));
  assert.deepEqual(noDates.properties.when, { type: 'string' });
  const self = JSON.parse(generate({ child: { child: {} } }, { lang: 'schema' }));
  assert.ok(self.$defs.Child);
});

test('Python TypedDict and dataclass', () => {
  const v = [
    { id: 1, 'first name': 'a' },
    { id: 2, 'first name': 'b', class: 'x' },
  ];
  const td = generate(v, { lang: 'python' });
  assert.match(td, /Root = TypedDict\("Root", \{\n {4}"id": int,\n {4}"first name": str,\n {4}"class": NotRequired\[str\],\n\}\)/);
  assert.match(td, /RootList = list\[Root\]/);
  const dc = generate({ userId: 1, nick: null, when: '2026-01-01' }, { lang: 'python', py: 'dataclass' });
  assert.match(dc, /class Root:\n {4}user_id: int {2}# JSON key: "userId"\n {4}nick: None\n {4}when: str {2}# date/);
});

test('Go structs: pointers for optional and nullable, time.Time, omitempty, any for mixed', () => {
  const g = generate(
    [
      { id: 1, at: '2026-10-01T10:00:00Z', n: null },
      { id: 2, at: '2026-10-02T10:00:00Z', n: 'x', opt: 1.5, mix: [1, 'a'] },
    ],
    { lang: 'go' },
  );
  assert.match(g, /import "time"/);
  assert.match(g, /type RootList \[\]Root/);
  assert.match(g, /ID +int64 +`json:"id"`/);
  assert.match(g, /At +time\.Time +`json:"at"`/);
  assert.match(g, /N +\*string +`json:"n,omitempty"`/);
  assert.match(g, /Opt +\*float64 +`json:"opt,omitempty"`/);
  assert.match(g, /Mix +\[\]any +`json:"mix,omitempty"`/);
});

test('review fix: singular of common English plurals', () => {
  const m = {
    movies: 'movie',
    sizes: 'size',
    caches: 'cache',
    news: 'news',
    series: 'series',
    heroes: 'hero',
    leaves: 'leaf',
    branches: 'branch',
    boxes: 'box',
    categories: 'category',
    addresses: 'address',
  };
  for (const [p, s] of Object.entries(m)) assert.equal(singular(p), s, p);
});
