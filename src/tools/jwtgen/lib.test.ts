import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, generateKeyPairSync, createVerify } from 'node:crypto';
// @ts-ignore browser module
import { signJwt, verifyJwt, importKeys, secretBytes, parseObject, timeStatus, rel } from '../../../public/_/jwtgen/lib.js';

const H = { alg: 'HS256', typ: 'JWT' },
  P = { sub: '1234567890', name: 'John Doe', iat: 1516239022 };

test('known HS256 vector (jwt.io)', async () => {
  const keys = await importKeys('HS256', secretBytes('your-256-bit-secret'));
  const t = await signJwt('HS256', H, P, keys);
  assert.equal(
    t,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
  );
  assert.equal(await verifyJwt(t, 'HS256', keys), true);
  assert.equal(await verifyJwt(t.slice(0, -2) + 'AA', 'HS256', keys), false);
  assert.equal(await verifyJwt('a.b', 'HS256', keys), false);
});
test('HS512 matches node crypto, base64 secrets decode', async () => {
  const sec = secretBytes('c2VjcmV0LWtleQ==', true);
  assert.equal(new TextDecoder().decode(sec), 'secret-key');
  const t = await signJwt('HS512', { alg: 'HS512' }, { a: 1 }, await importKeys('HS512', sec));
  const [h, p, s] = t.split('.');
  assert.equal(s, createHmac('sha512', 'secret-key').update(`${h}.${p}`).digest('base64url'));
  assert.throws(() => secretBytes('%%', true), /base64/);
  assert.throws(() => secretBytes(''), /Enter a secret/);
});
test('RS256 and ES256 from PKCS#8 PEM verify with node crypto', async () => {
  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keys = await importKeys('RS256', rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string);
  const t = await signJwt('RS256', { alg: 'RS256' }, P, keys);
  const [h, p, s] = t.split('.');
  assert.ok(createVerify('SHA256').update(`${h}.${p}`).verify(rsa.publicKey, Buffer.from(s, 'base64url')));
  assert.match(keys.publicPem, /^-----BEGIN PUBLIC KEY-----/);
  const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const ek = await importKeys('ES256', ec.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string);
  const et = await signJwt('ES256', { alg: 'ES256' }, P, ek);
  const [eh, ep, es] = et.split('.');
  assert.equal(Buffer.from(es, 'base64url').length, 64);
  assert.ok(createVerify('SHA256').update(`${eh}.${ep}`).verify({ key: ec.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(es, 'base64url')));
  assert.equal(await verifyJwt(et, 'ES256', ek), true);
  await assert.rejects(importKeys('ES256', rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string), /P-256/);
  await assert.rejects(importKeys('RS256', rsa.privateKey.export({ type: 'pkcs1', format: 'pem' }) as string), /older format/);
  await assert.rejects(importKeys('RS256', 'garbage'), /PKCS#8/);
});
test('JSON and time helpers', () => {
  assert.throws(() => parseObject('[1]', 'Payload'), /must be a JSON object/);
  assert.throws(() => parseObject('{', 'Header'), /Header is not valid JSON/);
  assert.equal(timeStatus({ exp: 100 }, 100).state, 'expired');
  assert.equal(timeStatus({ exp: 101, nbf: 200 }, 100).state, 'notyet');
  assert.equal(timeStatus({ exp: 'x' }, 100).bad.length, 1);
  assert.equal(rel(0), 'now');
  assert.throws(() => secretBytes('  ', true), /Enter a secret/);
  assert.equal(rel(3600), 'in 1 h');
  assert.equal(rel(-90), '2 min ago');
});
