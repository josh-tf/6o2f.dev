import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain ES module shared with the browser
import { parts, spoken, tzOffset, zonedToUtc, utcToZoned, when, ics, fold, slug, validTz } from '../../../public/_/countdown/lib.js';
import { ID_RE, newId, validateEvent } from './logic.ts';

test('parts and spoken', () => {
  assert.deepEqual(parts(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000 + 999), { d: 2, h: 3, m: 4, s: 5, done: false });
  assert.deepEqual(parts(-5000), { d: 0, h: 0, m: 0, s: 0, done: true });
  assert.equal(parts(0).done, true);
  assert.equal(spoken(((1 * 24 + 1) * 3600 + 60 + 1) * 1000), '1 day, 1 hour, 1 minute and 1 second');
  assert.equal(spoken(3 * 3600 * 1000), '3 hours');
  assert.equal(spoken(500), 'Less than a second');
  assert.equal(spoken(-1), 'Finished');
});

test('time zones, including DST edges', () => {
  assert.equal(tzOffset(Date.UTC(2026, 6, 1), 'Australia/Sydney'), 10 * 3600e3);
  assert.equal(tzOffset(Date.UTC(2026, 0, 1), 'Australia/Sydney'), 11 * 3600e3);
  assert.equal(tzOffset(Date.UTC(2026, 0, 1), 'Asia/Kolkata'), 5.5 * 3600e3);
  assert.equal(zonedToUtc('2027-01-01T00:00', 'Australia/Sydney'), Date.UTC(2026, 11, 31, 13));
  assert.equal(zonedToUtc('2026-07-04T12:30', 'America/New_York'), Date.UTC(2026, 6, 4, 16, 30));
  assert.equal(zonedToUtc('2026-03-08T02:30', 'America/New_York'), Date.UTC(2026, 2, 8, 7, 30)); // skipped hour -> 03:30 EDT
  assert.equal(zonedToUtc('2026-11-01T01:30', 'America/New_York'), Date.UTC(2026, 10, 1, 5, 30)); // repeated hour -> first (EDT)
  assert.equal(zonedToUtc('2026-06-01T09:00', 'UTC'), Date.UTC(2026, 5, 1, 9));
  // Southern hemisphere: Sydney's DST starts 2026-10-04 02:00 (gap) and ends 2026-04-05 03:00 (02:00-03:00 repeats).
  assert.equal(zonedToUtc('2026-10-04T02:30', 'Australia/Sydney'), Date.UTC(2026, 9, 3, 16, 30)); // -> 03:30 AEDT
  assert.equal(zonedToUtc('2026-04-05T02:30', 'Australia/Sydney'), Date.UTC(2026, 3, 4, 15, 30)); // first, AEDT (+11)
  assert.equal(zonedToUtc('2026-03-29T01:30', 'Europe/London'), Date.UTC(2026, 2, 29, 1, 30)); // gap -> 02:30 BST
  assert.equal(zonedToUtc('2026-10-25T01:30', 'Europe/London'), Date.UTC(2026, 9, 25, 0, 30)); // repeated -> BST
  assert.equal(zonedToUtc('2026-04-05T01:45', 'Australia/Lord_Howe'), Date.UTC(2026, 3, 4, 14, 45)); // 30-minute DST: 01:30-02:00 repeats, first is +11
  assert.ok(Number.isNaN(zonedToUtc('2026-02-30T10:00', 'UTC')));
  assert.ok(Number.isNaN(zonedToUtc('nope', 'UTC')));
  assert.ok(Number.isNaN(zonedToUtc('2026-06-01T09:00', 'Mars/Olympus')));
  assert.equal(utcToZoned(Date.UTC(2026, 11, 31, 13), 'Australia/Sydney'), '2027-01-01T00:00');
  assert.equal(validTz('Europe/London'), true);
  assert.equal(validTz('Nowhere/Land'), false);
  assert.match(when(Date.UTC(2026, 11, 31, 13), 'Australia/Sydney', 'en-AU'), /1 Jan 2027.*AEDT/);
});

test('ics is valid, escaped and folded', () => {
  const out = ics(
    {
      id: 'abcd2345',
      title: 'Launch; v2, final\\',
      target: Date.UTC(2027, 0, 1, 0, 0),
      message: 'Line one\nLine two',
      url: 'https://countdown.6o2f.dev/c/abcd2345',
    },
    Date.UTC(2026, 9, 7, 1, 2, 3),
  );
  const lines = out.split('\r\n');
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(out.endsWith('END:VCALENDAR\r\n'));
  assert.ok(lines.includes('DTSTART:20270101T000000Z'));
  assert.ok(lines.includes('DTSTAMP:20261007T010203Z'));
  assert.ok(lines.includes('UID:abcd2345@countdown.6o2f.dev'));
  assert.ok(lines.includes('SUMMARY:Launch\\; v2\\, final\\\\'));
  const unfolded = out.replace(/\r\n /g, '');
  assert.match(unfolded, /DESCRIPTION:Line one\\nLine two\\n\\nhttps:\/\/countdown\.6o2f\.dev\/c\/abcd2345/);
  for (const l of lines) assert.ok(new TextEncoder().encode(l).length <= 75, l);
  assert.ok(!out.replace(/\r\n/g, '').includes('\n'));
});

test('fold keeps multibyte characters whole', () => {
  const f = fold('SUMMARY:' + '🎉'.repeat(40));
  for (const l of f.split('\r\n')) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(f.replace(/\r\n /g, ''), 'SUMMARY:' + '🎉'.repeat(40));
  assert.equal(slug('New Year 2027! 🎆'), 'new-year-2027');
  assert.equal(slug('🎆'), 'countdown');
});

test('event validation', () => {
  const now = Date.UTC(2026, 9, 7);
  assert.deepEqual(validateEvent({ title: '  Launch   day ', target: now + 1000, tz: 'Europe/Paris', message: ' see you ' }, now), {
    title: 'Launch day',
    target: now + 1000,
    tz: 'Europe/Paris',
    message: 'see you',
  });
  assert.deepEqual(validateEvent({ title: 'x', target: now + 1, message: '' }, now), { title: 'x', target: now + 1, tz: null, message: null });
  for (const bad of [
    {},
    { title: 'x' },
    { title: 'x', target: now },
    { title: 'x', target: now + 1e13 * 1000 },
    { title: 'x'.repeat(81), target: now + 1 },
    { title: 'x', target: now + 1, tz: 'Bad/Zone' },
    { title: 'x', target: now + 1, message: 'm'.repeat(281) },
    { title: 'x', target: '2027' },
  ])
    assert.equal(typeof validateEvent(bad, now), 'string', JSON.stringify(bad).slice(0, 60));
  assert.equal(typeof validateEvent({ title: '🎉'.repeat(80), target: now + 1 }, now), 'object');
  assert.match(newId(), ID_RE);
});
