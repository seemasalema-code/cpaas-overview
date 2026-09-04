import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

// A browser-only build: dashboard rows are fetched directly from the Google Sheet.
// No worker, server cache, localStorage, or committed data snapshot is involved.
export default defineConfig({
  base: '/cpaas-overview/',
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: 'github-pages', emptyOutDir: true },
});
