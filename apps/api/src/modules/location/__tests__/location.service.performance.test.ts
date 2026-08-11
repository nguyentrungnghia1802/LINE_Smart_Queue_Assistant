import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../config', () => ({
  config: {
    location: {
      alertBatchSize: 50,
      claimTimeoutSeconds: 900,
      maxAttempts: 3,
      travelBufferMinutes: 8,
    },
  },
}));
jest.mock('../../../db/client', () => ({
  pool: {
    connect: jest.fn(),
  },
}));
jest.mock('../../../db/transaction', () => ({ withTransaction: jest.fn() }));
jest.mock('../location.repository');
jest.mock('../travel-time.provider');
jest.mock('../../notifications/notification-outbox.repository');

import { pool } from '../../../db/client';
import { withTransaction } from '../../../db/transaction';
import { notificationOutboxRepository } from '../../notifications/notification-outbox.repository';
import { locationRepository } from '../location.repository';
import { locationService } from '../location.service';
import { travelTimeProvider } from '../travel-time.provider';

const client = { query: jest.fn() };
const processingStartedAt = new Date('2026-08-11T12:00:00.000Z');
const row = {
  id: 'alert-1',
  organization_id: 'org-1',
  queue_entry_id: 'entry-1',
  event_key: 'location_alert:alert-1',
  distance_to_org_meters: 1_000,
  threshold_meters: 0,
  attempt_count: 1,
  line_user_id: 'line-1',
  user_id: 'user-1',
  ticket_code: 'A001',
  estimated_wait_seconds: 300,
  ahead_count: 2,
  customer_latitude: '35.6812',
  customer_longitude: '139.7671',
  branch_latitude: '35.6895',
  branch_longitude: '139.6917',
  processing_started_at: processingStartedAt,
};

describe('locationService.processAlerts transaction boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client as never));
    jest.mocked(locationRepository.claimDue).mockResolvedValue([row]);
    jest.mocked(locationRepository.mark).mockResolvedValue(true);
    jest
      .mocked(notificationOutboxRepository.enqueue)
      .mockResolvedValue({ id: 'notification-1' } as never);
    jest.mocked(travelTimeProvider.estimate).mockResolvedValue({
      distanceMeters: 1_000,
      durationSeconds: 900,
      provider: 'mock-walking-v1',
    });
  });

  it('performs provider I/O before opening the short finalization transaction', async () => {
    await expect(locationService.processAlerts()).resolves.toBe(1);

    expect(locationRepository.claimDue).toHaveBeenCalledWith(50, 900);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(jest.mocked(travelTimeProvider.estimate).mock.invocationCallOrder[0]).toBeLessThan(
      jest.mocked(withTransaction).mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    );
    expect(notificationOutboxRepository.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ eventKey: row.event_key, eventType: 'location_warning' }),
      client
    );
    expect(locationRepository.mark).toHaveBeenCalledWith(
      row.id,
      'sent',
      client,
      processingStartedAt
    );
  });

  it('releases a failed provider attempt back to the retry schedule', async () => {
    jest.mocked(travelTimeProvider.estimate).mockRejectedValueOnce(new Error('provider timeout'));

    await expect(locationService.processAlerts()).resolves.toBe(1);

    expect(notificationOutboxRepository.enqueue).not.toHaveBeenCalled();
    expect(locationRepository.mark).toHaveBeenCalledWith(
      row.id,
      'pending',
      client,
      processingStartedAt,
      'provider timeout'
    );
  });

  it('marks an exhausted claimed attempt as failed', async () => {
    jest.mocked(locationRepository.claimDue).mockResolvedValueOnce([{ ...row, attempt_count: 3 }]);
    jest.mocked(travelTimeProvider.estimate).mockRejectedValueOnce(new Error('provider timeout'));

    await locationService.processAlerts();

    expect(locationRepository.mark).toHaveBeenCalledWith(
      row.id,
      'failed',
      client,
      processingStartedAt,
      'provider timeout'
    );
  });
});
