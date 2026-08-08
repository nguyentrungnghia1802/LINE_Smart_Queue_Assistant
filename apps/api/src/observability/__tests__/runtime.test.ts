jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  withScope: jest.fn((callback: (scope: { setContext: jest.Mock }) => void) =>
    callback({ setContext: jest.fn() })
  ),
  captureException: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../config', () => ({
  config: {
    observability: {
      serviceName: 'test-api',
      release: 'test-release',
      environment: 'test',
      otel: { enabled: false, endpoint: '', sampleRatio: 1 },
      sentry: { dsn: 'https://public@example.ingest.sentry.io/1' },
    },
  },
}));

import * as Sentry from '@sentry/node';

import { captureException, initializeObservability, resetObservabilityForTests } from '../runtime';

const sentry = Sentry as jest.Mocked<typeof Sentry>;

describe('backend observability runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetObservabilityForTests();
  });

  it('captures selected errors without exporting raw context', () => {
    initializeObservability('worker');
    const error = new Error('job failed');
    captureException(error, { email: 'private@example.com', operation: 'notification.delivery' });

    expect(sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('does not throw when Sentry becomes unavailable', () => {
    sentry.withScope.mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });
    initializeObservability('api');

    expect(() => captureException(new Error('business error'))).not.toThrow();
  });

  it('keeps startup available when Sentry initialization fails', () => {
    sentry.init.mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });

    expect(() => initializeObservability('api')).not.toThrow();
  });
});
