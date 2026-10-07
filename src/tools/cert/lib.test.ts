import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import fs from 'node:fs';
// @ts-ignore browser module
import { pemBlocks, parseCert, parsePublicKey, dn, digest, daysLeft, status, links, chainOrder, der } from '../../../public/_/cert/lib.js';
// @ts-ignore browser module
import { ISRG_ROOT_X1 } from '../../../public/_/cert/example.js';

test('ISRG Root X1 decodes exactly', async () => {
  const [b] = pemBlocks(ISRG_ROOT_X1);
  const c = parseCert(b.der);
  assert.equal(c.version, 3);
  assert.equal(c.serial, '8210CFB0D240E3594463E0BB63828B00');
  assert.equal(dn(c.subject), 'C=US, O=Internet Security Research Group, CN=ISRG Root X1');
  assert.ok(c.selfIssued);
  assert.equal(c.notBefore.toISOString(), '2015-06-04T11:04:38.000Z');
  assert.equal(c.notAfter.toISOString(), '2035-06-04T11:04:38.000Z');
  assert.equal(c.key.summary, 'RSA 4096 bits (e = 65537)');
  assert.equal(c.signature, 'SHA-256 with RSA');
  assert.deepEqual(c.keyUsage, ['Certificate sign', 'CRL sign']);
  assert.equal(c.basic.ca, true);
  assert.equal(c.basic.pathLen, undefined);
  assert.ok(c.exts.find((e: any) => e.oid === '2.5.29.19').critical);
  assert.equal(c.ski, '79:B4:59:E6:7B:B6:E5:E4:01:73:80:08:88:C8:1A:58:F6:E9:9B:6E');
  assert.equal(await digest('SHA-256', c.der), '96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6');
  assert.equal(status(c, new Date('2036-01-01')), 'expired');
  assert.equal(status(c, new Date('2014-01-01')), 'notyet');
  assert.equal(daysLeft(c.notAfter, new Date('2035-06-02T11:04:38Z')), 2);
});

test('every system root matches node:crypto', async () => {
  const dir = '/etc/ssl/certs';
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.pem')) : [];
  let n = 0;
  for (const f of files) {
    const text = fs.readFileSync(`${dir}/${f}`, 'utf8');
    const x = new X509Certificate(text),
      c = parseCert(pemBlocks(text)[0].der);
    assert.equal(c.serial.replace(/^0+(?=.)/, ''), x.serialNumber.replace(/^0+(?=.)/, ''), f);
    assert.equal(c.notAfter.getTime(), x.validToDate.getTime(), f);
    assert.equal(await digest('SHA-256', c.der), x.fingerprint256, f);
    assert.equal(c.subject.map((a: any) => `${a.type}=${a.value}`).join('\n').length > 0, true);
    assert.equal(!!c.basic?.ca, x.ca, f);
    const d = x.publicKey.asymmetricKeyDetails!;
    if (c.key.type === 'RSA') assert.equal(c.key.bits, d.modulusLength, f);
    if (c.key.type === 'EC') assert.ok(c.key.curve === { prime256v1: 'P-256', secp384r1: 'P-384', secp521r1: 'P-521' }[d.namedCurve!], f);
    n++;
  }
  assert.ok(n === 0 || n > 50);
});

test('chain links and order', () => {
  const read = (f: string) => fs.readFileSync(`/etc/ssl/certs/${f}`, 'utf8');
  if (!fs.existsSync('/etc/ssl/certs/ISRG_Root_X2.pem')) return;
  const certs = [read('ISRG_Root_X2.pem'), ISRG_ROOT_X1].map((t) => parseCert(pemBlocks(t)[0].der));
  assert.deepEqual(links(certs), [0, 1]); // both self-signed
  assert.equal(certs[0].key.summary, 'ECDSA P-384');
  // A fake two-cert chain: link by name, and order leaf first.
  const leaf = { ...certs[0], selfIssued: false, issuer: certs[1].subject, aki: certs[1].ski, ski: 'AA' };
  assert.deepEqual(links([certs[1], leaf]), [0, 0]);
  assert.deepEqual(chainOrder([certs[1], leaf]), [1, 0]);
});

test('public keys and bad input', () => {
  const spki = Uint8Array.from(
    Buffer.from('MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+ExQQmp8YWsIXqGin5R3Jl7ylYc7QIaAmiNgZzOa5l8ino4YhXwZJFrcnag6sz7tKcLJ/2dAt8nrqqPVZrmGWg==', 'base64'),
  );
  assert.equal(parsePublicKey(spki).summary, 'ECDSA P-256');
  assert.equal(parsePublicKey(Uint8Array.from(Buffer.from('MCowBQYDK2VwAyEAGQYVTcnnWRnZphVampWWHoeWSuHaXgmqTx4Ku7x7ixo=', 'base64'))).type, 'Ed25519');
  assert.throws(() => pemBlocks('hello world!'), /No PEM block/);
  assert.throws(() => pemBlocks('hello'), /No PEM block/);
  assert.throws(() => pemBlocks('-----BEGIN CERTIFICATE-----\nAAAA'), /without a matching END/);
  assert.deepEqual(pemBlocks('  \n'), []);
  assert.throws(() => parseCert(new Uint8Array([0x30, 0x05, 1])), /Truncated/);
  assert.throws(() => der(new Uint8Array([0x30, 0x80, 0, 0])), /Indefinite/);
  const blocks = pemBlocks(ISRG_ROOT_X1 + '\n' + ISRG_ROOT_X1);
  assert.equal(blocks.length, 2);
});
