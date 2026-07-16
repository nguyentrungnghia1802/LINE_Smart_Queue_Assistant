jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));

import { pool } from '../../../db/client';
import { notificationOperationsService } from '../notification-operations.service';

describe('notificationOperationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scopes manager lists to one tenant and masks LINE recipient IDs', async () => {
    jest.mocked(pool.query).mockResolvedValue({
      rows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          organization_id: '22222222-2222-4222-8222-222222222222',
          queue_entry_id: null,
          event_type: 'called',
          status: 'failed',
          attempt_count: 5,
          max_attempts: 5,
          next_retry_at: null,
          sent_at: null,
          last_error: 'sanitized',
          line_user_id: 'U1234567890',
          created_at: new Date(),
          total_count: '1',
        },
      ],
    } as never);

    const result = await notificationOperationsService.list({
      organizationId: '22222222-2222-4222-8222-222222222222',
      status: 'failed',
      page: 1,
      limit: 20,
    });

    expect(jest.mocked(pool.query).mock.calls[0][1]).toContain(
      '22222222-2222-4222-8222-222222222222'
    );
    expect(result.items[0].lineRecipient).toBe('U1***7890');
  });

  it('rejects manual operations across tenants', async () => {
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              organization_id: 'other-org',
              status: 'failed',
            },
          ],
        })
        .mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    jest.mocked(pool.connect).mockResolvedValue(client as never);

    await expect(
      notificationOperationsService.retry({
        id: '11111111-1111-4111-8111-111111111111',
        organizationId: 'my-org',
        actorId: '33333333-3333-4333-8333-333333333333',
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
