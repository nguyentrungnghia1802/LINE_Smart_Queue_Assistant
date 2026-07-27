import {
  queueEntriesRepository,
  type QueueEntryRow,
} from '../../../db/repositories/queue-entries.repository';
import type { QueueRow } from '../../../db/repositories/queues.repository';
import { queueNotificationService } from '../../notifications/queue-notification.service';
import { tryAutoCallNextWaiting } from '../queue-auto-call.service';

jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../notifications/notification-outbox.repository', () => ({
  notificationOutboxRepository: {},
}));
jest.mock('../../notifications/queue-notification.service', () => ({
  ETA_WARNING_POSITIONS: [5, 3],
  queueNotificationService: {
    notifyTicketCalled: jest.fn().mockResolvedValue(undefined),
    notifyEtaWarning: jest.fn().mockResolvedValue(undefined),
  },
}));

const client = {} as never;
const queue = {
  id: 'queue-1',
  organization_id: 'org-1',
} as QueueRow;
const waiting = {
  id: 'entry-1',
  queue_id: queue.id,
  status: 'waiting',
  ticket_code: 'A001',
  line_user_id: 'U001',
} as QueueEntryRow;
const called = { ...waiting, status: 'called' } as QueueEntryRow;

describe('tryAutoCallNextWaiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(queueEntriesRepository.findByQueueAndStatus).mockResolvedValue(null);
    jest.mocked(queueEntriesRepository.listWaiting).mockResolvedValue([waiting]);
    jest.mocked(queueEntriesRepository.markCalled).mockResolvedValue(called);
  });

  it('calls and notifies the first waiting customer when the queue is idle', async () => {
    await expect(tryAutoCallNextWaiting(queue, client)).resolves.toEqual(called);

    expect(queueEntriesRepository.markCalled).toHaveBeenCalledWith(waiting.id, client);
    expect(queueNotificationService.notifyTicketCalled).toHaveBeenCalledWith(
      expect.objectContaining({ id: waiting.id, status: 'called' }),
      expect.objectContaining({ organizationId: queue.organization_id, aheadCount: 0 }),
      expect.anything(),
      client
    );
  });

  it('does not call another customer while one is serving', async () => {
    jest
      .mocked(queueEntriesRepository.findByQueueAndStatus)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...called, status: 'serving' });

    await expect(tryAutoCallNextWaiting(queue, client)).resolves.toBeNull();
    expect(queueEntriesRepository.listWaiting).not.toHaveBeenCalled();
    expect(queueEntriesRepository.markCalled).not.toHaveBeenCalled();
  });

  it('enqueues approaching notifications at five and three people ahead', async () => {
    const waitingAfterCall = Array.from({ length: 6 }, (_, index) => ({
      ...waiting,
      id: `waiting-${index}`,
      ticket_code: `A00${index + 2}`,
    }));
    jest
      .mocked(queueEntriesRepository.listWaiting)
      .mockResolvedValueOnce([waiting])
      .mockResolvedValueOnce(waitingAfterCall);

    await tryAutoCallNextWaiting(queue, client);

    expect(queueNotificationService.notifyEtaWarning).toHaveBeenCalledWith(
      waitingAfterCall[5],
      5,
      expect.objectContaining({ organizationId: queue.organization_id }),
      expect.anything(),
      client
    );
    expect(queueNotificationService.notifyEtaWarning).toHaveBeenCalledWith(
      waitingAfterCall[3],
      3,
      expect.objectContaining({ organizationId: queue.organization_id }),
      expect.anything(),
      client
    );
  });

  it('does nothing when no customer is waiting', async () => {
    jest.mocked(queueEntriesRepository.listWaiting).mockResolvedValue([]);

    await expect(tryAutoCallNextWaiting(queue, client)).resolves.toBeNull();
    expect(queueEntriesRepository.markCalled).not.toHaveBeenCalled();
  });
});
