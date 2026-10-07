import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore browser module
import { render } from '../../../public/_/md/lib.js';

const TAGS = '(?:p|h[1-6]|hr|br|strong|em|del|code|pre|blockquote|ul|ol|li|table|thead|tbody|tr|th|td|a)';
/** Safety oracle: remove every tag the renderer may emit; any '<' or '>' left over is injected markup. Every href must be http(s)/mailto. */
function assertSafe(html: string) {
  for (const [, href] of html.matchAll(/<a href="([^"]*)"/g)) assert.match(href, /^(https?:\/\/|mailto:)/, html);
  const rest = html
    .replace(/<a href="[^"<>]*" target="_blank" rel="noopener noreferrer nofollow">/g, '')
    .replace(new RegExp(`</?${TAGS}(?: class="language-[\\w-]+"| start="\\d+"| style="text-align:(?:left|right|center)")?/?>`, 'g'), '');
  assert.ok(!/[<>]/.test(rest), `unescaped markup in: ${html}`);
}

test('basic markup', () => {
  assert.equal(render('# Hi'), '<h1>Hi</h1>');
  assert.equal(render('**b** *i* ~~s~~ `c`'), '<p><strong>b</strong> <em>i</em> <del>s</del> <code>c</code></p>');
  assert.equal(render('***x***'), '<p><strong><em>x</em></strong></p>');
  assert.equal(render('a\nb  \nc'), '<p>a\nb<br>\nc</p>');
  assert.equal(render('---'), '<hr>');
  assert.equal(render('snake_case_word 2*3*4'), '<p>snake_case_word 2<em>3</em>4</p>');
  assert.equal(render('\\*not em\\*'), '<p>*not em*</p>');
});
test('code blocks stay literal', () => {
  assert.equal(render('```js\n<b>*x*</b>\n```'), '<pre><code class="language-js">&lt;b&gt;*x*&lt;/b&gt;</code></pre>');
  assert.equal(render('``a `b` c``'), '<p><code>a `b` c</code></p>');
});
test('lists', () => {
  assert.equal(render('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  assert.equal(render('3. a\n4. b'), '<ol start="3"><li>a</li><li>b</li></ol>');
  assert.equal(render('- a\n  - b\n  - c\n- d'), '<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>');
  assert.equal(render('1. a\n   - x\n2. b'), '<ol><li>a<ul><li>x</li></ul></li><li>b</li></ol>');
  assert.equal(render('- a\nlazy'), '<ul><li>a\nlazy</li></ul>');
});
test('task lists', () => {
  assert.equal(
    render('- [ ] todo\n- [x] **done**\n- [y] plain'),
    '<ul><li class="task"><input type="checkbox" disabled aria-label="Not done"> todo</li><li class="task"><input type="checkbox" disabled checked aria-label="Done"> <strong>done</strong></li><li>[y] plain</li></ul>',
  );
});
test('blockquote and table', () => {
  assert.equal(render('> a\n> - b'), '<blockquote><p>a</p>\n<ul><li>b</li></ul></blockquote>');
  assert.equal(
    render('| A | B |\n|:-|-:|\n| 1 | `x\\|y` |'),
    '<table><thead><tr><th style="text-align:left">A</th><th style="text-align:right">B</th></tr></thead><tbody><tr><td style="text-align:left">1</td><td style="text-align:right"><code>x|y</code></td></tr></tbody></table>',
  );
});
test('links: only http(s)/mailto, images are links', () => {
  assert.equal(render('[x](https://a.com/?q=1&b=2)'), '<p><a href="https://a.com/?q=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow">x</a></p>');
  assert.match(render('[m](mailto:a@b.co)'), /href="mailto:a@b.co"/);
  assert.equal(render('[x](javascript:alert(1))'), '<p>x</p>');
  assert.equal(
    render('![pic](https://a.com/p.png)'),
    '<p><a href="https://a.com/p.png" target="_blank" rel="noopener noreferrer nofollow">[image: pic]</a></p>',
  );
  assert.ok(!render('![pic](https://a.com/p.png)').includes('<img'));
  assert.equal(render('https://a.com/x.'), '<p><a href="https://a.com/x" target="_blank" rel="noopener noreferrer nofollow">https://a.com/x</a>.</p>');
});
test('XSS vectors are neutralised', () => {
  const vectors = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">x</a>',
    '<svg/onload=alert(1)>',
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x]( javascript:alert(1) )',
    '[x](java\tscript:alert(1))',
    '[x](data:text/html,<script>alert(1)</script>)',
    '[x](&#106;avascript:alert(1))',
    '[x](vbscript:msgbox)',
    '![x](javascript:alert(1))',
    '![x](data:image/svg+xml,<svg onload=alert(1)>)',
    '[<img src=x onerror=alert(1)>](https://a.com)',
    '[a](https://a.com"onmouseover="alert(1))',
    '[a](https://a.com/"><script>alert(1)</script>)',
    '**<script>**alert(1)**</script>**',
    '*<b onclick=alert(1)>*',
    '`<script>`<script>alert(1)</script>',
    '> <script>alert(1)</script>',
    '- <script>alert(1)</script>',
    '| <script> | b |\n|-|-|\n| <img onerror=x> | y |',
    '# <script>alert(1)</script>',
    '```"><script>alert(1)</script>\n```',
    '```js" onclick="alert(1)\nx\n```',
    '<https://a.com/"onclick="alert(1)>',
    'https://a.com/"onmouseover="alert(1)',
    '[[x](javascript:alert(1))](https://a.com)',
    '[x](https://a.com)](javascript:alert(1))',
    '<<script>script>alert(1)<</script>/script>',
    '&lt;script&gt;alert(1)&lt;/script&gt;',
    '\u0001<script>',
    '[x](mailto:a@b.co"onclick="x)',
  ];
  for (const v of vectors) {
    const h = render(v);
    assertSafe(h);
  }
  assert.ok(!render('<script>alert(1)</script>').includes('<script'));
  assert.ok(render('<script>alert(1)</script>').includes('&lt;script&gt;'));
  assert.ok(!/href="javascript/i.test(render('[x](javascript:alert(1))')));
  assert.ok(!/<a /.test(render('[x](data:text/html,hi)')));
});
test('pathological input terminates', () => {
  const t = Date.now();
  render('*'.repeat(3000) + '\n' + '['.repeat(2000) + '\n' + '`'.repeat(2000) + '\n' + '_ '.repeat(2000));
  assert.ok(Date.now() - t < 3000);
});
