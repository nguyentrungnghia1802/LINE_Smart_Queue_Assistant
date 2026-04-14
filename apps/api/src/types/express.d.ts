// Augment Express Request with fields set by custom middleware.
// pino-http already declares req.log: pino.Logger via its own type defs.

import type { AuthUser } from './auth.types';

declare global {
  namespace Express {
    interface Request {
      /** Unique trace ID for this request — set by requestId middleware. */
      id: string;

      /**
       * Authenticated user payload — populated by currentUser middleware.
       * Undefined for anonymous (unauthenticated) requests.
       * Use requireAuth middleware to enforce presence.
       */
      user?: AuthUser;
    }
  }
}

export {};
