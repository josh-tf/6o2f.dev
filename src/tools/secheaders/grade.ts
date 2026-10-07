// Pure grading of HTTP response security headers. No bindings, so it is unit-tested with synthetic header sets.
export type Status = 'pass' | 'warn' | 'fail' | 'info';
export type Check = { id: string; name: string; status: Status; detail: string; fix: string; penalty: number };
export type Input = {
  finalUrl: string;
  headers: [string, string][]; // lower-case names; set-cookie may repeat
  /** true = http:// redirected to https://, false = http:// served content, null = not tested / unreachable */
  httpRedirect: boolean | null;
};
export type Report = { grade: string; score: number; checks: Check[] };

const HALF_YEAR = 15_552_000;
const STRICT_REFERRER = ['no-referrer', 'same-origin', 'strict-origin', 'strict-origin-when-cross-origin'];

/** Parses a CSP header into directive -> source list (first occurrence wins, as browsers do). */
export function parseCsp(v: string): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const part of v.split(';')) {
    const [name, ...src] = part.trim().split(/\s+/);
    if (name && !m.has(name.toLowerCase())) m.set(name.toLowerCase(), src);
  }
  return m;
}

const c = (id: string, name: string, status: Status, detail: string, fix: string, penalty = 0): Check => ({ id, name, status, detail, fix, penalty });

export function grade(inp: Input): Report {
  const get = (n: string) => inp.headers.find(([k]) => k === n)?.[1]?.trim();
  const all = (n: string) => inp.headers.filter(([k]) => k === n).map(([, v]) => v);
  const https = /^https:/i.test(inp.finalUrl);
  const html = /text\/html|application\/xhtml/i.test(get('content-type') ?? '');
  const checks: Check[] = [];

  checks.push(
    https
      ? c('https', 'HTTPS', 'pass', 'The page is served over HTTPS.', '')
      : c(
          'https',
          'HTTPS',
          'fail',
          'The final page is served over plain HTTP: anyone on the network can read and change it.',
          "Serve the site over HTTPS (e.g. a free certificate from Let's Encrypt or your CDN) and redirect http:// to https://.",
          40,
        ),
  );

  checks.push(
    inp.httpRedirect === true
      ? c('redirect', 'HTTP → HTTPS redirect', 'pass', 'http:// redirects to https://.', '')
      : inp.httpRedirect === false
        ? c(
            'redirect',
            'HTTP → HTTPS redirect',
            'fail',
            'http:// serves content instead of redirecting to https://.',
            'server {\n  listen 80;\n  return 301 https://$host$request_uri;\n}',
            10,
          )
        : c('redirect', 'HTTP → HTTPS redirect', 'info', 'Could not test: the site did not answer on http://.', ''),
  );

  // HSTS (ignored by browsers over plain HTTP)
  const hsts = get('strict-transport-security');
  const hstsFix = 'Strict-Transport-Security: max-age=63072000; includeSubDomains; preload';
  if (!https) checks.push(c('hsts', 'Strict-Transport-Security', 'info', 'Not applicable: browsers ignore HSTS on plain HTTP.', hstsFix));
  else if (!hsts)
    checks.push(
      c('hsts', 'Strict-Transport-Security', 'fail', 'Missing. Browsers will still try http:// first, which allows SSL-stripping attacks.', hstsFix, 20),
    );
  else {
    const age = Number(/max-age\s*=\s*"?(\d+)/i.exec(hsts)?.[1] ?? NaN),
      sub = /includesubdomains/i.test(hsts),
      pre = /(^|;)\s*preload\s*($|;)/i.test(hsts);
    if (!Number.isFinite(age) || age === 0)
      checks.push(
        c(
          'hsts',
          'Strict-Transport-Security',
          'fail',
          Number.isFinite(age) ? 'max-age=0 turns HSTS off.' : 'Header present but has no valid max-age.',
          hstsFix,
          20,
        ),
      );
    else {
      const issues = [age < HALF_YEAR && `max-age is ${age}s; at least ${HALF_YEAR} (180 days) is recommended`, !sub && 'includeSubDomains is missing'].filter(
        Boolean,
      );
      checks.push(
        issues.length
          ? c('hsts', 'Strict-Transport-Security', 'warn', `${issues.join('; ')}.${pre ? '' : ' Not preload-ready.'}`, hstsFix, age < HALF_YEAR ? 10 : 5)
          : c(
              'hsts',
              'Strict-Transport-Security',
              'pass',
              `max-age ${age}s with includeSubDomains${pre ? ' and preload.' : '. Add preload to be eligible for the browser preload list.'}`,
              pre ? '' : hstsFix,
            ),
      );
    }
  }

  // CSP
  const cspRaw = get('content-security-policy'),
    cspRo = get('content-security-policy-report-only');
  const cspFix = "Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
  let frameAncestors = false;
  if (!cspRaw) {
    checks.push(
      c(
        'csp',
        'Content-Security-Policy',
        'fail',
        cspRo
          ? 'Only a Report-Only policy is set: it reports violations but blocks nothing.'
          : 'Missing. A CSP is the main defence against cross-site scripting (XSS).',
        cspFix,
        25,
      ),
    );
  } else {
    const csp = parseCsp(cspRaw);
    frameAncestors = csp.has('frame-ancestors');
    const script = csp.get('script-src') ?? csp.get('default-src');
    const issues: [string, number][] = [];
    if (!script) issues.push(['no script-src or default-src, so scripts are unrestricted', 15]);
    else {
      const nonceOrHash = script.some((s) => /^'(nonce-|sha(256|384|512)-)/i.test(s)),
        strictDyn = script.includes("'strict-dynamic'");
      if (script.includes("'unsafe-inline'") && !nonceOrHash) issues.push(["'unsafe-inline' scripts are allowed, which defeats XSS protection", 10]);
      if (script.includes("'unsafe-eval'")) issues.push(["'unsafe-eval' allows eval() and new Function()", 5]);
      const wild = script.filter((s) => s === '*' || /^(https?|data|blob):$/i.test(s));
      if (wild.length && !strictDyn) issues.push([`script sources include ${wild.join(' ')}, which allows scripts from anywhere`, 10]);
    }
    const dflt = csp.get('default-src');
    if (!csp.has('object-src') && !(dflt?.length === 1 && dflt[0] === "'none'")) issues.push(["object-src is not set (use 'none' to block plugins)", 3]);
    if (!csp.has('base-uri')) issues.push(["base-uri is not set (use 'none' or 'self' to stop <base> tag injection)", 3]);
    if (!frameAncestors && !get('x-frame-options')) issues.push(['frame-ancestors is not set, so the page can be framed (clickjacking)', 3]);
    checks.push(
      issues.length
        ? c(
            'csp',
            'Content-Security-Policy',
            issues.some(([, p]) => p >= 10) ? 'fail' : 'warn',
            `Present, but ${issues.map(([s]) => s).join('; ')}.`,
            cspFix,
            Math.min(
              25,
              issues.reduce((a, [, p]) => a + p, 0),
            ),
          )
        : c('csp', 'Content-Security-Policy', 'pass', 'Present with no unsafe sources found.', ''),
    );
  }

  // Framing
  const xfo = get('x-frame-options')?.toUpperCase();
  if (frameAncestors)
    checks.push(
      c('xfo', 'X-Frame-Options', 'pass', `CSP frame-ancestors controls framing${xfo ? ` (X-Frame-Options: ${xfo} is kept for old browsers)` : ''}.`, ''),
    );
  else if (xfo === 'DENY' || xfo === 'SAMEORIGIN') checks.push(c('xfo', 'X-Frame-Options', 'pass', `${xfo}: other sites cannot frame this page.`, ''));
  else if (xfo)
    checks.push(
      c(
        'xfo',
        'X-Frame-Options',
        'warn',
        `"${xfo}" is not a supported value (ALLOW-FROM is ignored by modern browsers).`,
        "Content-Security-Policy: frame-ancestors 'self'",
        5,
      ),
    );
  else
    checks.push(
      c(
        'xfo',
        'X-Frame-Options',
        'fail',
        'Neither X-Frame-Options nor CSP frame-ancestors is set: the page can be framed for clickjacking.',
        "X-Frame-Options: DENY\nContent-Security-Policy: frame-ancestors 'none'",
        10,
      ),
    );

  const xcto = get('x-content-type-options');
  checks.push(
    xcto?.toLowerCase() === 'nosniff'
      ? c('xcto', 'X-Content-Type-Options', 'pass', 'nosniff: browsers will not guess content types.', '')
      : c(
          'xcto',
          'X-Content-Type-Options',
          'fail',
          xcto ? `"${xcto}" is not valid; only nosniff is.` : 'Missing. Browsers may MIME-sniff uploads or responses into executable types.',
          'X-Content-Type-Options: nosniff',
          10,
        ),
  );

  const rp = get('referrer-policy')
    ?.toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .pop();
  const rpFix = 'Referrer-Policy: strict-origin-when-cross-origin';
  checks.push(
    !rp
      ? c(
          'referrer',
          'Referrer-Policy',
          'warn',
          'Missing. Modern browsers default to strict-origin-when-cross-origin, but older ones send full URLs to other sites.',
          rpFix,
          3,
        )
      : STRICT_REFERRER.includes(rp)
        ? c('referrer', 'Referrer-Policy', 'pass', `${rp}.`, '')
        : c('referrer', 'Referrer-Policy', 'warn', `${rp} can leak full URLs (paths and query strings) to other sites.`, rpFix, 5),
  );

  const pp = get('permissions-policy');
  checks.push(
    pp
      ? c('permissions', 'Permissions-Policy', 'pass', 'Present: browser features are restricted.', '')
      : c(
          'permissions',
          'Permissions-Policy',
          'warn',
          get('feature-policy')
            ? 'Only the deprecated Feature-Policy header is set.'
            : 'Missing. Embedded content can request powerful features such as camera, microphone or geolocation.',
          'Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()',
          5,
        ),
  );

  const coop = get('cross-origin-opener-policy'),
    coep = get('cross-origin-embedder-policy'),
    corp = get('cross-origin-resource-policy');
  const iso = `COOP ${coop ?? 'not set'}, COEP ${coep ?? 'not set'}, CORP ${corp ?? 'not set'}.`;
  checks.push(
    coop && /same-origin/i.test(coop)
      ? c('coop', 'Cross-origin isolation', 'pass', `${iso} Popups opened by other sites cannot reach this window.`, '')
      : c(
          'coop',
          'Cross-origin isolation',
          'warn',
          `${iso} Set COOP so cross-origin windows cannot keep a reference to this page (XS-Leaks). COEP and CORP are only needed for cross-origin isolation.`,
          'Cross-Origin-Opener-Policy: same-origin\nCross-Origin-Resource-Policy: same-origin',
          3,
        ),
  );

  const cc = get('cache-control');
  if (!html) checks.push(c('cache', 'Cache-Control', 'info', 'Not an HTML page; caching is not graded.', ''));
  else if (!cc)
    checks.push(
      c(
        'cache',
        'Cache-Control',
        'warn',
        'No Cache-Control on HTML: shared caches may apply heuristic caching. Personalised pages must not be stored by proxies.',
        'Cache-Control: no-store            # personalised pages\nCache-Control: public, max-age=300  # public pages',
        2,
      ),
    );
  else checks.push(c('cache', 'Cache-Control', 'pass', `${cc}.${/public/i.test(cc) ? ' Make sure this page is never personalised.' : ''}`, ''));

  // Cookies
  const cookies = all('set-cookie');
  if (!cookies.length) checks.push(c('cookies', 'Set-Cookie', 'pass', 'No cookies are set on this response.', ''));
  else {
    const bad: string[] = [];
    let p = 0,
      worst: Status = 'pass';
    for (const ck of cookies) {
      const [nv, ...attrs] = ck.split(';').map((s) => s.trim());
      const name = nv.split('=')[0],
        a = attrs.map((s) => s.toLowerCase().split('=')[0].trim());
      const miss = [!a.includes('secure') && 'Secure', !a.includes('httponly') && 'HttpOnly', !a.includes('samesite') && 'SameSite'].filter(
        Boolean,
      ) as string[];
      if (/^__(Host|Secure)-/.test(name) && !a.includes('secure')) miss.push('Secure (required by its prefix)');
      if (!miss.length) continue;
      bad.push(`${name}: no ${miss.join(', ')}`);
      if (miss.some((m) => m.startsWith('Secure')) && https) {
        worst = 'fail';
        p += 10;
      } else {
        if (worst === 'pass') worst = 'warn';
        p += miss.includes('HttpOnly') ? 3 : 2;
      }
    }
    checks.push(
      bad.length
        ? c(
            'cookies',
            'Set-Cookie',
            worst,
            `${bad.length} of ${cookies.length} cookie${cookies.length === 1 ? '' : 's'} missing flags: ${bad.join('; ')}. HttpOnly may be omitted on purpose for cookies that scripts must read.`,
            'Set-Cookie: session=…; Path=/; Secure; HttpOnly; SameSite=Lax',
            Math.min(15, p),
          )
        : c('cookies', 'Set-Cookie', 'pass', `${cookies.length} cookie${cookies.length === 1 ? '' : 's'}, all with Secure, HttpOnly and SameSite.`, ''),
    );
  }

  // Information leaks
  const leaks: string[] = [];
  const server = get('server');
  if (server && /\d/.test(server)) leaks.push(`Server: ${server}`);
  for (const h of ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator']) {
    const v = get(h);
    if (v) leaks.push(`${h}: ${v}`);
  }
  checks.push(
    leaks.length
      ? c(
          'leaks',
          'Information leakage',
          'warn',
          `Software versions are advertised (${leaks.join('; ')}), which helps attackers find known vulnerabilities.`,
          'nginx: server_tokens off;\nExpress: app.disable("x-powered-by");\nPHP: expose_php = Off',
          Math.min(5, leaks.length * 2),
        )
      : c('leaks', 'Information leakage', 'pass', server ? `Server: ${server} (no version number).` : 'No Server or X-Powered-By version details.', ''),
  );

  const acao = get('access-control-allow-origin'),
    acac = get('access-control-allow-credentials')?.toLowerCase() === 'true';
  if (acao === '*' && acac)
    checks.push(
      c(
        'cors',
        'CORS',
        'fail',
        'Access-Control-Allow-Origin: * together with Allow-Credentials: true. Browsers reject this, and it suggests the server may reflect origins for credentialed requests.',
        'Access-Control-Allow-Origin: https://app.example.com\nAccess-Control-Allow-Credentials: true\nVary: Origin',
        15,
      ),
    );
  else if (acao === 'null')
    checks.push(
      c(
        'cors',
        'CORS',
        'warn',
        'Access-Control-Allow-Origin: null trusts sandboxed iframes and file:// pages.',
        'Access-Control-Allow-Origin: https://app.example.com',
        5,
      ),
    );
  else
    checks.push(
      c(
        'cors',
        'CORS',
        'pass',
        acao
          ? `Allow-Origin: ${acao}${acao === '*' ? ' without credentials (fine for public content).' : '.'}`
          : 'No CORS headers: other origins cannot read responses.',
        '',
      ),
    );

  const score = Math.max(0, 100 - checks.reduce((a, x) => a + x.penalty, 0));
  const fails = checks.filter((x) => x.status === 'fail').length;
  const grade = !https ? 'F' : score >= 95 && !fails ? 'A+' : score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
  return { grade, score, checks };
}

const ICON: Record<Status, string> = { pass: 'PASS', warn: 'WARN', fail: 'FAIL', info: 'INFO' };
/** The report as Markdown, for pasting into an issue or chat. */
export function toMarkdown(url: string, r: Report, at = new Date()): string {
  const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const lines = [
    `## Security headers: ${url}`,
    '',
    `**Grade ${r.grade}** (${r.score}/100), checked ${at.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    '| Check | Result | Details |',
    '| --- | --- | --- |',
  ];
  for (const x of r.checks) lines.push(`| ${x.name} | ${ICON[x.status]} | ${cell(x.detail)} |`);
  const fixes = r.checks.filter((x) => x.fix && (x.status === 'fail' || x.status === 'warn'));
  if (fixes.length) {
    lines.push('', '### Fixes');
    for (const x of fixes) lines.push('', `**${x.name}**`, '```', x.fix, '```');
  }
  return lines.join('\n') + '\n';
}
