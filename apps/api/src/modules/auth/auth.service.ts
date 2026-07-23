import bcrypt from 'bcryptjs';

import { UserRole } from '@line-queue/shared';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { signToken, TokenPayload } from '../../utils/jwt';

import { RegisterCustomerDto } from './auth.validator';
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
    const token = signToken(payload);

    const user: AuthUser = {
      id: userRow.id,
      lineUserId: profile.lineUserId,
      role: userRow.role as UserRole,
      displayName: userRow.display_name,
      email: userRow.email ?? undefined,
      preferredLocale: userRow.preferred_locale,
    };

    return { token, user };
  },

  async loginWithEmailPassword(
    email: string,
    password: string
  ): Promise<{ token: string; user: AuthUser }> {
    const userRow = await usersRepository.findByEmail(email);
    if (!userRow || !userRow.password_hash) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, userRow.password_hash);
    if (!valid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const membership = await organizationsRepository.findMembershipByUserId(userRow.id);
    const organization = membership
      ? await organizationsRepository.findById(membership.organization_id)
      : null;

    const payload: TokenPayload = {
      sub: userRow.id,
      role: userRow.role as UserRole,
      orgId: membership?.organization_id,
    };
    const token = signToken(payload);

    const user: AuthUser = {
      id: userRow.id,
      role: userRow.role as UserRole,
      organizationId: membership?.organization_id,
      displayName: userRow.display_name,
      email: userRow.email ?? undefined,
      preferredLocale: userRow.preferred_locale,
      organizationLocale: organization?.default_locale,
    };

    return { token, user };
  },

  async registerCustomer(dto: RegisterCustomerDto): Promise<{ token: string; user: AuthUser }> {
    const existing = await usersRepository.findByEmail(dto.email);
    if (existing) {
      throw AppError.conflict('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userRow = await usersRepository.createWithPassword({
      displayName: dto.displayName,
      email: dto.email,
      role: 'customer',
      passwordHash,
    });

    const payload: TokenPayload = {
      sub: userRow.id,
      role: UserRole.CUSTOMER,
    };
    const token = signToken(payload);

    const user: AuthUser = {
      id: userRow.id,
      role: UserRole.CUSTOMER,
      displayName: userRow.display_name,
      email: userRow.email ?? undefined,
      preferredLocale: userRow.preferred_locale,
    };

    return { token, user };
  },
};
