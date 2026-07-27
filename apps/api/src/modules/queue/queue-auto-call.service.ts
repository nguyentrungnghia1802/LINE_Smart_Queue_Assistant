import type { PoolClient } from 'pg';

import {
  queueEntriesRepository,
  type QueueEntryRow,
} from '../../db/repositories/queue-entries.repository';
import type { QueueRow } from '../../db/repositories/queues.repository';
import { notificationOutboxRepository } from '../notifications/notification-outbox.repository';
import {
  ETA_WARNING_POSITIONS,
  queueNotificationService,
} from '../notifications/queue-notification.service';

export async function tryAutoCallNextWaiting(
  queue: QueueRow,
  client: PoolClient
): Promise<QueueEntryRow | null> {
  const alreadyCalled = await queueEntriesRepository.findByQueueAndStatus(
    queue.id,
    'called',
    client
  );
  const alreadyServing = alreadyCalled
    ? null
    : await queueEntriesRepository.findByQueueAndStatus(queue.id, 'serving', client);
  if (alreadyCalled || alreadyServing) return null;

  const [next] = (await queueEntriesRepository.listWaiting(queue.id, client)) ?? [];
  if (!next) return null;

  const called = await queueEntriesRepository.markCalled(next.id, client);
  await queueNotificationService.notifyTicketCalled(
    { ...called, estimated_wait_seconds: 0 },
    {
      organizationId: queue.organization_id,
      aheadCount: 0,
      estimatedWaitSeconds: 0,
    },
    notificationOutboxRepository,
    client
  );

  const waitingAfterCall = (await queueEntriesRepository.listWaiting(queue.id, client)) ?? [];
  for (const aheadCount of ETA_WARNING_POSITIONS) {
    const approaching = waitingAfterCall[aheadCount];
    if (!approaching) continue;
    await queueNotificationService.notifyEtaWarning(
      approaching,
      aheadCount,
      { organizationId: queue.organization_id },
      notificationOutboxRepository,
      client
    );
  }
  return called;
}
