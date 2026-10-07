import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ipapi, safeHeaders, utcOffset } from './info.ts';

const cf = {
  country: 'AU',
  city: 'Sydney',
  region: 'New South Wales',
  regionCode: 'NSW',
  postalCode: '1204',
  latitude: '-33.86778',
  longitude: '151.207052',
  timezone: 'Australia/Sydney',
  continent: 'OC',
  isEUCountry: undefined,
  asn: 38195,
  asOrganization: 'SUPERLOOP (AUSTRALIA) PTY LTD',
};

test('ipapi fills the ipapi.co/json fields from cf and the country table', () => {
  const r = ipapi('2401:d005::1', cf, new Date('2026-01-15T00:00:00Z'));
  assert.equal(r.version, 'IPv6');
  assert.equal(r.country_name, 'Australia');
  assert.equal(r.country_code_iso3, 'AUS');
  assert.equal(r.country_capital, 'Canberra');
  assert.equal(r.country_tld, '.au');
  assert.equal(r.country_calling_code, '+61');
  assert.equal(r.currency, 'AUD');
  assert.equal(r.in_eu, false);
  assert.equal(r.latitude, -33.86778);
  assert.equal(r.utc_offset, '+1100'); // AEDT in January
  assert.equal(r.asn, 'AS38195');
  assert.equal(r.org, 'SUPERLOOP (AUSTRALIA) PTY LTD');
});
test('ipapi is null-safe with no cf data', () => {
  const r = ipapi(undefined, undefined);
  assert.equal(r.ip, 'unknown');
  assert.equal(r.version, 'IPv4');
  assert.equal(r.country, null);
  assert.equal(r.latitude, null);
  assert.equal(r.in_eu, false);
});
test('utcOffset handles UTC, half-hour zones and junk', () => {
  const d = new Date('2026-06-01T00:00:00Z');
  assert.equal(utcOffset('UTC', d), '+0000');
  assert.equal(utcOffset('Asia/Kolkata', d), '+0530');
  assert.equal(utcOffset('America/New_York', d), '-0400');
  assert.equal(utcOffset('Not/AZone', d), null);
});
test('safeHeaders drops credentials', () => {
  assert.deepEqual(safeHeaders(new Headers({ cookie: 'a=b', Authorization: 'x', 'user-agent': 'ua' })), { 'user-agent': 'ua' });
});
