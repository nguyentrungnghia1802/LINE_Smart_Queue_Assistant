import { type QueueRow, queuesRepository } from '../../../db/repositories/queues.repository';
import { queuesService } from '../queues.service';

jest.mock('../../../db/repositories/queues.repository');

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
  });

  it('creates another queue inside the authenticated manager branch', async () => {
    jest.mocked(queuesRepository.create).mockResolvedValue(queue);

    await queuesService.createQueue(scope, {
      name: 'Hair services',
      status: 'open',
      avgServiceTimeMinutes: 15,
    });

    expect(queuesRepository.create).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      branchId: BRANCH_ID,
      name: 'Hair services',
      description: undefined,
      status: 'open',
      prefix: undefined,
      maxCapacity: undefined,
      avgServiceSeconds: 900,
    });
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

  it('prevents deleting the last active queue in a branch', async () => {
    jest.mocked(queuesRepository.findById).mockResolvedValue(queue);
    jest.mocked(queuesRepository.findActiveByBranches).mockResolvedValue([queue]);

    await expect(queuesService.deleteQueue(QUEUE_ID, scope)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(queuesRepository.softDelete).not.toHaveBeenCalled();
  });

  it('allows deleting one queue when another active queue remains', async () => {
    jest.mocked(queuesRepository.findById).mockResolvedValue(queue);
    jest
      .mocked(queuesRepository.findActiveByBranches)
      .mockResolvedValue([queue, { ...queue, id: '55555555-5555-4555-8555-555555555555' }]);

    await queuesService.deleteQueue(QUEUE_ID, scope);

    expect(queuesRepository.softDelete).toHaveBeenCalledWith(QUEUE_ID);
  });
});
