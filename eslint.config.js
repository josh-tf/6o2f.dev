// Lint: the Worker (src, TypeScript), the tool pages (public/_, browser ES modules) and the dev scripts (Node).
// web-mail is a separate Vite app with its own toolchain; vendored libraries and generated files are skipped.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules', '.wrangler', 'worker-configuration.d.ts', 'public/_/mail', '**/vendor/**', 'web-mail'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { globals: { ...globals.worker } } },
  { files: ['public/**/*.js'], languageOptions: { sourceType: 'module', globals: { ...globals.browser } } },
  // Scripts run in Node, but their page.evaluate() callbacks run in the browser (axe is injected there).
  { files: ['scripts/**/*.mjs', '*.config.js'], languageOptions: { globals: { ...globals.node, ...globals.browser, axe: 'readonly' } } },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // Empty catch is deliberate around storage and best-effort calls (private mode, blocked site data).
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      // Several tools (escape, unicode, hex, lines) match control characters on purpose.
      'no-control-regex': 'off',
    },
  },
  // Tests import the browser modules from public/_ (plain JS) with @ts-ignore, as CONTRACT.md specifies.
  { files: ['src/**/*.test.ts'], rules: { '@typescript-eslint/ban-ts-comment': 'off', '@typescript-eslint/no-explicit-any': 'off' } },
);
