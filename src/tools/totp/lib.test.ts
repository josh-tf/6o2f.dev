import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { b32decode, b32encode, hotp, totp, parseOtpauth, buildOtpauth, secondsLeft, group } from '../../../public/_/totp/lib.js';

const ascii = (s: string) => new TextEncoder().encode(s);
const K1 = ascii('12345678901234567890');
const K256 = ascii('12345678901234567890123456789012');
const K512 = ascii('1234567890123456789012345678901234567890123456789012345678901234');

test('RFC 4226 HOTP vectors', async () => {
  const want = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
  for (let i = 0; i < want.length; i++) assert.equal(await hotp(K1, i), want[i]);
});
test('RFC 6238 TOTP vectors (8 digits)', async () => {
  const rows: [number, string, string, string][] = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];
  for (const [t, a, b, c] of rows) {
    assert.equal(await totp(K1, t, { digits: 8, algorithm: 'SHA-1' }), a);
    assert.equal(await totp(K256, t, { digits: 8, algorithm: 'SHA-256' }), b);
    assert.equal(await totp(K512, t, { digits: 8, algorithm: 'SHA-512' }), c);
  }
});
test('base32', () => {
  assert.equal(b32encode(ascii('foobar')), 'MZXW6YTBOI');
  assert.deepEqual([...b32decode('mzxw 6ytb-oi==')], [...ascii('foobar')]);
  assert.equal(b32encode(K1), 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.throws(() => b32decode('ABC1'), /not valid base32/);
  assert.throws(() => b32decode('  '), /Enter a secret/);
});
test('otpauth round trip', () => {
  const u = 'otpauth://totp/ACME%20Co:john@example.com?secret=HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ&issuer=ACME%20Co&algorithm=SHA1&digits=6&period=30';
  const p = parseOtpauth(u);
  assert.deepEqual(p, {
    type: 'totp',
    label: 'john@example.com',
    issuer: 'ACME Co',
    secret: 'HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ',
    algorithm: 'SHA-1',
    digits: 6,
    period: 30,
    counter: 0,
  });
  assert.equal(buildOtpauth(p), u.replace('@', '%40'));
  assert.equal(parseOtpauth('otpauth://hotp/x?secret=abcd&counter=7&algorithm=SHA256').counter, 7);
  assert.equal(parseOtpauth('otpauth://totp/bad%E0name?secret=JBSWY3DP').label, 'bad%E0name'); // malformed escape kept, not thrown
  assert.throws(() => parseOtpauth('https://x'), /otpauth/);
  assert.throws(() => parseOtpauth('otpauth://totp/x'), /secret/);
  assert.throws(() => parseOtpauth('otpauth://totp/x?secret=AA&algorithm=MD5'), /Unsupported/);
});
test('helpers', () => {
  assert.equal(secondsLeft(59), 1);
  assert.equal(secondsLeft(60), 30);
  assert.equal(group('123456'), '123 456');
  assert.equal(group('12345678'), '1234 5678');
});
