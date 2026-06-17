/**
 * Background Job Scheduler
 *
 * ── Responsibility ────────────────────────────────────────────────────────────
 * Registers all background jobs with the `JobRunner` and exposes a clean
 * start/stop API for `server.ts` to call during startup and graceful shutdown.
 *
 * ── Job inventory ─────────────────────────────────────────────────────────────
 *
 * etaUpdater  (30 s)
 *   Recalculates `estimated_call_at` for waiting entries in every open queue.
 *   Keeps the LIFF countdown displays accurate.
 *
 * etaWarning  (30 s)
 *   Scans waiting entries within the ETA threshold and pushes LINE "almost
 *   your turn" messages.  Anti-duplicate via notificationLogRepository.
 *
 * calledRenotify  (60 s)
 *   Re-attempts "your number is called" pushes for entries where the initial
 *   delivery (fired synchronously by callNextTicket) may have failed.
 *
 * counterReset  (checked hourly, fires once per UTC calendar day at 00:xx)
 *   Resets daily_ticket_counter for all active queues.  Runs at most once
 *   per day per process — `lastResetUtcDay` tracks the last reset to prevent
 *   duplicate firings within the same midnight hour.
 *
 * ── Scheduler approach ────────────────────────────────────────────────────────
 * Polling via `setInterval` was chosen over a dedicated queue library because:
 *   • No Redis dependency at MVP scale.
 *   • PostgreSQL is already the source of truth; polling reads it directly.
 *   • Overlap protection in JobRunner prevents concurrent DB storms.
 *   • Upgrade path is clear: replace setInterval with BullMQ workers when
 *     horizontal scaling is required — job logic (the `run` functions) stays
 *     unchanged.
 */

import { logger } from '../utils/logger';

import { runCounterReset } from './counterReset.job';
import { runEtaUpdater } from './etaUpdater.job';
import { JobRunner } from './jobRunner';
import { scanCalledRenotify, scanEtaWarnings } from './notificationScan.job';

// ── Interval constants ────────────────────────────────────────────────────────

/** How often to recalculate ETAs in the DB (ms). */
const ETA_UPDATER_INTERVAL_MS = 30_000;

/** How often to scan for ETA-warning candidates (ms). */
const ETA_WARNING_INTERVAL_MS = 30_000;

/** How often to re-check called entries for failed notifications (ms). */
const CALLED_RENOTIFY_INTERVAL_MS = 60_000;

/** How often the counter-reset guard checks the clock (ms). Fires once per day. */
const COUNTER_RESET_CHECK_INTERVAL_MS = 60 * 60_000; // 1 h

// ── Internal state ────────────────────────────────────────────────────────────

/**
 * UTC day-of-week (0–6) of the last counter reset.
 * Initialised to -1 so the first run at midnight always fires.
 * Using day-of-week is sufficient for MVP (resets more than 7 days apart are
 * never a concern for a single-instance process).
 */
let lastResetUtcDay = -1;

const runner = new JobRunner();
let running = false;

// ── Public API ────────────────────────────────────────────────────────────────

export const scheduler = {
  /**
   * Start all background jobs.
   *
   * Call once after `server.listen()` has confirmed the HTTP port is bound.
   * Jobs fire after their first interval elapses, giving the server a brief
   * warm-up window before the first DB queries run.
   */
  start(): void {
    if (running) {
      logger.warn('scheduler: start called while already running');
      return;
    }

    logger.info('scheduler: starting');

    runner
      .schedule({
        name: 'etaUpdater',
        intervalMs: ETA_UPDATER_INTERVAL_MS,
        run: runEtaUpdater,
      })
      .schedule({
        name: 'etaWarning',
        intervalMs: ETA_WARNING_INTERVAL_MS,
        run: scanEtaWarnings,
      })
      .schedule({
        name: 'calledRenotify',
        intervalMs: CALLED_RENOTIFY_INTERVAL_MS,
        run: scanCalledRenotify,
      })
      .schedule({
        name: 'counterReset',
        intervalMs: COUNTER_RESET_CHECK_INTERVAL_MS,
        run: async () => {
          const now = new Date();
          // Only fire in the UTC midnight hour and at most once per calendar day.
          if (now.getUTCHours() === 0 && now.getUTCDay() !== lastResetUtcDay) {
            lastResetUtcDay = now.getUTCDay();
            await runCounterReset();
          }
        },
      });

    logger.info({ jobs: runner.count }, 'scheduler: started');
    running = true;
  },

  /**
   * Stop all scheduled jobs.
   *
   * Call during graceful shutdown before closing the DB pool.
   * In-flight cycles are not interrupted — they will complete naturally.
   */
  stop(): void {
    logger.info('scheduler: stopping');
    runner.stop();
    running = false;
    logger.info('scheduler: stopped');
  },

  status(): { running: boolean; registeredJobs: number } {
    return {
      running,
      registeredJobs: runner.count,
    };
  },

  /**
   * Run the notification scan jobs once without waiting for the next interval.
   *
   * Useful for:
   *   • Integration / end-to-end tests that need deterministic execution.
   *   • A future admin endpoint ("flush pending notifications now").
   *
   * ETA recalculation and counter reset are deliberately excluded because
   * they modify DB rows and are not safe to trigger ad-hoc in tests.
   */
  async runOnce(): Promise<void> {
    await Promise.allSettled([scanEtaWarnings(), scanCalledRenotify()]);
  },
};
