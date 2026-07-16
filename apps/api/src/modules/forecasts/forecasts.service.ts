import type { CurrentQueueLoad, HistoricalSlot } from './forecasts.repository';
import { forecastsRepository } from './forecasts.repository';

export const FORECAST_MODEL_VERSION = 'measured-heuristic-v1';

export function buildStaffingRecommendation(slot: HistoricalSlot) {
  const averageArrivalsPerSlot = slot.arrival_count / 8;
  const serviceSeconds = slot.average_service_seconds ?? 900;
  const workloadHours = (averageArrivalsPerSlot * serviceSeconds) / 3600;
  const recommendedStaff = Math.max(1, Math.min(30, Math.ceil(workloadHours / 0.8)));
  const sampleSize = Math.max(slot.arrival_count, slot.completion_count);
  const confidence = Number(Math.min(0.9, 0.2 + sampleSize / 50).toFixed(4));
  const explanation =
    sampleSize === 0
      ? 'No observations were available in the prior eight weeks; using the minimum staffing baseline.'
      : `Calculated from ${slot.arrival_count} arrivals in the matching weekday/hour over eight weeks and an average service time of ${Math.ceil(serviceSeconds / 60)} minutes.`;
  return { recommendedStaff, confidence, explanation };
}

export function buildWaitForecast(queue: CurrentQueueLoad) {
  const forecastedWaitSeconds = Math.max(
    0,
    Math.ceil((queue.queue_depth * queue.average_service_seconds) / queue.active_staff_count)
  );
  const confidence = Number(Math.min(0.9, 0.3 + queue.historical_sample_count / 40).toFixed(4));
  return {
    forecastedWaitSeconds,
    confidence,
    explanation: `Calculated from ${queue.queue_depth} waiting parties, ${queue.active_staff_count} active staff, and an average service time of ${Math.ceil(queue.average_service_seconds / 60)} minutes.`,
  };
}

export const forecastsService = {
  async generate(retentionDays: number) {
    const [historicalSlots, currentQueues] = await Promise.all([
      forecastsRepository.loadHistoricalSlots(),
      forecastsRepository.loadCurrentQueueLoads(),
    ]);
    await forecastsRepository.saveCycle(
      historicalSlots.map((slot) => ({ ...slot, ...buildStaffingRecommendation(slot) })),
      currentQueues.map((queue) => ({ ...queue, ...buildWaitForecast(queue) })),
      retentionDays
    );
    await forecastsRepository.deleteExpired();
    return { slotCount: historicalSlots.length, queueCount: currentQueues.length };
  },

  listWait(organizationId: string) {
    return forecastsRepository.listLatestWaitForecasts(organizationId);
  },

  listStaffing(organizationId: string) {
    return forecastsRepository.listLatestStaffing(organizationId);
  },
};
