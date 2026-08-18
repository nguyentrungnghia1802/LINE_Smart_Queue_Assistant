import { resolveLogMonitoringConfiguration } from '../index';

describe('Log Monitoring configuration', () => {
  it('defaults to disabled without requiring endpoint or credentials', () => {
    const resolved = resolveLogMonitoringConfiguration({ NODE_ENV: 'test' });

    expect(resolved).toMatchObject({
      enabled: false,
      endpoint: '',
      apiKey: '',
      service: 'line-smart-queue-api',
      environment: 'test',
    });
  });

  it('requires an endpoint and project-scoped API key when enabled', () => {
    expect(() =>
      resolveLogMonitoringConfiguration({
        NODE_ENV: 'test',
        LOG_MONITORING_ENABLED: 'true',
      })
    ).toThrow('LOG_MONITORING_ENDPOINT');

    expect(() =>
      resolveLogMonitoringConfiguration({
        NODE_ENV: 'test',
        LOG_MONITORING_ENABLED: 'true',
        LOG_MONITORING_ENDPOINT: 'https://monitoring.example.test',
      })
    ).toThrow('LOG_MONITORING_API_KEY');
  });

  it('rejects an unsafe endpoint protocol and invalid backoff bounds', () => {
    expect(() =>
      resolveLogMonitoringConfiguration({
        NODE_ENV: 'test',
        LOG_MONITORING_ENABLED: 'true',
        LOG_MONITORING_ENDPOINT: 'file:///tmp/logs',
        LOG_MONITORING_API_KEY: 'test-key',
      })
    ).toThrow('http:// or https://');

    expect(() =>
      resolveLogMonitoringConfiguration({
        NODE_ENV: 'test',
        LOG_MONITORING_BACKOFF_MS: '100',
        LOG_MONITORING_MAX_BACKOFF_MS: '10',
      })
    ).toThrow('MAX_BACKOFF_MS');
  });
});
