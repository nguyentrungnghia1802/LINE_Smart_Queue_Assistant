import './observability/api-bootstrap';

import { createApp } from './app';
import { config } from './config';
import { closePool } from './db/client';
import { redisService } from './infrastructure/redis';
import { scheduler } from './jobs/scheduler';
import { realtimeService } from './modules/realtime';
import { captureException, shutdownObservability } from './observability/runtime';
import { logger } from './utils/logger';

const app = createApp();

async function startServer(): Promise<void> {
  // Redis accelerates and coordinates ephemeral behavior only. Startup continues
  // in bounded local-fallback mode when Redis is temporarily unavailable.
  await redisService.start();
  await realtimeService.start();

  const server = app.listen(config.port, config.host, () => {
    logger.info({ host: config.host, port: config.port, environment: config.nodeEnv }, 'API ready');
    scheduler.start();
  });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'API shutdown started');
    scheduler.stop();
    await realtimeService.stop();
    server.close(async () => {
      await Promise.all([closePool(), redisService.stop(), shutdownObservability()]);
      logger.info('API shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void startServer();

process.on('uncaughtException', (err) => {
  captureException(err, { processEvent: 'uncaughtException' });
  logger.fatal({ errorType: err.name }, 'API uncaught exception');
  void shutdownObservability().finally(() => process.exit(1));
});

process.on('unhandledRejection', (reason) => {
  captureException(reason, { processEvent: 'unhandledRejection' });
  logger.fatal(
    { errorType: reason instanceof Error ? reason.name : 'UnknownError' },
    'API unhandled rejection'
  );
  void shutdownObservability().finally(() => process.exit(1));
});
