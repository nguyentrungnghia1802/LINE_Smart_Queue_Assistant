import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../../db/client';
import { locationRepository } from '../location.repository';

const mockPoolQuery = pool.query as jest.MockedFunction<typeof pool.query>;

describe('locationRepository alert claims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('claims due rows atomically with a recoverable processing lease', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] } as never);

    await locationRepository.claimDue(25, 900);

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    const [sql, values] = mockPoolQuery.mock.calls[0] ?? [];
    expect(sql).toContain('FOR UPDATE OF la SKIP LOCKED');
    expect(sql).toContain('processing_started_at <');
    expect(sql).toContain('UPDATE location_alerts la');
    expect(sql).toContain('attempt_count = la.attempt_count + 1');
    expect(values).toEqual([25, 900]);
  });

  it('finalizes only the claim owned by the supplied processing timestamp', async () => {
    const processingStartedAt = new Date('2026-08-11T12:00:00.000Z');
    const client = {
      query: jest.fn().mockResolvedValue({ rowCount: 1 } as never),
    };

    await expect(
      locationRepository.mark('alert-1', 'sent', client as never, processingStartedAt)
    ).resolves.toBe(true);

    const [sql, values] = client.query.mock.calls[0] ?? [];
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('processing_started_at = $4');
    expect(sql).toContain('processing_started_at = NULL');
    expect(values).toEqual(['alert-1', 'sent', null, processingStartedAt]);
  });
});
