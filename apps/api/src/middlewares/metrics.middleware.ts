import { NextFunction, Request, Response } from 'express';

import { metricsService } from '../utils/metrics';

export function metricsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    metricsService.increment('requests_total');
    metricsService.setGauge(
      'http_request_latency_seconds',
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000
    );
    if (res.statusCode >= 400) {
      metricsService.increment('errors_total');
    }
  });

  next();
}
