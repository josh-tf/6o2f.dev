import { $, esc, mountBar } from '/_/ui.js';
import { der, pemBlocks, parseCert, parsePublicKey, dn, digest, daysLeft, status, links, chainOrder } from './lib.js';
import { ISRG_ROOT_X1 } from './example.js';
mountBar('Certificates');

const say = (t) => {
  $('#msg').textContent = t;
};
const iso = (d) => `<time datetime="${d.toISOString()}">${d.toISOString().replace('T', ' ').slice(0, 19)} UTC</time>`;
const cn = (attrs) => attrs.find((a) => a.type === 'CN')?.value || attrs.find((a) => a.type === 'O')?.value || dn(attrs) || '(empty name)';
const list = (a) => (a.length ? `<ul>${a.map((x) => `<li>${x}</li>`).join('')}</ul>` : '<span class="muted">none</span>');
const b64 = (hexs) => btoa(String.fromCharCode(...hexs.split(':').map((h) => parseInt(h, 16))));
const b64bytes = (b) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const row = (k, v) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`;
const fp = (label, v) => `<code>${esc(v)}</code><button type="button" class="cp" data-copy="${esc(v)}" aria-label="Copy ${label}">Copy</button>`;

function validity(c, now) {
  const s = status(c, now),
    d = daysLeft(c.notAfter, now);
  if (s === 'expired') return `<span class="badge bad">expired ${-d} day${-d === 1 ? '' : 's'} ago</span>`;
  if (s === 'notyet') return `<span class="badge bad">not valid until ${c.notBefore.toISOString().slice(0, 10)}</span>`;
  return `<span class="badge ${d < 30 ? 'bad' : 'ok'}">${d} day${d === 1 ? '' : 's'} left</span>`;
}

async function certHtml(c, i, issuerIdx, total) {
  const now = new Date();
  const [sha1, sha256, spki] = await Promise.all([digest('SHA-1', c.der), digest('SHA-256', c.der), digest('SHA-256', c.spki)]);
  const role = c.basic?.ca ? (c.selfIssued ? 'Root CA' : 'Intermediate CA') : 'End-entity';
  const known = new Set(['2.5.29.17', '2.5.29.15', '2.5.29.37', '2.5.29.19', '2.5.29.14', '2.5.29.35']);
  const crit = (id) => (c.exts.find((e) => e.oid === id)?.critical ? ' <span class="muted">(critical)</span>' : '');
  const issuer = issuerIdx === i ? 'self-signed' : issuerIdx >= 0 ? `certificate #${issuerIdx + 1}` : total > 1 ? 'not in the pasted set' : '';
  const other = c.exts
    .filter((e) => !known.has(e.oid))
    .map((e) => {
      let d = '';
      if (e.access) d = e.access.map((a) => `${esc(a.method)}: <code>${esc(a.value)}</code>`).join('<br>');
      else if (e.uris) d = e.uris.map((u) => `<code>${esc(u)}</code>`).join('<br>');
      else if (e.policies) d = e.policies.map(esc).join('<br>');
      return `${esc(e.name)}${e.critical ? ' <span class="muted">(critical)</span>' : ''}${d ? `<br>${d}` : ''}`;
    });
  const bc = c.basic
    ? `CA: ${c.basic.ca ? 'yes' : 'no'}${c.basic.pathLen !== undefined ? `, path length ≤ ${c.basic.pathLen}` : ''}${crit('2.5.29.19')}`
    : '<span class="muted">absent</span>';
  return `<article class="card cert" aria-labelledby="c${i}"><h3 id="c${i}">#${i + 1} ${esc(cn(c.subject))}</h3><p class="kind">${role} certificate, X.509 v${c.version}</p>
<table><caption class="vh">Fields of certificate ${i + 1}</caption><tbody>
${row('Subject', esc(dn(c.subject)))}
${row('Issuer', esc(dn(c.issuer)) + (issuer ? ` <span class="muted">(${esc(issuer)})</span>` : ''))}
${row('Serial', `<code>${esc(c.serial)}</code>`)}
${row('Valid from', iso(c.notBefore))}
${row('Valid until', iso(c.notAfter) + validity(c, now))}
${row('Public key', esc(c.key.summary))}
${row('Signature', esc(c.signature) + (/SHA-1|MD5/.test(c.signature) && !c.selfIssued ? ' <span class="bad">(weak)</span>' : ''))}
${row('Alt names', list(c.san.map((n) => `${esc(n.type)}: <code>${esc(n.value)}</code>`)))}
${row(`Key usage`, c.keyUsage.length ? esc(c.keyUsage.join(', ')) + crit('2.5.29.15') : '<span class="muted">absent</span>')}
${row('Extended key usage', c.eku.length ? esc(c.eku.join(', ')) + crit('2.5.29.37') : '<span class="muted">absent</span>')}
${row('Basic constraints', bc)}
${row('Subject key ID', c.ski ? `<code>${esc(c.ski)}</code>` : '<span class="muted">absent</span>')}
${row('Authority key ID', c.aki ? `<code>${esc(c.aki)}</code>` : '<span class="muted">absent</span>')}
${other.length ? row('Other extensions', list(other)) : ''}
${row('SHA-1 fingerprint', fp('SHA-1 fingerprint', sha1))}
${row('SHA-256 fingerprint', fp('SHA-256 fingerprint', sha256))}
${row('SPKI pin (sha256)', fp('SPKI pin', b64(spki)))}
</tbody></table></article>`;
}

async function keyHtml(k, bytes, i) {
  const sha = k.pkcs1 ? '' : await digest('SHA-256', bytes);
  return `<article class="card cert" aria-labelledby="c${i}"><h3 id="c${i}">#${i + 1} Public key</h3><p class="kind">${k.pkcs1 ? 'PKCS#1 RSA public key' : 'SubjectPublicKeyInfo'}</p>
<table><caption class="vh">Public key ${i + 1}</caption><tbody>${row('Type', esc(k.summary))}${sha ? row('SHA-256 of SPKI', fp('SPKI SHA-256', sha)) + row('SPKI pin (sha256)', fp('SPKI pin', b64(sha))) : ''}</tbody></table></article>`;
}

let seq = 0;
async function decode() {
  const my = ++seq,
    text = $('#in').value;
  $('#err').textContent = '';
  $('#in').removeAttribute('aria-invalid');
  const fail = (m) => {
    $('#err').textContent = m;
    $('#in').setAttribute('aria-invalid', 'true');
    $('#out').innerHTML = '';
    $('#chainbox').hidden = true;
    $('#st').textContent = '';
  };
  let blocks;
  try {
    blocks = pemBlocks(text);
  } catch (e) {
    return fail(e.message);
  }
  if (!blocks.length) {
    $('#out').innerHTML = '';
    $('#chainbox').hidden = true;
    $('#st').textContent = 'Paste a PEM certificate above, open a file, or load the example.';
    return;
  }
  const items = [];
  for (const [n, b] of blocks.entries()) {
    try {
      if (b.label === 'CERTIFICATE' || b.label === 'TRUSTED CERTIFICATE' || b.label === 'X509 CERTIFICATE')
        items.push({ cert: parseCert(b.label === 'TRUSTED CERTIFICATE' ? b.der.subarray(0, der(b.der).end) : b.der) }); // OpenSSL appends trust settings after the cert
      else if (b.label === 'PUBLIC KEY' || b.label === 'RSA PUBLIC KEY') items.push({ key: parsePublicKey(b.der, b.label), der: b.der });
      else if (/PRIVATE KEY/.test(b.label))
        return fail(`Block #${n + 1} is a private key. This page only decodes public data; do not paste private keys into web pages.`);
      else return fail(`Block #${n + 1} is a ${b.label}, which this page does not decode. Paste CERTIFICATE or PUBLIC KEY blocks.`);
    } catch (e) {
      return fail(`Block #${n + 1} (${b.label}) could not be decoded: ${e.message}`);
    }
  }
  const certs = items.filter((x) => x.cert).map((x) => x.cert);
  const l = links(certs);
  let ci = 0;
  const html = await Promise.all(
    items.map((x, i) =>
      x.cert
        ? certHtml(
            x.cert,
            i,
            (() => {
              const j = l[ci++];
              return j < 0 ? -1 : items.findIndex((y) => y.cert === certs[j]);
            })(),
            items.length,
          )
        : keyHtml(x.key, x.der, i),
    ),
  );
  if (my !== seq) return;
  $('#out').innerHTML = html.join('');
  $('#st').textContent = `Decoded ${items.length} item${items.length === 1 ? '' : 's'}.`;
  $('#chainbox').hidden = certs.length < 2;
  if (certs.length > 1) {
    const order = chainOrder(certs),
      num = (c) => items.findIndex((y) => y.cert === c) + 1;
    const inOrder = order.every((v, i) => v === i);
    $('#chain').innerHTML =
      order
        .map((k, pos) => {
          const c = certs[k],
            j = l[k],
            next = order[pos + 1];
          const link =
            j === k ? 'self-signed root' : j < 0 ? 'issuer not pasted' : next === j ? `signed by the next certificate` : `issued by #${num(certs[j])}`;
          return `<li><a href="#c${num(c) - 1}">#${num(c)} ${esc(cn(c.subject))}</a> <span class="muted">(${esc(link)})</span></li>`;
        })
        .join('') +
      `<li class="muted" style="list-style:none;margin-left:-22px">${inOrder ? 'The certificates are pasted leaf first, as servers should send them.' : `Pasted out of order; servers should send ${order.map((k) => '#' + num(certs[k])).join(', ')}.`}</li>`;
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    say('Copied.');
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? 'Copied.' : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
$('#out').addEventListener('click', (e) => {
  const b = e.target.closest('[data-copy]');
  if (b) copy(b.dataset.copy);
});
$('#in').addEventListener('input', decode);
$('#ex').addEventListener('click', () => {
  $('#in').value = ISRG_ROOT_X1;
  $('#in').setSelectionRange(0, 0);
  $('#in').scrollTop = 0;
  decode();
  say("Loaded ISRG Root X1, Let's Encrypt's RSA root.");
});
$('#clear').addEventListener('click', () => {
  $('#in').value = '';
  decode();
  $('#in').focus();
});
$('#file').addEventListener('change', async () => {
  const f = $('#file').files[0];
  if (!f) return;
  if (f.size > 1 << 20) {
    $('#err').textContent = 'That file is over 1 MB; certificates are a few KB.';
    return;
  }
  const b = new Uint8Array(await f.arrayBuffer());
  const text = new TextDecoder().decode(b);
  // Binary DER starts with a SEQUENCE tag; wrap it as PEM so the textarea shows what was decoded.
  $('#in').value =
    b[0] === 0x30 && !/-----BEGIN/.test(text)
      ? `-----BEGIN CERTIFICATE-----\n${b64bytes(b)
          .match(/.{1,64}/g)
          .join('\n')}\n-----END CERTIFICATE-----\n`
      : text;
  $('#file').value = '';
  decode();
  say(`Opened ${f.name}.`);
});
$('#in').value = ISRG_ROOT_X1;
$('#in').setSelectionRange(0, 0); // caret at the top, so focusing the field does not scroll to the end
decode();
