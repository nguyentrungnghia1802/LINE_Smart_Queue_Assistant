import type { SupportedLocale, UserRole } from '@line-queue/shared';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  organizationId?: string;
  preferredLocale?: SupportedLocale | null;
  organizationLocale?: SupportedLocale;
  isOrganizationOwner?: boolean;
  branchIds?: string[];
}

export interface AuthSessionMetadata {
  kind: 'business' | 'customer';
  idleTimeoutSeconds: number;
  absoluteExpiresAt: string;
}

export interface AuthenticationResponse {
  token: string;
  user: AuthUser;
  session: AuthSessionMetadata;
}
