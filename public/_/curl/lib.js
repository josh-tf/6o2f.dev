// curl command parser and code generators (fetch, axios, Python requests, Go net/http, PHP curl, Node https).
// Pure functions, no DOM. The tokenizer follows POSIX shell quoting: '...', "...", $'...', backslashes,
// and line continuations (\ for bash, ^ for cmd.exe, ` for PowerShell).

export class CurlError extends Error {}

/** Split a shell command line into words. Stops at |, ;, && or || (warning about the rest). */
export function tokenize(src) {
  const words = [],
    warnings = [];
  let i = 0,
    cur = null;
  // line continuations: bash \, cmd.exe ^, PowerShell ` at the end of a line (removed, as the shell does)
  let s = src.replace(/\r\n?/g, '\n').replace(/[\\^`]\n/g, '');
  // cmd.exe quoting (Chrome's "Copy as cURL (cmd)"): ^ escapes the next character, ^"…^" wraps each argument
  if (/\^"/.test(s)) s = s.replace(/\^([\s\S])/g, '$1');
  const n = s.length;
  const push = () => {
    if (cur !== null) words.push(cur);
    cur = null;
  };
  while (i < n) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      push();
      i++;
      continue;
    }
    if (cur === null && c === '#') {
      const e = s.indexOf('\n', i);
      i = e < 0 ? n : e;
      continue;
    }
    if (cur === null && (c === '|' || c === ';' || (c === '&' && s[i + 1] === '&'))) {
      if (
        s
          .slice(i)
          .trim()
          .replace(/^[|;&]+/, '')
          .trim()
      )
        warnings.push(`Ignored everything after "${c === '&' ? '&&' : c}"`);
      break;
    }
    if (c === "'") {
      const e = s.indexOf("'", i + 1);
      if (e < 0) throw new CurlError('A single quote is never closed');
      cur = (cur ?? '') + s.slice(i + 1, e);
      i = e + 1;
      continue;
    }
    if (c === '$' && s[i + 1] === "'") {
      // ANSI-C quoting, used by Chrome's "Copy as cURL"
      let j = i + 2,
        out = '';
      for (;;) {
        if (j >= n) throw new CurlError("A $'...' string is never closed");
        const d = s[j];
        if (d === "'") break;
        if (d !== '\\') {
          out += d;
          j++;
          continue;
        }
        const e = s[j + 1];
        const simple = { n: '\n', t: '\t', r: '\r', a: '\x07', b: '\b', e: '\x1b', E: '\x1b', f: '\f', v: '\v', '\\': '\\', "'": "'", '"': '"', '?': '?' };
        if (e in simple) {
          out += simple[e];
          j += 2;
          continue;
        }
        let m;
        if ((m = /^x([0-9a-fA-F]{1,2})/.exec(s.slice(j + 1)))) {
          out += String.fromCharCode(parseInt(m[1], 16));
          j += 1 + m[0].length;
          continue;
        }
        if ((m = /^u([0-9a-fA-F]{1,4})/.exec(s.slice(j + 1))) || (m = /^U([0-9a-fA-F]{1,8})/.exec(s.slice(j + 1)))) {
          out += String.fromCodePoint(parseInt(m[1], 16));
          j += 1 + m[0].length;
          continue;
        }
        if ((m = /^[0-7]{1,3}/.exec(s.slice(j + 1)))) {
          out += String.fromCharCode(parseInt(m[0], 8));
          j += 1 + m[0].length;
          continue;
        }
        out += '\\' + (e ?? '');
        j += 2;
      }
      cur = (cur ?? '') + out;
      i = j + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1,
        out = '';
      for (;;) {
        if (j >= n) throw new CurlError('A double quote is never closed');
        const d = s[j];
        if (d === '"') break;
        if (d === '\\' && '$`"\\\n'.includes(s[j + 1])) {
          if (s[j + 1] !== '\n') out += s[j + 1];
          j += 2;
          continue;
        }
        if (d === '$' && /[A-Za-z_{(]/.test(s[j + 1] ?? ''))
          warnings.push(`Shell variable or substitution "${/^\$(\{[^}]*\}|\([^)]*\)|\w+)/.exec(s.slice(j))?.[0] ?? '$'}" was kept literally`);
        out += d;
        j++;
      }
      cur = (cur ?? '') + out;
      i = j + 1;
      continue;
    }
    if (c === '\\') {
      cur = (cur ?? '') + (s[i + 1] ?? '');
      i += 2;
      continue;
    }
    if (c === '$' && /[A-Za-z_{(]/.test(s[i + 1] ?? ''))
      warnings.push(`Shell variable or substitution "${/^\$(\{[^}]*\}|\([^)]*\)|\w+)/.exec(s.slice(i))?.[0] ?? '$'}" was kept literally`);
    cur = (cur ?? '') + c;
    i++;
  }
  push();
  return { words, warnings: [...new Set(warnings)] };
}

// option name -> canonical long name; true = takes an argument
const SHORT = {
  X: 'request',
  H: 'header',
  d: 'data',
  F: 'form',
  u: 'user',
  b: 'cookie',
  L: 'location',
  k: 'insecure',
  G: 'get',
  I: 'head',
  A: 'user-agent',
  e: 'referer',
  m: 'max-time',
  o: 'output',
  O: 'remote-name',
  s: 'silent',
  S: 'show-error',
  v: 'verbose',
  i: 'include',
  f: 'fail',
  T: 'upload-file',
  x: 'proxy',
  '#': 'progress-bar',
  E: 'cert',
  0: 'http1.0',
  4: 'ipv4',
  6: 'ipv6',
  N: 'no-buffer',
  g: 'globoff',
  w: 'write-out',
  D: 'dump-header',
  c: 'cookie-jar',
  J: 'remote-header-name',
  K: 'config',
  r: 'range',
  Y: 'speed-limit',
  y: 'speed-time',
  z: 'time-cond',
  C: 'continue-at',
  q: 'disable',
  U: 'proxy-user',
  n: 'netrc',
  j: 'junk-session-cookies',
  R: 'remote-time',
  Z: 'parallel',
  l: 'list-only',
  a: 'append',
  B: 'use-ascii',
  M: 'manual',
  P: 'ftp-port',
  p: 'proxytunnel',
  Q: 'quote',
  t: 'telnet-option',
  V: 'version',
  h: 'help',
};
const ARG = new Set([
  'request',
  'header',
  'data',
  'data-raw',
  'data-binary',
  'data-ascii',
  'data-urlencode',
  'json',
  'form',
  'form-string',
  'user',
  'cookie',
  'user-agent',
  'referer',
  'max-time',
  'connect-timeout',
  'output',
  'upload-file',
  'proxy',
  'url',
  'oauth2-bearer',
  'cert',
  'key',
  'cacert',
  'write-out',
  'dump-header',
  'cookie-jar',
  'config',
  'range',
  'speed-limit',
  'speed-time',
  'time-cond',
  'continue-at',
  'proxy-user',
  'ftp-port',
  'quote',
  'telnet-option',
  'retry',
  'retry-delay',
  'retry-max-time',
  'max-redirs',
  'resolve',
  'connect-to',
  'interface',
  'limit-rate',
  'max-filesize',
  'output-dir',
  'trace',
  'trace-ascii',
  'unix-socket',
  'abstract-unix-socket',
  'aws-sigv4',
  'variable',
  'expand-url',
  'expand-data',
  'stderr',
  'request-target',
  'happy-eyeballs-timeout-ms',
  'keepalive-time',
  'dns-servers',
  'local-port',
  'tls-max',
  'ciphers',
  'pass',
  'key-type',
  'cert-type',
  'capath',
  'pinnedpubkey',
  'proto',
  'proto-redir',
  'netrc-file',
  'ftp-method',
  'preproxy',
  'socks5',
  'socks5-hostname',
  'socks4',
  'socks4a',
  'url-query',
  'proxy-header',
  'proxy-cacert',
  'proxy-cert',
  'proxy-key',
  'proxy-pass',
  'mail-from',
  'mail-rcpt',
  'doh-url',
  'etag-save',
  'etag-compare',
  'alt-svc',
  'hsts',
  'login-options',
  'sasl-authzid',
  'service-name',
  'crlfile',
  'pubkey',
  'hostpubsha256',
  'hostpubmd5',
  'curves',
  'tls13-ciphers',
  'parallel-max',
  'rate',
  'ip-tos',
  'krb',
  'delegation',
  'engine',
  'form-escape',
  'dns-interface',
  'dns-ipv4-addr',
  'dns-ipv6-addr',
]);
// accepted and harmless for generated code (output / progress / transport details)
const QUIET = new Set([
  'silent',
  'show-error',
  'verbose',
  'include',
  'output',
  'remote-name',
  'progress-bar',
  'no-progress-meter',
  'http1.1',
  'http1.0',
  'http2',
  'http2-prior-knowledge',
  'http3',
  'ipv4',
  'ipv6',
  'no-buffer',
  'globoff',
  'write-out',
  'dump-header',
  'remote-header-name',
  'stderr',
  'trace',
  'trace-ascii',
  'retry',
  'retry-delay',
  'retry-max-time',
  'tcp-nodelay',
  'no-keepalive',
  'keepalive-time',
  'fail',
  'fail-with-body',
  'create-dirs',
  'output-dir',
  'remote-time',
  'styled-output',
  'no-styled-output',
  'max-redirs',
  'path-as-is',
  'tlsv1.2',
  'tlsv1.3',
  'tls-max',
  'no-alpn',
  'no-npn',
  'raw',
]);

/**
 * Parse a curl command. Returns { method, url, headers: [[name, value]], body, auth, cookies, insecure, follow,
 * compressed, timeout, warnings } where body is null | { kind: 'raw', text } | { kind: 'form', parts: [{ name, value?, file?, type?, filename? }] }.
 */
export function parse(cmd) {
  const { words, warnings } = tokenize(cmd.trim().replace(/^\$\s+/, ''));
  if (!words.length) throw new CurlError('Paste a curl command');
  if (!/^curl(\.exe)?$/i.test(words[0].split(/[\\/]/).pop())) throw new CurlError(`This doesn't start with "curl" (found "${words[0].slice(0, 30)}")`);
  const r = {
    method: null,
    url: null,
    headers: [],
    data: [],
    form: [],
    auth: null,
    cookies: null,
    insecure: false,
    follow: false,
    compressed: false,
    timeout: null,
    get: false,
    head: false,
    upload: null,
    json: false,
    warnings,
  };
  const warn = (m) => {
    if (!r.warnings.includes(m)) r.warnings.push(m);
  };
  const urls = [];
  const handle = (name, val) => {
    switch (name) {
      case 'request':
        r.method = val.toUpperCase();
        break;
      case 'header': {
        if (val.startsWith('@')) {
          warn(`Headers from file ${val} can't be read; ignored`);
          break;
        }
        const c = val.indexOf(':');
        if (c < 0) {
          if (val.endsWith(';')) r.headers.push([val.slice(0, -1).trim(), '']);
          else warn(`Header "${val}" has no ":"; ignored`);
          break;
        }
        const v = val.slice(c + 1).trim();
        if (!v) {
          r.headers = r.headers.filter(([k]) => k.toLowerCase() !== val.slice(0, c).trim().toLowerCase());
          break;
        } // "Name:" removes a header in curl
        r.headers.push([val.slice(0, c).trim(), v]);
        break;
      }
      case 'data':
      case 'data-ascii':
      case 'data-binary': {
        if (val.startsWith('@')) {
          warn(`Body is read from file "${val.slice(1)}" by curl; the code uses a placeholder`);
          r.data.push(`<contents of ${val.slice(1)}>`);
          break;
        }
        r.data.push(name === 'data-binary' ? val : val.replace(/[\r\n]/g, ''));
        break;
      }
      case 'data-raw':
        r.data.push(val);
        break;
      case 'json':
        r.json = true;
        r.data.push(
          val.startsWith('@') ? (warn(`JSON is read from file "${val.slice(1)}"; the code uses a placeholder`), `<contents of ${val.slice(1)}>`) : val,
        );
        break;
      case 'data-urlencode': {
        const m = /^([^=@]*)([=@])([\s\S]*)$/.exec(val);
        if (!m) r.data.push(encodeURIComponent(val));
        else if (m[2] === '@') {
          warn(`--data-urlencode reads file "${m[3]}"; the code uses a placeholder`);
          r.data.push(`${m[1] ? m[1] + '=' : ''}<urlencoded contents of ${m[3]}>`);
        } else r.data.push(m[1] ? `${m[1]}=${encodeURIComponent(m[3])}` : encodeURIComponent(m[3]));
        break;
      }
      case 'form':
      case 'form-string': {
        const e = val.indexOf('=');
        if (e < 0) {
          warn(`Form field "${val}" has no "="; ignored`);
          break;
        }
        const fname = val.slice(0, e),
          rest = val.slice(e + 1);
        if (name === 'form' && (rest.startsWith('@') || rest.startsWith('<'))) {
          const [path, ...attrs] = rest.slice(1).split(';');
          const part = { name: fname, file: path, asText: rest[0] === '<' };
          for (const a of attrs) {
            const [k, v] = a.split('=');
            if (k.trim() === 'type') part.type = v;
            else if (k.trim() === 'filename') part.filename = v;
          }
          r.form.push(part);
        } else {
          let value = rest,
            type;
          if (name === 'form') {
            const m = /^(.*?);type=([^;]+)$/.exec(rest);
            if (m) {
              value = m[1];
              type = m[2];
            }
          }
          r.form.push({ name: fname, value, type });
        }
        break;
      }
      case 'user': {
        const c = val.indexOf(':');
        r.auth = c < 0 ? { user: val, pass: '' } : { user: val.slice(0, c), pass: val.slice(c + 1) };
        if (c < 0) warn('curl would prompt for the password; it is left empty');
        break;
      }
      case 'oauth2-bearer':
        r.headers.push(['Authorization', `Bearer ${val}`]);
        break;
      case 'cookie':
        if (!val.includes('=')) warn(`Cookies from file "${val}" can't be read; ignored`);
        else r.cookies = (r.cookies ? r.cookies + '; ' : '') + val;
        break;
      case 'user-agent':
        r.headers.push(['User-Agent', val]);
        break;
      case 'referer':
        r.headers.push(['Referer', val.replace(/;auto$/, '')]);
        break;
      case 'location':
      case 'location-trusted':
        r.follow = true;
        break;
      case 'insecure':
        r.insecure = true;
        break;
      case 'compressed':
        r.compressed = true;
        break;
      case 'get':
        r.get = true;
        break;
      case 'head':
        r.head = true;
        break;
      case 'max-time':
        r.timeout = Number(val);
        if (!(r.timeout > 0)) {
          warn(`--max-time "${val}" is not a number of seconds; ignored`);
          r.timeout = null;
        }
        break;
      case 'connect-timeout':
        warn('--connect-timeout is not converted (only the total --max-time is)');
        break;
      case 'url':
        urls.push(val);
        break;
      case 'upload-file':
        r.upload = val;
        warn(`--upload-file sends "${val}" from disk; the code uses a placeholder body`);
        break;
      case 'url-query':
        r.query = (r.query ? r.query + '&' : '') + val;
        break;
      default:
        if (!QUIET.has(name)) warn(`--${name} is not supported and was ignored`);
    }
  };
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w === '--') {
      urls.push(...words.slice(i + 1));
      break;
    }
    if (w.startsWith('--') && w.length > 2) {
      let name = w.slice(2);
      if (name.startsWith('no-') && !ARG.has(name) && !QUIET.has(name)) {
        // --no-location etc.
        const base = name.slice(3);
        if (base === 'location') r.follow = false;
        else if (base === 'insecure') r.insecure = false;
        else if (base === 'compressed') r.compressed = false;
        continue;
      }
      if (ARG.has(name)) {
        if (i + 1 >= words.length) throw new CurlError(`--${name} needs a value`);
        handle(name, words[++i]);
      } else handle(name, '');
      continue;
    }
    if (w.startsWith('-') && w.length > 1) {
      for (let j = 1; j < w.length; j++) {
        const name = SHORT[w[j]];
        if (!name) {
          warn(`-${w[j]} is not a known curl option; ignored`);
          continue;
        }
        if (ARG.has(name)) {
          let val = w.slice(j + 1);
          if (!val) {
            if (i + 1 >= words.length) throw new CurlError(`-${w[j]} needs a value`);
            val = words[++i];
          }
          handle(name, val);
          break;
        }
        handle(name, '');
      }
      continue;
    }
    urls.push(w);
  }
  if (!urls.length) throw new CurlError('No URL found in the command');
  if (urls.length > 1) warn(`Only the first of ${urls.length} URLs is converted`);
  let url = urls[0];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    url = 'http://' + url;
    warn('The URL has no scheme; curl assumes http://');
  }
  if (r.query) url += (url.includes('?') ? '&' : '?') + r.query;
  try {
    new URL(url);
  } catch {
    throw new CurlError(`"${url.slice(0, 80)}" is not a valid URL`);
  }
  const hasHeader = (h) => r.headers.some(([k]) => k.toLowerCase() === h);
  let body = null;
  if (r.form.length && r.data.length) throw new CurlError('curl does not allow -F together with -d');
  if (r.get && r.data.length) {
    url += (url.includes('?') ? '&' : '?') + r.data.join('&');
  } else if (r.data.length) {
    body = { kind: 'raw', text: r.data.join('&') };
    if (r.json) {
      body.text = r.data.join('');
      if (!hasHeader('content-type')) r.headers.push(['Content-Type', 'application/json']);
      if (!hasHeader('accept')) r.headers.push(['Accept', 'application/json']);
    } else if (!hasHeader('content-type')) r.headers.push(['Content-Type', 'application/x-www-form-urlencoded']);
  } else if (r.form.length) body = { kind: 'form', parts: r.form };
  else if (r.upload) body = { kind: 'raw', text: `<contents of ${r.upload}>` };
  const method = r.method ?? (r.head ? 'HEAD' : r.upload ? 'PUT' : r.get ? 'GET' : body ? 'POST' : 'GET');
  if (r.method && r.head && r.method !== 'HEAD') warn('-I and -X disagree; -X wins');
  return {
    method,
    url,
    headers: r.headers,
    body,
    auth: r.auth,
    cookies: r.cookies,
    insecure: r.insecure,
    follow: r.follow,
    compressed: r.compressed,
    timeout: r.timeout,
    warnings: r.warnings,
  };
}

// ---------- helpers ----------
const header = (req, name) => req.headers.find(([k]) => k.toLowerCase() === name)?.[1];
/** The body as a JSON value when the content type says JSON and it parses; otherwise undefined. */
export function jsonBody(req) {
  if (req.body?.kind !== 'raw' || !/json/i.test(header(req, 'content-type') ?? '')) return undefined;
  try {
    return JSON.parse(req.body.text);
  } catch {
    return undefined;
  }
}
const jsStr = (s) => {
  s = String(s);
  const q = s.includes("'") && !s.includes('"') ? '"' : "'"; // "it's" rather than 'it\'s'
  return (
    q +
    s.replace(/[\\'"\n\r\t\u2028\u2029]|[\u0000-\u001f]/g, (c) =>
      c === '"' || c === "'"
        ? c === q
          ? '\\' + c
          : c
        : ({ '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' }[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`),
    ) +
    q
  );
};
const jsKey = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : jsStr(k));
function jsLit(v, d = 0) {
  const pad = '  '.repeat(d + 1),
    end = '  '.repeat(d);
  if (Array.isArray(v)) {
    const flat = v.every((x) => x === null || typeof x !== 'object') && v.map((x) => jsLit(x)).join(', ');
    return !v.length ? '[]' : flat && flat.length <= 60 ? `[${flat}]` : `[\n${v.map((x) => pad + jsLit(x, d + 1)).join(',\n')},\n${end}]`;
  }
  if (v && typeof v === 'object') {
    const e = Object.entries(v);
    return e.length ? `{\n${e.map(([k, x]) => `${pad}${jsKey(k)}: ${jsLit(x, d + 1)}`).join(',\n')},\n${end}}` : '{}';
  }
  return typeof v === 'string' ? jsStr(v) : JSON.stringify(v);
}
const pyStr = (s) =>
  `'${String(s).replace(/[\\'\n\r\t]|[\u0000-\u001f]/g, (c) => ({ '\\': '\\\\', "'": "\\'", '\n': '\\n', '\r': '\\r', '\t': '\\t' })[c] ?? `\\x${c.charCodeAt(0).toString(16).padStart(2, '0')}`)}'`;
function pyLit(v, d = 0) {
  const pad = '    '.repeat(d + 1),
    end = '    '.repeat(d);
  if (Array.isArray(v)) {
    const flat = v.every((x) => x === null || typeof x !== 'object') && v.map((x) => pyLit(x)).join(', ');
    return !v.length ? '[]' : flat && flat.length <= 60 ? `[${flat}]` : `[\n${v.map((x) => pad + pyLit(x, d + 1)).join(',\n')},\n${end}]`;
  }
  if (v && typeof v === 'object') {
    const e = Object.entries(v);
    return e.length ? `{\n${e.map(([k, x]) => `${pad}${pyStr(k)}: ${pyLit(x, d + 1)}`).join(',\n')},\n${end}}` : '{}';
  }
  if (v === null) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  return typeof v === 'string' ? pyStr(v) : JSON.stringify(v);
}
const goStr = (s) => (/[`\r]/.test(s) || !/["\\\n]/.test(s) ? JSON.stringify(String(s)) : '`' + s + '`');
const phpStr = (s) => `'${String(s).replace(/[\\']/g, (c) => '\\' + c)}'`;
const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
/** Headers as one list, with auth and cookies folded in where a language has no separate option. */
function allHeaders(req, { auth = true, cookies = true } = {}) {
  const h = [...req.headers];
  if (auth && req.auth) h.push(['Authorization', `Basic ${b64(`${req.auth.user}:${req.auth.pass}`)}`]);
  if (cookies && req.cookies) h.push(['Cookie', req.cookies]);
  return h;
}
const dedupe = (h) => {
  const m = new Map();
  for (const [k, v] of h) {
    const key = [...m.keys()].find((x) => x.toLowerCase() === k.toLowerCase()) ?? k;
    m.set(key, m.has(key) ? `${m.get(key)}${key.toLowerCase() === 'cookie' ? '; ' : ', '}${v}` : v);
  }
  return [...m];
};

// ---------- generators ----------
export function toFetch(req) {
  const notes = [],
    json = jsonBody(req),
    lines = [];
  const h = dedupe(allHeaders(req));
  const opts = [];
  if (req.method !== 'GET') opts.push(`method: ${jsStr(req.method)}`);
  if (h.length) opts.push(`headers: {\n${h.map(([k, v]) => `    ${jsKey(k)}: ${jsStr(v)}`).join(',\n')},\n  }`);
  if (req.body?.kind === 'form') {
    lines.push('const form = new FormData();');
    for (const p of req.body.parts)
      lines.push(
        p.file !== undefined
          ? `form.append(${jsStr(p.name)}, fileInput.files[0]${p.filename ? `, ${jsStr(p.filename)}` : ''}); // ${p.asText ? 'text of' : 'file'} ${p.file}`
          : `form.append(${jsStr(p.name)}, ${jsStr(p.value)});`,
      );
    lines.push('');
    opts.push('body: form');
  } else if (req.body) opts.push(`body: ${json !== undefined ? `JSON.stringify(${jsLit(json, 1)})` : jsStr(req.body.text)}`);
  if (!req.follow) opts.push("redirect: 'manual'");
  if (req.timeout) opts.push(`signal: AbortSignal.timeout(${req.timeout * 1000})`);
  if (req.insecure) notes.push('// fetch cannot skip TLS verification (curl -k); in Node use NODE_TLS_REJECT_UNAUTHORIZED=0 only for testing');
  if (req.cookies) notes.push('// Browsers do not let fetch set the Cookie header; it works in Node and Deno');
  lines.push(...notes);
  lines.push(`const res = await fetch(${jsStr(req.url)}${opts.length ? `, {\n  ${opts.join(',\n  ')},\n}` : ''});`);
  lines.push(
    req.method === 'HEAD'
      ? 'console.log(res.status, Object.fromEntries(res.headers));'
      : `const data = await res.${/json/i.test(header(req, 'accept') ?? '') || json !== undefined ? 'json' : 'text'}();\nconsole.log(res.status, data);`,
  );
  return lines.join('\n') + '\n';
}

export function toAxios(req) {
  const json = jsonBody(req),
    pre = ["import axios from 'axios';"];
  const h = dedupe(allHeaders(req, { auth: false }));
  const o = [`method: ${jsStr(req.method.toLowerCase())}`, `url: ${jsStr(req.url)}`];
  if (h.length) o.push(`headers: {\n${h.map(([k, v]) => `    ${jsKey(k)}: ${jsStr(v)}`).join(',\n')},\n  }`);
  if (req.auth) o.push(`auth: { username: ${jsStr(req.auth.user)}, password: ${jsStr(req.auth.pass)} }`);
  const body = [];
  if (req.body?.kind === 'form') {
    pre.push("import fs from 'node:fs';");
    body.push('const form = new FormData();');
    for (const p of req.body.parts)
      body.push(
        p.file !== undefined
          ? `form.append(${jsStr(p.name)}, new Blob([fs.readFileSync(${jsStr(p.file)})]${p.type ? `, { type: ${jsStr(p.type)} }` : ''}), ${jsStr(p.filename ?? p.file.split('/').pop())});`
          : `form.append(${jsStr(p.name)}, ${jsStr(p.value)});`,
      );
    body.push('');
    o.push('data: form');
  } else if (req.body) o.push(`data: ${json !== undefined ? jsLit(json, 1) : jsStr(req.body.text)}`);
  if (!req.follow) o.push('maxRedirects: 0'); // curl does not follow redirects without -L
  if (req.timeout) o.push(`timeout: ${req.timeout * 1000}`);
  if (req.insecure) {
    pre.push("import https from 'node:https';");
    o.push('httpsAgent: new https.Agent({ rejectUnauthorized: false })');
  }
  if (req.compressed) o.push('decompress: true');
  o.push('validateStatus: () => true');
  return `${pre.join('\n')}\n\n${body.length ? body.join('\n') + '\n' : ''}const res = await axios({\n  ${o.join(',\n  ')},\n});\nconsole.log(res.status, res.data);\n`;
}

export function toPython(req) {
  const json = jsonBody(req),
    out = ['import requests', ''];
  const h = dedupe(allHeaders(req, { auth: false, cookies: false })).filter(
    ([k]) => !(json !== undefined && k.toLowerCase() === 'content-type' && /^application\/json\b/i.test(header(req, 'content-type'))),
  );
  const args = [pyStr(req.url)];
  if (h.length) {
    out.push(`headers = {\n${h.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`).join('\n')}\n}\n`);
    args.push('headers=headers');
  }
  if (req.cookies) {
    const c = req.cookies
      .split(';')
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const e = x.indexOf('=');
        return [x.slice(0, e), x.slice(e + 1)];
      });
    out.push(`cookies = {\n${c.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`).join('\n')}\n}\n`);
    args.push('cookies=cookies');
  }
  if (req.body?.kind === 'form') {
    const files = req.body.parts.filter((p) => p.file !== undefined && !p.asText),
      data = req.body.parts.filter((p) => p.file === undefined || p.asText);
    if (data.length) {
      out.push(`data = {\n${data.map((p) => `    ${pyStr(p.name)}: ${p.asText ? `open(${pyStr(p.file)}).read()` : pyStr(p.value)},`).join('\n')}\n}\n`);
      args.push('data=data');
    }
    if (files.length) {
      out.push(
        `files = {\n${files.map((p) => `    ${pyStr(p.name)}: (${pyStr(p.filename ?? p.file.split('/').pop())}, open(${pyStr(p.file)}, 'rb')${p.type ? `, ${pyStr(p.type)}` : ''}),`).join('\n')}\n}\n`,
      );
      args.push('files=files');
    }
    if (!files.length) {
      out.push('# curl -F always sends multipart; requests needs files= for that');
    }
  } else if (req.body) {
    if (json !== undefined) {
      out.push(`json_data = ${pyLit(json)}\n`);
      args.push('json=json_data');
    } else {
      out.push(`data = ${pyStr(req.body.text)}.encode()\n`);
      args.push('data=data');
    }
  }
  if (req.auth) args.push(`auth=(${pyStr(req.auth.user)}, ${pyStr(req.auth.pass)})`);
  if (req.insecure) args.push('verify=False');
  if (!req.follow && req.method !== 'HEAD') args.push('allow_redirects=False');
  if (req.follow && req.method === 'HEAD') args.push('allow_redirects=True');
  if (req.timeout) args.push(`timeout=${req.timeout}`);
  const fn = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(req.method) ? req.method.toLowerCase() : null;
  const call = fn ? `requests.${fn}(` : `requests.request(${pyStr(req.method)}, `;
  const oneLine = `response = ${call}${args.join(', ')})`;
  out.push(oneLine.length <= 88 ? oneLine : `response = ${call}\n    ${args.join(',\n    ')},\n)`);
  out.push(req.method === 'HEAD' ? 'print(response.status_code, response.headers)' : 'print(response.status_code, response.text)');
  return out.join('\n') + '\n';
}

export function toGo(req) {
  const imports = new Set(['fmt', 'io', 'log', 'net/http']),
    pre = [],
    setup = [];
  let bodyVar = 'nil';
  if (req.body?.kind === 'form') {
    imports.add('bytes');
    imports.add('mime/multipart');
    pre.push('body := &bytes.Buffer{}', 'mw := multipart.NewWriter(body)');
    for (const p of req.body.parts) {
      if (p.file !== undefined) {
        imports.add('os');
        pre.push(
          `{`,
          `\tf, err := os.Open(${goStr(p.file)})`,
          '\tif err != nil {',
          '\t\tlog.Fatal(err)',
          '\t}',
          `\tw, _ := mw.CreateFormFile(${goStr(p.name)}, ${goStr(p.filename ?? p.file.split('/').pop())})`,
          '\tio.Copy(w, f)',
          '\tf.Close()',
          '}',
        );
        if (p.type) pre.push(`// curl also sends Content-Type ${p.type} for "${p.name}"; build the part with mw.CreatePart to keep it`);
      } else pre.push(`mw.WriteField(${goStr(p.name)}, ${goStr(p.value)})`);
    }
    pre.push('mw.Close()');
    bodyVar = 'body';
  } else if (req.body) {
    imports.add('strings');
    pre.push(`body := strings.NewReader(${goStr(req.body.text)})`);
    bodyVar = 'body';
  }
  for (const [k, v] of allHeaders(req, { auth: false }))
    setup.push(`req.Header.${setup.some((l) => l.includes(`Set(${goStr(k)}`)) ? 'Add' : 'Set'}(${goStr(k)}, ${goStr(v)})`);
  if (req.body?.kind === 'form') setup.push('req.Header.Set("Content-Type", mw.FormDataContentType())');
  if (req.auth) setup.push(`req.SetBasicAuth(${goStr(req.auth.user)}, ${goStr(req.auth.pass)})`);
  const client = [];
  if (!req.follow) client.push('CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }, // like curl without -L');
  if (req.timeout) {
    imports.add('time');
    client.push(`Timeout: ${Number.isInteger(req.timeout) ? `${req.timeout} * time.Second` : `${Math.round(req.timeout * 1000)} * time.Millisecond`},`);
  }
  if (req.insecure) {
    imports.add('crypto/tls');
    client.push('Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},');
  }
  const body = [
    ...pre,
    `req, err := http.NewRequest(${goStr(req.method)}, ${goStr(req.url)}, ${bodyVar})`,
    'if err != nil {',
    '\tlog.Fatal(err)',
    '}',
    ...setup,
    client.length ? `client := &http.Client{\n${client.map((c) => '\t' + c).join('\n')}\n}` : 'client := &http.Client{}',
    'resp, err := client.Do(req)',
    'if err != nil {',
    '\tlog.Fatal(err)',
    '}',
    'defer resp.Body.Close()',
    'b, err := io.ReadAll(resp.Body)',
    'if err != nil {',
    '\tlog.Fatal(err)',
    '}',
    'fmt.Println(resp.Status)',
    'fmt.Println(string(b))',
  ];
  return `package main\n\nimport (\n${[...imports]
    .sort()
    .map((i) => `\t"${i}"`)
    .join('\n')}\n)\n\nfunc main() {\n${body
    .join('\n')
    .split('\n')
    .map((l) => '\t' + l)
    .join('\n')}\n}\n`;
}

export function toPhp(req) {
  const o = [`curl_setopt($ch, CURLOPT_URL, ${phpStr(req.url)});`, 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);'];
  if (req.method === 'HEAD') o.push('curl_setopt($ch, CURLOPT_NOBODY, true);');
  else if (req.body ? req.method !== 'POST' : req.method !== 'GET') o.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(req.method)});`);
  const h = req.headers;
  if (h.length) o.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${h.map(([k, v]) => `    ${phpStr(`${k}: ${v}`)},`).join('\n')}\n]);`);
  if (req.body?.kind === 'form')
    o.push(
      `curl_setopt($ch, CURLOPT_POSTFIELDS, [\n${req.body.parts.map((p) => `    ${phpStr(p.name)} => ${p.file !== undefined ? (p.asText ? `file_get_contents(${phpStr(p.file)})` : `new CURLFile(${phpStr(p.file)}${p.type || p.filename ? `, ${phpStr(p.type ?? '')}` : ''}${p.filename ? `, ${phpStr(p.filename)}` : ''})`) : phpStr(p.value)},`).join('\n')}\n]);`,
    );
  else if (req.body) o.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpStr(req.body.text)});`);
  if (req.auth) o.push(`curl_setopt($ch, CURLOPT_USERPWD, ${phpStr(`${req.auth.user}:${req.auth.pass}`)});`);
  if (req.cookies) o.push(`curl_setopt($ch, CURLOPT_COOKIE, ${phpStr(req.cookies)});`);
  if (req.follow) o.push('curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);');
  if (req.insecure) o.push('curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);', 'curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);');
  if (req.compressed) o.push("curl_setopt($ch, CURLOPT_ENCODING, '');");
  if (req.timeout)
    o.push(
      Number.isInteger(req.timeout)
        ? `curl_setopt($ch, CURLOPT_TIMEOUT, ${req.timeout});`
        : `curl_setopt($ch, CURLOPT_TIMEOUT_MS, ${Math.round(req.timeout * 1000)});`,
    );
  return `<?php\n\n$ch = curl_init();\n${o.join('\n')}\n\n$response = curl_exec($ch);\nif ($response === false) {\n    echo 'Error: ' . curl_error($ch);\n} else {\n    echo curl_getinfo($ch, CURLINFO_RESPONSE_CODE), "\\n", $response;\n}\ncurl_close($ch);\n`;
}

export function toNode(req) {
  const u = new URL(req.url),
    mod = u.protocol === 'http:' ? 'http' : 'https';
  const pre = [`import ${mod} from 'node:${mod}';`],
    notes = [],
    body = [];
  const h = dedupe(allHeaders(req, { auth: false }));
  let write = null;
  if (req.body?.kind === 'form') {
    if (req.body.parts.some((p) => p.file !== undefined)) pre.push("import fs from 'node:fs';");
    body.push("const boundary = '----curlconvert' + Math.random().toString(16).slice(2);", 'const payload = Buffer.concat([');
    for (const p of req.body.parts) {
      const disp = `Content-Disposition: form-data; name="${p.name.replace(/"/g, '%22')}"${p.file !== undefined && !p.asText ? `; filename="${(p.filename ?? p.file.split('/').pop()).replace(/"/g, '%22')}"` : ''}`;
      const type = p.type ? `\\r\\nContent-Type: ${p.type}` : p.file !== undefined && !p.asText ? '\\r\\nContent-Type: application/octet-stream' : '';
      body.push(`  Buffer.from(\`--\${boundary}\\r\\n${disp.replace(/[`\\$]/g, '\\$&')}${type}\\r\\n\\r\\n\`),`);
      body.push(`  ${p.file !== undefined ? `fs.readFileSync(${jsStr(p.file)})` : `Buffer.from(${jsStr(p.value)})`},`, "  Buffer.from('\\r\\n'),");
    }
    body.push('  Buffer.from(`--${boundary}--\\r\\n`),', ']);', '');
    h.push(['Content-Type', '`multipart/form-data; boundary=${boundary}`']);
    write = 'payload';
  } else if (req.body) {
    const json = jsonBody(req);
    body.push(`const payload = ${json !== undefined ? `JSON.stringify(${jsLit(json)})` : jsStr(req.body.text)};`, '');
    write = 'payload';
  }
  if (write) h.push(['Content-Length', 'Buffer.byteLength(payload)']);
  const val = (k, v) => (k === 'Content-Length' || v.startsWith('`multipart') ? v : jsStr(v));
  const o = [`method: ${jsStr(req.method)}`];
  if (h.length) o.push(`headers: {\n${h.map(([k, v]) => `    ${jsKey(k)}: ${val(k, v)}`).join(',\n')},\n  }`);
  if (req.auth) o.push(`auth: ${jsStr(`${req.auth.user}:${req.auth.pass}`)}`);
  if (req.insecure && mod === 'https') o.push('rejectUnauthorized: false');
  if (req.timeout) o.push(`timeout: ${req.timeout * 1000}`);
  if (req.follow) notes.push(`// ${mod}.request does not follow redirects (curl -L); check res.headers.location yourself`);
  if (req.compressed) notes.push('// The response is not decompressed automatically (curl --compressed); pipe through zlib.createGunzip() if needed');
  const code = [
    ...body,
    ...notes,
    `const req = ${mod}.request(${jsStr(req.url)}, {\n  ${o.join(',\n  ')},\n}, (res) => {`,
    "  let data = '';",
    "  res.setEncoding('utf8');",
    "  res.on('data', (chunk) => (data += chunk));",
    "  res.on('end', () => console.log(res.statusCode, data));",
    '});',
    "req.on('error', (err) => console.error(err));",
    ...(req.timeout ? ["req.on('timeout', () => req.destroy(new Error('timeout')));"] : []),
    ...(write ? [`req.write(${write});`] : []),
    'req.end();',
  ];
  return `${pre.join('\n')}\n\n${code.join('\n')}\n`;
}

export const TARGETS = {
  fetch: ['fetch', toFetch],
  axios: ['axios', toAxios],
  python: ['Python requests', toPython],
  go: ['Go net/http', toGo],
  php: ['PHP curl', toPhp],
  node: ['Node https', toNode],
};
