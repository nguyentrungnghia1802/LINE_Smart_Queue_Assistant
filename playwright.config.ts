import { defineConfig, devices } from '@playwright/test';

const e2eLineUserId = `mock-user-e2e-${process.env.E2E_RUN_ID ?? Date.now()}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
      testMatch: /responsive/,
    },
  ],
  webServer: [
    {
      command: 'node apps/api/dist/server.js',
      url: 'http://127.0.0.1:4100/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        API_HOST: '127.0.0.1',
        API_PORT: '4100',
        CORS_ORIGIN: 'http://127.0.0.1:5174',
        WEB_ORIGIN: 'http://127.0.0.1:5174',
        JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-only-jwt-secret-not-for-production',
        LINE_CHANNEL_ACCESS_TOKEN: '',
        LINE_ID_TOKEN_VERIFICATION_MODE: 'mock',
        LINE_ID_TOKEN_MOCK_VALUE: 'mock-liff-id-token',
        LINE_ID_TOKEN_MOCK_USER_ID: e2eLineUserId,
        LINE_ID_TOKEN_MOCK_DISPLAY_NAME: 'E2Eテストユーザー',
        LINE_NOTIFICATION_WORKER_INTERVAL_MS: '500',
        MEDIA_STORAGE_MODE: 'mock',
      },
    },
    {
      command: 'npm run dev -w apps/web -- --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_URL: 'http://127.0.0.1:4100',
        VITE_LIFF_MOCK: 'true',
        VITE_LIFF_MOCK_LOGGED_IN: 'true',
        VITE_LIFF_MOCK_USER_ID: e2eLineUserId,
        VITE_LIFF_MOCK_DISPLAY_NAME: 'E2Eテストユーザー',
        VITE_LIFF_MOCK_INIT_DELAY_MS: '0',
        VITE_LIFF_DEFAULT_BOOKING_PATH: '/liff/qr/demo-queue-lab-2026',
        VITE_PAYMENT_MODE: 'demo',
      },
    },
  ],
});
