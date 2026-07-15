import pino from 'pino';

import { config } from '../config';

const loggerLevel = (() => {
  if (config.nodeEnv === 'test') return 'silent';
  if (config.nodeEnv === 'production') return 'info';
  return 'debug';
})();

const loggerTransport = (() => {
  if (config.nodeEnv === 'production') {
    return undefined;
  }

  return pino.transport({
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname,service',
    },
  });
})();

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
    level: loggerLevel,
    base: { service: 'line-queue-api' },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers',
        'password',
        '*.password',
        'token',
        '*.token',
        'secret',
        '*.secret',
        'channelAccessToken',
        'channelSecret',
      ],
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  loggerTransport
);
