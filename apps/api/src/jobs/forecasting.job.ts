import { config } from '../config';
import { forecastsService } from '../modules/forecasts/forecasts.service';
import { logger } from '../utils/logger';

export async function runForecasting(): Promise<void> {
  const result = await forecastsService.generate(config.forecasts.retentionDays);
  logger.info(result, 'forecasting: measured heuristic cycle completed');
}
