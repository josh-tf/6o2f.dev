import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS module
import { tokenize, parse, toFetch, toAxios, toPython, toGo, toPhp, toNode } from '../../../public/_/curl/lib.js';

test('tokenizer: nasty quoting', () => {
  assert.deepEqual(tokenize(`curl 'a b' "c \\"d\\" \\$e \\\\ f" g\\ h 'it'\\''s' $'x\\ny\\t\\'z\\x41\\u00e9' "mix"'ed'`).words, [
    'curl',
    'a b',
    'c "d" $e \\ f',
    'g h',
    "it's",
    "x\ny\t'zAé",
    'mixed',
  ]);
  assert.deepEqual(tokenize('curl -d \'{"a": "x\\\\y"}\'').words, ['curl', '-d', '{"a": "x\\\\y"}']); // backslashes in single quotes are literal
  assert.deepEqual(tokenize('curl \\\n  -X POST \\\r\n  url').words, ['curl', '-X', 'POST', 'url']);
  assert.deepEqual(tokenize('curl ^\n -H x ^\n url').words, ['curl', '-H', 'x', 'url']);
  assert.deepEqual(tokenize('curl url | jq .').words, ['curl', 'url']);
  assert.match(tokenize('curl url | jq .').warnings[0], /after "\|"/);
  assert.match(tokenize('curl -H "Authorization: Bearer $TOKEN" url').warnings[0], /\$TOKEN/);
  assert.throws(() => tokenize("curl 'oops"), /never closed/);
});

test('parse: method inference, headers, data joining, -G, urlencode', () => {
  let r = parse('curl https://x.io -d a=1 -d b=2');
  assert.equal(r.method, 'POST');
  assert.deepEqual(r.headers, [['Content-Type', 'application/x-www-form-urlencoded']]);
  assert.equal(r.body.text, 'a=1&b=2');
  r = parse("curl -G https://x.io/s?q=1 --data-urlencode 'name=J Doe & co' --data-urlencode =x/y");
  assert.equal(r.method, 'GET');
  assert.equal(r.url, 'https://x.io/s?q=1&name=J%20Doe%20%26%20co&x%2Fy');
  assert.equal(r.body, null);
  r = parse("curl -XPUT -H\"X-A: 1\" -H 'X-Empty;' -H 'User-Agent:' -A ua example.com");
  assert.equal(r.method, 'PUT');
  assert.equal(r.url, 'http://example.com');
  assert.deepEqual(r.headers, [
    ['X-A', '1'],
    ['X-Empty', ''],
    ['User-Agent', 'ua'],
  ]);
  r = parse('curl -I https://x.io');
  assert.equal(r.method, 'HEAD');
  r = parse('curl https://x.io --json \'{"a":1}\'');
  assert.deepEqual(r.headers, [
    ['Content-Type', 'application/json'],
    ['Accept', 'application/json'],
  ]);
});

test('parse: combined short flags, auth, cookies, -L -k --compressed, timeouts, unknown flags', () => {
  const r = parse("curl -sSLk -u 'user:p@ss:word' -b 'a=1; b=2' --compressed -m 2.5 --proxy http://p:1 https://x.io");
  assert.deepEqual([r.follow, r.insecure, r.compressed, r.timeout], [true, true, true, 2.5]);
  assert.deepEqual(r.auth, { user: 'user', pass: 'p@ss:word' });
  assert.equal(r.cookies, 'a=1; b=2');
  assert.deepEqual(r.warnings, ['--proxy is not supported and was ignored']);
});

test('parse: data from files, binary keeps newlines, -d strips them, forms', () => {
  assert.equal(parse("curl x.io -d $'a\\nb'").body.text, 'ab');
  assert.equal(parse("curl x.io --data-binary $'a\\nb'").body.text, 'a\nb');
  assert.equal(parse("curl x.io --data-raw '@not-a-file'").body.text, '@not-a-file');
  const f = parse('curl x.io -d @body.json');
  assert.equal(f.body.text, '<contents of body.json>');
  assert.match(f.warnings[0], /body\.json/);
  const m = parse("curl x.io -F 'doc=@\"a.pdf\";type=application/pdf;filename=r.pdf' -F 'note=hi;type=text/plain' --form-string 'raw=@x'");
  assert.deepEqual(m.body.parts, [
    { name: 'doc', file: '"a.pdf"', asText: false, type: 'application/pdf', filename: 'r.pdf' },
    { name: 'note', value: 'hi', type: 'text/plain' },
    { name: 'raw', value: '@x', type: undefined },
  ]);
  assert.throws(() => parse('curl x.io -F a=1 -d b=2'), /-F together with -d/);
  assert.throws(() => parse('wget x.io'), /doesn't start with "curl"/);
  assert.throws(() => parse('curl -H'), /needs a value/);
  assert.throws(() => parse('curl -s'), /No URL/);
});

const REQ = parse(`curl 'https://api.x.io/v1/items' -H 'Content-Type: application/json' --data-raw '{"name":"it\\u0027s","ok":true,"n":null}' -u a:b`);

test('generators produce the right calls', () => {
  assert.match(toFetch(REQ), /body: JSON\.stringify\(\{\n {4}name: "it's",\n {4}ok: true,\n {4}n: null,\n {2}\}\)/);
  assert.match(toFetch(REQ), /Authorization: 'Basic YTpi'/);
  assert.match(toFetch(REQ), /redirect: 'manual'/);
  assert.match(toAxios(REQ), /auth: \{ username: 'a', password: 'b' \}/);
  const py = toPython(REQ);
  assert.match(py, /json_data = \{\n {4}'name': 'it\\'s',\n {4}'ok': True,\n {4}'n': None,\n\}/);
  assert.doesNotMatch(py, /Content-Type/); // requests sets it for json=
  assert.match(py, /auth=\('a', 'b'\)/);
  assert.match(toGo(REQ), /strings\.NewReader\(`\{"name":"it\\u0027s","ok":true,"n":null\}`\)/);
  assert.match(toGo(REQ), /req\.SetBasicAuth\("a", "b"\)/);
  assert.match(toPhp(REQ), /CURLOPT_POSTFIELDS, '\{"name":"it\\\\u0027s","ok":true,"n":null\}'/);
  assert.doesNotMatch(toPhp(REQ), /CUSTOMREQUEST/);
  assert.match(toPhp(parse('curl -X DELETE x.io')), /CURLOPT_CUSTOMREQUEST, 'DELETE'/);
  assert.match(toNode(REQ), /'Content-Length': Buffer\.byteLength\(payload\)/);
  assert.match(toNode(parse('curl http://x.io')), /import http from 'node:http'/);
  assert.match(toPython(parse('curl -X PURGE x.io')), /requests\.request\('PURGE', /);
});

test("review fixes: Chrome's cmd.exe format, invalid URL, arg-taking flags", () => {
  const r = parse('curl ^"https://example.com/api?a=1^&b=2^" ^\n  -H ^"accept: application/json^" ^\n  --data-raw ^"^{^\\^"a^\\^":1^}^"');
  assert.equal(r.url, 'https://example.com/api?a=1&b=2');
  assert.deepEqual(r.headers[0], ['accept', 'application/json']);
  assert.equal(r.body?.text, '{"a":1}');
  assert.throws(() => parse("curl 'http://[bad'"), /not a valid URL/);
  assert.equal(parse("curl --proxy-header 'X: y' https://x.com").url, 'https://x.com');
});
