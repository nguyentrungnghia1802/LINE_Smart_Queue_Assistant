import './observability/worker-bootstrap';

import { config } from './config';
import { closePool } from './db/client';
import { bullMqRuntime } from './infrastructure/bullmq';
import { WorkerHeartbeat } from './infrastructure/bullmq/worker-heartbeat';
import { redisService } from './infrastructure/redis';
import { logMonitoringClient } from './modules/log-monitoring';
import { captureException, shutdownObservability } from './observability/runtime';
import { logger } from './utils/logger';

const heartbeat = new WorkerHeartbeat(
  config.bullmq.heartbeatFile,
  config.bullmq.heartbeatIntervalMs,
  () => (bullMqRuntime.status().status === 'ready' ? 'ready' : 'degraded'),
  async (payload) => {
    if (!redisService.isReady) return;
    await redisService.execute((client) =>
      client.set(
        `${config.redis.keyPrefix}:worker:heartbeat`,
        JSON.stringify(payload),
        'PX',
        config.bullmq.heartbeatIntervalMs * 3
      )
    );
  }
);

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Worker shutdown started');
  await bullMqRuntime.stop();
  await heartbeat.stop();
  await redisService.stop();
  await closePool();
  await logMonitoringClient.close();
  await shutdownObservability();
  logger.info('Worker shutdown complete');
  process.exit(exitCode);
}

export async function startWorkerProcess(): Promise<void> {
  if (config.bullmq.notificationDeliveryOwner !== 'bullmq') {
    throw new Error('Worker requires LINE_NOTIFICATION_DELIVERY_OWNER=bullmq');
  }
  await redisService.start();
  await bullMqRuntime.start();
  await heartbeat.start();
  logger.info('Dedicated background worker started');
}

if (require.main === module) {
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (error) => {
    captureException(error, { processEvent: 'uncaughtException', runtimeRole: 'worker' });
    logger.fatal({ errorType: error.name }, 'Worker uncaught exception');
    void shutdown('uncaughtException', 1);
  });
  process.on('unhandledRejection', (reason) => {
    captureException(reason, { processEvent: 'unhandledRejection', runtimeRole: 'worker' });
    logger.fatal(
      { errorType: reason instanceof Error ? reason.name : 'UnknownError' },
      'Worker unhandled rejection'
    );
    void shutdown('unhandledRejection', 1);
  });
  void startWorkerProcess().catch((error: unknown) => {
    captureException(error, { processEvent: 'startupFailure', runtimeRole: 'worker' });
    logger.fatal(
      { errorType: error instanceof Error ? error.name : 'UnknownError' },
      'Dedicated worker failed to start'
    );
    void shutdown('startupFailure', 1);
  });
}
