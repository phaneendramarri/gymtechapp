import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  // Absolute asset URLs so deep client-side routes (/members/123, /portal…)
  // resolve JS/CSS from the domain root on full page loads. A relative base
  // ('./') made every bookmarked/refreshed page below / render blank because
  // the browser requested /members/assets/… instead of /assets/….
  base: '/',
  // Tell Vite to load .env files from the repo root so --mode staging/production
  // picks up the root .env.staging / .env.production files.
  envDir: path.resolve(__dirname, '../..'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
