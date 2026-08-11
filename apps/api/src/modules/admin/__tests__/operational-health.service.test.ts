import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { pool } from '../../../db/client';
import { redisService } from '../../../infrastructure/redis';
import { scheduler } from '../../../jobs/scheduler';
import { notificationOutboxRepository } from '../../notifications/notification-outbox.repository';
import {
  operationalHealthInternals,
  operationalHealthService,
} from '../operational-health.service';

describe('operationalHealthService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps demo payment healthy without PSP credentials and returns sanitized aggregates', async () => {
    jest.spyOn(pool, 'query').mockResolvedValue({ rows: [], rowCount: 1 } as never);
    jest.spyOn(redisService, 'health').mockReturnValue({ enabled: false, status: 'disabled' });
    jest.spyOn(redisService, 'ping').mockResolvedValue(false);
    jest.spyOn(scheduler, 'status').mockReturnValue({
      running: true,
      registeredJobs: 8,
      notificationDeliveryOwner: 'api',
    });
    jest.spyOn(notificationOutboxRepository, 'deliveryMetrics').mockResolvedValue({
      pending: '2',
      retrying: '1',
      failed: '0',
      oldest_pending_seconds: '12',
      latency_seconds: '1.5',
    });

    const snapshot = await operationalHealthService.getSnapshot();

    expect(snapshot.components.payment).toMatchObject({
      status: 'healthy',
      mode: 'demo',
      provider: 'demo',
    });
    expect(snapshot.components.line.status).toBe('not_configured');
    expect(snapshot.notifications).toMatchObject({ pending: 2, retrying: 1, failed: 0 });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /accessToken|channelSecret|apiKey|checksumKey|lineUserId|organizationId|payload/i
    );
  });

  it('reports controlled dependency failures without throwing', async () => {
    jest.spyOn(pool, 'query').mockResolvedValue({ rows: [], rowCount: 1 } as never);
    jest.spyOn(redisService, 'health').mockReturnValue({ enabled: true, status: 'degraded' });
    jest.spyOn(redisService, 'ping').mockResolvedValue(false);
    jest.spyOn(scheduler, 'status').mockReturnValue({
      running: false,
      registeredJobs: 0,
      notificationDeliveryOwner: 'api',
    });
    jest
      .spyOn(notificationOutboxRepository, 'deliveryMetrics')
      .mockRejectedValue(new Error('down'));

    const snapshot = await operationalHealthService.getSnapshot();

    expect(snapshot.status).toBe('unavailable');
    expect(snapshot.components.redis.status).toBe('degraded');
    expect(snapshot.components.worker.status).toBe('degraded');
    expect(snapshot.notifications.status).toBe('unavailable');
  });

  it('accepts only the safe worker heartbeat shape', () => {
    expect(
      operationalHealthInternals.parseHeartbeat(
        JSON.stringify({ status: 'ready', updatedAt: '2026-08-11T00:00:00.000Z' })
      )
    ).toEqual({ status: 'ready', updatedAt: '2026-08-11T00:00:00.000Z' });
    expect(operationalHealthInternals.parseHeartbeat('{"token":"secret"}')).toBeNull();
    expect(operationalHealthInternals.parseHeartbeat('invalid')).toBeNull();
  });
});
