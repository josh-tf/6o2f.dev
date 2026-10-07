import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Built into the Worker's static assets; the Worker serves index.html for every non-/api path on mail.6o2f.dev.
export default defineConfig({
  base: '/_/mail/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  build: { outDir: '../public/_/mail', emptyOutDir: true, modulePreload: { polyfill: false } },
  server: { proxy: { '/api': process.env.API_ORIGIN ?? 'http://127.0.0.1:8851' } },
});
