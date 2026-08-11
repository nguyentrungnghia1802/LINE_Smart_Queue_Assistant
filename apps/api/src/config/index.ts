import path from 'node:path';

import dotenv from 'dotenv';

// Jest cases provide isolated environment values and must not inherit local secrets.
if (!process.env.JEST_WORKER_ID) {
  dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
}

function positiveInteger(
  name: string,
  fallback: number,
  environment: NodeJS.ProcessEnv = process.env
): number {
  const value = Number.parseInt(environment[name] ?? String(fallback), 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export type PaymentRuntimeMode = 'demo' | 'external';

export interface PaymentRuntimeConfiguration {
  mode: PaymentRuntimeMode;
  demoWebhookSecret: string;
  externalRedirectBaseUrl: string;
  maxWebhookAgeSeconds: number;
  payos: {
    clientId: string;
    apiKey: string;
    checksumKey: string;
  };
}

export function resolvePaymentConfiguration(
  environment: NodeJS.ProcessEnv = process.env
): PaymentRuntimeConfiguration {
  const rawMode = (environment.PAYMENT_MODE ?? 'demo').trim().toLowerCase();
  if (rawMode !== 'demo' && rawMode !== 'external') {
    throw new Error('PAYMENT_MODE must be demo or external');
  }

  const payos = {
    clientId: environment.PAYOS_CLIENT_ID?.trim() ?? '',
    apiKey: environment.PAYOS_API_KEY?.trim() ?? '',
    checksumKey: environment.PAYOS_CHECKSUM_KEY?.trim() ?? '',
  };

  if (rawMode === 'external') {
    const missing = [
      !payos.clientId && 'PAYOS_CLIENT_ID',
      !payos.apiKey && 'PAYOS_API_KEY',
      !payos.checksumKey && 'PAYOS_CHECKSUM_KEY',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`${missing.join(', ')} must be set when PAYMENT_MODE=external`);
    }
  }

  return {
    mode: rawMode,
    demoWebhookSecret:
      environment.DEMO_PAYMENT_WEBHOOK_SECRET ?? environment.JWT_SECRET ?? 'demo-payment-secret',
    externalRedirectBaseUrl: environment.PAYMENT_EXTERNAL_REDIRECT_BASE_URL?.trim() ?? '',
    maxWebhookAgeSeconds: positiveInteger('PAYMENT_WEBHOOK_MAX_AGE_SECONDS', 300, environment),
    payos,
  };
}

function optionalRedisUrl(): string {
  const value = process.env.REDIS_URL?.trim() ?? '';
  if (!value) return '';

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL');
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol');
  }

  return value;
}

function redisKeyPrefix(): string {
  const value = process.env.REDIS_KEY_PREFIX?.trim() || 'sqa';
  if (!/^[a-zA-Z0-9:_-]{1,64}$/.test(value)) {
    throw new Error('REDIS_KEY_PREFIX must contain 1-64 safe key-prefix characters');
  }
  return value;
}

function notificationDeliveryOwner(): 'api' | 'bullmq' {
  const value = process.env.LINE_NOTIFICATION_DELIVERY_OWNER?.trim() || 'api';
  if (value !== 'api' && value !== 'bullmq') {
    throw new Error('LINE_NOTIFICATION_DELIVERY_OWNER must be api or bullmq');
  }
  return value;
}

function optionalRatio(name: string, fallback: number): number {
  const value = Number.parseFloat(process.env[name] ?? String(fallback));
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1`);
  }
  return value;
}

function optionalBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
}

type MediaStorageProvider = 'local' | 'mock' | 's3';

function mediaStorageProvider(): MediaStorageProvider {
  const configured = (
    process.env.MEDIA_STORAGE_PROVIDER ??
    process.env.MEDIA_STORAGE_MODE ??
    (process.env.NODE_ENV === 'test' ? 'mock' : 'local')
  )
    .trim()
    .toLowerCase();

  if (configured === 'local' || configured === 'mock' || configured === 's3') {
    return configured;
  }
  throw new Error('MEDIA_STORAGE_PROVIDER must be local, mock, or s3');
}

function requiredS3Value(name: string, provider: MediaStorageProvider): string {
  const value = process.env[name]?.trim() ?? '';
  if (provider === 's3' && !value) throw new Error(`${name} must be set when media storage is s3`);
  return value;
}

function s3PublicBaseUrl(provider: MediaStorageProvider): string {
  const value = requiredS3Value('S3_PUBLIC_BASE_URL', provider);
  if (!value) return '';

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('S3_PUBLIC_BASE_URL must be a valid http(s) URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('S3_PUBLIC_BASE_URL must use http:// or https://');
  }
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    throw new Error('S3_PUBLIC_BASE_URL must use https:// in production');
  }
  return value.replace(/\/$/, '');
}

function localMediaDir(provider: MediaStorageProvider): string {
  const configured = process.env.MEDIA_LOCAL_DIR?.trim();
  if (provider === 'local' && process.env.NODE_ENV === 'production' && !configured) {
    throw new Error('MEDIA_LOCAL_DIR must be set when media storage is local in production');
  }
  return path.resolve(__dirname, configured || '../../../../var/media');
}

const configuredMediaStorageProvider = mediaStorageProvider();
const configuredNodeEnv = (process.env.NODE_ENV ?? 'development') as
  'development' | 'production' | 'test';
const configuredPayments = resolvePaymentConfiguration();

export const config = {
  nodeEnv: configuredNodeEnv,
  port: Number.parseInt(process.env.API_PORT ?? '4000', 10),
  host: process.env.API_HOST ?? '0.0.0.0',

  database: {
    url: process.env.DATABASE_URL ?? '',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    name: process.env.DB_NAME ?? 'line_queue',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    poolMax: positiveInteger('DB_POOL_MAX', configuredNodeEnv === 'test' ? 2 : 20),
    poolIdleTimeoutMs: positiveInteger('DB_POOL_IDLE_TIMEOUT_MS', 30_000),
    poolConnectionTimeoutMs: positiveInteger('DB_POOL_CONNECTION_TIMEOUT_MS', 5_000),
  },

  redis: {
    url: optionalRedisUrl(),
    connectTimeoutMs: positiveInteger('REDIS_CONNECT_TIMEOUT_MS', 5_000),
    commandTimeoutMs: positiveInteger('REDIS_COMMAND_TIMEOUT_MS', 1_000),
    keyPrefix: redisKeyPrefix(),
    publicBranchCacheTtlMs: positiveInteger('REDIS_PUBLIC_BRANCH_CACHE_TTL_MS', 5_000),
    publicQueueCacheTtlMs: positiveInteger('REDIS_PUBLIC_QUEUE_CACHE_TTL_MS', 3_000),
  },

  realtime: {
    keepAliveMs: positiveInteger('SSE_KEEP_ALIVE_MS', 15_000),
    retryMs: positiveInteger('SSE_RETRY_MS', 3_000),
    maxConnectionDurationMs: positiveInteger('SSE_MAX_CONNECTION_DURATION_MS', 300_000),
    maxConnections: positiveInteger('SSE_MAX_CONNECTIONS', 1_000),
    maxConnectionsPerUser: positiveInteger('SSE_MAX_CONNECTIONS_PER_USER', 3),
  },

  bullmq: {
    notificationDeliveryOwner: notificationDeliveryOwner(),
    startupTimeoutMs: positiveInteger('BULLMQ_STARTUP_TIMEOUT_MS', 10_000),
    jobTimeoutMs: positiveInteger('BULLMQ_JOB_TIMEOUT_MS', 300_000),
    workerConcurrency: positiveInteger('BULLMQ_WORKER_CONCURRENCY', 1),
    providerRateLimitMax: positiveInteger('BULLMQ_PROVIDER_RATE_LIMIT_MAX', 20),
    providerRateLimitDurationMs: positiveInteger('BULLMQ_PROVIDER_RATE_LIMIT_DURATION_MS', 1_000),
    heartbeatFile: process.env.WORKER_HEALTH_FILE ?? '/tmp/sqa-worker-health',
    heartbeatIntervalMs: positiveInteger('WORKER_HEARTBEAT_INTERVAL_MS', 10_000),
  },

  observability: {
    serviceName: process.env.OTEL_SERVICE_NAME?.trim() || 'line-smart-queue-api',
    release: process.env.SENTRY_RELEASE?.trim() || process.env.APP_RELEASE?.trim() || '',
    environment: process.env.SENTRY_ENVIRONMENT?.trim() || process.env.NODE_ENV || 'development',
    otel: {
      enabled:
        process.env.OTEL_SDK_DISABLED !== 'true' &&
        Boolean(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim()),
      endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() || '',
      sampleRatio: optionalRatio('OTEL_TRACES_SAMPLER_ARG', 0.1),
    },
    sentry: {
      dsn: process.env.SENTRY_DSN?.trim() || '',
    },
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
    messagingRequestTimeoutMs: positiveInteger('LINE_MESSAGING_REQUEST_TIMEOUT_MS', 10_000),
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
    dispatchClaimTimeoutSeconds: positiveInteger(
      'LINE_NOTIFICATION_DISPATCH_CLAIM_TIMEOUT_SECONDS',
      60
    ),
  },

  email: {
    mode: (process.env.EMAIL_TRANSPORT ??
      (process.env.NODE_ENV === 'production' ? 'disabled' : 'mock')) as
      'disabled' | 'mock' | 'smtp',
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

  payments: configuredPayments,

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
    travelProvider: (process.env.LOCATION_TRAVEL_PROVIDER ?? 'mock') as 'mock' | 'google_routes',
    googleRoutesApiKey: process.env.GOOGLE_ROUTES_API_KEY ?? '',
    travelBufferMinutes: positiveInteger('LOCATION_TRAVEL_BUFFER_MINUTES', 8),
    retentionDays: Number.parseInt(process.env.LOCATION_RETENTION_DAYS ?? '30', 10),
    alertBatchSize: Number.parseInt(process.env.LOCATION_ALERT_BATCH_SIZE ?? '50', 10),
    maxAttempts: Number.parseInt(process.env.LOCATION_ALERT_MAX_ATTEMPTS ?? '5', 10),
    claimTimeoutSeconds: positiveInteger('LOCATION_ALERT_CLAIM_TIMEOUT_SECONDS', 900),
    cleanupBatchSize: Number.parseInt(process.env.LOCATION_CLEANUP_BATCH_SIZE ?? '500', 10),
    workerIntervalMs: Number.parseInt(process.env.LOCATION_WORKER_INTERVAL_MS ?? '60000', 10),
    cleanupIntervalMs: Number.parseInt(process.env.LOCATION_CLEANUP_INTERVAL_MS ?? '3600000', 10),
  },

  forecasts: {
    retentionDays: Number.parseInt(process.env.FORECAST_RETENTION_DAYS ?? '90', 10),
    intervalMs: Number.parseInt(process.env.FORECAST_WORKER_INTERVAL_MS ?? '3600000', 10),
  },

  media: {
    provider: configuredMediaStorageProvider,
    localDir: localMediaDir(configuredMediaStorageProvider),
    publicBaseUrl: process.env.MEDIA_PUBLIC_BASE_URL ?? '/media',
    maxOriginalBytes: Number.parseInt(process.env.MEDIA_MAX_ORIGINAL_BYTES ?? '5242880', 10),
    requestBodyLimit: process.env.MEDIA_REQUEST_BODY_LIMIT ?? '8mb',
    s3: {
      endpoint: process.env.S3_ENDPOINT?.trim() ?? '',
      region: requiredS3Value('S3_REGION', configuredMediaStorageProvider),
      bucket: requiredS3Value('S3_BUCKET', configuredMediaStorageProvider),
      accessKeyId: requiredS3Value('S3_ACCESS_KEY_ID', configuredMediaStorageProvider),
      secretAccessKey: requiredS3Value('S3_SECRET_ACCESS_KEY', configuredMediaStorageProvider),
      publicBaseUrl: s3PublicBaseUrl(configuredMediaStorageProvider),
      forcePathStyle: optionalBoolean('S3_FORCE_PATH_STYLE', false),
    },
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },

  web: {
    origin: process.env.WEB_ORIGIN ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  },
} as const;
