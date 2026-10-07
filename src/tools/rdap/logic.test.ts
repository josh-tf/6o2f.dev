import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, summarize } from './logic.ts';

test('classify', () => {
  assert.deepEqual(classify('Example.COM.'), { kind: 'domain', value: 'example.com' });
  assert.deepEqual(classify('xn--bcher-kva.example'), { kind: 'domain', value: 'xn--bcher-kva.example' });
  assert.deepEqual(classify('AS13335'), { kind: 'asn', value: '13335' });
  assert.deepEqual(classify('1.1.1.1'), { kind: 'ip', value: '1.1.1.1' });
  assert.deepEqual(classify('2606:4700::1111'), { kind: 'ip', value: '2606:4700::1111' });
  for (const bad of ['', 'localhost', 'a b.com', '999.1.1.1', '-a.com', 'a.com/x', 'a.123', 'http://a.com', ':::']) assert.equal(classify(bad), null, bad);
});

test('summarize domain', () => {
  const j = {
    ldhName: 'EXAMPLE.COM',
    status: ['active'],
    events: [{ eventAction: 'expiration', eventDate: '2026-12-01T00:00:00Z' }],
    nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }],
    secureDNS: { delegationSigned: true },
    entities: [
      {
        roles: ['registrar'],
        vcardArray: ['vcard', [['fn', {}, 'text', 'Reg Inc']]],
        entities: [{ roles: ['abuse'], vcardArray: ['vcard', [['email', {}, 'text', 'abuse@reg.example']]] }],
      },
    ],
  };
  const s = Object.fromEntries(summarize('domain', j, Date.parse('2026-10-07T00:00:00Z')).map((r) => [r.label, r.value]));
  assert.equal(s.Registrar, 'Reg Inc');
  assert.equal(s.Expires, '2026-12-01 (55 days left)');
  assert.equal(s.DNSSEC, 'signed');
  assert.equal(s['Abuse contact'], 'abuse@reg.example');
  assert.equal(s.Nameservers, 'a.iana-servers.net');
});
