import { EtaConfidence } from '@line-queue/shared';

import { EtaConfig, EtaInput, EtaResult } from './eta.types';

// ── Default config constants ───────────────────────────────────────────────────

/**
 * Fallback average service time used when a queue has no measured
 * `avg_service_seconds` (i.e. the value is 0 or absent).
 *
 * 120 s (2 min) is a conservative low-activity estimate. Real queues should
 * configure `avg_service_seconds` at creation time; this only fires during
 * bootstrap or for very new queues before any completions have been recorded.
 */
const DEFAULT_AVG_SERVICE_SECONDS = 120;

/**
 * aheadCount strictly below this value → HIGH confidence.
 * Short queues (fewer than 5 people) are highly predictable at MVP scale.
 */
const HIGH_CONFIDENCE_MAX_AHEAD = 5;

/**
 * aheadCount at or above this value → LOW confidence.
 * Queues of 20+ people introduce enough variance to warrant a conservative label.
 */
const LOW_CONFIDENCE_MIN_AHEAD = 20;

export const DEFAULT_ETA_CONFIG: EtaConfig = {
  defaultAvgServiceSeconds: DEFAULT_AVG_SERVICE_SECONDS,
  highConfidenceMaxAhead: HIGH_CONFIDENCE_MAX_AHEAD,
  lowConfidenceMinAhead: LOW_CONFIDENCE_MIN_AHEAD,
};

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Map queue-length + fallback flag to a confidence level.
 *
 * Rules (evaluated in order):
 *   1. Fallback applied OR aheadCount >= lowConfidenceMinAhead → LOW
 *   2. aheadCount < highConfidenceMaxAhead → HIGH
 *   3. Otherwise → MEDIUM
 */
function deriveConfidence(
  aheadCount: number,
  isFallback: boolean,
  config: EtaConfig
): EtaConfidence {
  if (isFallback || aheadCount >= config.lowConfidenceMinAhead) {
    return EtaConfidence.LOW;
  }
  if (aheadCount < config.highConfidenceMaxAhead) {
    return EtaConfidence.HIGH;
  }
  return EtaConfidence.MEDIUM;
}

// ── Service ────────────────────────────────────────────────────────────────────

/**
 * ETA calculation service.
 *
 * **Decoupling contract**: this service knows nothing about HTTP,
 * Express, or database access. It accepts plain numbers and returns
 * a plain `EtaResult`. Queue controllers and the queue service call
 * `etaService.calculate()` and embed the result in their response shapes.
 *
 * **Upgradeability**: `avgServiceSeconds` in `EtaInput` is the only
 * source of service-time measurement. Today callers pass
 * `queue.avg_service_seconds` (a static column). Once historical
 * completion data is available, callers can pass a dynamically
 * computed rolling average without changing this service at all.
 */
export const etaService = {
  /**
   * Calculate ETA for a single ticket position.
   *
   * **Formula (Hybrid Strategy)**:
   * 1. If `totalWorkloadMinutes` is present and > 0:
   *    `estimatedWaitSeconds = totalWorkloadMinutes × 60`
   * 2. Otherwise, fallback to:
   *    `estimatedWaitSeconds = aheadCount × effectiveAvgServiceSeconds`
   *    where `effectiveAvgServiceSeconds` is `avgServiceSeconds` when > 0,
   *    or `config.defaultAvgServiceSeconds` (fallback) otherwise.
   *
   * This enables workload-aware ETA when order_items data is available,
   * and gracefully falls back to average-based calculation otherwise.
   *
   * @param input  - Position data and service-time measurement for this ticket
   * @param config - Tunable thresholds; defaults to `DEFAULT_ETA_CONFIG`
   * @returns      - A fully populated `EtaResult`
   */
  calculate(input: EtaInput, config: EtaConfig = DEFAULT_ETA_CONFIG): EtaResult {
    const { aheadCount, avgServiceSeconds, totalWorkloadMinutes, now = new Date() } = input;

    let estimatedWaitSeconds: number;
    let isFallback: boolean;

    // Primary: Use workload-based calculation if available
    if (totalWorkloadMinutes && totalWorkloadMinutes > 0) {
      estimatedWaitSeconds = totalWorkloadMinutes * 60;
      isFallback = false;
    } else {
      // Fallback: Use average-based calculation
      isFallback = avgServiceSeconds <= 0;
      const effectiveAvgServiceSeconds = isFallback
        ? config.defaultAvgServiceSeconds
        : avgServiceSeconds;
      estimatedWaitSeconds = aheadCount * effectiveAvgServiceSeconds;
    }

    const estimatedWaitMinutes = Math.ceil(estimatedWaitSeconds / 60);
    const expectedCallAt = new Date(now.getTime() + estimatedWaitSeconds * 1_000);
    const confidence = deriveConfidence(aheadCount, isFallback, config);

    return {
      estimatedWaitSeconds,
      estimatedWaitMinutes,
      expectedCallAt,
      isFallback,
      confidence,
    };
  },
};
