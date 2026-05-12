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

      /**
       * Raw request body bytes captured by the `verify` hook on express.json().
       * Used by the LINE webhook controller to verify the HMAC-SHA256 signature
       * against the exact bytes LINE signed — re-serialising parsed JSON would
       * not be byte-for-byte equivalent.
       */
      rawBody?: Buffer;
    }
  }
}

export {};
