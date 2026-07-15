import { config } from '../../config';
import { pool } from '../../db/client';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';

import { locationRepository } from './location.repository';
import { travelTimeProvider } from './travel-time.provider';

export const locationService = {
  getConsent: locationRepository.getConsent,
  setConsent: locationRepository.setConsent,
  revokeAndDelete: locationRepository.revokeAndDelete,

  async processAlerts(): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const rows = await locationRepository.claimDue(config.location.alertBatchSize, client);
      for (const row of rows) {
        try {
          const estimate = await travelTimeProvider.estimate({
            distanceMeters: row.distance_to_org_meters,
          });
          const notification = await notificationOutboxRepository.enqueue(
            {
              organizationId: row.organization_id,
              queueEntryId: row.queue_entry_id,
              userId: row.user_id,
              lineUserId: row.line_user_id,
              eventType: 'location_warning',
              eventKey: row.event_key,
              payload: {
                ticketCode: row.ticket_code,
                aheadCount: row.ahead_count,
                estimatedWaitSeconds: row.estimated_wait_seconds,
                travelDurationSeconds: estimate.durationSeconds,
                distanceMeters: estimate.distanceMeters,
                travelProvider: estimate.provider,
              },
            },
            client
          );
          await locationRepository.mark(row.id, notification ? 'sent' : 'skipped', client);
        } catch (error) {
          await locationRepository.mark(
            row.id,
            row.attempt_count + 1 >= config.location.maxAttempts ? 'failed' : 'pending',
            client,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  cleanupExpired() {
    return locationRepository.cleanupExpired(config.location.cleanupBatchSize);
  },
};
