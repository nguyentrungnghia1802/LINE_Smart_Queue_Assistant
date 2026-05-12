/**
 * Unit tests for jobRunner.ts
 *
 * Strategy:
 *   - runWithRetry: tested with real timers + baseDelayMs = 0 (instant retries).
 *   - JobRunner: tested with jest fake timers so setInterval can be advanced
 *     deterministically without real wall-clock waiting.
 */

import { JobRunner, runWithRetry } from '../jobRunner';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ── runWithRetry ───────────────────────────────────────────────────────────────

describe('runWithRetry', () => {
  it('resolves on the first attempt without retry', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    await runWithRetry('job', fn, 3, 0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('succeeds after a single transient failure', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue(undefined);
    await runWithRetry('job', fn, 3, 0);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error when all attempts are exhausted', async () => {
    const err = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(err);
    await expect(runWithRetry('job', fn, 2, 0)).rejects.toThrow('always fails');
    // maxRetries=2 → attempts 0, 1, 2 = 3 total calls
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('makes exactly one call when maxRetries is 0', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));
    await expect(runWithRetry('job', fn, 0, 0)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ── JobRunner ─────────────────────────────────────────────────────────────────

describe('JobRunner', () => {
  let runner: JobRunner;

  beforeEach(() => {
    jest.useFakeTimers();
    runner = new JobRunner();
  });

  afterEach(() => {
    runner.stop();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not execute the job before the first interval elapses', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    runner.schedule({ name: 'j', intervalMs: 1_000, run: fn });

    await jest.advanceTimersByTimeAsync(999);

    expect(fn).not.toHaveBeenCalled();
  });

  it('executes the job once after one interval', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    runner.schedule({ name: 'j', intervalMs: 1_000, run: fn });

    await jest.advanceTimersByTimeAsync(1_000);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('executes the job on every subsequent interval', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    runner.schedule({ name: 'j', intervalMs: 1_000, run: fn });

    await jest.advanceTimersByTimeAsync(3_000);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stop() prevents further executions after clearing timers', async () => {
    const fn = jest.fn().mockResolvedValue(undefined);
    runner.schedule({ name: 'j', intervalMs: 1_000, run: fn });

    await jest.advanceTimersByTimeAsync(1_000);
    expect(fn).toHaveBeenCalledTimes(1);

    runner.stop();

    await jest.advanceTimersByTimeAsync(5_000);
    expect(fn).toHaveBeenCalledTimes(1); // no additional calls after stop
  });

  it('count returns the number of registered jobs', () => {
    expect(runner.count).toBe(0);

    runner.schedule({ name: 'a', intervalMs: 1_000, run: jest.fn().mockResolvedValue(undefined) });
    runner.schedule({ name: 'b', intervalMs: 2_000, run: jest.fn().mockResolvedValue(undefined) });

    expect(runner.count).toBe(2);
  });

  it('count returns 0 after stop()', () => {
    runner.schedule({ name: 'a', intervalMs: 1_000, run: jest.fn().mockResolvedValue(undefined) });
    runner.stop();
    expect(runner.count).toBe(0);
  });

  it('skips the next tick when the previous cycle is still running', async () => {
    // First invocation returns a promise we control; subsequent calls resolve immediately.
    let resolveFirst!: () => void;
    const firstPromise = new Promise<void>((r) => {
      resolveFirst = r;
    });

    const fn = jest.fn().mockReturnValueOnce(firstPromise).mockResolvedValue(undefined);

    runner.schedule({ name: 'j', intervalMs: 1_000, run: fn });

    // First tick: starts the slow cycle.
    await jest.advanceTimersByTimeAsync(1_000);
    expect(fn).toHaveBeenCalledTimes(1);

    // Second tick fires while the first cycle is still in-flight — should be skipped.
    await jest.advanceTimersByTimeAsync(1_000);
    expect(fn).toHaveBeenCalledTimes(1);

    // Complete the first cycle and let the finally-block flush.
    resolveFirst();
    await Promise.resolve();
    await Promise.resolve();

    // Third tick should execute normally now.
    await jest.advanceTimersByTimeAsync(1_000);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('supports chaining multiple schedule() calls', () => {
    const result = runner
      .schedule({ name: 'a', intervalMs: 1_000, run: jest.fn().mockResolvedValue(undefined) })
      .schedule({ name: 'b', intervalMs: 2_000, run: jest.fn().mockResolvedValue(undefined) });

    expect(result).toBe(runner);
    expect(runner.count).toBe(2);
  });
});
