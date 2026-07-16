import { locationService } from '../modules/location/location.service';
import { logger } from '../utils/logger';

export async function runLocationAlerts(): Promise<void> {
  const processed = await locationService.processAlerts();
  logger.debug({ processed }, 'locationAlerts: cycle complete');
}

export async function runLocationCleanup(): Promise<void> {
  const anonymized = await locationService.cleanupExpired();
  logger.debug({ anonymized }, 'locationCleanup: cycle complete');
}
