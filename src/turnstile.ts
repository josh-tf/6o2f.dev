// Cloudflare Turnstile for public (signed-out) writes. The page renders the widget with env.TURNSTILE_SITEKEY and sends its token;
// the handler calls verifyTurnstile before doing the write. Tokens are single-use, so the page resets its widget after each attempt.
import type { Context } from 'hono';
import { fail, type AppEnv } from './auth.ts';

/** Throws 403 unless `token` is a fresh Turnstile token issued on one of our hosts for `action`. Fails closed. */
export async function verifyTurnstile(c: Context<AppEnv>, token: unknown, action: string): Promise<void> {
  const no = () => fail(403, 'Could not confirm you are human. Complete the check and try again.');
  if (typeof token !== 'string' || !token || token.length > 2048 || !c.env.TURNSTILE_SECRET) no();
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: c.env.TURNSTILE_SECRET, response: token as string, remoteip: c.req.header('cf-connecting-ip') ?? '' }),
    signal: AbortSignal.timeout(10_000),
  })
    .then((x) => (x.ok ? x.json<{ success?: boolean; action?: string; hostname?: string }>() : null))
    .catch(() => null);
  if (!r?.success) no();
  if (c.env.DEV) return; // the test keys in .dev.vars.example answer with hostname example.com and no action
  const host = r!.hostname ?? '';
  if (r!.action !== action || !(host === c.env.DOMAIN || host.endsWith(`.${c.env.DOMAIN}`))) no();
}
