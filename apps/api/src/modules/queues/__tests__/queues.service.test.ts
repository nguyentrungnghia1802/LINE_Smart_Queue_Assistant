import { productsRepository } from '../../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../../db/repositories/queue-entries.repository';
import { type QueueRow, queuesRepository } from '../../../db/repositories/queues.repository';
import { withTransaction } from '../../../db/transaction';
import { publicReadModelCache } from '../../../infrastructure/redis/redis-json.cache';
import { queuesService } from '../queues.service';

jest.mock('../../../db/repositories/products.repository');
jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/transaction');
jest.mock('../../../infrastructure/redis/redis-json.cache', () => ({
  publicReadModelCache: {
    invalidateQueue: jest.fn().mockResolvedValue(undefined),
  },
}));

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = '22222222-2222-4222-8222-222222222222';
const QUEUE_ID = '33333333-3333-4333-8333-333333333333';
const scope = { organizationId: ORG_ID, branchId: BRANCH_ID };

const queue: QueueRow = {
  id: QUEUE_ID,
  organization_id: ORG_ID,
  branch_id: BRANCH_ID,
  name: 'Hair services',
  description: null,
  status: 'open',
  queue_type: 'walk_in',
  prefix: 'H',
  max_capacity: null,
  daily_ticket_counter: 0,
  last_counter_reset_at: new Date(),
  avg_service_seconds: 900,
  notify_ahead_positions: 3,
  allow_skip: true,
  max_skips_before_penalty: 2,
  opens_at: null,
  closes_at: null,
  settings: {},
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('queuesService branch scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback({} as never));
    jest.mocked(productsRepository.syncProductsForQueue).mockResolvedValue(undefined);
    jest.mocked(queueEntriesRepository.countLiveByQueueIds).mockResolvedValue({});
    jest.mocked(queuesRepository.countStaffAssignments).mockResolvedValue(0);
  });

  it('returns live customer counts separately from the daily ticket counter', async () => {
    jest
      .mocked(queuesRepository.findActiveByBranches)
      .mockResolvedValue([{ ...queue, daily_ticket_counter: 2 }]);
    jest.mocked(queueEntriesRepository.countLiveByQueueIds).mockResolvedValue({
      [QUEUE_ID]: { waitingCount: 1, calledCount: 0, servingCount: 0 },
    });

    const result = await queuesService.listQueues(ORG_ID, BRANCH_ID);

    expect(queueEntriesRepository.countLiveByQueueIds).toHaveBeenCalledWith([QUEUE_ID]);
    expect(result[0]).toMatchObject({
      currentNumber: 2,
      waitingCount: 1,
      calledCount: 0,
      servingCount: 0,
    });
  });

  it('creates another queue inside the authenticated manager branch', async () => {
    jest.mocked(queuesRepository.create).mockResolvedValue(queue);

    await queuesService.createQueue(scope, {
      name: 'Hair services',
      status: 'open',
      avgServiceTimeMinutes: 15,
      absenceGraceMinutes: 5,
      productIds: [],
    });

    expect(queuesRepository.create).toHaveBeenCalledWith(
      {
        organizationId: ORG_ID,
        branchId: BRANCH_ID,
        name: 'Hair services',
        description: undefined,
        status: 'open',
        prefix: undefined,
        maxCapacity: undefined,
        avgServiceSeconds: 900,
        autoNoShowMinutes: 5,
      },
      expect.anything()
    );
    expect(productsRepository.syncProductsForQueue).toHaveBeenCalledWith(
      QUEUE_ID,
      ORG_ID,
      BRANCH_ID,
      [],
      expect.anything()
    );
    expect(publicReadModelCache.invalidateQueue).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      branchId: BRANCH_ID,
      queueId: QUEUE_ID,
    });
  });

  it('does not invalidate a public read model when queue creation rolls back', async () => {
    jest.mocked(queuesRepository.create).mockResolvedValue(queue);
    jest
      .mocked(productsRepository.syncProductsForQueue)
      .mockRejectedValueOnce(new Error('transaction failed'));

    await expect(
      queuesService.createQueue(scope, {
        name: 'Hair services',
        status: 'open',
        avgServiceTimeMinutes: 15,
        absenceGraceMinutes: 5,
        productIds: [],
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(publicReadModelCache.invalidateQueue).not.toHaveBeenCalled();
  });

  it('rejects reading a queue assigned to another branch', async () => {
    jest.mocked(queuesRepository.findById).mockResolvedValue({
      ...queue,
      branch_id: '44444444-4444-4444-8444-444444444444',
    });

    await expect(queuesService.getQueue(QUEUE_ID, scope)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('allows deleting the last active queue while a branch is being configured', async () => {
    jest.mocked(queuesRepository.lockById).mockResolvedValue(queue);

    await queuesService.deleteQueue(QUEUE_ID, scope);

    expect(queuesRepository.lockById).toHaveBeenCalledWith(QUEUE_ID, expect.anything());
    expect(queuesRepository.softDelete).toHaveBeenCalledWith(QUEUE_ID, expect.anything());
  });

  it('allows deleting one queue when another active queue remains', async () => {
    jest.mocked(queuesRepository.lockById).mockResolvedValue(queue);
    jest
      .mocked(queuesRepository.findActiveByBranches)
      .mockResolvedValue([queue, { ...queue, id: '55555555-5555-4555-8555-555555555555' }]);

    await queuesService.deleteQueue(QUEUE_ID, scope);

    expect(queuesRepository.softDelete).toHaveBeenCalledWith(QUEUE_ID, expect.anything());
  });

  it('requires staff reassignment before deleting their queue', async () => {
    jest.mocked(queuesRepository.lockById).mockResolvedValue(queue);
    jest.mocked(queuesRepository.countStaffAssignments).mockResolvedValue(1);

    await expect(queuesService.deleteQueue(QUEUE_ID, scope)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(queuesRepository.softDelete).not.toHaveBeenCalled();
  });

  it('requires active tickets to finish before deleting their queue', async () => {
    jest.mocked(queuesRepository.lockById).mockResolvedValue(queue);
    jest.mocked(queueEntriesRepository.countLiveByQueueIds).mockResolvedValue({
      [QUEUE_ID]: { waitingCount: 1, calledCount: 1, servingCount: 0 },
    });

    await expect(queuesService.deleteQueue(QUEUE_ID, scope)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(queuesRepository.countStaffAssignments).not.toHaveBeenCalled();
    expect(queuesRepository.softDelete).not.toHaveBeenCalled();
  });
});
