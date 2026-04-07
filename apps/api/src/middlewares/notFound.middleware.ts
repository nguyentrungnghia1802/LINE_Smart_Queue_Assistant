import { Request, Response } from 'express';

import { sendError } from '../utils/response';

/** Catches any request that did not match a registered route. */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, 404, 'NOT_FOUND', req.method + ' ' + req.path + ' not found');
}
