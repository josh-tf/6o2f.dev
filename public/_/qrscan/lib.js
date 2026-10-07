// What a decoded QR payload is: URL, Wi-Fi, vCard/MeCard contact, e-mail, phone, geo, SMS or plain text.

/** Split on an unescaped separator and unescape \x (Wi-Fi and MeCard escaping). */
function splitEsc(s, sep) {
  const out = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length) cur += s[++i];
    else if (s[i] === sep) {
      out.push(cur);
      cur = '';
    } else cur += s[i];
  }
  return [...out, cur];
}
function fieldsOf(body) {
  // "K:v;K2:v2;;" -> [[K, v], ...] honouring backslash escapes
  return splitEsc(body, ';')
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(':');
      return i < 0 ? [p, ''] : [p.slice(0, i).toUpperCase(), p.slice(i + 1)];
    });
}

const dec = (s) => {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
};
/** Returns { type, label, fields: [[name, value]], href? }. href is only set for schemes that are safe to open (http, https, mailto, tel, sms, geo). */
export function classify(raw) {
  const text = String(raw ?? ''),
    t = text.trim();
  let m;
  if (/^https?:\/\/\S+$/i.test(t)) {
    try {
      const u = new URL(t);
      return {
        type: 'url',
        label: 'Web link',
        fields: [
          ['Host', u.hostname],
          ['URL', u.href],
        ],
        href: u.href,
      };
    } catch {}
  }
  if (/^www\.[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(t)) return { type: 'url', label: 'Web link', fields: [['URL', `https://${t}`]], href: `https://${t}` };
  if ((m = /^WIFI:(.*)$/is.exec(t))) {
    const f = Object.fromEntries(fieldsOf(m[1]));
    const sec = f.T ? (f.T.toUpperCase() === 'NOPASS' ? 'None (open)' : f.T) : 'None (open)';
    return {
      type: 'wifi',
      label: 'Wi-Fi network',
      fields: [['Network', f.S ?? ''], ['Security', sec], ['Password', f.P ?? ''], ...(/^true$/i.test(f.H ?? '') ? [['Hidden', 'Yes']] : [])].filter(
        ([, v]) => v !== '',
      ),
    };
  }
  if (/^BEGIN:VCARD/i.test(t)) {
    const lines = t.replace(/\r?\n[ \t]/g, '').split(/\r?\n/),
      get = [];
    const map = { FN: 'Name', N: 'Name', ORG: 'Organisation', TITLE: 'Title', TEL: 'Phone', EMAIL: 'Email', URL: 'Website', ADR: 'Address', NOTE: 'Note' };
    let hasFn = lines.some((l) => /^FN[:;]/i.test(l));
    for (const l of lines) {
      const i = l.indexOf(':');
      if (i < 0) continue;
      const key = l
          .slice(0, i)
          .split(';')[0]
          .toUpperCase()
          .replace(/^ITEM\d+\./, ''),
        v = l
          .slice(i + 1)
          .replace(/\\([,;\\])/g, '$1')
          .replace(/\\n/gi, ' ');
      if (!map[key] || (key === 'N' && hasFn)) continue;
      get.push([map[key], key === 'N' || key === 'ADR' ? v.split(';').filter(Boolean).join(' ') : v]);
    }
    return { type: 'contact', label: 'Contact (vCard)', fields: get };
  }
  if ((m = /^MECARD:(.*)$/is.exec(t))) {
    const map = { N: 'Name', TEL: 'Phone', EMAIL: 'Email', URL: 'Website', ADR: 'Address', NOTE: 'Note', ORG: 'Organisation' };
    return {
      type: 'contact',
      label: 'Contact (MeCard)',
      fields: fieldsOf(m[1])
        .filter(([k]) => map[k])
        .map(([k, v]) => [map[k], k === 'N' ? v.split(',').reverse().join(' ').trim() : v]),
    };
  }
  if ((m = /^mailto:([^?]*)(\?(.*))?$/is.exec(t))) {
    const q = new URLSearchParams(m[3] ?? '');
    return {
      type: 'email',
      label: 'E-mail',
      fields: [
        ['To', dec(m[1])],
        ['Subject', q.get('subject') ?? ''],
        ['Body', q.get('body') ?? ''],
      ].filter(([, v]) => v),
      href: t,
    };
  }
  if ((m = /^MATMSG:(.*)$/is.exec(t))) {
    const f = Object.fromEntries(fieldsOf(m[1]));
    const href = `mailto:${encodeURIComponent(f.TO ?? '')}?subject=${encodeURIComponent(f.SUB ?? '')}&body=${encodeURIComponent(f.BODY ?? '')}`;
    return {
      type: 'email',
      label: 'E-mail',
      fields: [
        ['To', f.TO ?? ''],
        ['Subject', f.SUB ?? ''],
        ['Body', f.BODY ?? ''],
      ].filter(([, v]) => v),
      href,
    };
  }
  if ((m = /^tel:([+\d\s().\-*#,;pw]+)$/i.exec(t)))
    return { type: 'tel', label: 'Phone number', fields: [['Number', m[1]]], href: `tel:${m[1].replace(/\s/g, '').replace(/#/g, '%23')}` };
  if ((m = /^(?:smsto|sms|mms|mmsto):([+\d\s().-]*)(?:[:?](?:body=)?(.*))?$/is.exec(t))) {
    const num = m[1].trim(),
      body = /^sms:/i.test(t) && /\?/.test(t) ? dec(m[2] ?? '') : (m[2] ?? '');
    return {
      type: 'sms',
      label: 'Text message',
      fields: [
        ['To', num],
        ['Message', body],
      ].filter(([, v]) => v),
      href: `sms:${num.replace(/\s/g, '')}${body ? `?body=${encodeURIComponent(body)}` : ''}`,
    };
  }
  if ((m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(-?[\d.]+))?(?:[;?].*)?$/i.exec(t)) && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) {
    const q = /[?&]q=([^&]*)/.exec(t);
    return {
      type: 'geo',
      label: 'Location',
      fields: [['Latitude', m[1]], ['Longitude', m[2]], ...(m[3] ? [['Altitude', `${m[3]} m`]] : []), ...(q ? [['Label', dec(q[1])]] : [])],
      href: `https://www.openstreetmap.org/?mlat=${+m[1]}&mlon=${+m[2]}#map=16/${+m[1]}/${+m[2]}`,
    };
  }
  return { type: 'text', label: 'Text', fields: [] };
}

/** Decode RGBA pixels with jsQR (passed in so the 130 kB fallback is only loaded when needed). Returns the text or null. */
export function decodePixels(jsQR, data, width, height) {
  const r = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' });
  return r ? r.data : null;
}
