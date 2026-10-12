#!/usr/bin/env node
// HTML / accessibility / console audit for tool pages against a local dev server.
//   scripts/dev.sh 50 &            # in the background, wait for the port
//   node scripts/audit.mjs --slot 50 json uuid qr        # specific tools ("all" = every tool in src/tools/index.ts)
// Options: --slot N (default 0), --json (machine-readable), --no-axe (skip axe-core), --shots DIR (save screenshots)
// Exit code 1 when any issue (level "error") is found. "warn" items are advisory.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : d;
};
const flag = (k) => argv.includes(k);
const slot = Number(opt('--slot', 0)),
  base = `http://localhost:${8850 + slot}/`,
  shots = opt('--shots', '');
const skip = new Set(['--slot', '--shots', opt('--slot', ''), opt('--shots', '')]);
let names = argv.filter((a) => !a.startsWith('--') && !skip.has(a));
if (names.includes('all') || !names.length)
  names = [...fs.readFileSync(new URL('../src/tools/index.ts', import.meta.url), 'utf8').matchAll(/tool as t_(\w+) }/g)].map((m) => m[1]);
const req = createRequire(import.meta.url);
const axeSrc = flag('--no-axe') ? '' : fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const exe =
  process.env.CHROME ??
  (() => {
    const root = path.join(os.homedir(), '.cache/ms-playwright');
    const d = fs.readdirSync(root).find((x) => x.startsWith('chromium_headless_shell'));
    const v = fs.readdirSync(path.join(root, d)).find((x) => fs.existsSync(path.join(root, d, x, 'chrome-headless-shell')));
    return path.join(root, d, v, 'chrome-headless-shell');
  })();
const TOKEN = '6o2f_devtoken0000000000000000';
const browser = await chromium.launch({ executablePath: exe });
const results = [];

// Tags that must be closed and are not: the browser repairs these silently and the layout ends up nested wrongly
// (a result section inside the form's button column, for one).
function unbalanced(file) {
  if (!fs.existsSync(file)) return [];
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  const skip =
    /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr|p|li|td|th|tr|tbody|thead|tfoot|option|dt|dd|html|head|body|caption|path|circle|rect|line|polyline|polygon|ellipse|use|stop)$/;
  const stack = [],
    out = [];
  for (const [, close, raw, rest] of html.matchAll(/<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g)) {
    const t = raw.toLowerCase();
    if (skip.test(t) || rest.endsWith('/')) continue;
    if (!close) stack.push(t);
    else if (!stack.includes(t)) out.push(`stray </${t}>`);
    else for (let o; (o = stack.pop()) !== t;) out.push(`<${o}> is not closed before </${t}>`);
  }
  return [...out, ...stack.map((t) => `<${t}> is never closed`)];
}

for (const name of names) {
  const issues = [],
    add = (level, id, msg) => issues.push({ level, id, msg: String(msg).slice(0, 220) });
  for (const m of unbalanced(path.join(import.meta.dirname, '../public/_', name, 'index.html'))) add('error', 'html', m);
  for (const [w, h, scheme] of [
    [1100, 800, 'dark'],
    [1100, 800, 'light'],
    [400, 800, 'dark'],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      colorScheme: scheme,
      extraHTTPHeaders: { 'x-host': `${name}.6o2f.dev`, authorization: `Bearer ${TOKEN}` },
    });
    const page = await ctx.newPage();
    const tag = `${w}px ${scheme}`;
    page.on('console', (m) => m.type() === 'error' && add('error', 'console', `[${tag}] ${m.text()}`));
    page.on('pageerror', (e) => add('error', 'pageerror', `[${tag}] ${e.message}`));
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().startsWith(base.slice(0, -1)) && !r.url().includes('/api/'))
        add('error', 'http', `[${tag}] ${r.status()} ${new URL(r.url()).pathname}`);
    });
    try {
      await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      add('error', 'load', e.message);
      await ctx.close();
      continue;
    }
    await page.waitForTimeout(300);
    const info = await page.evaluate(() => {
      const q = (s) => [...document.querySelectorAll(s)];
      const vis = (e) => {
        const r = e.getBoundingClientRect();
        const st = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none';
      };
      const name = (e) =>
        e.getAttribute('aria-label') ||
        e.getAttribute('aria-labelledby') ||
        (e.labels && e.labels.length) ||
        e.title ||
        e.textContent.trim() ||
        e.querySelector('img[alt]')?.alt ||
        '';
      return {
        title: document.title,
        lang: document.documentElement.lang,
        h1: q('h1').length,
        main: q('main').length,
        desc: !!document.querySelector('meta[name=description]'),
        viewport: !!document.querySelector('meta[name=viewport]'),
        buttonsNoType: q('button:not([type])')
          .map((b) => b.textContent.trim().slice(0, 30) || b.id || b.className)
          .slice(0, 5),
        iconButtonsNoName: q('button')
          .filter((b) => vis(b) && !name(b))
          .map((b) => b.id || b.className)
          .slice(0, 5),
        blankLinks: q('a[target=_blank]:not([rel*=noopener])').length,
        emptyLinks: q('a').filter((a) => vis(a) && !a.getAttribute('href') && !a.hasAttribute('role')).length,
        inputsNoLabel: q('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select')
          .filter((e) => vis(e) && !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
          .map((e) => e.id || e.name || e.type)
          .slice(0, 6),
        headingJumps: (() => {
          let last = 0,
            jumps = [];
          q('h1,h2,h3,h4,h5,h6')
            .filter(vis)
            .forEach((h) => {
              const n = +h.tagName[1];
              if (last && n > last + 1) jumps.push(`${h.tagName} after H${last}`);
              last = n;
            });
          return jumps.slice(0, 3);
        })(),
        tablesNoTh: q('table').filter((t) => vis(t) && !t.querySelector('th')).length,
        hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        placeholderOnly: q('input[placeholder],textarea[placeholder]').filter(
          (e) => vis(e) && e.type !== 'hidden' && !(e.labels && e.labels.length) && !e.getAttribute('aria-label'),
        ).length,
        textLen: document.body.innerText.trim().length,
      };
    });
    if (!info.title || /^(Loading|undefined)/i.test(info.title)) add('error', 'title', `[${tag}] missing title`);
    if (!info.lang) add('error', 'lang', 'html lang missing');
    if (info.h1 !== 1) add('error', 'h1', `[${tag}] ${info.h1} h1 elements (need exactly 1)`);
    if (info.main !== 1) add('error', 'main', `[${tag}] ${info.main} <main> landmarks`);
    if (!info.viewport) add('error', 'viewport', 'meta viewport missing');
    if (!info.desc)
      add('warn', 'description', 'meta description missing (served pages get one injected; check the raw HTML only if this is the Worker output)');
    if (info.buttonsNoType.length) add('error', 'button-type', `[${tag}] buttons without type: ${info.buttonsNoType.join(', ')}`);
    if (info.iconButtonsNoName.length) add('error', 'button-name', `[${tag}] buttons with no accessible name: ${info.iconButtonsNoName.join(', ')}`);
    if (info.inputsNoLabel.length) add('error', 'label', `[${tag}] controls with no label: ${info.inputsNoLabel.join(', ')}`);
    if (info.blankLinks) add('error', 'noopener', `[${tag}] ${info.blankLinks} target=_blank links without rel=noopener`);
    if (info.emptyLinks) add('warn', 'link', `[${tag}] ${info.emptyLinks} <a> without href`);
    if (info.headingJumps.length) add('warn', 'headings', `[${tag}] skipped heading level: ${info.headingJumps.join('; ')}`);
    if (info.tablesNoTh) add('error', 'table', `[${tag}] ${info.tablesNoTh} table(s) without <th>`);
    if (w === 400 && info.hscroll > 2) add('error', 'hscroll', `[${tag}] page scrolls sideways by ${info.hscroll}px`);
    if (info.placeholderOnly) add('warn', 'placeholder', `[${tag}] ${info.placeholderOnly} field(s) use only a placeholder as label`);
    if (info.textLen < 40) add('warn', 'empty', `[${tag}] very little text on the page (${info.textLen} chars): is it a stub?`);
    // keyboard focus must be visible on the first 25 focusable elements
    if (w === 1100 && scheme === 'dark') {
      const bad = [];
      await page.evaluate(() => document.activeElement?.blur());
      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab');
        const r = await page.evaluate(() => {
          const e = document.activeElement;
          if (!e || e === document.body) return null;
          const s = getComputedStyle(e);
          const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
          const p = e.closest('.num,.pickwrap,label');
          const ps = p ? getComputedStyle(p) : null;
          return {
            ok: ring || (ps && ((ps.outlineStyle !== 'none' && parseFloat(ps.outlineWidth) > 0) || ps.boxShadow !== 'none')) || e.matches('input[type=file]'),
            d: `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}`,
          };
        });
        if (r && !r.ok) bad.push(r.d);
      }
      if (bad.length) add('error', 'focus', `[${tag}] no visible focus style: ${[...new Set(bad)].slice(0, 6).join(', ')}`);
    }
    if (axeSrc) {
      await page.evaluate(axeSrc);
      const ax = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
            rules: { region: { enabled: false } },
          })
        ).violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes[0]?.target?.join(' ').slice(0, 80) })),
      );
      for (const v of ax) add(v.impact === 'minor' ? 'warn' : 'error', `axe:${v.id}`, `[${tag}] ${v.help} (${v.n}×, e.g. ${v.sample})`);
    }
    if (shots && w === 1100 && scheme === 'dark') {
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true });
    }
    if (shots && w === 400) {
      fs.mkdirSync(shots, { recursive: true });
      await page.screenshot({ path: path.join(shots, `${name}-m.png`), fullPage: true });
    }
    // "Used" state: press the page's main action (a lookup, a convert, a create) and check the page with its result showing.
    // ponytail: one click on the first visible primary/submit button; tools with richer flows still need a human look at the -used shots.
    if (scheme === 'dark') {
      const main = page.locator('main button.primary:visible, main form button[type=submit]:visible').first();
      if (await main.count()) {
        await main.click({ timeout: 3000 }).catch(() => {});
        await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
        await page.waitForTimeout(400);
        const hs = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (w === 400 && hs > 2) add('error', 'hscroll-used', `[${tag}] after using the tool the page scrolls sideways by ${hs}px`);
        if (shots) await page.screenshot({ path: path.join(shots, `${name}${w === 400 ? '-m' : ''}-used.png`), fullPage: true });
      }
    }
    await ctx.close();
  }
  // de-duplicate identical messages across viewports/schemes
  const seen = new Set(),
    uniq = issues.filter((i) => {
      const k = i.id + i.msg.replace(/^\[[^\]]*\]\s*/, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  results.push({ tool: name, errors: uniq.filter((i) => i.level === 'error').length, warns: uniq.filter((i) => i.level === 'warn').length, issues: uniq });
}
await browser.close();
if (flag('--json')) console.log(JSON.stringify(results, null, 1));
else
  for (const r of results) {
    console.log(`${r.errors ? 'FAIL' : 'ok  '} ${r.tool}  (${r.errors} errors, ${r.warns} warnings)`);
    for (const i of r.issues) console.log(`   ${i.level === 'error' ? '✗' : '·'} ${i.id}: ${i.msg}`);
  }
process.exit(results.some((r) => r.errors) ? 1 : 0);
