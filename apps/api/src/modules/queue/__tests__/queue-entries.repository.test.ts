import type { PoolClient } from 'pg';

import {
  queueEntriesRepository,
  type QueueEntryRow,
} from '../../../db/repositories/queue-entries.repository';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

const entry: QueueEntryRow = {
  id: '22222222-2222-4222-8222-222222222222',
  queue_id: '33333333-3333-4333-8333-333333333333',
  user_id: '44444444-4444-4444-8444-444444444444',
  order_id: '55555555-5555-4555-8555-555555555555',
  line_user_id: 'U1234567890',
  ticket_number: 4,
  ticket_code: 'A004',
  status: 'served',
  priority: 0,
  position_snapshot: null,
  called_at: new Date('2026-07-24T01:00:00.000Z'),
  serving_started_at: new Date('2026-07-24T01:05:00.000Z'),
  served_at: new Date('2026-07-24T01:15:00.000Z'),
  skipped_at: null,
  cancelled_at: null,
  no_show_at: null,
  estimated_wait_seconds: null,
  created_at: new Date('2026-07-24T00:55:00.000Z'),
  updated_at: new Date('2026-07-24T01:15:00.000Z'),
};

describe('queueEntriesRepository.archiveToHistory', () => {
  it('writes the staff actor into the canonical actor_id column', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as PoolClient;

    await queueEntriesRepository.archiveToHistory(
      entry,
      'serving',
      'served',
      undefined,
      client,
      ACTOR_ID
    );

    const sql = String(query.mock.calls[0]?.[0]);
    const params = query.mock.calls[0]?.[1] as unknown[];

    expect(sql).toContain('organization_id, actor_id, line_user_id');
    expect(sql).not.toContain('organization_id, user_id, line_user_id');
    expect(params[2]).toBe(ACTOR_ID);
    expect(params[3]).toBe(entry.line_user_id);
  });

  it('clamps inconsistent legacy timestamps to nonnegative durations', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const client = { query } as unknown as PoolClient;

    await queueEntriesRepository.archiveToHistory(
      {
        ...entry,
        created_at: new Date('2026-07-24T01:10:00.000Z'),
        serving_started_at: new Date('2026-07-24T01:05:00.000Z'),
        served_at: new Date('2026-07-24T01:00:00.000Z'),
      },
      'serving',
      'served',
      undefined,
      client,
      ACTOR_ID
    );

    const params = query.mock.calls[0]?.[1] as unknown[];
    expect(params[9]).toBe(0);
    expect(params[10]).toBe(0);
  });
});
