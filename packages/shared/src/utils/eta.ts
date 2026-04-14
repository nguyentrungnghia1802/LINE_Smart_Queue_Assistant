import { ETA_CONFIG } from '../constants/domain';
import type { EtaInfo } from '../types/entities';
import { EtaConfidence } from '../types/enums';

/**
 * Estimate waiting time in minutes based on position in queue.
 * Position 1 = currently being served → 0 minutes wait.
 */
export function estimateWaitMinutes(position: number, avgServiceTimeMinutes: number): number {
  return Math.max(0, (position - 1) * avgServiceTimeMinutes);
}

/**
 * Derive ETA confidence from the number of positions ahead in queue.
 */
export function deriveEtaConfidence(position: number): EtaConfidence {
  if (position <= ETA_CONFIG.HIGH_CONFIDENCE_THRESHOLD) return EtaConfidence.HIGH;
  if (position <= ETA_CONFIG.MEDIUM_CONFIDENCE_THRESHOLD) return EtaConfidence.MEDIUM;
  return EtaConfidence.LOW;
}

/**
 * Build a full EtaInfo object from queue context.
 * When avgServiceTimeMinutes is undefined (not yet configured),
 * estimatedCallTime is null and confidence defaults to LOW.
 */
export function buildEtaInfo(
  positionInQueue: number,
  avgServiceTimeMinutes: number | undefined
): EtaInfo {
  const estimatedWaitMinutes =
    avgServiceTimeMinutes !== undefined
      ? estimateWaitMinutes(positionInQueue, avgServiceTimeMinutes)
      : 0;

  const estimatedCallTime =
    avgServiceTimeMinutes !== undefined
      ? new Date(Date.now() + estimatedWaitMinutes * 60_000)
      : null;

  return {
    positionInQueue,
    estimatedWaitMinutes,
    estimatedCallTime,
    confidence:
      avgServiceTimeMinutes !== undefined
        ? deriveEtaConfidence(positionInQueue)
        : EtaConfidence.LOW,
  };
}
