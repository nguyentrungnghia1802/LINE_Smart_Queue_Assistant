import pino from 'pino';

import { config } from '../config';

/**
 * Singleton pino logger.
 *
 * In development, output is pretty-printed via pino-pretty.
 * In production, output is newline-delimited JSON for log aggregators.
 *
 * The instance is shared by httpLoggerMiddleware (via pino-http genReqId)
 * and can be imported directly for non-request logging (jobs, startup, etc.).
 */
export const logger = pino(
  {
    level:
      config.nodeEnv === 'test' ? 'silent' : config.nodeEnv === 'production' ? 'info' : 'debug',
    base: { service: 'line-queue-api' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers'],
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  config.nodeEnv === 'production'
    ? undefined
    : pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: 'pid,hostname,service',
        },
      })
);
