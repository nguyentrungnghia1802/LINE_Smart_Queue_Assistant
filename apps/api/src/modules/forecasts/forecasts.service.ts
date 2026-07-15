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
      ? '過去8週間の実績がないため、最低配置人数を提案しています。'
      : `過去8週間の同じ曜日・時間帯の受付${slot.arrival_count}件と平均対応時間${Math.ceil(serviceSeconds / 60)}分から算出しています。`;
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
    explanation: `現在の待機${queue.queue_depth}組、稼働スタッフ${queue.active_staff_count}名、平均対応時間${Math.ceil(queue.average_service_seconds / 60)}分から算出しています。`,
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
