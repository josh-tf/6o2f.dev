// Small safe Markdown -> HTML. Every piece of input text goes through esc(); the only tags emitted are
// the fixed ones below, and URLs are limited to http(s)/mailto. Raw HTML in the input is shown as text.
// ponytail: CommonMark subset (no reference links, no link titles, one paren level in URLs, no setext headings); extend if needed.
export const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => (/^(https?:\/\/|mailto:)[^\s<>"']+$/i.test(u.trim()) ? u.trim() : null);
const a = (url, inner) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${inner}</a>`;

const INLINE =
  /\\([\\`*_{}[\]()#+\-.!~|>])|(`+)([^`]|[^`][^]*?[^`])\2(?!`)|!\[([^\]]*)\]\(\s*((?:[^\s()]|\([^\s()]*\))*)(?:\s+"[^"]*")?\s*\)|\[([^\]]+)\]\(\s*((?:[^\s()]|\([^\s()]*\))*)(?:\s+"[^"]*")?\s*\)|(\*\*\*|___)(?=\S)([^]+?)(?<=\S)\8|(\*\*|__)(?=\S)([^]+?)(?<=\S)\10|~~(?=\S)([^]+?)(?<=\S)~~|\*(?=\S)([^]+?)(?<=\S)\*|(?<!\w)_(?=\S)([^]+?)(?<=\S)_(?!\w)|<((?:https?:\/\/|mailto:)[^\s<>]+)>|(https?:\/\/[^\s<>]*[^\s<>.,;:!?)'"])/g;

export function inline(s, noLink = false, d = 0) {
  if (d > 6) return esc(s); // bounds recursion on pathological nesting
  let out = '',
    last = 0;
  for (const m of s.matchAll(INLINE)) {
    // matchAll clones the regex, so recursion cannot disturb its position
    out += esc(s.slice(last, m.index));
    last = m.index + m[0].length;
    const [, bs, , code, alt, img, text, href, , tri, , bold, strike, em, em2, auto, bare] = m;
    if (bs) out += esc(bs);
    else if (code !== undefined) out += `<code>${esc(code.trim())}</code>`;
    else if (alt !== undefined) {
      const u = safeUrl(img);
      out += u && !noLink ? a(u, `[image: ${esc(alt) || esc(u)}]`) : esc(alt);
    } else if (text !== undefined) {
      const u = safeUrl(href);
      out += u && !noLink ? a(u, inline(text, true, d + 1)) : inline(text, noLink, d + 1);
    } else if (tri) out += `<strong><em>${inline(m[9], noLink, d + 1)}</em></strong>`;
    else if (bold !== undefined) out += `<strong>${inline(bold, noLink, d + 1)}</strong>`;
    else if (strike !== undefined) out += `<del>${inline(strike, noLink, d + 1)}</del>`;
    else if (em !== undefined || em2 !== undefined) out += `<em>${inline(em ?? em2, noLink, d + 1)}</em>`;
    else {
      const u = safeUrl(auto ?? bare);
      out += u && !noLink ? a(u, esc(u)) : esc(m[0]);
    }
  }
  return out + esc(s.slice(last));
}

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w-]*)[^`]*$/;
const HR = /^ {0,3}([-*_])( ?\1){2,}\s*$/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const cells = (l) =>
  l
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
const startsBlock = (l, next) =>
  FENCE.test(l) ||
  /^ {0,3}#{1,6}\s/.test(l) ||
  /^ {0,3}>/.test(l) ||
  HR.test(l) ||
  ITEM.test(l) ||
  (l.includes('|') && next !== undefined && SEP.test(next) && next.includes('-') && next.includes('|'));

function blocks(lines) {
  const out = [];
  for (let i = 0; i < lines.length;) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    let m;
    if ((m = FENCE.exec(l))) {
      const body = [];
      for (i++; i < lines.length && !new RegExp(`^ {0,3}${m[1][0]}{${m[1].length},}\\s*$`).test(lines[i]); i++) body.push(lines[i]);
      i++;
      out.push(`<pre><code${m[2] ? ` class="language-${m[2]}"` : ''}>${esc(body.join('\n'))}</code></pre>`);
    } else if ((m = /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/.exec(l))) {
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++;
    } else if (HR.test(l)) {
      out.push('<hr>');
      i++;
    } else if (/^ {0,3}>/.test(l)) {
      const q = [];
      for (; i < lines.length && /^ {0,3}>/.test(lines[i]); i++) q.push(lines[i].replace(/^ {0,3}> ?/, ''));
      out.push(`<blockquote>${blocks(q).join('\n')}</blockquote>`);
    } else if ((m = ITEM.exec(l))) {
      const base = m[1].length,
        ordered = /\d/.test(m[2][0]),
        items = [];
      while (i < lines.length) {
        const im = ITEM.exec(lines[i]);
        if (!im || im[1].length !== base || /\d/.test(im[2][0]) !== ordered) break;
        const body = [im[3]];
        for (i++; i < lines.length; i++) {
          const x = lines[i];
          if (!x.trim()) {
            if (i + 1 < lines.length && /^ +\S/.test(lines[i + 1]) && lines[i + 1].search(/\S/) > base) {
              body.push('');
              continue;
            }
            break;
          }
          if (x.search(/\S/) > base) body.push(x);
          else if (!startsBlock(x) && body[body.length - 1] !== '')
            body.push(x); // lazy continuation
          else break;
        }
        const pad = Math.min(
          ...body
            .slice(1)
            .filter((x) => x.trim())
            .map((x) => x.search(/\S/)),
          Infinity,
        );
        const inner = blocks(body.map((x, k) => (k && Number.isFinite(pad) ? x.slice(Math.min(pad, x.search(/\S/) < 0 ? 0 : x.search(/\S/))) : x))).join('');
        const li = inner.replace(/^<p>([^]*?)<\/p>/, '$1'),
          task = /^\[([ xX])\]\s/.exec(li); // GFM task list item
        items.push(
          task
            ? `<li class="task"><input type="checkbox" disabled${task[1] === ' ' ? '' : ' checked'} aria-label="${task[1] === ' ' ? 'Not done' : 'Done'}"> ${li.slice(4)}</li>`
            : `<li>${li}</li>`,
        );
      }
      const t = ordered ? 'ol' : 'ul',
        start = ordered && parseInt(m[2], 10) !== 1 ? ` start="${parseInt(m[2], 10)}"` : '';
      out.push(`<${t}${start}>${items.join('')}</${t}>`);
    } else if (l.includes('|') && SEP.test(lines[i + 1] ?? '') && (lines[i + 1] ?? '').includes('-')) {
      const al = cells(lines[i + 1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /^-+:$/.test(c) ? 'right' : /^:-+$/.test(c) ? 'left' : ''));
      const row = (cs, tag) => `<tr>${cs.map((c, k) => `<${tag}${al[k] ? ` style="text-align:${al[k]}"` : ''}>${inline(c)}</${tag}>`).join('')}</tr>`;
      const rows = [];
      for (let k = i + 2; k < lines.length && lines[k].trim() && lines[k].includes('|'); k++) rows.push(row(cells(lines[k]), 'td'));
      out.push(`<table><thead>${row(cells(l), 'th')}</thead><tbody>${rows.join('')}</tbody></table>`);
      i += 2 + rows.length;
    } else {
      const p = [l];
      for (i++; i < lines.length && lines[i].trim() && !startsBlock(lines[i], lines[i + 1]); i++) p.push(lines[i]);
      out.push(
        `<p>${inline(
          p
            .map((x) => x.replace(/(?: {2,}|\\)$/, '\u0001').trim())
            .join('\n')
            .replace(/\u0001\n?/g, '\u0001'),
        ).replace(/\u0001/g, '<br>\n')}</p>`,
      );
    }
  }
  return out;
}

export const render = (md) =>
  blocks(
    String(md)
      .replace(/\u0001|\r\n?/g, (c) => (c === '\u0001' ? '' : '\n'))
      .replace(/\t/g, '    ')
      .split('\n'),
  ).join('\n');
