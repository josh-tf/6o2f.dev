import { COUNTRIES } from './countries.ts';

const HIDDEN = new Set(['cookie', 'authorization']);

/** Request headers minus credentials. */
export const safeHeaders = (h: Headers): Record<string, string> => Object.fromEntries([...h].filter(([k]) => !HIDDEN.has(k.toLowerCase())));

/** "+1100" for an IANA zone right now (Intl longOffset: "GMT+11:00" / "GMT"), or null. */
export function utcOffset(timeZone: unknown, at = new Date()): string | null {
  if (typeof timeZone !== 'string') return null;
  try {
    const v = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(v);
    return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : '+0000';
  } catch {
    return null;
  }
}

const num = (v: unknown) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** ipapi.co/json-shaped answer from the client IP and Cloudflare's request.cf. Anything Cloudflare cannot tell us is null. */
export function ipapi(ip: string | undefined, cf: Record<string, unknown> | undefined, now = new Date()) {
  const cc = typeof cf?.country === 'string' ? cf.country : null;
  const c = cc ? COUNTRIES[cc] : undefined;
  return {
    ip: ip || 'unknown',
    network: null, // Cloudflare does not expose the announced prefix
    version: ip?.includes(':') ? 'IPv6' : 'IPv4',
    city: (cf?.city as string) ?? null,
    region: (cf?.region as string) ?? null,
    region_code: (cf?.regionCode as string) ?? null,
    country: cc,
    country_name: c?.[1] ?? null,
    country_code: cc,
    country_code_iso3: c?.[0] ?? null,
    country_capital: c?.[2] || null,
    country_tld: c?.[3] || null,
    continent_code: (cf?.continent as string) ?? null,
    in_eu: cf?.isEUCountry === '1',
    postal: (cf?.postalCode as string) ?? null,
    latitude: num(cf?.latitude),
    longitude: num(cf?.longitude),
    timezone: (cf?.timezone as string) ?? null,
    utc_offset: utcOffset(cf?.timezone, now),
    country_calling_code: c?.[4] || null,
    currency: c?.[5] || null,
    currency_name: c?.[6] || null,
    languages: c?.[7] || null,
    country_area: c?.[8] ?? null,
    country_population: c?.[9] ?? null,
    asn: cf?.asn ? `AS${cf.asn}` : null,
    org: (cf?.asOrganization as string) ?? null,
    // Cloudflare extras
    colo: (cf?.colo as string) ?? null,
    http_protocol: (cf?.httpProtocol as string) ?? null,
    tls_version: (cf?.tlsVersion as string) ?? null,
  };
}
