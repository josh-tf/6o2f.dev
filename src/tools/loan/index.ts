import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'loan'));

export const tool: Tool = {
  name: 'loan',
  title: 'Loan',
  blurb: 'Repayments and amortisation',
  icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v.01M18 14v.01"/>',
  note: 'Runs in your browser. Nothing is sent or stored.',
  public: true,
  app,
};
