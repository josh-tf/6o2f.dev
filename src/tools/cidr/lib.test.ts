import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import {
  parseIP,
  fmt,
  parseCIDR,
  info,
  binary,
  split,
  aggregate,
  contains,
  convert,
  range,
  rangeToCidrs,
  ptr,
  count,
  expand6,
} from '../../../public/_/cidr/lib.js';

test('parse and format addresses', () => {
  assert.equal(parseIP('192.168.1.1')!.n, 3232235777n);
  for (const bad of [
    '',
    '256.1.1.1',
    '1.2.3',
    '1.2.3.4.5',
    '01.2.3.4',
    'a.b.c.d',
    '1::2::3',
    '12345::',
    ':::',
    '1:2:3:4:5:6:7:8:9',
    'g::1',
    '::1.2.3',
    '1:2:3:4:5:6:7::8:9',
  ])
    assert.equal(parseIP(bad), null, bad);
  const r = (s: string) => {
    const p = parseIP(s)!;
    return fmt(p.n, p.v);
  };
  assert.equal(r('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
  assert.equal(r('2001:db8:0:0:1:0:0:1'), '2001:db8::1:0:0:1'); // first longest run (RFC 5952)
  assert.equal(r('2001:db8:0:1:1:1:1:1'), '2001:db8:0:1:1:1:1:1'); // single 0 group not compressed
  assert.equal(r('::'), '::');
  assert.equal(r('::1'), '::1');
  assert.equal(r('fe80::1%eth0'), 'fe80::1');
  assert.equal(r('[2001:db8::a]'), '2001:db8::a');
  assert.equal(r('::ffff:192.0.2.1'), '::ffff:192.0.2.1');
  assert.equal(r('64:ff9b::192.0.2.33'), '64:ff9b::c000:221');
  assert.equal(r('1:2:3:4:5:6:7::'), '1:2:3:4:5:6:7:0');
  assert.equal(expand6(parseIP('2001:db8::1')!.n), '2001:0db8:0000:0000:0000:0000:0000:0001');
});
test('IPv4 blocks', () => {
  const i = info('192.168.1.130/26');
  assert.equal(i.cidr, '192.168.1.128/26');
  assert.equal(i.hostBits, true);
  assert.equal(fmt(i.first, 4), '192.168.1.129');
  assert.equal(fmt(i.lastHost, 4), '192.168.1.190');
  assert.equal(i.broadcast, '192.168.1.191');
  assert.equal(i.usable, 62n);
  assert.equal(i.size, 64n);
  assert.equal(i.netmask, '255.255.255.192');
  assert.equal(i.wildcard, '0.0.0.63');
  assert.equal(i.flags.private, true);
  assert.equal(i.flags.class, 'C');
  assert.equal(i.ptr, '130.1.168.192.in-addr.arpa');
  const p31 = info('10.0.0.0/31');
  assert.equal(p31.usable, 2n);
  assert.equal(p31.broadcast, null);
  assert.equal(fmt(p31.first, 4), '10.0.0.0');
  assert.equal(fmt(p31.lastHost, 4), '10.0.0.1');
  const p32 = info('8.8.8.8');
  assert.equal(p32.prefix, 32);
  assert.equal(p32.usable, 1n);
  assert.equal(fmt(p32.first, 4), '8.8.8.8');
  assert.equal(p32.flags.public, true);
  assert.equal(p32.netmask, '255.255.255.255');
  const all = info('0.0.0.0/0');
  assert.equal(all.size, 4294967296n);
  assert.equal(all.netmask, '0.0.0.0');
  assert.equal(info('10.1.2.3 255.255.0.0').cidr, '10.1.0.0/16');
  assert.equal(info('10.1.2.3/255.255.255.0').cidr, '10.1.2.0/24');
  assert.match(info('10.0.0.0/255.0.255.0').error, /netmask/);
  assert.match(info('10.0.0.0/0.255.255.255').error, /netmask/);
  assert.match(info('10.0.0.0/33').error, /32/);
  assert.match(info('nope').error, /not a valid/);
  assert.equal(info('127.0.0.1').flags.loopback, true);
  assert.equal(info('169.254.10.1').flags.linklocal, true);
  assert.equal(info('100.64.1.1').flags.private, true);
  assert.equal(info('224.0.0.1').flags.multicast, true);
  assert.equal(info('172.32.0.1').flags.private, false);
  assert.equal(binary(parseIP('192.168.1.1')!.n, 4), '11000000.10101000.00000001.00000001');
});
test('IPv6 blocks', () => {
  const i = info('2001:db8:abcd:12::1/64');
  assert.equal(i.cidr, '2001:db8:abcd:12::/64');
  assert.equal(i.size, 18446744073709551616n);
  assert.equal(i.usable, i.size);
  assert.equal(fmt(i.last, 6), '2001:db8:abcd:12:ffff:ffff:ffff:ffff');
  assert.equal(i.broadcast, null);
  assert.equal(i.netmask, 'ffff:ffff:ffff:ffff::');
  assert.equal(i.flags.labels[0].label, 'Documentation');
  const h = info('2606:4700::1111/128');
  assert.equal(h.size, 1n);
  assert.equal(h.flags.public, true);
  assert.equal(fmt(h.first, 6), '2606:4700::1111');
  assert.equal(info('::1').flags.loopback, true);
  assert.equal(info('fe80::1/64').flags.linklocal, true);
  assert.equal(info('fd12:3456::/48').flags.private, true);
  assert.match(info('::/129').error, /128/);
  assert.equal(ptr(parseIP('2001:db8::1')!.n, 6), '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
  assert.equal(count(1n << 64n), '2^64 (1.844e19)');
  assert.equal(count(256n), '256');
});
test('split', () => {
  const s = split('10.0.0.0/24', 26);
  assert.equal(s.count, 4n);
  assert.deepEqual(s.subnets, ['10.0.0.0/26', '10.0.0.64/26', '10.0.0.128/26', '10.0.0.192/26']);
  const v6 = split('2001:db8::/48', 64, 3);
  assert.equal(v6.count, 65536n);
  assert.deepEqual(v6.subnets, ['2001:db8::/64', '2001:db8:0:1::/64', '2001:db8:0:2::/64']);
  assert.match(split('10.0.0.0/24', 23).error, /between/);
  assert.equal(split('10.0.0.0/24', 24).count, 1n);
});
test('aggregate', () => {
  assert.deepEqual(aggregate('10.0.0.0/25 10.0.0.128/25').cidrs, ['10.0.0.0/24']);
  assert.deepEqual(aggregate('192.168.0.0/24, 192.168.1.0/24\n192.168.2.0/24 192.168.3.0/24 192.168.1.17').cidrs, ['192.168.0.0/22']);
  assert.deepEqual(aggregate('10.0.0.0/8 10.1.0.0/16').cidrs, ['10.0.0.0/8']);
  assert.deepEqual(aggregate('10.0.0.1 10.0.0.2').cidrs, ['10.0.0.1/32', '10.0.0.2/32']);
  assert.deepEqual(aggregate('2001:db8::/33 2001:db8:8000::/33 10.0.0.0/24').cidrs, ['10.0.0.0/24', '2001:db8::/32']);
  assert.deepEqual(aggregate('10.0.0.0-10.0.0.255').cidrs, ['10.0.0.0/24']);
  const bad = aggregate('10.0.0.0/24 junk');
  assert.equal(bad.errors.length, 1);
  assert.deepEqual(bad.cidrs, ['10.0.0.0/24']);
  assert.deepEqual(aggregate('').cidrs, []);
});
test('contains, convert, range', () => {
  assert.equal(contains('10.0.0.0/8', '10.255.1.1').inside, true);
  assert.equal(contains('10.0.0.0/8', '11.0.0.0').inside, false);
  assert.equal(contains('2001:db8::/32', '2001:db8:ffff::1').inside, true);
  assert.equal(contains('10.0.0.0/8', '::1').inside, false);
  assert.ok(contains('10.0.0.0/8', 'x').error);
  assert.deepEqual(convert('192.168.1.1'), { ip: '192.168.1.1', v: 4, dec: '3232235777', hex: '0xc0a80101', full: null });
  assert.equal(convert('3232235777').ip, '192.168.1.1');
  assert.equal(convert('0xc0a80101').ip, '192.168.1.1');
  assert.equal(convert('4294967296').ip, '::1:0:0');
  assert.equal(convert('1', 6).ip, '::1');
  assert.equal(convert('::1').dec, '1');
  assert.ok(convert('340282366920938463463374607431768211456').error);
  assert.ok(convert('hello').error);
  assert.deepEqual(range('10.0.0.0', '10.0.0.10').cidrs, ['10.0.0.0/29', '10.0.0.8/31', '10.0.0.10/32']);
  assert.deepEqual(range('192.168.0.5', '192.168.0.5').cidrs, ['192.168.0.5/32']);
  assert.deepEqual(range('0.0.0.0', '255.255.255.255').cidrs, ['0.0.0.0/0']);
  assert.deepEqual(range('::', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff').cidrs, ['::/0']);
  assert.deepEqual(range('10.0.0.10', '10.0.0.8').cidrs, ['10.0.0.8/31', '10.0.0.10/32']);
  assert.ok(range('10.0.0.1', '::1').error);
  assert.equal(rangeToCidrs(1n, 6n, 4).length, 4); // 1/32 2/31 4/31 6/32
  assert.equal(parseCIDR('').error.length > 0, true);
});

test('review fixes: spaced ranges in merge, empty range ends, IPv6 public only in 2000::/3', () => {
  assert.deepEqual(aggregate('10.0.0.1 - 10.0.0.6, 10.0.0.7').cidrs, ['10.0.0.1/32', '10.0.0.2/31', '10.0.0.4/30']);
  assert.ok(range('', '10.0.0.1').error);
  assert.equal(info('4000::/16').flags.public, false);
  assert.equal(info('2606:4700::/32').flags.public, true);
  assert.equal(info('10.20.30.40 255.255.240.0').cidr, '10.20.16.0/20');
  assert.equal(fmt(parseIP('2001:0:0:1:0:0:0:1').n, 6), '2001:0:0:1::1');
});
