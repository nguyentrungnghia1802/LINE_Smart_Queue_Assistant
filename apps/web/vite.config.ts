import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { liffCspPlugin } from './vite-plugins/liffCspPlugin.ts';

const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:4000';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [liffCspPlugin(), react(), tailwindcss()],
  // Share the repository-root .env with the API during native local development.
  // Vite only exposes variables prefixed with VITE_ to browser code.
  envDir: resolve(import.meta.dirname, '../..'),

  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      // Resolve shared package from TypeScript source so Rollup (vite build)
      // receives ESM-compatible input instead of the CJS dist output.
      // tsc (noEmit typecheck) still resolves via node_modules/dist typings.
      '@line-queue/shared': resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to the Express backend during development
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
      // Media URLs are persisted as same-origin /media/* paths. Keep local
      // development aligned with the production nginx reverse proxy.
      '/media': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    // Production source maps are not published with the static image. Uploading
    // hidden maps must happen in trusted CI when a private Sentry token exists.
    sourcemap: mode !== 'production',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-router-dom')) return 'router';
          if (id.includes('@tanstack/react-query')) return 'query';
          if (id.includes('@sentry/')) return 'observability';
          if (id.includes('/react/') || id.includes('/react-dom/')) return 'react';
          if (id.includes('i18next')) return 'i18n';
          return undefined;
        },
      },
    },
  },
}));
