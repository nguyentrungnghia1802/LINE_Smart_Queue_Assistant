import path from 'node:path';

import dotenv from 'dotenv';

// Load .env from monorepo root when running locally
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

function positiveInteger(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

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
    accessTokenExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
  },

  auth: {
    businessIdleTimeoutMinutes: positiveInteger('AUTH_BUSINESS_IDLE_TIMEOUT_MINUTES', 15),
    businessAbsoluteTimeoutHours: positiveInteger('AUTH_BUSINESS_ABSOLUTE_TIMEOUT_HOURS', 12),
    customerSessionDays: positiveInteger('AUTH_CUSTOMER_SESSION_DAYS', 30),
    refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'lq_refresh_session',
    sessionCleanupIntervalMs: positiveInteger('AUTH_SESSION_CLEANUP_INTERVAL_MS', 3_600_000),
    revokedSessionRetentionDays: positiveInteger('AUTH_REVOKED_SESSION_RETENTION_DAYS', 7),
  },

  line: {
    /** Messaging API channel access token used for push/reply and Rich Menu APIs. */
    messagingChannelAccessToken:
      process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ??
      process.env.LINE_CHANNEL_ACCESS_TOKEN ??
      '',
    /** Messaging API channel secret used only for webhook signature verification. */
    messagingChannelSecret:
      process.env.LINE_MESSAGING_CHANNEL_SECRET ?? process.env.LINE_CHANNEL_SECRET ?? '',
    /** Safe diagnostic label; never contains the credential value. */
    messagingChannelSecretSource: process.env.LINE_MESSAGING_CHANNEL_SECRET
      ? 'LINE_MESSAGING_CHANNEL_SECRET'
      : process.env.LINE_CHANNEL_SECRET
        ? 'LINE_CHANNEL_SECRET (legacy)'
        : 'missing',
    /** LINE Login / LIFF channel ID — required to verify OIDC id_tokens. */
    loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID ?? process.env.LINE_CHANNEL_ID ?? '',
    /** LIFF app ID used to generate customer deep links in LINE push messages. */
    loginLiffId:
      process.env.LINE_LOGIN_LIFF_ID ?? process.env.LINE_LIFF_ID ?? process.env.VITE_LIFF_ID ?? '',
    /** Path configured in the LINE Developers Console LIFF Endpoint URL. */
    liffEndpointPath: process.env.LINE_LIFF_ENDPOINT_PATH ?? '/liff',
    /** Local PNG/JPEG image used by the explicit Rich Menu sync command. */
    richMenuImagePath: process.env.LINE_RICH_MENU_IMAGE_PATH ?? '',
    /** Explicit local/E2E escape hatch. Mock verification is rejected in production. */
    idTokenVerificationMode: (process.env.LINE_ID_TOKEN_VERIFICATION_MODE ??
      (process.env.NODE_ENV === 'production' ? 'line' : 'mock')) as 'line' | 'mock',
    mockIdToken: process.env.LINE_ID_TOKEN_MOCK_VALUE ?? 'mock-liff-id-token',
    mockUserId: process.env.LINE_ID_TOKEN_MOCK_USER_ID ?? 'mock-user-001',
    mockDisplayName: process.env.LINE_ID_TOKEN_MOCK_DISPLAY_NAME ?? 'ローカルテストユーザー',
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

  email: {
    mode: (process.env.EMAIL_TRANSPORT ??
      (process.env.NODE_ENV === 'production' ? 'disabled' : 'mock')) as
      | 'disabled'
      | 'mock'
      | 'smtp',
    fromName: process.env.EMAIL_FROM_NAME ?? 'LINE Smart Queue Assistant',
    fromAddress: process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@example.invalid',
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: Number.parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ?? '',
      password: process.env.SMTP_PASSWORD ?? '',
    },
    tokenEncryptionKey: process.env.EMAIL_TOKEN_ENCRYPTION_KEY ?? '',
    activationTtlHours: Number.parseInt(process.env.ACCOUNT_ACTIVATION_TTL_HOURS ?? '72', 10),
    passwordResetTtlMinutes: Number.parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '60', 10),
    deliveryBatchSize: Number.parseInt(process.env.EMAIL_DELIVERY_BATCH_SIZE ?? '20', 10),
    workerIntervalMs: Number.parseInt(process.env.EMAIL_WORKER_INTERVAL_MS ?? '15000', 10),
    maxAttempts: Number.parseInt(process.env.EMAIL_MAX_ATTEMPTS ?? '5', 10),
    retryBaseSeconds: Number.parseInt(process.env.EMAIL_RETRY_BASE_SECONDS ?? '30', 10),
    processingTimeoutSeconds: Number.parseInt(
      process.env.EMAIL_PROCESSING_TIMEOUT_SECONDS ?? '300',
      10
    ),
    mockOutputDir: path.resolve(
      __dirname,
      process.env.EMAIL_MOCK_OUTPUT_DIR ?? '../../../../var/email-preview'
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
