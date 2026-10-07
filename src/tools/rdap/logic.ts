/* eslint-disable @typescript-eslint/no-explicit-any -- parses untyped JSON from public DoH/RDAP servers; every field is checked or stringified */
export type Kind = 'domain' | 'ip' | 'asn';
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Classifies a query as domain, IP literal or AS number; null if it is none of them. */
export function classify(raw: string): { kind: Kind; value: string } | null {
  const q = raw.trim().toLowerCase().replace(/\.$/, '');
  if (!q || q.length > 253) return null;
  const as = q.match(/^(?:as)?(\d{1,10})$/);
  if (as) return { kind: 'asn', value: String(Number(as[1])) };
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(q)) return q.split('.').every((n) => +n <= 255) ? { kind: 'ip', value: q.split('.').map(Number).join('.') } : null;
  if (q.includes(':')) {
    try {
      return /^[0-9a-f:.]+$/.test(q) ? { kind: 'ip', value: new URL(`http://[${q}]`).hostname.slice(1, -1) } : null;
    } catch {
      return null;
    }
  }
  const labels = q.split('.');
  return labels.length >= 2 && labels.every((l) => LABEL.test(l)) && /^([a-z]{2,63}|xn--[a-z0-9-]+)$/.test(labels.at(-1)!)
    ? { kind: 'domain', value: q }
    : null;
}

type Ent = { roles?: string[]; vcardArray?: [string, [string, unknown, string, unknown][]]; entities?: Ent[] };
const vc = (e: Ent | undefined, field: string) => {
  const v = e?.vcardArray?.[1]?.find((x) => x[0] === field)?.[3];
  return typeof v === 'string' ? v : '';
};
const findRole = (es: Ent[] | undefined, role: string): Ent | undefined => {
  for (const e of es ?? []) {
    if (e.roles?.includes(role)) return e;
    const n = findRole(e.entities, role);
    if (n) return n;
  }
};

/** Flattens an RDAP response into label/value rows the UI can show. */
export function summarize(kind: Kind, j: any, now = Date.now()): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: unknown) => {
    if (value != null && value !== '' && !(Array.isArray(value) && !value.length))
      rows.push({ label, value: Array.isArray(value) ? value.join(', ') : String(value) });
  };
  const ev = (a: string) => j.events?.find((e: any) => e.eventAction === a)?.eventDate as string | undefined;
  const date = (a: string) => {
    const d = ev(a);
    if (!d) return '';
    const days = Math.ceil((Date.parse(d) - now) / 864e5);
    return `${d.slice(0, 10)}${a === 'expiration' ? (days >= 0 ? ` (${days} days left)` : ` (expired ${-days} days ago)`) : ''}`;
  };
  if (kind === 'domain') {
    add('Domain', j.ldhName?.toLowerCase());
    const reg = findRole(j.entities, 'registrar');
    add('Registrar', vc(reg, 'fn'));
    add('Status', j.status);
    add('Registered', date('registration'));
    add('Updated', date('last changed'));
    add('Expires', date('expiration'));
    add(
      'Nameservers',
      j.nameservers?.map((n: any) => n.ldhName?.toLowerCase()),
    );
    if (j.secureDNS) add('DNSSEC', j.secureDNS.delegationSigned ? 'signed' : 'unsigned');
    const ab = findRole(j.entities, 'abuse');
    add('Abuse contact', [vc(ab, 'email'), vc(ab, 'tel')].filter(Boolean));
  } else if (kind === 'ip') {
    add('Network', j.name);
    add('Handle', j.handle);
    add('Range', j.startAddress && `${j.startAddress} - ${j.endAddress}`);
    add(
      'CIDR',
      j.cidr0_cidrs?.map((c: any) => `${c.v4prefix ?? c.v6prefix}/${c.length}`),
    );
    add('Country', j.country);
    add('Type', j.type);
    add('Status', j.status);
    add('Registered', date('registration'));
    add('Updated', date('last changed'));
    const ab = findRole(j.entities, 'abuse');
    add('Abuse contact', [vc(ab, 'email'), vc(ab, 'tel')].filter(Boolean));
  } else {
    add('Network', j.name);
    add('Handle', j.handle);
    add('Range', j.startAutnum != null && `AS${j.startAutnum}${j.endAutnum !== j.startAutnum ? ` - AS${j.endAutnum}` : ''}`);
    add('Country', j.country);
    add('Type', j.type);
    add('Status', j.status);
    add('Registered', date('registration'));
    add('Updated', date('last changed'));
    const ab = findRole(j.entities, 'abuse');
    add('Abuse contact', [vc(ab, 'email'), vc(ab, 'tel')].filter(Boolean));
  }
  return rows;
}
