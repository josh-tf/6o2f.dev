/* eslint-disable @typescript-eslint/no-explicit-any -- parses untyped JSON from public DoH/RDAP servers; every field is checked or stringified */
export const TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA', 'SRV', 'DS', 'DNSKEY', 'PTR'];
export const ALL_TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'CAA'];
const STATUS = ['NOERROR', 'FORMERR', 'SERVFAIL', 'NXDOMAIN', 'NOTIMP', 'REFUSED'];
const RRTYPE: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  43: 'DS',
  46: 'RRSIG',
  48: 'DNSKEY',
  257: 'CAA',
};
const LABEL = /^[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9_])?$/;

/** The in-addr.arpa / ip6.arpa name for an IPv4/IPv6 literal, or null if it is not one. */
export function reverseName(ip: string): string | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.split('.').every((n) => +n <= 255) ? ip.split('.').reverse().join('.') + '.in-addr.arpa' : null;
  if (!ip.includes(':') || !/^[0-9a-f:.]+$/i.test(ip)) return null;
  let h: string;
  try {
    h = new URL(`http://[${ip}]`).hostname.slice(1, -1);
  } catch {
    return null;
  }
  const [a, b] = h.split('::');
  const left = a ? a.split(':') : [],
    right = b ? b.split(':') : [];
  const groups = h.includes('::') ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return (
    groups
      .map((g) => g.padStart(4, '0'))
      .join('')
      .split('')
      .reverse()
      .join('.') + '.ip6.arpa'
  );
}

/** Validates a query name (hostname, or an IP literal which is turned into its reverse name). Returns the lowercase name or null. */
export function cleanName(raw: string): string | null {
  const n = raw.trim().toLowerCase().replace(/\.$/, '');
  if (!n) return null;
  const rev = reverseName(n);
  if (rev) return rev;
  return n.length <= 253 && n.split('.').every((l) => LABEL.test(l)) ? n : null;
}

export type Answer = { name: string; type: string; ttl: number; data: string };
export type Result = { status: string; ad: boolean; answers: Answer[]; error?: string };

/** Normalises a DoH JSON reply (Cloudflare and Google share the format). */
export function parseDoh(j: any): Result {
  return {
    status: STATUS[j.Status] ?? `RCODE${j.Status}`,
    ad: !!j.AD,
    answers: (j.Answer ?? []).map((a: any) => ({
      name: String(a.name).replace(/\.$/, ''),
      type: RRTYPE[a.type] ?? `TYPE${a.type}`,
      ttl: a.TTL,
      data: String(a.data),
    })),
  };
}

const norm = (r: Result) => r.answers.map((a) => `${a.type} ${a.data.toLowerCase().replace(/\.$/, '')}`).sort();
/** Differences between two resolvers' results (TTLs ignored); empty when they agree. */
export function diff(a: Result, b: Result): string[] {
  const out: string[] = [];
  if (a.status !== b.status) out.push(`Status: ${a.status} vs ${b.status}`);
  if (a.ad !== b.ad) out.push(`DNSSEC validated (AD): ${a.ad} vs ${b.ad}`);
  const x = norm(a),
    y = norm(b);
  for (const r of x) if (!y.includes(r)) out.push(`Only in first: ${r}`);
  for (const r of y) if (!x.includes(r)) out.push(`Only in second: ${r}`);
  return out;
}
