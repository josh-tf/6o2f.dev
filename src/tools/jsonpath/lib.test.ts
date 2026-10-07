import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { query, parse, normPath, BOOKSTORE } from '../../../public/_/jsonpath/lib.js';

const q = (s: string, doc: unknown = BOOKSTORE) => query(doc, s).map((r: any) => r.value);
const paths = (s: string, doc: unknown = BOOKSTORE) => query(doc, s).map((r: any) => r.path);
const books = BOOKSTORE.store.book;

test('goessner bookstore examples', () => {
  const authors = ['Nigel Rees', 'Evelyn Waugh', 'Herman Melville', 'J. R. R. Tolkien'];
  assert.deepEqual(q('$.store.book[*].author'), authors);
  assert.deepEqual(q('$..author'), authors);
  assert.deepEqual(q('$.store.*'), [books, BOOKSTORE.store.bicycle]);
  assert.deepEqual(q('$.store..price'), [8.95, 12.99, 8.99, 22.99, 399]);
  assert.deepEqual(q('$..book[2]'), [books[2]]);
  assert.deepEqual(q('$..book[-1]'), [books[3]]);
  assert.deepEqual(q('$..book[(@.length-1)]'), [books[3]]);
  assert.deepEqual(q('$..book[0,1]'), [books[0], books[1]]);
  assert.deepEqual(q('$..book[:2]'), [books[0], books[1]]);
  assert.deepEqual(q('$..book[?(@.isbn)]'), [books[2], books[3]]);
  assert.deepEqual(q('$..book[?(@.price<10)]'), [books[0], books[2]]);
  assert.equal(q('$..*').length, 27);
  assert.deepEqual(q('$.store.book[?(@.author =~ /tolkien/i)].title'), ['The Lord of the Rings']);
});

test('normalized paths', () => {
  assert.deepEqual(paths('$..book[?(@.price > 20)].title'), ["$['store']['book'][3]['title']"]);
  assert.equal(normPath(["a'b", 0, 'c\\d', 'e\nf']), "$['a\\'b'][0]['c\\\\d']['e\\nf']");
});

test('slices follow RFC 9535', () => {
  const a = [0, 1, 2, 3, 4, 5, 6];
  assert.deepEqual(q('$[1:5:2]', a), [1, 3]);
  assert.deepEqual(q('$[::-1]', a), [6, 5, 4, 3, 2, 1, 0]);
  assert.deepEqual(q('$[5:1:-2]', a), [5, 3]);
  assert.deepEqual(q('$[-2:]', a), [5, 6]);
  assert.deepEqual(q('$[::0]', a), []);
  assert.deepEqual(q('$[10]', a), []);
});

test('filters: && || !, existential match on wildcards, arithmetic, functions', () => {
  const doc = {
    items: [
      { name: 'a', price: 5, tags: ['x', 'y'] },
      { name: 'b', price: 15, tags: ['x'] },
      { name: 'c', price: 25, tags: ['z'] },
      { name: 'd', price: 30 },
    ],
  };
  assert.deepEqual(q('$.items[?(@.price > 10 && @.tags[*] == "x")].name', doc), ['b']);
  assert.deepEqual(q('$.items[?(@.price < 10 || @.price >= 30)].name', doc), ['a', 'd']);
  assert.deepEqual(q('$.items[?(!@.tags)].name', doc), ['d']);
  assert.deepEqual(q('$.items[?@.price * 2 == 30].name', doc), ['b']);
  assert.deepEqual(q('$.items[?length(@.tags) == 2].name', doc), ['a']);
  assert.deepEqual(q('$.items[?count(@.tags[*]) == 1].name', doc), ['b', 'c']);
  assert.deepEqual(q('$.items[?match(@.name, "[a-b]")].name', doc), ['a', 'b']);
  assert.deepEqual(q('$.items[?search(@.name, "c")].name', doc), ['c']);
  assert.deepEqual(q('$.items[?(@.price > $.items[0].price && @.price < 20)].name', doc), ['b']);
  assert.deepEqual(q('$.items[?(@.tags[*] != "x")].name', doc), ['c', 'd']);
});

test('names: quoted, unicode, dashes, numbers-as-keys', () => {
  const doc = { 'first-name': 1, 'a b': 2, ключ: 3, '0': 4, "it's": 5 };
  assert.deepEqual(q('$.first-name', doc), [1]);
  assert.deepEqual(q("$['a b']", doc), [2]);
  assert.deepEqual(q('$.ключ', doc), [3]);
  assert.deepEqual(q('$.0', doc), [4]);
  assert.deepEqual(q("$['it\\'s', 'a b']", doc), [5, 2]);
});

test('bad queries report a position', () => {
  assert.throws(() => parse('store'), /starts with \$ at position 1/);
  assert.throws(() => parse('$.store[?(@.price < ]'), /position/);
  assert.throws(() => parse("$['x"), /Unterminated string/);
  assert.throws(() => parse('$.a[?(foo)]'), /Unknown name "foo"/);
  assert.throws(() => parse('$.a b'), /Unexpected "b"/);
});

test('review fixes: large arrays do not overflow the stack; unclosed bracket message', () => {
  const big = Array.from({ length: 200000 }, (_, i) => ({ id: i }));
  assert.equal(query(big, '$[*].id').length, 200000);
  assert.equal(query(big, '$..*').length, 400000);
  assert.throws(() => parse('$.a[0'), /Expected "\]"/);
});
