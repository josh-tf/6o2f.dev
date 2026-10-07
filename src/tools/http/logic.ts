export const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'];
const FORBIDDEN = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie']);
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Validates user header rows; returns [name, value] pairs or an error message. */
export function cleanHeaders(rows: unknown): [string, string][] | string {
  if (!Array.isArray(rows)) return 'headers must be a list';
  if (rows.length > 30) return 'Too many headers (max 30)';
  const out: [string, string][] = [];
  for (const r of rows) {
    const name = String(r?.name ?? '').trim(),
      value = String(r?.value ?? '');
    if (!name && !value) continue;
    if (!TOKEN.test(name)) return `Invalid header name: ${name.slice(0, 40)}`;
    if (FORBIDDEN.has(name.toLowerCase())) return `Header not allowed: ${name}`;
    if (/[\r\n\0]/.test(value) || value.length > 4096) return `Invalid value for ${name}`;
    out.push([name, value]);
  }
  return out;
}
