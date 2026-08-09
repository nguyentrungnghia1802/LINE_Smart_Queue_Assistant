import { createHash, randomBytes } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { PoolClient } from 'pg';

import type { SupportedLocale } from '@line-queue/shared';

import { config } from '../../config';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { authSessionService } from '../auth/auth-session.service';
import { emailOutboxRepository } from '../email/email-outbox.repository';
import { encryptEmailActionToken } from '../email/email-token.crypto';

import {
  type AccountActionPurpose,
  accountLifecycleRepository,
} from './account-lifecycle.repository';
import type { CompleteAccountActionDto, ForgotPasswordDto } from './account-lifecycle.validator';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

function expiresAt(purpose: AccountActionPurpose): Date {
  const milliseconds =
    purpose === 'account_activation'
      ? config.email.activationTtlHours * 60 * 60 * 1000
      : config.email.passwordResetTtlMinutes * 60 * 1000;
  return new Date(Date.now() + milliseconds);
}

function expiryLabel(purpose: AccountActionPurpose, locale: SupportedLocale): string {
  const value =
    purpose === 'account_activation'
      ? config.email.activationTtlHours
      : config.email.passwordResetTtlMinutes;
  if (locale === 'ja') return purpose === 'account_activation' ? `${value}時間` : `${value}分`;
  if (locale === 'vi') return purpose === 'account_activation' ? `${value} giờ` : `${value} phút`;
  return purpose === 'account_activation' ? `${value} hours` : `${value} minutes`;
}

export interface IssueAccountActionParams {
  userId: string;
  recipientEmail: string;
  displayName: string;
  organizationName?: string;
  locale: SupportedLocale;
  purpose: AccountActionPurpose;
  createdBy?: string;
}

export async function issueAccountAction(
  params: IssueAccountActionParams,
  client: PoolClient
): Promise<void> {
  const rawToken = randomBytes(32).toString('base64url');
  await accountLifecycleRepository.revokeActive(params.userId, params.purpose, client);
  const tokenRow = await accountLifecycleRepository.createToken(
    {
      userId: params.userId,
      purpose: params.purpose,
      tokenHash: hashToken(rawToken),
      createdBy: params.createdBy,
      expiresAt: expiresAt(params.purpose),
    },
    client
  );
  await emailOutboxRepository.enqueue(
    {
      eventKey: `account-action:${tokenRow.id}`,
      recipientEmail: params.recipientEmail,
      templateKey: params.purpose,
      locale: params.locale,
      templateData: {
        displayName: params.displayName,
        organizationName: params.organizationName ?? 'Smart Queue Assistant',
        expiresIn: expiryLabel(params.purpose, params.locale),
      },
      encryptedActionToken: encryptEmailActionToken(rawToken),
    },
    client
  );
}

export async function revokeAccountAction(
  userId: string,
  purpose: AccountActionPurpose,
  client: PoolClient
): Promise<void> {
  await accountLifecycleRepository.revokeActive(userId, purpose, client);
  await emailOutboxRepository.cancelAccountAction(userId, purpose, client);
}

function assertPurpose(actual: AccountActionPurpose, expected: AccountActionPurpose): void {
  if (actual !== expected) {
    throw new AppError('The account action link is invalid', 400, 'ACCOUNT_TOKEN_INVALID');
  }
}

export const accountLifecycleService = {
  async inspect(rawToken: string) {
    const context = await accountLifecycleRepository.findValid(hashToken(rawToken));
    if (!context) {
      throw new AppError(
        'The account action link is invalid or expired',
        400,
        'ACCOUNT_TOKEN_INVALID'
      );
    }
    return {
      purpose: context.purpose,
      displayName: context.display_name,
      maskedEmail: maskEmail(context.email),
      organizationName: context.organization_name,
      expiresAt: context.expires_at,
    };
  },

  async activate(dto: CompleteAccountActionDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    return withTransaction(async (client) => {
      const context = await accountLifecycleRepository.lockValid(hashToken(dto.token), client);
      if (!context) {
        throw new AppError(
          'The activation link is invalid or expired',
          400,
          'ACCOUNT_TOKEN_INVALID'
        );
      }
      assertPurpose(context.purpose, 'account_activation');
      if (context.account_status !== 'invited') {
        throw AppError.conflict('This account has already been activated');
      }
      await accountLifecycleRepository.activateAccount(context, passwordHash, client);
      return { activated: true };
    });
  },

  async requestPasswordReset(dto: ForgotPasswordDto) {
    const user = await usersRepository.findByEmail(dto.email);
    if (
      !user ||
      user.role === 'customer' ||
      !user.is_active ||
      user.account_status !== 'active' ||
      !user.email
    ) {
      return { accepted: true };
    }
    await withTransaction(async (client) => {
      const membership = await client.query<{
        organization_name: string | null;
        locale: SupportedLocale | null;
      }>(
        `SELECT o.name AS organization_name, o.default_locale AS locale
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.user_id = $1 AND om.is_active = TRUE
         ORDER BY om.joined_at
         LIMIT 1`,
        [user.id]
      );
      await issueAccountAction(
        {
          userId: user.id,
          recipientEmail: user.email ?? dto.email,
          displayName: user.display_name,
          organizationName: membership.rows[0]?.organization_name ?? undefined,
          locale: user.preferred_locale ?? membership.rows[0]?.locale ?? 'ja',
          purpose: 'password_reset',
        },
        client
      );
    });
    return { accepted: true };
  },

  async resetPassword(dto: CompleteAccountActionDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const result = await withTransaction(async (client) => {
      const context = await accountLifecycleRepository.lockValid(hashToken(dto.token), client);
      if (!context) {
        throw new AppError(
          'The password reset link is invalid or expired',
          400,
          'ACCOUNT_TOKEN_INVALID'
        );
      }
      assertPurpose(context.purpose, 'password_reset');
      if (!context.is_active || context.account_status !== 'active') {
        throw AppError.forbidden('This account is not active');
      }
      await accountLifecycleRepository.resetPassword(context, passwordHash, client);
      return { reset: true, userId: context.user_id };
    });
    await authSessionService.revokeAllForUser(result.userId, 'password_reset');
    return { reset: true };
  },
};
