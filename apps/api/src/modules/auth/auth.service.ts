import { UserRole } from '@line-queue/shared';

import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AuthUser } from '../../types/auth.types';
import { signToken, TokenPayload } from '../../utils/jwt';

import { verifyLineIdToken } from './line/lineIdToken.verifier';

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
  async loginWithLineToken(idToken: string): Promise<{ token: string; user: AuthUser }> {
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

    // Step 3 — Issue JWT
    const payload: TokenPayload = {
      sub: userRow.id,
      lineUserId: profile.lineUserId,
      role: userRow.role as UserRole,
    };
    const token = signToken(payload);

    const user: AuthUser = {
      id: userRow.id,
      lineUserId: profile.lineUserId,
      role: userRow.role as UserRole,
    };

    return { token, user };
  },
};
