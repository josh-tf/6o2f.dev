import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { pem, unpem, sshPublicLine, sshFingerprint, parseSpki, rsaBits, b64 } from '../../../public/_/keygen/lib.js';

// Keys made with ssh-keygen; the expected lines and fingerprints are ssh-keygen's own output.
const ED = {
  pem: 'MCowBQYDK2VwAyEAGQYVTcnnWRnZphVampWWHoeWSuHaXgmqTx4Ku7x7ixo=',
  line: 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBkGFU3J51kZ2aYVWpqVlh6Hlkrh2l4Jqk8eCru8e4sa',
  fp: 'SHA256:8HZ5i+o5zjUe4jyum7F2Ac/1YUzoSuPr0E17is5P4eI',
};
const EC = {
  pem: 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+ExQQmp8YWsIXqGin5R3Jl7ylYc7QIaAmiNgZzOa5l8ino4YhXwZJFrcnag6sz7tKcLJ/2dAt8nrqqPVZrmGWg==',
  line: 'ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBPhMUEJqfGFrCF6hop+UdyZe8pWHO0CGgJojYGczmuZfIp6OGIV8GSRa3J2oOrM+7SnCyf9nQLfJ66qj1Wa5hlo=',
  fp: 'SHA256:odhkrfn1Mmg7MZ+Cc3p2O1jKFClvQ5R9TT+pAiWUF5w',
};
const RSA = {
  pem: 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCX706QA6A7y+PDns3XeXBHiKKUtBk1Z0IxYOv8vvhqX/vDLl0oPxAS2v4ciKlzkEQgGKRmsgeVOWP7MZnVAVSISoRs4Op6/3IoiyOgtAOsp5Fu9yaYnkdrtK781JlF86nzp10VFLoIDUVzc/rzy9EH2XM/IcybZiRtaivTIV+ofQIDAQAB',
  line: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAAgQCX706QA6A7y+PDns3XeXBHiKKUtBk1Z0IxYOv8vvhqX/vDLl0oPxAS2v4ciKlzkEQgGKRmsgeVOWP7MZnVAVSISoRs4Op6/3IoiyOgtAOsp5Fu9yaYnkdrtK781JlF86nzp10VFLoIDUVzc/rzy9EH2XM/IcybZiRtaivTIV+ofQ==',
  fp: 'SHA256:p5CdbVMztEqeJCR5ohG+SvT4hvND9q88EZtRH+rJbS8',
};
const der = (s: string) => Uint8Array.from(Buffer.from(s, 'base64'));

test('OpenSSH public keys and fingerprints match ssh-keygen', async () => {
  for (const k of [ED, EC, RSA]) {
    assert.equal(sshPublicLine(der(k.pem)), k.line);
    assert.equal(await sshFingerprint(der(k.pem)), k.fp);
  }
  assert.equal(sshPublicLine(der(ED.pem), 'me@host'), ED.line + ' me@host');
});
test('PEM wrapping uses 64-column lines and round-trips', () => {
  const p = pem(der(RSA.pem), 'PUBLIC KEY');
  const lines = p.trimEnd().split('\n');
  assert.equal(lines[0], '-----BEGIN PUBLIC KEY-----');
  assert.equal(lines.at(-1), '-----END PUBLIC KEY-----');
  assert.ok(lines.slice(1, -2).every((l: string) => l.length === 64));
  assert.ok(lines.at(-2).length <= 64);
  assert.ok(p.endsWith('\n'));
  const u = unpem(p);
  assert.equal(u.label, 'PUBLIC KEY');
  assert.equal(b64(u.der), RSA.pem);
  assert.throws(() => unpem('nope'), /No PEM/);
});
test('SPKI parsing', () => {
  const k = parseSpki(der(RSA.pem));
  assert.equal(k.type, 'rsa');
  assert.equal(rsaBits(k.n), 1024);
  assert.deepEqual([...k.e], [1, 0, 1]);
  assert.equal(parseSpki(der(EC.pem)).curve, 'nistp256');
  assert.equal(parseSpki(der(ED.pem)).key.length, 32);
  assert.throws(() => parseSpki(new Uint8Array([1, 2, 3])), /Not an SPKI|Truncated/);
});
