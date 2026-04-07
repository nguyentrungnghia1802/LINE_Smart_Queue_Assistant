// Augment Express Request with fields set by custom middleware.
// pino-http already declares req.log: pino.Logger via its own type defs.

declare global {
  namespace Express {
    interface Request {
      /** Unique trace ID for this request — set by requestId middleware. */
      id: string;

      /** Authenticated user payload — populated by auth middleware (future). */
      user?: {
        id: string;
        role: string;
        organizationId?: string;
      };
    }
  }
}

export {};
