/**
 * Lightweight background job runner built on `setInterval`.
 *
 * ── Design rationale (MVP) ────────────────────────────────────────────────────
 * At single-instance Express + PostgreSQL scale, `setInterval` polling avoids
 * a Redis dependency (Bull/BullMQ) or an external process scheduler (pg_cron).
 * The `JobSpec` interface is deliberately thin so the runner can be swapped for
 * BullMQ or a cloud scheduler without touching job logic.
 *
 * ── Retry strategy ───────────────────────────────────────────────────────────
 * Exponential back-off: `delay = retryDelayMs × 2^attempt` (1 s → 2 s → 4 s).
 * After `maxRetries` exhausted the error is logged. Jobs NEVER crash the process.
 *
 * ── Overlap protection ───────────────────────────────────────────────────────
 * If a cycle is still executing when the next tick fires that tick is skipped
 * and a warning is emitted. This prevents runaway DB connections on slow cycles.
 */

import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface JobSpec {
  /** Human-readable identifier — appears in every log line for this job. */
  name: string;
  /** How often the job runs (milliseconds). */
  intervalMs: number;
  /** The async work to perform each cycle. Retry handles transient errors. */
  run: () => Promise<void>;
  /** Maximum number of retry attempts per cycle (default 3). */
  maxRetries?: number;
  /** Base back-off delay in ms; doubles each retry (default 1 000). */
  retryDelayMs?: number;
}

// ── JobRunner ─────────────────────────────────────────────────────────────────

export class JobRunner {
  private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly running = new Set<string>();

  /**
   * Register and start a recurring job.
   *
   * The first execution fires after the first `intervalMs` elapses, not
   * immediately on registration. This lets the server finish booting before
   * any DB queries run.
   *
   * Returns `this` for chaining.
   */
  schedule(spec: JobSpec): this {
    const { name, intervalMs, run, maxRetries = 3, retryDelayMs = 1_000 } = spec;

    const execute = async (): Promise<void> => {
      if (this.running.has(name)) {
        logger.warn({ job: name }, 'job.skip: previous cycle still running');
        return;
      }

      this.running.add(name);
      const start = Date.now();

      try {
        await runWithRetry(name, run, maxRetries, retryDelayMs);
        logger.debug({ job: name, durationMs: Date.now() - start }, 'job.done');
      } catch (err) {
        logger.error({ job: name, err, durationMs: Date.now() - start }, 'job.failed');
      } finally {
        this.running.delete(name);
      }
    };

    const timer = setInterval(() => void execute(), intervalMs);
    // Unref so the timer doesn't keep the process alive when everything else exits.
    timer.unref();

    this.timers.set(name, timer);
    logger.info({ job: name, intervalMs }, 'job.scheduled');

    return this;
  }

  /** Stop all scheduled jobs. In-flight cycles are not interrupted. */
  stop(): void {
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      logger.info({ job: name }, 'job.stopped');
    }
    this.timers.clear();
  }

  /** Number of currently registered jobs. */
  get count(): number {
    return this.timers.size;
  }
}

// ── Retry helper ──────────────────────────────────────────────────────────────

/**
 * Run `fn` with exponential-backoff retries.
 *
 * Exported so tests can exercise retry logic independently of `JobRunner`.
 * Not part of the public scheduling API.
 *
 * Throws the last error when all attempts (attempt 0 … maxRetries) are exhausted.
 */
export async function runWithRetry(
  name: string,
  fn: () => Promise<void>,
  maxRetries: number,
  baseDelayMs: number
): Promise<void> {
  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delayMs = baseDelayMs * 2 ** (attempt - 1); // 1s, 2s, 4s, …
      logger.warn({ job: name, attempt, delayMs }, 'job.retry');
      await sleep(delayMs);
    }

    try {
      await fn();
      return;
    } catch (err) {
      lastErr = err;
      logger.warn({ job: name, attempt, err }, 'job.attempt-failed');
    }
  }

  throw lastErr;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
