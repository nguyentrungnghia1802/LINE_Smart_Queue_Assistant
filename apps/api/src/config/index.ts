import path from 'node:path';

import dotenv from 'dotenv';

// Load .env from monorepo root when running locally
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

export const config = {
  nodeEnv: (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  port: Number.parseInt(process.env.API_PORT ?? '4000', 10),
  host: process.env.API_HOST ?? '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL ?? '',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'line_queue',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },

  line: {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? '',
    channelSecret: process.env.LINE_CHANNEL_SECRET ?? '',
    /** LINE Login / LIFF channel ID — required to verify OIDC id_tokens. */
    channelId: process.env.LINE_CHANNEL_ID ?? '',
    /** LIFF app ID used to generate customer deep links in LINE push messages. */
    liffId: process.env.LINE_LIFF_ID ?? process.env.VITE_LIFF_ID ?? '',
    /** Local PNG/JPEG image used by the explicit Rich Menu sync command. */
    richMenuImagePath: process.env.LINE_RICH_MENU_IMAGE_PATH ?? '',
  },

  notifications: {
    deliveryBatchSize: Number.parseInt(process.env.LINE_NOTIFICATION_BATCH_SIZE ?? '20', 10),
    workerIntervalMs: Number.parseInt(
      process.env.LINE_NOTIFICATION_WORKER_INTERVAL_MS ?? '15000',
      10
    ),
    maxAttempts: Number.parseInt(process.env.LINE_NOTIFICATION_MAX_ATTEMPTS ?? '5', 10),
    retryBaseSeconds: Number.parseInt(process.env.LINE_NOTIFICATION_RETRY_BASE_SECONDS ?? '30', 10),
    processingTimeoutSeconds: Number.parseInt(
      process.env.LINE_NOTIFICATION_PROCESSING_TIMEOUT_SECONDS ?? '300',
      10
    ),
  },

  payments: {
    mode: (process.env.PAYMENT_MODE ?? 'demo') as 'demo' | 'external',
    demoWebhookSecret:
      process.env.DEMO_PAYMENT_WEBHOOK_SECRET ?? process.env.JWT_SECRET ?? 'demo-payment-secret',
    externalRedirectBaseUrl: process.env.PAYMENT_EXTERNAL_REDIRECT_BASE_URL ?? '',
    maxWebhookAgeSeconds: Number.parseInt(process.env.PAYMENT_WEBHOOK_MAX_AGE_SECONDS ?? '300', 10),
  },

  inventory: {
    reservationTtlMinutes: Number.parseInt(
      process.env.INVENTORY_RESERVATION_TTL_MINUTES ?? '1440',
      10
    ),
    expiryBatchSize: Number.parseInt(process.env.INVENTORY_EXPIRY_BATCH_SIZE ?? '100', 10),
    expiryWorkerIntervalMs: Number.parseInt(
      process.env.INVENTORY_EXPIRY_WORKER_INTERVAL_MS ?? '60000',
      10
    ),
  },

  location: {
    retentionDays: Number.parseInt(process.env.LOCATION_RETENTION_DAYS ?? '30', 10),
    alertBatchSize: Number.parseInt(process.env.LOCATION_ALERT_BATCH_SIZE ?? '50', 10),
    maxAttempts: Number.parseInt(process.env.LOCATION_ALERT_MAX_ATTEMPTS ?? '5', 10),
    cleanupBatchSize: Number.parseInt(process.env.LOCATION_CLEANUP_BATCH_SIZE ?? '500', 10),
    workerIntervalMs: Number.parseInt(process.env.LOCATION_WORKER_INTERVAL_MS ?? '60000', 10),
    cleanupIntervalMs: Number.parseInt(process.env.LOCATION_CLEANUP_INTERVAL_MS ?? '3600000', 10),
  },

  forecasts: {
    retentionDays: Number.parseInt(process.env.FORECAST_RETENTION_DAYS ?? '90', 10),
    intervalMs: Number.parseInt(process.env.FORECAST_WORKER_INTERVAL_MS ?? '3600000', 10),
  },

  media: {
    mode: (process.env.MEDIA_STORAGE_MODE ??
      (process.env.NODE_ENV === 'test' ? 'mock' : 'local')) as 'local' | 'mock',
    localDir: path.resolve(__dirname, process.env.MEDIA_LOCAL_DIR ?? '../../../../var/media'),
    publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL ?? '/media',
    maxOriginalBytes: Number.parseInt(process.env.MEDIA_MAX_ORIGINAL_BYTES ?? '5242880', 10),
    requestBodyLimit: process.env.MEDIA_REQUEST_BODY_LIMIT ?? '8mb',
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },

  web: {
    origin: process.env.WEB_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },
} as const;
