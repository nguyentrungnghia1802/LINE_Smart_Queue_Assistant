import { pool } from '../../db/client';
import { withAdvisoryJobLock } from '../scheduler-lock';

jest.mock('../../db/client', () => ({
  pool: { connect: jest.fn(), query: jest.fn() },
}));

type MockClient = {
  query: jest.Mock;
  release: jest.Mock;
};

const mockConnect = pool.connect as jest.MockedFunction<typeof pool.connect>;

function clientWithLock(acquired: boolean): MockClient {
  return {
    query: jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ acquired }] })
      .mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
}

describe('withAdvisoryJobLock', () => {
  beforeEach(() => jest.clearAllMocks());

  it('skips execution when another scheduler owns the lock', async () => {
    const client = clientWithLock(false);
    mockConnect.mockResolvedValue(client as never);
    const run = jest.fn();

    await expect(withAdvisoryJobLock('forecasting', run)).resolves.toBe(false);

    expect(run).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('records success, unlocks, and releases the owning session', async () => {
    const client = clientWithLock(true);
    mockConnect.mockResolvedValue(client as never);
    const run = jest.fn().mockResolvedValue(undefined);

    await expect(withAdvisoryJobLock('forecasting', run)).resolves.toBe(true);

    expect(run).toHaveBeenCalledTimes(1);
    expect(
      client.query.mock.calls.some(([sql]) => String(sql).includes("status = 'succeeded'"))
    ).toBe(true);
    expect(
      client.query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_unlock'))
    ).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('records a sanitized failure and still releases the lock', async () => {
    const client = clientWithLock(true);
    mockConnect.mockResolvedValue(client as never);

    await expect(
      withAdvisoryJobLock('forecasting', async () => {
        throw new Error('provider failed with Bearer top-secret-token');
      })
    ).rejects.toThrow('provider failed');

    const failureCall = client.query.mock.calls.find(([sql]) =>
      String(sql).includes("status = 'failed'")
    );
    expect(failureCall?.[1]).toEqual(['forecasting', 'provider failed with Bearer [redacted]']);
    expect(
      client.query.mock.calls.some(([sql]) => String(sql).includes('pg_advisory_unlock'))
    ).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('allows a later scheduler session to acquire after contention', async () => {
    const contended = clientWithLock(false);
    const reacquired = clientWithLock(true);
    mockConnect
      .mockResolvedValueOnce(contended as never)
      .mockResolvedValueOnce(reacquired as never);
    const firstRun = jest.fn();
    const secondRun = jest.fn().mockResolvedValue(undefined);

    await expect(withAdvisoryJobLock('counterReset', firstRun)).resolves.toBe(false);
    await expect(withAdvisoryJobLock('counterReset', secondRun)).resolves.toBe(true);

    expect(firstRun).not.toHaveBeenCalled();
    expect(secondRun).toHaveBeenCalledTimes(1);
  });
});
