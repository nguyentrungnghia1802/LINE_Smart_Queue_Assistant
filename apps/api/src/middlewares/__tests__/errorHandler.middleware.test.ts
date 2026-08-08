import { describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { errorHandler } from '../errorHandler.middleware';

describe('errorHandler validation details', () => {
  it('returns form-level Zod issues instead of an empty fieldErrors object', () => {
    const schema = z.object({ value: z.string().optional() }).refine((input) => input.value, {
      message: 'At least one field must be provided',
    });
    const result = schema.safeParse({});
    if (result.success) throw new Error('Expected schema validation to fail');

    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const response = { status } as unknown as Response;

    errorHandler(result.error, {} as Request, response, jest.fn() as unknown as NextFunction);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: {
            fieldErrors: { _form: ['At least one field must be provided'] },
          },
        }),
      })
    );
  });
});
