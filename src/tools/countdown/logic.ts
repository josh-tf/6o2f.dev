// Pure validation for countdown events (no bindings, unit-tested).
export const MAX_EVENTS = 50;
export const MAX_TITLE = 80;
export const MAX_MESSAGE = 280;
const YEAR = 365.25 * 86_400_000;
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes
export const ID_RE = /^[a-z2-9]{8}$/;

export const newId = () => [...crypto.getRandomValues(new Uint8Array(8))].map((x) => ALPHABET[x % ALPHABET.length]).join('');

export type NewEvent = { title: string; target: number; tz: string | null; message: string | null };
export function validTz(tz: string) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
/** Validates the create body. Returns the clean event or an error message. */
export function validateEvent(b: unknown, now: number): NewEvent | string {
  const o = (b ?? {}) as Record<string, unknown>;
  const title = typeof o.title === 'string' ? o.title.trim().replace(/\s+/g, ' ') : '';
  if (!title) return 'Title is required';
  if ([...title].length > MAX_TITLE) return `Title is too long (max ${MAX_TITLE} characters)`;
  const target = typeof o.target === 'number' ? Math.round(o.target) : NaN;
  if (!Number.isFinite(target)) return 'Pick a date and time';
  if (target <= now) return 'The date must be in the future';
  if (target > now + 100 * YEAR) return 'The date must be within 100 years';
  const tz = typeof o.tz === 'string' && o.tz ? o.tz : null;
  if (tz && (tz.length > 64 || !validTz(tz))) return 'Unknown time zone';
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  if ([...message].length > MAX_MESSAGE) return `Message is too long (max ${MAX_MESSAGE} characters)`;
  return { title, target, tz, message: message || null };
}
