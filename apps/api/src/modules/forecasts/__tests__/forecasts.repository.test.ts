import { pool } from '../../../db/client';
import { forecastsRepository } from '../forecasts.repository';

jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn() },
}));

const mockQuery = pool.query as jest.Mock;

describe('forecastsRepository branch staffing joins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('loads historical staffing through the current branch membership key', async () => {
    await forecastsRepository.loadHistoricalSlots();

    const sql = String(mockQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('bm.organization_id = om.organization_id');
    expect(sql).toContain('bm.user_id = om.user_id');
    expect(sql).not.toContain('organization_member_id');
  });

  it('loads current queue staffing through the current branch membership key', async () => {
    await forecastsRepository.loadCurrentQueueLoads();

    const sql = String(mockQuery.mock.calls[0]?.[0]);
    expect(sql).toContain('bm.organization_id = om.organization_id');
    expect(sql).toContain('bm.user_id = om.user_id');
    expect(sql).not.toContain('organization_member_id');
  });
});
