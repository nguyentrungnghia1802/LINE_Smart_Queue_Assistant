import { beforeEach, describe, expect, it, vi } from 'vitest';

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: { setContext: ReturnType<typeof vi.fn> }) => void) =>
    callback({ setContext: vi.fn() })
  ),
}));

vi.mock('@sentry/react', () => sentry);

import {
  captureFrontendException,
  initializeFrontendObservability,
  resetFrontendObservabilityForTests,
  sanitizeFrontendTelemetryForTests,
} from '../sentry';

describe('frontend observability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1');
    resetFrontendObservabilityForTests();
  });

  it('initializes Sentry and captures runtime failures', () => {
    initializeFrontendObservability();
    const error = new Error('render failed');
    captureFrontendException(error, { route: '/manager', email: 'private@example.com' });

    expect(sentry.init).toHaveBeenCalledOnce();
    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('scrubs browser auth and customer data', () => {
    expect(
      sanitizeFrontendTelemetryForTests({
        token: 'secret',
        phone: '0900000000',
        route: '/staff',
      })
    ).toEqual({ token: '[REDACTED]', phone: '[REDACTED]', route: '/staff' });
  });

  it('does not throw when Sentry is unavailable', () => {
    sentry.captureException.mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });
    initializeFrontendObservability();

    expect(() => captureFrontendException(new Error('business error'))).not.toThrow();
  });
});
