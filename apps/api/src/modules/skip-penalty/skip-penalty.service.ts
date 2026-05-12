import { PenaltyRecordRow, penaltyRepository } from '../../db/repositories/penalty.repository';
import { logger } from '../../utils/logger';

import { SKIP_PENALTY_POLICY } from './skip-penalty.policy';

// ── Helpers ────────────────────────────────────────────────────────────────────

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ── Service ────────────────────────────────────────────────────────────────────

export const skipPenaltyService = {
  /**
   * Record a 'skip' penalty when a customer exhausts their skip allowance on a
   * single queue entry (skip_count reaches max_skips_before_penalty).
   *
   * Fire-and-forget safe: caller should `void` the promise and `.catch` errors
   * so a penalty-write failure never blocks the queue state transition.
   *
   * NOTE: Only applicable to registered users. LINE-only (anonymous) users
   * cannot accumulate penalty records because the table requires a valid user_id.
   */
  async onSkipExhausted(params: {
    userId: string;
    queueId: string;
    entryId: string;
    organizationId: string;
  }): Promise<void> {
    const { userId, queueId, entryId, organizationId } = params;
    await penaltyRepository.create({
      userId,
      organizationId,
      queueId,
      queueEntryId: entryId,
      type: 'skip',
      severity: SKIP_PENALTY_POLICY.SKIP_PENALTY_SEVERITY,
      expiresAt: hoursFromNow(SKIP_PENALTY_POLICY.SKIP_PENALTY_EXPIRY_HOURS),
      notes: 'Auto-generated: customer exhausted skip allowance',
    });
    logger.info({ userId, queueId }, 'skip-penalty: skip penalty recorded');
  },

  /**
   * Record a 'no_show' penalty when staff marks a ticket as no-show.
   *
   * Fire-and-forget safe: caller should `void` the promise and `.catch` errors.
   *
   * NOTE: Only applicable to registered users.
   */
  async onNoShow(params: {
    userId: string;
    queueId: string;
    entryId: string;
    organizationId: string;
  }): Promise<void> {
    const { userId, queueId, entryId, organizationId } = params;
    await penaltyRepository.create({
      userId,
      organizationId,
      queueId,
      queueEntryId: entryId,
      type: 'no_show',
      severity: SKIP_PENALTY_POLICY.NO_SHOW_PENALTY_SEVERITY,
      expiresAt: hoursFromNow(SKIP_PENALTY_POLICY.NO_SHOW_PENALTY_EXPIRY_HOURS),
      notes: 'Auto-generated: ticket marked no-show by staff',
    });
    logger.info({ userId, queueId }, 'skip-penalty: no-show penalty recorded');
  },

  /**
   * Calculate the priority adjustment to apply when a user joins a queue.
   *
   * Returns `PENALTY_PRIORITY_DEDUCTION` (a negative integer) when the user
   * has one or more active penalties in the organization; returns 0 otherwise.
   *
   * A negative adjustment lowers the entry's initial priority, placing the
   * customer behind penalty-free entries (which start at priority 0).
   */
  async calculatePriorityAdjustment(params: {
    userId: string;
    organizationId: string;
  }): Promise<number> {
    const count = await penaltyRepository.countActiveByUser(params.userId, params.organizationId);
    return count > 0 ? SKIP_PENALTY_POLICY.PENALTY_PRIORITY_DEDUCTION : 0;
  },

  /**
   * Return all currently active penalties for a user.
   * Optionally scoped to an organization.
   *
   * Used by the `GET /api/v1/queue/me/penalties` endpoint.
   */
  async getActivePenalties(params: {
    userId: string;
    organizationId?: string;
  }): Promise<PenaltyRecordRow[]> {
    return penaltyRepository.findActiveByUser(params.userId, params.organizationId);
  },
};
