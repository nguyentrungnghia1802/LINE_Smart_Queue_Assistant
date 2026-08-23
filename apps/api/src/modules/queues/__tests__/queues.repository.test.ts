import type { PoolClient } from 'pg';

import { queuesRepository } from '../../../db/repositories/queues.repository';

describe('queuesRepository', () => {
  it('soft-deactivates a queue and its product assignments atomically', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as PoolClient;

    await queuesRepository.softDelete('queue-001', client);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('UPDATE queues');
    expect(sql).toContain('UPDATE queue_products');
    expect(sql).toContain('WHERE queue_id = $1');
    expect(params).toEqual(['queue-001']);
  });
});
