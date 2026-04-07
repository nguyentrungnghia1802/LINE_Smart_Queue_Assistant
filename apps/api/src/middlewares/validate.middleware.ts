import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

type ValidateTarget = 'body' | 'params' | 'query';

/**
 * Request validation middleware factory using Zod schemas.
 *
 * - Parses req[target] against `schema`.
 * - On success: replaces req[target] with the coerced/defaulted Zod output.
 * - On failure: forwards a ZodError to next() — caught by errorHandler as 422.
 *
 * Usage:
 *   router.post('/path', validate(myBodySchema), asyncHandler(controller));
 *   router.get('/:id',   validate(uuidParamSchema, 'params'), ...);
 */
export function validate(schema: ZodType, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      // ZodError is handled as 422 Unprocessable Entity in errorHandler
      next(result.error);
      return;
    }
    // Replace with coerced + default-applied value
    Object.assign(req, { [target]: result.data });
    next();
  };
}

export { ZodError };
