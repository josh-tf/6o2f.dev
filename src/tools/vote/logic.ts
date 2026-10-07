// Pure poll logic: validation, ids, voter hashing, results. No Worker bindings, so it is unit-testable.
export const MAX_POLLS = 50;
export const MAX_QUESTION = 200;
export const MAX_OPTION = 100;
const DAY = 86_400_000;
const ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 chars, no look-alikes

export type NewPoll = { question: string; options: string[]; multi: boolean; showResults: boolean; closesAt: number };

export function newId(len = 8): string {
  const b = crypto.getRandomValues(new Uint8Array(len));
  return [...b].map((x) => ID_ALPHABET[x % ID_ALPHABET.length]).join('');
}

/** Validates the create body. Returns the clean poll or an error message. */
export function validateCreate(b: unknown, now: number): NewPoll | string {
  const o = (b ?? {}) as Record<string, unknown>;
  const question = typeof o.question === 'string' ? o.question.trim() : '';
  if (!question) return 'Question is required';
  if (question.length > MAX_QUESTION) return `Question is too long (max ${MAX_QUESTION} characters)`;
  if (!Array.isArray(o.options)) return 'Options must be a list';
  const options = o.options.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  if (options.some((x) => x.length > MAX_OPTION)) return `An option is too long (max ${MAX_OPTION} characters)`;
  if (options.length < 2 || options.length > 10) return 'Give 2 to 10 options';
  if (new Set(options.map((x) => x.toLowerCase())).size !== options.length) return 'Options must be different from each other';
  const days = o.days === undefined ? 7 : Number(o.days);
  if (!Number.isFinite(days) || days < 1 || days > 30 || !Number.isInteger(days)) return 'Expiry must be 1 to 30 days';
  return { question, options, multi: o.multi === true, showResults: o.showResults !== false, closesAt: now + days * DAY };
}

/** Validates a ballot against a poll. Returns sorted unique option indexes or an error message. */
export function validateChoices(raw: unknown, optionCount: number, multi: boolean): number[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'Pick an option';
  if (raw.length > optionCount) return 'Too many choices';
  const set = new Set<number>();
  for (const x of raw) {
    if (!Number.isInteger(x) || x < 0 || x >= optionCount) return 'Invalid choice';
    set.add(x);
  }
  if (set.size !== raw.length) return 'Duplicate choices';
  if (!multi && set.size !== 1) return 'Pick exactly one option';
  return [...set].sort((a, b) => a - b);
}

/** voter = SHA-256(secret + poll id + ip + user agent), hex. The raw IP is never stored. */
export async function voterHash(secret: string, pollId: string, ip: string, ua: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}\0${pollId}\0${ip}\0${ua}`));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const isOpen = (p: { closes_at: number }, now: number) => p.closes_at > now;

/** Results are public while open only when the creator allowed it; after closing they are always shown. */
export const canSeeResults = (p: { show_results: number; closes_at: number }, now: number) => !!p.show_results || !isOpen(p, now);

/** Per-option counts from json_each rows, plus integer-safe percentages of voters (multi-choice sums can exceed 100). */
export function tally(optionCount: number, rows: { i: number; n: number }[], voters: number) {
  const counts = Array<number>(optionCount).fill(0);
  for (const r of rows) if (r.i >= 0 && r.i < optionCount) counts[r.i] = r.n;
  return { voters, counts, percents: counts.map((n) => (voters ? Math.round((n / voters) * 100) : 0)) };
}

/** Tiny in-memory limiter (per isolate). ponytail: not shared across isolates; move to D1/DO if abused. */
export function makeLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now: number) => {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] > windowMs) hits.delete(k);
    return recent.length <= max;
  };
}
