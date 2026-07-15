import { UserRole } from '@line-queue/shared';

/**
 * The authenticated user payload attached to req.user by currentUser middleware.
 *
 * Trusted fields only — sourced from our own JWT, never from raw client input.
 */
export interface AuthUser {
  /** Internal UUID from the users table. */
  id: string;
  /** LINE userId — present for LINE-authenticated users, absent for email/password logins. */
  lineUserId?: string;
  /** User's role — drives access-control decisions in requireRole middleware. */
  role: UserRole;
  /** Org the user belongs to — may be absent for standalone customers. */
  organizationId?: string;
  /** Display name for UI. */
  displayName?: string;
  /** Email for UI. */
  email?: string;
}
