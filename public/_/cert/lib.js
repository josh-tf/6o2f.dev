// Minimal DER/ASN.1 reader and X.509 certificate / SPKI decoder. No libraries; nothing leaves the page.

// ---------- PEM ----------
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
/** Every PEM block in `text` as { label, der }. Bare base64 (one DER blob) is accepted too. */
export function pemBlocks(text) {
  const out = [],
    re = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/g;
  let m;
  while ((m = re.exec(text))) {
    try {
      out.push({ label: m[1], der: unb64(m[2].replace(/\s+/g, '')) });
    } catch {
      throw new Error(`The ${m[1]} block #${out.length + 1} is not valid base64.`);
    }
  }
  if (!out.length) {
    const b = text.replace(/\s+/g, '');
    if (!b) return [];
    if (/-----BEGIN/.test(text)) throw new Error('Found a BEGIN line without a matching END line.');
    let bytes = null;
    try {
      if (/^[A-Za-z0-9+/]+=*$/.test(b)) bytes = unb64(b);
    } catch {}
    if (!bytes || bytes[0] !== 0x30) throw new Error('No PEM block found. Paste text starting with -----BEGIN CERTIFICATE-----.');
    out.push({ label: 'CERTIFICATE', der: bytes });
  }
  return out;
}

// ---------- DER ----------
/** Parse one TLV at `off`: { tag, cls, cons, num, start, end, hdr, kids? }. Constructed values get their children parsed. */
export function der(b, off = 0, depth = 0) {
  if (off + 2 > b.length) throw new Error('Truncated DER (header).');
  if (depth > 40) throw new Error('DER nested too deeply.');
  const tag = b[off],
    cls = tag >> 6,
    cons = !!(tag & 0x20);
  let num = tag & 0x1f,
    p = off + 1;
  if (num === 0x1f) {
    num = 0;
    do {
      if (p >= b.length) throw new Error('Truncated DER (tag).');
      num = num * 128 + (b[p] & 127);
    } while (b[p++] & 128);
  }
  let len = b[p++];
  if (len === 0x80) throw new Error('Indefinite length is not DER.');
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n > 4) throw new Error('DER length too large.');
    len = 0;
    for (let i = 0; i < n; i++) {
      if (p >= b.length) throw new Error('Truncated DER (length).');
      len = len * 256 + b[p++];
    }
  }
  const node = { tag, cls, cons, num, hdr: off, start: p, end: p + len };
  if (node.end > b.length) throw new Error('Truncated DER (value runs past the end).');
  if (cons) {
    node.kids = [];
    for (let q = p; q < node.end;) {
      const k = der(b, q, depth + 1);
      node.kids.push(k);
      q = k.end;
    }
  }
  return node;
}
const val = (b, n) => b.subarray(n.start, n.end);
const need = (n, tag, what) => {
  if (!n || n.tag !== tag) throw new Error(`Malformed certificate: expected ${what}.`);
  return n;
};

export function oid(bytes) {
  const out = [];
  let v = 0n;
  for (const x of bytes) {
    v = (v << 7n) | BigInt(x & 127);
    if (!(x & 128)) {
      out.push(v);
      v = 0n;
    }
  }
  if (!out.length) return '';
  const f = out[0],
    a = f < 40n ? 0n : f < 80n ? 1n : 2n;
  return [a, f - a * 40n, ...out.slice(1)].join('.');
}
export const hex = (bytes, sep = ':') => [...bytes].map((x) => x.toString(16).padStart(2, '0').toUpperCase()).join(sep);
/** Positive INTEGER as hex without the DER sign byte. */
const intHex = (bytes) => {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  return hex(bytes.subarray(i), '');
};
const bitLen = (bytes) => {
  let i = 0;
  while (i < bytes.length && bytes[i] === 0) i++;
  return i === bytes.length ? 0 : (bytes.length - i) * 8 - Math.clz32(bytes[i]) + 24;
};

function str(b, n) {
  const v = val(b, n);
  switch (n.tag) {
    case 0x0c:
      return new TextDecoder().decode(v); // UTF8String
    case 0x1e: {
      let s = '';
      for (let i = 0; i + 1 < v.length; i += 2) s += String.fromCharCode((v[i] << 8) | v[i + 1]);
      return s;
    } // BMPString
    case 0x1c: {
      let s = '';
      for (let i = 0; i + 3 < v.length; i += 4) s += String.fromCodePoint(((v[i] << 24) | (v[i + 1] << 16) | (v[i + 2] << 8) | v[i + 3]) >>> 0);
      return s;
    }
    case 0x13:
    case 0x16:
    case 0x14:
    case 0x1a:
    case 0x12:
      return String.fromCharCode(...v); // Printable, IA5, T61 (as Latin-1), Visible, Numeric
    default:
      return hex(v);
  }
}
function time(b, n) {
  const s = String.fromCharCode(...val(b, n));
  const m = n.tag === 0x17 ? /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?Z$/.exec(s) : /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?(?:\.\d+)?Z$/.exec(s);
  if (!m) throw new Error(`Unsupported time format "${s}".`);
  let y = +m[1];
  if (n.tag === 0x17) y += y >= 50 ? 1900 : 2000; // RFC 5280 4.1.2.5.1
  return new Date(Date.UTC(y, +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)));
}

// ---------- names and OIDs ----------
const ATTR = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.9': 'street',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.5': 'serialNumber',
  '2.5.4.4': 'SN',
  '2.5.4.42': 'GN',
  '2.5.4.12': 'title',
  '2.5.4.15': 'businessCategory',
  '2.5.4.17': 'postalCode',
  '2.5.4.97': 'organizationIdentifier',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '0.9.2342.19200300.100.1.25': 'DC',
  '0.9.2342.19200300.100.1.1': 'UID',
  '1.3.6.1.4.1.311.60.2.1.3': 'jurisdictionC',
  '1.3.6.1.4.1.311.60.2.1.2': 'jurisdictionST',
  '1.3.6.1.4.1.311.60.2.1.1': 'jurisdictionL',
};
/** Name -> [{ type, value }] in encoded order. */
function name(b, n) {
  const out = [];
  for (const rdn of n.kids || [])
    for (const atv of rdn.kids || []) {
      const t = oid(val(b, atv.kids[0]));
      out.push({ type: ATTR[t] || t, value: str(b, atv.kids[1]) });
    }
  return out;
}
export const dn = (attrs) => attrs.map((a) => `${a.type}=${a.value}`).join(', ');

export const SIG = {
  '1.2.840.113549.1.1.4': 'MD5 with RSA',
  '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
  '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
  '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
  '1.2.840.113549.1.1.14': 'SHA-224 with RSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.4.1': 'ECDSA with SHA-1',
  '1.2.840.10045.4.3.1': 'ECDSA with SHA-224',
  '1.2.840.10045.4.3.2': 'ECDSA with SHA-256',
  '1.2.840.10045.4.3.3': 'ECDSA with SHA-384',
  '1.2.840.10045.4.3.4': 'ECDSA with SHA-512',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
  '1.2.840.10040.4.3': 'DSA with SHA-1',
  '2.16.840.1.101.3.4.3.2': 'DSA with SHA-256',
};
const CURVE = {
  '1.2.840.10045.3.1.7': ['P-256', 256],
  '1.3.132.0.34': ['P-384', 384],
  '1.3.132.0.35': ['P-521', 521],
  '1.3.132.0.10': ['secp256k1', 256],
  '1.2.840.10045.3.1.1': ['P-192', 192],
  '1.3.132.0.33': ['P-224', 224],
  '1.3.36.3.3.2.8.1.1.7': ['brainpoolP256r1', 256],
  '1.3.36.3.3.2.8.1.1.11': ['brainpoolP384r1', 384],
  '1.3.36.3.3.2.8.1.1.13': ['brainpoolP512r1', 512],
};
const EKU = {
  '1.3.6.1.5.5.7.3.1': 'TLS server',
  '1.3.6.1.5.5.7.3.2': 'TLS client',
  '1.3.6.1.5.5.7.3.3': 'Code signing',
  '1.3.6.1.5.5.7.3.4': 'Email protection',
  '1.3.6.1.5.5.7.3.8': 'Time stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP signing',
  '2.5.29.37.0': 'Any',
  '1.3.6.1.4.1.311.10.3.3': 'Microsoft SGC',
  '2.16.840.1.113730.4.1': 'Netscape SGC',
  '1.3.6.1.4.1.311.20.2.2': 'Smart card logon',
  '1.3.6.1.5.5.7.3.17': 'IPsec IKE',
};
const KU = [
  'Digital signature',
  'Non-repudiation',
  'Key encipherment',
  'Data encipherment',
  'Key agreement',
  'Certificate sign',
  'CRL sign',
  'Encipher only',
  'Decipher only',
];
export const EXT = {
  '2.5.29.14': 'Subject key identifier',
  '2.5.29.15': 'Key usage',
  '2.5.29.17': 'Subject alternative names',
  '2.5.29.18': 'Issuer alternative names',
  '2.5.29.19': 'Basic constraints',
  '2.5.29.30': 'Name constraints',
  '2.5.29.31': 'CRL distribution points',
  '2.5.29.32': 'Certificate policies',
  '2.5.29.35': 'Authority key identifier',
  '2.5.29.37': 'Extended key usage',
  '2.5.29.36': 'Policy constraints',
  '2.5.29.54': 'Inhibit any-policy',
  '1.3.6.1.5.5.7.1.1': 'Authority information access',
  '1.3.6.1.4.1.11129.2.4.2': 'Certificate Transparency SCTs',
  '1.3.6.1.4.1.11129.2.4.3': 'CT precertificate poison',
  '1.3.6.1.5.5.7.1.24': 'TLS feature (OCSP must-staple)',
  '2.16.840.1.113730.1.1': 'Netscape cert type',
  '1.3.6.1.4.1.311.21.1': 'Microsoft CA version',
};
const POLICY = {
  '2.23.140.1.2.1': 'Domain validated',
  '2.23.140.1.2.2': 'Organization validated',
  '2.23.140.1.2.3': 'Individual validated',
  '2.23.140.1.1': 'Extended validation',
  '2.5.29.32.0': 'Any policy',
  '1.3.6.1.4.1.44947.1.1.1': 'ISRG domain validated',
};

// ---------- SPKI ----------
/** SubjectPublicKeyInfo node -> { type, bits, curve?, exponent?, summary }. */
function spkiInfo(b, n) {
  const alg = n.kids[0],
    a = oid(val(b, alg.kids[0])),
    key = val(b, need(n.kids[1], 0x03, 'public key BIT STRING')).subarray(1);
  if (a === '1.2.840.113549.1.1.1' || a === '1.2.840.113549.1.1.10') {
    const k = der(key),
      mod = val(key, k.kids[0]),
      e = val(key, k.kids[1]);
    const bits = bitLen(mod),
      exponent = parseInt(intHex(e), 16);
    return { type: a.endsWith('.10') ? 'RSA-PSS' : 'RSA', bits, exponent, summary: `RSA ${bits} bits (e = ${exponent})` };
  }
  if (a === '1.2.840.10045.2.1') {
    const p = alg.kids[1],
      c = p && p.tag === 0x06 ? oid(val(b, p)) : '',
      [cn, bits] = CURVE[c] || [c ? `curve ${c}` : 'explicit curve parameters', 0];
    return { type: 'EC', curve: cn, bits, summary: `ECDSA ${cn}${bits && !cn.endsWith(bits) ? ` (${bits} bits)` : ''}` };
  }
  if (a === '1.3.101.112') return { type: 'Ed25519', bits: 256, summary: 'Ed25519' };
  if (a === '1.3.101.113') return { type: 'Ed448', bits: 456, summary: 'Ed448' };
  if (a === '1.3.101.110') return { type: 'X25519', bits: 256, summary: 'X25519' };
  if (a === '1.2.840.10040.4.1') {
    const y = der(key);
    const bits = bitLen(val(key, y));
    return { type: 'DSA', bits, summary: `DSA ${bits} bits` };
  }
  return { type: a, bits: 0, summary: `Unknown key algorithm ${a}` };
}

// ---------- extensions ----------
function generalNames(b, n) {
  return (n.kids || []).map((g) => {
    const v = val(b, g);
    switch (g.num) {
      case 1:
        return { type: 'email', value: String.fromCharCode(...v) };
      case 2:
        return { type: 'DNS', value: String.fromCharCode(...v) };
      case 6:
        return { type: 'URI', value: String.fromCharCode(...v) };
      case 7:
        return { type: 'IP', value: v.length === 4 ? [...v].join('.') : v.length === 16 ? ipv6(v) : hex(v) };
      case 4:
        return { type: 'DirName', value: dn(name(b, g.kids[0])) };
      case 8:
        return { type: 'RID', value: oid(v) };
      case 0:
        return { type: 'otherName', value: g.kids?.[0] ? oid(val(b, g.kids[0])) : '' };
      default:
        return { type: `[${g.num}]`, value: hex(v) };
    }
  });
}
function ipv6(v) {
  const w = [];
  for (let i = 0; i < 16; i += 2) w.push(((v[i] << 8) | v[i + 1]).toString(16));
  const s = w.join(':'),
    m = s.match(/(?:^|:)0(?::0)+(?:$|:)/g);
  if (!m) return s;
  const longest = m.reduce((a, c) => (c.length > a.length ? c : a));
  return s.replace(longest, '::');
}
function ext(b, e) {
  const id = oid(val(b, e.kids[0]));
  const critical = e.kids.length === 3 && e.kids[1].tag === 0x01 && b[e.kids[1].start] !== 0;
  const inner = val(b, e.kids[e.kids.length - 1]),
    x = der(inner),
    out = { oid: id, name: EXT[id] || id, critical };
  try {
    switch (id) {
      case '2.5.29.17':
      case '2.5.29.18':
        out.names = generalNames(inner, x);
        break;
      case '2.5.29.15': {
        const v = val(inner, x); // v[0] = unused-bit count (always zero bits in DER), bit 0 is the MSB of v[1]
        out.usage = KU.filter((_, i) => (v[1 + (i >> 3)] ?? 0) & (0x80 >> (i & 7)));
        break;
      }
      case '2.5.29.37':
        out.usage = x.kids.map((k) => {
          const o = oid(val(inner, k));
          return EKU[o] || o;
        });
        break;
      case '2.5.29.19': {
        const k = x.kids || [];
        out.ca = !!(k[0] && k[0].tag === 0x01 && inner[k[0].start]);
        const pl = k.find((n) => n.tag === 0x02);
        if (pl) out.pathLen = parseInt(intHex(val(inner, pl)), 16);
        break;
      }
      case '2.5.29.14':
        out.keyId = hex(val(inner, x));
        break;
      case '2.5.29.35': {
        const k = (x.kids || []).find((n) => n.cls === 2 && n.num === 0);
        if (k) out.keyId = hex(val(inner, k));
        break;
      }
      case '1.3.6.1.5.5.7.1.1':
        out.access = x.kids.map((ad) => {
          const m = oid(val(inner, ad.kids[0]));
          return {
            method: m === '1.3.6.1.5.5.7.48.1' ? 'OCSP' : m === '1.3.6.1.5.5.7.48.2' ? 'CA issuers' : m,
            ...generalNames(inner, { kids: [ad.kids[1]] })[0],
          };
        });
        break;
      case '2.5.29.31':
        out.uris = [];
        for (const dp of x.kids)
          for (const f of dp.kids || [])
            if (f.cls === 2 && f.num === 0) for (const fn of f.kids || []) if (fn.num === 0) out.uris.push(...generalNames(inner, fn).map((g) => g.value));
        break;
      case '2.5.29.32':
        out.policies = x.kids.map((p) => {
          const o = oid(val(inner, p.kids[0]));
          return POLICY[o] ? `${POLICY[o]} (${o})` : o;
        });
        break;
    }
  } catch {
    out.raw = true;
  }
  return out;
}

// ---------- certificate ----------
/** Decode an X.509 certificate DER. Fingerprints are added by `fingerprints()` (async). */
export function parseCert(bytes) {
  const root = der(bytes);
  if (root.end !== bytes.length) throw new Error('Extra bytes after the certificate.');
  const [tbs, sigAlg, sig] = need(root, 0x30, 'a SEQUENCE').kids || [];
  need(tbs, 0x30, 'TBSCertificate');
  need(sigAlg, 0x30, 'signature algorithm');
  need(sig, 0x03, 'signature');
  const k = tbs.kids;
  let i = 0,
    version = 1;
  if (k[0].cls === 2 && k[0].num === 0) {
    version = b2i(val(bytes, k[0].kids[0])) + 1;
    i++;
  }
  const serial = intHex(val(bytes, need(k[i++], 0x02, 'serial number')));
  i++; // inner signature algorithm (must equal the outer one)
  const issuer = name(bytes, need(k[i++], 0x30, 'issuer'));
  const v = need(k[i++], 0x30, 'validity');
  const notBefore = time(bytes, v.kids[0]),
    notAfter = time(bytes, v.kids[1]);
  const subject = name(bytes, need(k[i++], 0x30, 'subject'));
  const spkiNode = need(k[i++], 0x30, 'subject public key info');
  const key = spkiInfo(bytes, spkiNode);
  const extNode = k.slice(i).find((n) => n.cls === 2 && n.num === 3);
  const exts = extNode ? extNode.kids[0].kids.map((e) => ext(bytes, e)) : [];
  const sigOid = oid(val(bytes, sigAlg.kids[0]));
  const by = (id) => exts.find((e) => e.oid === id);
  return {
    version,
    serial,
    issuer,
    subject,
    notBefore,
    notAfter,
    key,
    exts,
    signature: SIG[sigOid] || sigOid,
    san: by('2.5.29.17')?.names || [],
    keyUsage: by('2.5.29.15')?.usage || [],
    eku: by('2.5.29.37')?.usage || [],
    basic: by('2.5.29.19') || null,
    ski: by('2.5.29.14')?.keyId || '',
    aki: by('2.5.29.35')?.keyId || '',
    selfIssued: dn(subject) === dn(issuer),
    spki: bytes.slice(spkiNode.hdr, spkiNode.end),
    der: bytes,
  };
}
const b2i = (v) => v.reduce((a, x) => a * 256 + x, 0);

/** SPKI-only PEM ("PUBLIC KEY") or PKCS#1 ("RSA PUBLIC KEY"). */
export function parsePublicKey(bytes, label = 'PUBLIC KEY') {
  if (label === 'RSA PUBLIC KEY') {
    const k = der(bytes),
      bits = bitLen(val(bytes, k.kids[0])),
      e = parseInt(intHex(val(bytes, k.kids[1])), 16);
    return { type: 'RSA', bits, exponent: e, summary: `RSA ${bits} bits (e = ${e})`, pkcs1: true };
  }
  const n = der(bytes);
  if (n.end !== bytes.length || !n.kids || n.kids.length !== 2) throw new Error('Not a SubjectPublicKeyInfo structure.');
  return spkiInfo(bytes, n);
}

export async function digest(alg, bytes) {
  return hex(new Uint8Array(await crypto.subtle.digest(alg, bytes)));
}

/** Whole days from `now` to `date` (negative when past). */
export const daysLeft = (date, now = new Date()) => Math.floor((date.getTime() - now.getTime()) / 86400000);
export function status(c, now = new Date()) {
  if (now < c.notBefore) return 'notyet';
  if (now > c.notAfter) return 'expired';
  return 'valid';
}

/** For each cert, the index of its issuer within the list (-1 if absent). Matches name, plus AKI = SKI when both exist. */
export function links(certs) {
  return certs.map((c, i) => {
    if (c.selfIssued && (!c.aki || !c.ski || c.aki === c.ski)) return i;
    return certs.findIndex((p, j) => j !== i && dn(p.subject) === dn(c.issuer) && (!c.aki || !p.ski || c.aki === p.ski));
  });
}
/** Leaf-to-root order following issuer links from the cert nobody else names as issuer. */
export function chainOrder(certs) {
  const l = links(certs),
    issuers = new Set(l.filter((x, i) => x !== i));
  const start = certs.findIndex((_, i) => !issuers.has(i));
  const order = [];
  for (let i = start < 0 ? 0 : start; i >= 0 && !order.includes(i); i = l[i] === i ? -1 : l[i]) order.push(i);
  for (let i = 0; i < certs.length; i++) if (!order.includes(i)) order.push(i);
  return order;
}
