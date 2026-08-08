import * as Sentry from '@sentry/react';

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /(?:authorization|cookie|password|jwt|token|secret|credential|api.?key|line.?user|user.?id|email|phone|latitude|longitude|coordinate|payload)/i;

function sanitize(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (depth > 5) return '[TRUNCATED]';
  if (
    value === null ||
    value === undefined ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        url.username = '';
        url.password = '';
        url.search = '';
        url.hash = '';
        return url.toString();
      } catch {
        return value.slice(0, 2_000);
      }
    }
    if (/^(?:Bearer\s+)?[\w-]{16,}\.[\w-]{8,}\.[\w-]{8,}$/.test(value)) return REDACTED;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return REDACTED;
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
      .replace(/[\w-]{16,}\.[\w-]{8,}\.[\w-]{8,}/g, REDACTED)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
      .replace(/\+?\d[\d\s()-]{8,}\d/g, '[REDACTED_PHONE]')
      .slice(0, 2_000);
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, key, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey, depth + 1)])
    );
  }
  return String(value).slice(0, 1_000);
}

let initialized = false;

export function initializeFrontendObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (initialized || !dsn) return;
  initialized = true;
  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
      sendDefaultPii: false,
      beforeSend: (event) => sanitize(event) as typeof event,
    });
  } catch {
    initialized = false;
  }
}

export function captureFrontendException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  try {
    Sentry.withScope((scope) => {
      if (context) scope.setContext('application', sanitize(context) as Record<string, unknown>);
      Sentry.captureException(error);
    });
  } catch {
    // Observability must never replace the localized application fallback.
  }
}

export function sanitizeFrontendTelemetryForTests(value: unknown): unknown {
  return sanitize(value);
}

export function resetFrontendObservabilityForTests(): void {
  initialized = false;
}
