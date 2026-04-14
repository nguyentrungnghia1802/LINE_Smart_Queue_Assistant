import { UserRole } from '@line-queue/shared';

/**
 * The authenticated user payload attached to req.user by currentUser middleware.
 *
 * Trusted fields only — sourced from our own JWT, never from raw client input.
 */
export interface AuthUser {
  /** Internal UUID from the users table. */
  id: string;
  /** LINE userId — stable platform identifier for this user. */
  lineUserId: string;
  /** User's role — drives access-control decisions in requireRole middleware. */
  role: UserRole;
  /** Org the user belongs to — may be absent for standalone customers. */
  organizationId?: string;
}
