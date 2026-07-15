import { NextFunction, Request, Response } from 'express';

import { metricsService } from '../utils/metrics';

export function metricsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    metricsService.increment('requests_total');
    if (res.statusCode >= 400) {
      metricsService.increment('errors_total');
    }
  });

  next();
}
