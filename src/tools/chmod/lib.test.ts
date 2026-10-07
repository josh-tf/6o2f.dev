import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import {
  parseOctal,
  toOctal,
  toLs,
  parseLs,
  toClauses,
  applySymbolic,
  command,
  explain,
  notes,
  umaskResult,
  parseUmask,
  PRESETS,
} from '../../../public/_/chmod/lib.js';

test('octal', () => {
  assert.equal(parseOctal('755'), 0o755);
  assert.equal(parseOctal('0755'), 0o755);
  assert.equal(parseOctal('2775'), 0o2775);
  for (const bad of ['', '75', '758', '77777', 'rwx', '0o9']) assert.equal(parseOctal(bad), null, bad);
  assert.equal(toOctal(0o755), '0755');
  assert.equal(toOctal(0o4755), '4755');
  assert.equal(toOctal(0), '0000');
});
test('ls string', () => {
  assert.equal(toLs(0o755), 'rwxr-xr-x');
  assert.equal(toLs(0o644), 'rw-r--r--');
  assert.equal(toLs(0o4755), 'rwsr-xr-x');
  assert.equal(toLs(0o4644), 'rwSr--r--');
  assert.equal(toLs(0o2775), 'rwxrwsr-x');
  assert.equal(toLs(0o1777), 'rwxrwxrwt');
  assert.equal(toLs(0o1776), 'rwxrwxrwT');
  assert.equal(toLs(0), '---------');
  for (let m = 0; m <= 0o7777; m++) assert.equal(parseLs(toLs(m))!.mode, m);
  assert.deepEqual(parseLs('drwxr-xr-x'), { mode: 0o755, type: 'd' });
  assert.equal(parseLs('-rwxr-xr-x')!.mode, 0o755);
  assert.equal(parseLs('rwxr-xr-s'), null);
  assert.equal(parseLs('rwtr-xr-x'), null);
  assert.equal(parseLs('rwx'), null);
});
test('symbolic', () => {
  const m = (e: string, b = 0) => applySymbolic(e, b).mode;
  assert.equal(m('u=rwx,go=rx'), 0o755);
  assert.equal(m('a=r'), 0o444);
  assert.equal(m('a+x', 0o644), 0o755);
  assert.equal(m('+x', 0o644), 0o755);
  assert.equal(m('go-w', 0o777), 0o755);
  assert.equal(m('g=u', 0o750), 0o770);
  assert.equal(m('o=', 0o777), 0o770);
  assert.equal(m('u+s', 0o755), 0o4755);
  assert.equal(m('g+s,o+t', 0o755), 0o3755);
  assert.equal(m('u=rwxs,g=rxs,o=rxt'), 0o7755);
  assert.equal(m('u-s', 0o4755), 0o755);
  assert.equal(m('a=rwx,o-w'), 0o775);
  assert.equal(m('u+X', 0o644), 0o644);
  assert.equal(m('a+X', 0o744), 0o755);
  assert.equal(m('rwxr-xr-x'), 0o755);
  assert.equal(m('u=rwx,g=rx,o=rx'), 0o755);
  assert.equal(m('g=rx,g+w', 0o700), 0o770);
  for (const bad of ['', 'x', 'u=z', 'u+', 'q+r', 'u=rwx;g=r']) assert.ok(applySymbolic(bad).error !== undefined || bad === 'u+', bad);
  for (let k = 0; k <= 0o7777; k += 7) assert.equal(applySymbolic(toClauses(k)).mode, k, toClauses(k));
});
test('command and text', () => {
  assert.equal(command(0o755, { file: 'run.sh' }), 'chmod 755 run.sh');
  assert.equal(command(0o2775, { file: 'my dir', recursive: true }), "chmod -R 2775 'my dir'");
  assert.equal(command(0o644, { file: "it's" }), "chmod 644 'it'\\''s'");
  assert.equal(command(0o644, { file: '' }), 'chmod 644 file');
  assert.match(explain(0o755), /^Owner: read, write, execute\. Group and everyone else: read, execute\.$/);
  assert.match(explain(0), /Owner: nothing/);
  assert.ok(notes(0o777).some((n: any) => n.level === 'warn'));
  assert.ok(!notes(0o1777).some((n: any) => n.level === 'warn'));
  assert.ok(notes(0o4755).some((n: any) => /Setuid/.test(n.text)));
});
test('umask', () => {
  assert.deepEqual(umaskResult(0o022), { file: 0o644, dir: 0o755 });
  assert.deepEqual(umaskResult(0o077), { file: 0o600, dir: 0o700 });
  assert.deepEqual(umaskResult(0o002), { file: 0o664, dir: 0o775 });
  assert.deepEqual(umaskResult(0o033), { file: 0o644, dir: 0o744 }); // masked, not subtracted (666-033 would be 633)
  assert.equal(parseUmask('0022'), 0o22);
  assert.equal(parseUmask('22'), null);
  assert.equal(parseUmask('0o027'), 0o27);
});
test('presets', () => {
  assert.equal(PRESETS.length, 8);
  for (const p of PRESETS) assert.ok(p.what && p.sec && p.use);
});

test('review fixes: unusual-ordering note compares bits against the owner and the group', () => {
  const unusual = (m: number) => notes(m).some((n: any) => n.text.startsWith('Unusual'));
  assert.equal(unusual(0o640), false);
  assert.equal(unusual(0o755), false);
  assert.equal(unusual(0o614), true); // group has x, owner does not
  assert.equal(unusual(0o604), true); // others read, group cannot
  assert.equal(unusual(0o750), false);
});
