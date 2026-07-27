import bcrypt from 'bcryptjs';

import { UserRole } from '@line-queue/shared';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { signToken, TokenPayload } from '../../utils/jwt';

import { authSessionService, IssuedAuthSession } from './auth-session.service';
import { verifyLineIdToken } from './line/lineIdToken.verifier';

interface AuthenticationResult {
  token: string;
  user: AuthUser;
  session: IssuedAuthSession;
}

async function resolveAuthentication(userId: string): Promise<{
  payload: TokenPayload;
  user: AuthUser;
}> {
  const userRow = await usersRepository.findById(userId);
  if (!userRow?.is_active || userRow.account_status === 'disabled') {
    await authSessionService.revokeAllForUser(userId);
    throw new AppError('This account has been disabled', 401, 'AUTH_ACCOUNT_DISABLED');
  }

  const role = userRow.role as UserRole;
  const membership = await organizationsRepository.findMembershipByUserId(userRow.id);
  const organization = membership
    ? await organizationsRepository.findById(membership.organization_id)
    : null;
  const branchIds = membership
    ? await organizationsRepository.findBranchIdsForUser(userRow.id, membership.organization_id)
    : [];
  const lineAccount =
    role === UserRole.CUSTOMER ? await usersRepository.findLineAccountByUserId(userRow.id) : null;

  if (role === UserRole.CUSTOMER && !lineAccount?.is_linked) {
    throw new AppError('LINE account is no longer linked', 401, 'LINE_AUTH_REQUIRED');
  }
  if ([UserRole.STAFF, UserRole.MANAGER].includes(role) && !membership) {
    throw new AppError('User has no organization membership', 403, 'FORBIDDEN');
  }

  return {
    payload: {
      sub: userRow.id,
      role,
      orgId: membership?.organization_id,
      lineUserId: lineAccount?.line_user_id,
    },
    user: {
      id: userRow.id,
      lineUserId: lineAccount?.line_user_id,
      role,
      organizationId: membership?.organization_id,
      displayName: userRow.display_name,
      email: userRow.email ?? undefined,
      preferredLocale: userRow.preferred_locale,
      organizationLocale: organization?.default_locale,
      isOrganizationOwner: membership?.is_owner ?? false,
      branchIds,
    },
  };
}

async function issueAuthentication(
  payload: TokenPayload,
  user: AuthUser
): Promise<AuthenticationResult> {
  const session = await authSessionService.issue(user.id, user.role);
  return {
    token: signToken({ ...payload, sid: session.familyId }),
    user,
    session,
  };
}

export const authService = {
  /**
   * Verify a LINE OIDC id_token and return an internal JWT together with
   * the authenticated user's public profile.
   *
   * Flow:
   *  1. Call LINE's verify endpoint — throws 401 on failure.
   *  2. Look up the internal user by lineUserId.
   *     - New user  → create users row + line_accounts row in one transaction.
   *     - Known user → sync display name / picture via upsertLineAccount.
   *  3. Issue a signed JWT containing only non-sensitive identity claims.
   */
  async loginWithLineToken(idToken: string): Promise<AuthenticationResult> {
    // Step 1 — Verify with LINE (server-side; not local JWT decode)
    const profile = await verifyLineIdToken(idToken);

    // Step 2 — Resolve internal user
    let userRow = await usersRepository.findByLineUserId(profile.lineUserId);

    if (userRow) {
      // Returning user: sync profile data on each login
      await usersRepository.upsertLineAccount({
        userId: userRow.id,
        lineUserId: profile.lineUserId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
      });
    } else {
      // First login: create user + link LINE account atomically
      userRow = await withTransaction(async (client) => {
        const created = await usersRepository.create(
          { displayName: profile.displayName, role: 'customer' },
          client
        );
        await usersRepository.upsertLineAccount(
          {
            userId: created.id,
            lineUserId: profile.lineUserId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
          },
          client
        );
        return created;
      });
    }

    // LINE exposes email only when the channel has the email scope and the
    // customer consents. Never overwrite an existing address or claim one
    // already owned by another platform user.
    if (profile.email && !userRow.email) {
      userRow =
        (await usersRepository.setVerifiedLineEmailIfAvailable(userRow.id, profile.email)) ??
        userRow;
    }

    // Step 3 — Issue JWT
    const payload: TokenPayload = {
      sub: userRow.id,
      lineUserId: profile.lineUserId,
      role: userRow.role as UserRole,
    };
    const user: AuthUser = {
      id: userRow.id,
      lineUserId: profile.lineUserId,
      role: userRow.role as UserRole,
      displayName: userRow.display_name,
      email: userRow.email ?? undefined,
      preferredLocale: userRow.preferred_locale,
    };

    return issueAuthentication(payload, user);
  },

  async loginWithEmailPassword(email: string, password: string): Promise<AuthenticationResult> {
    const userRow = await usersRepository.findByEmail(email);
    if (!userRow) {
      throw new AppError(
        'No account is registered for this email address',
        401,
        'AUTH_ACCOUNT_NOT_FOUND'
      );
    }
    if (!userRow.is_active || userRow.account_status === 'disabled') {
      throw new AppError('This account has been disabled', 403, 'AUTH_ACCOUNT_DISABLED');
    }
    if (!userRow.password_hash || userRow.account_status === 'invited') {
      throw new AppError(
        'This account has not been activated yet',
        403,
        'AUTH_ACCOUNT_NOT_ACTIVATED'
      );
    }

    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      throw new AppError('The password is incorrect', 401, 'AUTH_INVALID_PASSWORD');
    }
    if (userRow.role === UserRole.CUSTOMER) {
      throw new AppError(
        'Customer accounts must sign in with LINE',
        403,
        'CUSTOMER_LINE_LOGIN_REQUIRED'
      );
    }

    const membership = await organizationsRepository.findMembershipByUserId(userRow.id);
    const organization = membership
      ? await organizationsRepository.findById(membership.organization_id)
      : null;
    const branchIds = membership
      ? await organizationsRepository.findBranchIdsForUser(userRow.id, membership.organization_id)
      : [];

    const payload: TokenPayload = {
      sub: userRow.id,
      role: userRow.role as UserRole,
      orgId: membership?.organization_id,
    };
    const user: AuthUser = {
      id: userRow.id,
      role: userRow.role as UserRole,
      organizationId: membership?.organization_id,
      displayName: userRow.display_name,
      email: userRow.email ?? undefined,
      preferredLocale: userRow.preferred_locale,
      organizationLocale: organization?.default_locale,
      isOrganizationOwner: membership?.is_owner ?? false,
      branchIds,
    };

    return issueAuthentication(payload, user);
  },

  async refreshSession(refreshToken: string): Promise<AuthenticationResult> {
    const session = await authSessionService.rotate(refreshToken);
    try {
      const { payload, user } = await resolveAuthentication(session.userId);
      return {
        token: signToken({ ...payload, sid: session.familyId }),
        user,
        session,
      };
    } catch (error) {
      await authSessionService.revoke(session.refreshToken, 'identity_invalid');
      throw error;
    }
  },

  async logout(refreshToken: string | null): Promise<void> {
    if (refreshToken) await authSessionService.revoke(refreshToken);
  },
};
