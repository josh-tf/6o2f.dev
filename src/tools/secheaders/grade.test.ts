import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grade, parseCsp, toMarkdown, type Input } from './grade.ts';

const strong: [string, string][] = [
  ['content-type', 'text/html; charset=utf-8'],
  ['strict-transport-security', 'max-age=63072000; includeSubDomains; preload'],
  ['content-security-policy', "default-src 'self'; script-src 'self' 'nonce-abc'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'strict-origin-when-cross-origin'],
  ['permissions-policy', 'camera=()'],
  ['cross-origin-opener-policy', 'same-origin'],
  ['cache-control', 'no-store'],
  ['set-cookie', '__Host-s=1; Path=/; Secure; HttpOnly; SameSite=Lax'],
  ['server', 'cloudflare'],
];
const inp = (headers: [string, string][], extra: Partial<Input> = {}): Input => ({ finalUrl: 'https://example.com/', headers, httpRedirect: true, ...extra });
const by = (r: ReturnType<typeof grade>, id: string) => r.checks.find((c) => c.id === id)!;

test('a hardened site gets A+', () => {
  const r = grade(inp(strong));
  assert.equal(r.grade, 'A+');
  assert.equal(r.score, 100);
  assert.ok(
    r.checks.every((c) => c.status === 'pass' || c.status === 'info'),
    JSON.stringify(r.checks.filter((c) => c.status !== 'pass')),
  );
});

test('no headers at all scores F-ish and every key check fails', () => {
  const r = grade(inp([['content-type', 'text/html']], { httpRedirect: false }));
  for (const id of ['hsts', 'csp', 'xfo', 'xcto', 'redirect']) assert.equal(by(r, id).status, 'fail', id);
  assert.ok(['D', 'F'].includes(r.grade), r.grade);
});

test('plain http is always F and HSTS is not applicable', () => {
  const r = grade(inp(strong, { finalUrl: 'http://example.com/' }));
  assert.equal(r.grade, 'F');
  assert.equal(by(r, 'https').status, 'fail');
  assert.equal(by(r, 'hsts').status, 'info');
});

test('HSTS rules', () => {
  const h = (v: string) => by(grade(inp([['strict-transport-security', v]])), 'hsts');
  assert.equal(h('max-age=300').status, 'warn');
  assert.equal(h('max-age=31536000').status, 'warn'); // no includeSubDomains
  assert.equal(h('max-age=31536000; includeSubDomains').status, 'pass');
  assert.equal(h('max-age=0').status, 'fail');
  assert.equal(h('includeSubDomains').status, 'fail');
});

test('CSP weaknesses are flagged', () => {
  const csp = (v: string, more: [string, string][] = []) => by(grade(inp([['content-security-policy', v], ...more])), 'csp');
  assert.match(csp("default-src 'self' 'unsafe-inline'").detail, /unsafe-inline/);
  assert.equal(csp("script-src 'self' 'unsafe-inline' 'nonce-x'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'").status, 'pass'); // nonce makes unsafe-inline inert
  assert.match(csp("script-src 'self' 'unsafe-eval'").detail, /unsafe-eval/);
  assert.match(csp('default-src *').detail, /from anywhere/);
  assert.match(csp('default-src https:').detail, /from anywhere/);
  assert.match(csp("img-src 'self'").detail, /scripts are unrestricted/);
  const minor = csp("default-src 'self'");
  assert.equal(minor.status, 'warn');
  assert.match(minor.detail, /object-src.*base-uri.*frame-ancestors/);
  assert.doesNotMatch(csp("default-src 'none'; base-uri 'none'", [['x-frame-options', 'DENY']]).detail ?? '', /object-src/);
  assert.equal(by(grade(inp([['content-security-policy-report-only', "default-src 'self'"]])), 'csp').status, 'fail');
  assert.deepEqual(parseCsp("Default-Src 'self';; img-src * ; default-src x").get('default-src'), ["'self'"]);
});

test('framing, sniffing, referrer, cookies, leaks, CORS', () => {
  assert.equal(by(grade(inp([['x-frame-options', 'sameorigin']])), 'xfo').status, 'pass');
  assert.equal(by(grade(inp([['x-frame-options', 'ALLOW-FROM https://a.b']])), 'xfo').status, 'warn');
  assert.equal(by(grade(inp([['x-content-type-options', 'nosniff ']])), 'xcto').status, 'pass');
  assert.equal(by(grade(inp([['referrer-policy', 'unsafe-url']])), 'referrer').status, 'warn');
  assert.equal(by(grade(inp([['referrer-policy', 'no-referrer, strict-origin-when-cross-origin']])), 'referrer').status, 'pass');
  const ck = by(
    grade(
      inp([
        ['set-cookie', 'a=1; Path=/'],
        ['set-cookie', 'b=2; Secure; HttpOnly; SameSite=Strict'],
      ]),
    ),
    'cookies',
  );
  assert.equal(ck.status, 'fail');
  assert.match(ck.detail, /1 of 2.*a: no Secure, HttpOnly, SameSite/);
  assert.equal(by(grade(inp([['set-cookie', 'a=1; Secure; SameSite=Lax']])), 'cookies').status, 'warn');
  const lk = by(
    grade(
      inp([
        ['server', 'Apache/2.4.41 (Ubuntu)'],
        ['x-powered-by', 'PHP/7.4.3'],
      ]),
    ),
    'leaks',
  );
  assert.equal(lk.status, 'warn');
  assert.match(lk.detail, /Apache\/2\.4\.41.*PHP\/7\.4\.3/);
  assert.equal(by(grade(inp([['server', 'nginx']])), 'leaks').status, 'pass');
  assert.equal(
    by(
      grade(
        inp([
          ['access-control-allow-origin', '*'],
          ['access-control-allow-credentials', 'true'],
        ]),
      ),
      'cors',
    ).status,
    'fail',
  );
  assert.equal(by(grade(inp([['access-control-allow-origin', '*']])), 'cors').status, 'pass');
  assert.equal(by(grade(inp([['content-type', 'application/json']])), 'cache').status, 'info');
});

test('markdown report', () => {
  const r = grade(inp([['content-type', 'text/html']]));
  const md = toMarkdown('https://example.com/', r, new Date('2026-01-02T03:04:00Z'));
  assert.match(md, /^## Security headers: https:\/\/example.com\//);
  assert.match(md, /\*\*Grade [A-F+]+\*\* \(\d+\/100\), checked 2026-01-02 03:04 UTC/);
  assert.match(md, /\| Content-Security-Policy \| FAIL \|/);
  assert.match(md, /### Fixes[\s\S]*X-Content-Type-Options: nosniff/);
});
