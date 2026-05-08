import { EtaConfidence } from '@line-queue/shared';

// ── MVP Assumptions ────────────────────────────────────────────────────────────
//
// 1. `avg_service_seconds` is set per-queue at creation time and is NOT updated
//    dynamically from historical completions. Future: replace with a rolling
//    average derived from completed ticket timestamps.
// 2. All waiting tickets are processed in FIFO order. Priority adjustments from
//    customer-initiated skips may reorder — ETA does not reflect that.
// 3. Single server per queue (no parallel serving lanes). MVP scope.
// 4. ETA does not account for queue pauses, disaster / maintenance mode, or
//    early no-shows among tickets ahead.
// 5. Tickets in `called` or `serving` status that are still ahead are treated
//    the same as `waiting` — they still consume service time in the estimate.

// ── Input / Config ─────────────────────────────────────────────────────────────

export interface EtaInput {
  /** Number of tickets ahead of this one. 0 means next to be called. */
  aheadCount: number;
  /**
   * Average seconds per ticket, sourced from `queue.avg_service_seconds`.
   * When <= 0 the service falls back to `EtaConfig.defaultAvgServiceSeconds`.
   *
   * Future: pass a dynamically computed rolling average here instead of the
   * static queue-level setting — the rest of the calculation stays identical.
   */
  avgServiceSeconds: number;
  /**
   * Current timestamp used to compute `expectedCallAt`.
   * Defaults to `new Date()`. Inject a fixed value in tests for determinism.
   */
  now?: Date;
}

export interface EtaConfig {
  /**
   * Fallback average service time (seconds) used when `avgServiceSeconds <= 0`.
   * Default: 120 s (2 min) — a conservative estimate for a low-activity queue.
   * Set per-deployment via `createEtaService` if the default is not suitable.
   */
  defaultAvgServiceSeconds: number;
  /**
   * aheadCount strictly below this threshold yields HIGH confidence.
   * Default: 5.
   */
  highConfidenceMaxAhead: number;
  /**
   * aheadCount at or above this threshold yields LOW confidence (regardless of
   * whether a fallback was applied). Default: 20.
   */
  lowConfidenceMinAhead: number;
}

// ── Output ─────────────────────────────────────────────────────────────────────

export interface EtaResult {
  /** Raw wait estimate in seconds: `aheadCount × effectiveAvgServiceSeconds`. */
  estimatedWaitSeconds: number;
  /** `estimatedWaitSeconds` converted to minutes, rounded up (`Math.ceil`). */
  estimatedWaitMinutes: number;
  /** Absolute timestamp the caller can expect to be called. */
  expectedCallAt: Date;
  /**
   * `true` when `avgServiceSeconds` was <= 0 and the default fallback was used.
   * Surface an "estimated" qualifier in UI / notifications when this is `true`.
   */
  isFallback: boolean;
  /**
   * Confidence level derived from queue length and whether a fallback was applied.
   * Aligned with the `EtaConfidence` enum from `@line-queue/shared`.
   *
   * HIGH   → not a fallback AND aheadCount < `highConfidenceMaxAhead`
   * MEDIUM → not a fallback AND aheadCount in [highConfidenceMaxAhead, lowConfidenceMinAhead)
   * LOW    → fallback used  OR  aheadCount >= `lowConfidenceMinAhead`
   */
  confidence: EtaConfidence;
}
