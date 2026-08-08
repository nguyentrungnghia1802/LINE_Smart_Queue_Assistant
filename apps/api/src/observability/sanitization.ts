const REDACTED = '[REDACTED]';

const SENSITIVE_KEY =
  /(?:authorization|cookie|password|passcode|hash|jwt|token|secret|credential|api.?key|smtp|redis.?url|line.?user|user.?id|email|phone|latitude|longitude|coordinate|raw.?payload|provider.?payload)/i;
const TOKEN_LIKE_VALUE = /^(?:Bearer\s+)?[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const EMAIL_LIKE_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\+?\d[\d\s()-]{8,}\d/g, '[REDACTED_PHONE]')
    .slice(0, 8_000);
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

export function sanitizeTelemetryValue(value: unknown, key = '', depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (depth > 6) return '[TRUNCATED]';
  if (
    value === null ||
    value === undefined ||
    typeof value === 'boolean' ||
    typeof value === 'number'
  ) {
    return value;
  }
  if (typeof value === 'string') {
    if (/^https?:\/\//i.test(value)) return safeUrl(value);
    if (TOKEN_LIKE_VALUE.test(value) || EMAIL_LIKE_VALUE.test(value)) return REDACTED;
    return sanitizeString(value).slice(0, 2_000);
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message).slice(0, 1_000),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeTelemetryValue(item, key, depth + 1));
  }
  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value).slice(0, 100)) {
      sanitized[childKey] = sanitizeTelemetryValue(childValue, childKey, depth + 1);
    }
    return sanitized;
  }
  return String(value).slice(0, 1_000);
}

export function sanitizeSentryEvent<T>(event: T): T {
  return sanitizeTelemetryValue(event) as T;
}
