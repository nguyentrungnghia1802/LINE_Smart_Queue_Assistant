import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'src/test', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      '@line-queue/shared': resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
