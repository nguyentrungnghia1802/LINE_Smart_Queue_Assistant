import { config } from '../../config';
import { pool } from '../../db/client';
import { ordersRepository } from '../../db/repositories/orders.repository';
import { withTransaction } from '../../db/transaction';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';

import { locationRepository } from './location.repository';
import type { CustomerLocationSnapshotDto } from './location.validator';
import { travelTimeProvider } from './travel-time.provider';

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) *
      Math.cos(radians(to.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * earthRadiusMeters * Math.asin(Math.sqrt(a)));
}

export const locationService = {
  getConsent: locationRepository.getConsent,
  setConsent: locationRepository.setConsent,
  revokeAndDelete: locationRepository.revokeAndDelete,

  async saveRealtimeSnapshot(userId: string, dto: CustomerLocationSnapshotDto) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (!(await locationRepository.isEnabled(userId, client))) {
        await client.query('COMMIT');
        return { activeTicketCount: 0, savedSnapshotCount: 0, consentEnabled: false };
      }

      const targets = await locationRepository.findActiveTargets(userId, client);
      for (const target of targets) {
        const distanceToBranchMeters = distanceMeters(dto, {
          latitude: Number(target.branch_latitude),
          longitude: Number(target.branch_longitude),
        });
        const snapshot = await ordersRepository.createCustomerLocation(
          {
            organizationId: target.organization_id,
            queueEntryId: target.queue_entry_id,
            customerUserId: userId,
            latitude: dto.latitude,
            longitude: dto.longitude,
            accuracyMeters: dto.accuracyMeters,
            distanceToOrgMeters: distanceToBranchMeters,
            consentUserId: userId,
            expiresAt: new Date(Date.now() + config.location.retentionDays * 86_400_000),
          },
          client
        );
        await ordersRepository.createLocationAlert(
          {
            organizationId: target.organization_id,
            queueEntryId: target.queue_entry_id,
            customerLocationId: snapshot.id,
            distanceToOrgMeters: distanceToBranchMeters,
            thresholdMeters: 0,
            dueAt: new Date(),
            rawPayload: {
              queueId: target.queue_id,
              ticketNumber: target.ticket_number,
              ticketCode: target.ticket_code,
              notifyAheadPositions: target.notify_ahead_positions,
              avgServiceSeconds: target.avg_service_seconds,
              source: 'realtime_location',
            },
          },
          client
        );
      }
      await client.query('COMMIT');
      return {
        activeTicketCount: targets.length,
        savedSnapshotCount: targets.length,
        consentEnabled: true,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async processAlerts(): Promise<number> {
    const rows = await locationRepository.claimDue(
      config.location.alertBatchSize,
      config.location.claimTimeoutSeconds
    );
    for (const row of rows) {
      try {
        const estimate = await travelTimeProvider.estimate({
          distanceMeters: row.distance_to_org_meters,
          origin: {
            latitude: Number(row.customer_latitude),
            longitude: Number(row.customer_longitude),
          },
          destination: {
            latitude: Number(row.branch_latitude),
            longitude: Number(row.branch_longitude),
          },
        });
        const bufferedTravelSeconds =
          estimate.durationSeconds + config.location.travelBufferMinutes * 60;
        if (
          row.estimated_wait_seconds === null ||
          bufferedTravelSeconds <= row.estimated_wait_seconds
        ) {
          await withTransaction((client) =>
            locationRepository.mark(row.id, 'skipped', client, row.processing_started_at)
          );
          continue;
        }
        await withTransaction(async (client) => {
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
                travelDurationSeconds: bufferedTravelSeconds,
                routeDurationSeconds: estimate.durationSeconds,
                travelBufferMinutes: config.location.travelBufferMinutes,
                distanceMeters: estimate.distanceMeters,
                travelProvider: estimate.provider,
              },
            },
            client
          );
          await locationRepository.mark(
            row.id,
            notification ? 'sent' : 'skipped',
            client,
            row.processing_started_at
          );
        });
      } catch (error) {
        await withTransaction((client) =>
          locationRepository.mark(
            row.id,
            row.attempt_count >= config.location.maxAttempts ? 'failed' : 'pending',
            client,
            row.processing_started_at,
            error instanceof Error ? error.message : String(error)
          )
        );
      }
    }
    return rows.length;
  },

  cleanupExpired() {
    return locationRepository.cleanupExpired(config.location.cleanupBatchSize);
  },
};
