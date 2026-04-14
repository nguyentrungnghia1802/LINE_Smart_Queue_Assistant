import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Resolve shared package from TypeScript source so Rollup (vite build)
      // receives ESM-compatible input instead of the CJS dist output.
      // tsc (noEmit typecheck) still resolves via node_modules/dist typings.
      '@line-queue/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // Proxy /api/* to the Express backend during development
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
