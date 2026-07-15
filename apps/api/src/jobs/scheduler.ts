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
 *   Recalculates `estimated_wait_seconds` for waiting entries in every open queue.
 *   Keeps the LIFF countdown displays accurate.
 *
 * etaWarning  (30 s)
 *   Scans waiting entries within the ETA threshold and enqueues durable LINE
 *   "almost your turn" notifications.
 *
 * calledRenotify  (60 s)
 *   Backfills durable "your number is called" notifications for called entries
 *   if a prior enqueue was missed. Delivery retry is owned by the outbox worker.
 *
 * notificationDelivery (configurable, default 15 s)
 *   Claims due LINE notification outbox records and sends them after commit.
 *
 * counterReset  (hourly)
 *   Resets counters whose organization-local business date changed.
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

import { config } from '../config';
import { logger } from '../utils/logger';

import { runCounterReset } from './counterReset.job';
import { runEtaUpdater } from './etaUpdater.job';
import { runInventoryExpiry } from './inventoryExpiry.job';
import { JobRunner } from './jobRunner';
import { runLocationAlerts, runLocationCleanup } from './locationAlert.job';
import { runNotificationDelivery } from './notificationDelivery.job';
import { scanCalledRenotify, scanEtaWarnings } from './notificationScan.job';
import { withAdvisoryJobLock } from './scheduler-lock';

// ── Interval constants ────────────────────────────────────────────────────────

/** How often to recalculate ETAs in the DB (ms). */
const ETA_UPDATER_INTERVAL_MS = 30_000;

/** How often to scan for ETA-warning candidates (ms). */
const ETA_WARNING_INTERVAL_MS = 30_000;

/** How often to re-check called entries for failed notifications (ms). */
const CALLED_RENOTIFY_INTERVAL_MS = 60_000;

/** How often organization-local business dates are checked. */
const COUNTER_RESET_CHECK_INTERVAL_MS = 60 * 60_000; // 1 h

// ── Internal state ────────────────────────────────────────────────────────────

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
        run: async () => void (await withAdvisoryJobLock('etaUpdater', runEtaUpdater)),
      })
      .schedule({
        name: 'etaWarning',
        intervalMs: ETA_WARNING_INTERVAL_MS,
        run: async () => void (await withAdvisoryJobLock('etaWarning', scanEtaWarnings)),
      })
      .schedule({
        name: 'calledRenotify',
        intervalMs: CALLED_RENOTIFY_INTERVAL_MS,
        run: async () => void (await withAdvisoryJobLock('calledRenotify', scanCalledRenotify)),
      })
      .schedule({
        name: 'inventoryExpiry',
        intervalMs: config.inventory.expiryWorkerIntervalMs,
        run: async () => void (await withAdvisoryJobLock('inventoryExpiry', runInventoryExpiry)),
      })
      .schedule({
        name: 'locationAlerts',
        intervalMs: config.location.workerIntervalMs,
        run: async () => void (await withAdvisoryJobLock('locationAlerts', runLocationAlerts)),
      })
      .schedule({
        name: 'locationCleanup',
        intervalMs: config.location.cleanupIntervalMs,
        run: async () => void (await withAdvisoryJobLock('locationCleanup', runLocationCleanup)),
      })
      .schedule({
        name: 'notificationDelivery',
        intervalMs: config.notifications.workerIntervalMs,
        run: runNotificationDelivery,
      })
      .schedule({
        name: 'counterReset',
        intervalMs: COUNTER_RESET_CHECK_INTERVAL_MS,
        run: async () => void (await withAdvisoryJobLock('counterReset', runCounterReset)),
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
    await Promise.allSettled([scanEtaWarnings(), scanCalledRenotify(), runNotificationDelivery()]);
  },
};
