jest.mock('../../../db/client', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  queryWithClient: jest.fn(),
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
}));

import { query, queryOne, queryWithClient } from '../../../db/client';
import { NotificationOperationsRepository } from '../notification-operations.repository';

describe('NotificationOperationsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(query).mockResolvedValue([]);
    jest.mocked(queryOne).mockResolvedValue(null);
    jest.mocked(queryWithClient).mockResolvedValue([]);
  });

  it('builds a paginated scoped query without selecting provider payload aliases', async () => {
    const repository = new NotificationOperationsRepository();
    await repository.list({
      organizationId: '11111111-1111-4111-8111-111111111111',
      branchId: '22222222-2222-4222-8222-222222222222',
      status: 'failed',
      eventType: 'called',
      createdFrom: new Date('2026-08-01T00:00:00Z'),
      createdTo: new Date('2026-08-10T00:00:00Z'),
      page: 2,
      limit: 20,
    });
    const [sql, values] = jest.mocked(query).mock.calls[0];
    expect(sql).toContain('n.organization_id');
    expect(sql).toContain('q.branch_id');
    expect(sql).toContain('n.event_type');
    expect(sql).toContain('COUNT(*) OVER()');
    expect(values).toEqual(expect.arrayContaining(['failed', 'called', 20, 20]));
  });

  it('locks one scoped row so concurrent operator mutations serialize', async () => {
    const repository = new NotificationOperationsRepository();
    const client = {} as never;
    await repository.findByIdForUpdate(client, '11111111-1111-4111-8111-111111111111', {
      organizationId: '22222222-2222-4222-8222-222222222222',
      branchId: '33333333-3333-4333-8333-333333333333',
    });
    const [, sql] = jest.mocked(queryWithClient).mock.calls[0];
    expect(sql).toContain('FOR UPDATE OF n');
    expect(sql).toContain('n.organization_id');
    expect(sql).toContain('q.branch_id');
  });

  it('resets dispatch state with a unique manual job id while preserving one event row', async () => {
    const repository = new NotificationOperationsRepository();
    await repository.retryFailed({} as never, '11111111-1111-4111-8111-111111111111', 'reason');
    const [, sql] = jest.mocked(queryWithClient).mock.calls[0];
    expect(sql).toContain("WHERE id = $1 AND status = 'failed'");
    expect(sql).toContain("dispatch_status = 'pending'");
    expect(sql).toContain("'-manual-' || (manual_retry_count + 1)::text");
    expect(sql).not.toContain('INSERT INTO notifications');
  });
});
