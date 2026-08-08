import { createApp } from './app';
import { config } from './config';
import { closePool } from './db/client';
import { redisService } from './infrastructure/redis';
import { scheduler } from './jobs/scheduler';

const app = createApp();

async function startServer(): Promise<void> {
  // Redis accelerates and coordinates ephemeral behavior only. Startup continues
  // in bounded local-fallback mode when Redis is temporarily unavailable.
  await redisService.start();

  const server = app.listen(config.port, config.host, () => {
    console.info(`🚀  API ready → http://${config.host}:${config.port}`);
    console.info(`📋  Environment: ${config.nodeEnv}`);
    scheduler.start();
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`\n${signal} received — shutting down gracefully…`);
    scheduler.stop();
    server.close(async () => {
      console.info('HTTP server closed.');
      await Promise.all([closePool(), redisService.stop()]);
      console.info('DB pool and Redis client closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void startServer();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
