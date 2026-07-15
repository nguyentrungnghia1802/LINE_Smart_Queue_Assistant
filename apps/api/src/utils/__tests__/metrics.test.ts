import { beforeEach, describe, expect, it } from '@jest/globals';

import { metricsService } from '../metrics';

describe('metricsService', () => {
  beforeEach(() => {
    metricsService.resetForTests();
  });

  it('tracks counters in the in-memory snapshot', () => {
    metricsService.increment('requests_total');
    metricsService.increment('queue_created_total', 2);
    metricsService.increment('notifications_failed_total');

    expect(metricsService.snapshot()).toMatchObject({
      requests_total: 1,
      queue_created_total: 2,
      notifications_failed_total: 1,
    });
  });

  it('renders Prometheus-compatible output', () => {
    metricsService.increment('requests_total', 3);
    metricsService.increment('notifications_sent_total', 2);

    const output = metricsService.toPrometheus();

    expect(output).toContain('line_queue_requests_total 3');
    expect(output).toContain('line_queue_notifications_sent_total 2');
    expect(output.endsWith('\n')).toBe(true);
  });
});
