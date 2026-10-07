import type { Hono } from 'hono';
import type { AppEnv } from '../auth.ts';

/** A tool is a Hono app that answers every request on <name>.DOMAIN. See CONTRACT.md. */
/** `public: true` = the tool's page needs no login (the launcher shows it unlocked); omitted = sign-in required. */
export type Tool = {
  name: string;
  /** Launcher title, short (1-2 words). */
  title: string;
  /** Launcher description, short (under ~35 chars). */
  blurb: string;
  /** Inner markup of a 24x24 stroke icon (lucide style: paths/circles/rects, no <svg> wrapper, no fill/stroke attrs). */
  icon: string;
  /** One line shown in the launcher's details panel: what is public and what needs sign-in. */
  note: string;
  public?: boolean;
  app: Hono<AppEnv>;
};
