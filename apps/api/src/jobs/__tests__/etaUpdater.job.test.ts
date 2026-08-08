import { pool } from '../../db/client';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { realtimeService } from '../../modules/realtime';
import { runEtaUpdater } from '../etaUpdater.job';

jest.mock('../../db/client', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../db/repositories/queue-entries.repository', () => ({
  queueEntriesRepository: { bulkUpdateEta: jest.fn() },
}));
jest.mock('../../modules/realtime', () => ({
  realtimeService: {
    publishTicketEvent: jest.fn(),
    publishQueueSummary: jest.fn(),
  },
}));

const mockQuery = pool.query as jest.Mock;
const mockBulkUpdateEta = queueEntriesRepository.bulkUpdateEta as jest.MockedFunction<
  typeof queueEntriesRepository.bulkUpdateEta
>;
const mockPublishTicket = realtimeService.publishTicketEvent as jest.MockedFunction<
  typeof realtimeService.publishTicketEvent
>;
const mockPublishSummary = realtimeService.publishQueueSummary as jest.MockedFunction<
  typeof realtimeService.publishQueueSummary
>;

describe('runEtaUpdater realtime publication', () => {
  beforeEach(() => jest.clearAllMocks());

  it('publishes changed ETA rows and one queue summary after the database update', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          organization_id: '22222222-2222-4222-8222-222222222222',
          branch_id: '33333333-3333-4333-8333-333333333333',
          avg_service_seconds: 300,
        },
      ],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
    mockBulkUpdateEta.mockResolvedValueOnce([
      {
        id: '44444444-4444-4444-8444-444444444444',
        status: 'waiting',
        estimated_wait_seconds: 600,
      },
    ]);

    await runEtaUpdater();

    expect(mockPublishTicket).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ticket.eta_updated' })
    );
    expect(mockPublishSummary).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'eta_updated' })
    );
    expect(mockBulkUpdateEta.mock.invocationCallOrder[0]).toBeLessThan(
      mockPublishTicket.mock.invocationCallOrder[0]
    );
  });

  it('does not publish unchanged ETA rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          organization_id: '22222222-2222-4222-8222-222222222222',
          branch_id: '33333333-3333-4333-8333-333333333333',
          avg_service_seconds: 300,
        },
      ],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    });
    mockBulkUpdateEta.mockResolvedValueOnce([]);

    await runEtaUpdater();

    expect(mockPublishTicket).not.toHaveBeenCalled();
    expect(mockPublishSummary).not.toHaveBeenCalled();
  });
});
