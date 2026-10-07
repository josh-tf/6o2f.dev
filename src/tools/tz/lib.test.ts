import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore no types for the browser module
import { offset, fromWall, fmtOffset, dayDiff, validZone, city, wall } from '../../../public/_/tz/lib.js';

const J = Date.UTC(2024, 0, 15, 12, 0),
  L = Date.UTC(2024, 6, 15, 12, 0);
test('offsets incl. DST and half hours', () => {
  assert.equal(offset('UTC', J), 0);
  assert.equal(offset('America/New_York', J), -300);
  assert.equal(offset('America/New_York', L), -240);
  assert.equal(offset('Europe/London', L), 60);
  assert.equal(offset('Asia/Kolkata', J), 330);
  assert.equal(offset('Australia/Sydney', J), 660);
  assert.equal(offset('Australia/Sydney', L), 600);
});
test('fromWall round trips and crosses DST', () => {
  assert.equal(new Date(fromWall('America/New_York', '2024-01-15T09:00')).toISOString(), '2024-01-15T14:00:00.000Z');
  assert.equal(new Date(fromWall('America/New_York', '2024-07-15T09:00')).toISOString(), '2024-07-15T13:00:00.000Z');
  assert.equal(new Date(fromWall('Asia/Kolkata', '2024-01-15T05:30')).toISOString(), '2024-01-15T00:00:00.000Z');
  for (const z of ['Europe/Berlin', 'Asia/Tokyo', 'Pacific/Auckland']) {
    const w = wall(z, fromWall(z, '2024-03-31T14:45'));
    assert.deepEqual([w.d, w.h, w.mi], [31, 14, 45]);
  }
});
test('fmtOffset / dayDiff / helpers', () => {
  assert.equal(fmtOffset(0), 'UTC+0');
  assert.equal(fmtOffset(-300), 'UTC-5');
  assert.equal(fmtOffset(330), 'UTC+5:30');
  assert.equal(fmtOffset(-570), 'UTC-9:30');
  const t = Date.UTC(2024, 0, 15, 20, 0);
  assert.equal(dayDiff('Asia/Tokyo', 'UTC', t), 1);
  assert.equal(dayDiff('America/Los_Angeles', 'UTC', Date.UTC(2024, 0, 15, 3, 0)), -1);
  assert.equal(dayDiff('Europe/London', 'UTC', t), 0);
  assert.ok(validZone('Europe/Paris'));
  assert.ok(!validZone('Mars/Base'));
  assert.equal(city('America/Argentina/Buenos_Aires'), 'Buenos Aires');
});
