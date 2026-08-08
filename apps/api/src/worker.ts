import { config } from './config';
import { closePool } from './db/client';
import { bullMqRuntime } from './infrastructure/bullmq';
import { WorkerHeartbeat } from './infrastructure/bullmq/worker-heartbeat';
import { logger } from './utils/logger';

const heartbeat = new WorkerHeartbeat(
  config.bullmq.heartbeatFile,
  config.bullmq.heartbeatIntervalMs,
  () => (bullMqRuntime.status().status === 'ready' ? 'ready' : 'degraded')
);

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker shutdown started');
  await bullMqRuntime.stop();
  await heartbeat.stop();
  await closePool();
  logger.info('Worker shutdown complete');
  process.exit(exitCode);
}

export async function startWorkerProcess(): Promise<void> {
  if (config.bullmq.notificationDeliveryOwner !== 'bullmq') {
    throw new Error('Worker requires LINE_NOTIFICATION_DELIVERY_OWNER=bullmq');
  }
  await bullMqRuntime.start();
  await heartbeat.start();
  logger.info('Dedicated background worker started');
}

if (require.main === module) {
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ errorType: error.name }, 'Worker uncaught exception');
    void shutdown('uncaughtException', 1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal(
      { errorType: reason instanceof Error ? reason.name : 'UnknownError' },
      'Worker unhandled rejection'
    );
    void shutdown('unhandledRejection', 1);
  });
  void startWorkerProcess().catch((error: unknown) => {
    logger.fatal(
      { errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Dedicated worker failed to start'
    );
    void shutdown('startupFailure', 1);
  });
}
