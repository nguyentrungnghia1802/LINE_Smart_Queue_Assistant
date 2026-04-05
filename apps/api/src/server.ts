import { createApp } from './app';
import { config } from './config';
import { closePool } from './db/client';

const app = createApp();

const server = app.listen(config.port, config.host, () => {
  console.info(`🚀  API ready → http://${config.host}:${config.port}`);
  console.info(`📋  Environment: ${config.nodeEnv}`);
});

// ── Graceful shutdown ──────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  console.info(`\n${signal} received — shutting down gracefully…`);
  server.close(async () => {
    console.info('HTTP server closed.');
    await closePool();
    console.info('DB pool closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
