import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { v7, ulid, make, format, parse, NIL } from '../../../public/_/uuid/lib.js';

const RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('v7 layout and timestamp prefix decode', () => {
  const ms = 1_700_000_000_123;
  const id = v7(ms);
  assert.match(id, RE);
  assert.equal(parseInt(id.replace(/-/g, '').slice(0, 12), 16), ms);
  const p = parse(id);
  assert.deepEqual([p.version, p.ms], [7, ms]);
  assert.match(p.variant, /RFC/);
});

test('v7 and ULID sort by time', () => {
  const ts = [1e12, 1e12 + 1, 1e12 + 1000, 1.7e12, 1.7e12 + 5];
  const a = ts.map((t) => v7(t)),
    b = ts.map((t) => ulid(t));
  assert.deepEqual([...a].sort(), a);
  assert.deepEqual([...b].sort(), b);
  const m = make('v7', 500);
  assert.deepEqual([...m].sort(), m);
});

test('ULID shape and decode', () => {
  const u = ulid(1_700_000_000_123, new Uint8Array(10));
  assert.equal(u, '01HF7YAT3V0000000000000000');
  assert.equal(parse(u).ms, 1_700_000_000_123);
  assert.equal(ulid().length, 26);
});

test('parse v1, v4, nil, bad', () => {
  const v1 = parse('c232ab00-9414-11ec-b3c8-9f6bdeced846'); // 2022-02-22
  assert.equal(v1.version, 1);
  assert.equal(new Date(v1.ms).toISOString().slice(0, 10), '2022-02-22');
  assert.equal(parse('{F81D4FAE-7DEC-11D0-A765-00A0C91E6BF6}').version, 1);
  assert.equal(parse(crypto.randomUUID().replace(/-/g, '')).version, 4);
  assert.equal(parse(NIL).version, 'nil');
  assert.ok(parse('nope').error);
  assert.ok(parse('f81d4fae7dec-11d0-a765-00a0c91e6bf6').error);
});

test('format options', () => {
  const id = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6';
  assert.equal(format(id, { upper: true, hyphens: false, braces: true }), '{F81D4FAE7DEC11D0A76500A0C91E6BF6}');
  assert.equal(format(id), id);
});

test('parse v6 timestamp (RFC 9562 test vector)', () => {
  const p = parse('1EC9414C-232A-6B00-B3C8-9F6BDECED846'); // same instant as the RFC's v1 example
  assert.equal(p.version, 6);
  assert.equal(new Date(p.ms).toISOString(), '2022-02-22T19:22:22.000Z');
});
