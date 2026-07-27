import { config } from '../config';
import { authSessionRepository } from '../modules/auth/auth-session.repository';
import { logger } from '../utils/logger';

export async function runAuthSessionCleanup(): Promise<void> {
  const deleted = await authSessionRepository.deleteExpired(
    config.auth.revokedSessionRetentionDays
  );
  logger.debug({ deleted }, 'authSessionCleanup: cycle complete');
}
