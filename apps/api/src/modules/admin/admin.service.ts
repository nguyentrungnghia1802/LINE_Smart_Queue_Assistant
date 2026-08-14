import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { authSessionService } from '../auth/auth-session.service';
import { organizationApplicationsRepository } from '../organization-applications/organization-applications.repository';
import { toUserResponse } from '../users/user-response';

import { SuspendOrganizationDto, UpdateOwnerEmailDto } from './admin.validator';

export const adminService = {
  async listOrganizations() {
    const organizations = await organizationsRepository.listForAdmin();
    return organizations.map((organization) => ({
      ...organization,
      subscription_plan:
        organization.settings?.subscriptionPlan === 'standard' ||
        organization.settings?.subscriptionPlan === 'scale'
          ? organization.settings.subscriptionPlan
          : 'starter',
    }));
  },

  async getDashboard() {
    return organizationApplicationsRepository.getAdminDashboard();
  },

  async suspendOrganization(orgId: string, actorId: string, dto: SuspendOrganizationDto) {
    return withTransaction(async (client) => {
      const organizationResult = await client.query<{
        activation_status: 'pending_activation' | 'active' | 'suspended';
        is_active: boolean;
      }>(
        `SELECT activation_status, is_active
         FROM organizations
         WHERE id = $1
         FOR UPDATE`,
        [orgId]
      );
      const organization = organizationResult.rows[0];
      if (!organization) throw AppError.notFound('Organization');
      if (!organization.is_active || organization.activation_status !== 'active') {
        throw AppError.conflict('Only an active organization can be suspended');
      }

      const members = await client.query<{ user_id: string }>(
        `SELECT user_id FROM organization_members
         WHERE organization_id = $1
         FOR UPDATE`,
        [orgId]
      );
      const userIds = members.rows.map((member) => member.user_id);
      await client.query(
        `UPDATE organizations
         SET is_active = FALSE,
             activation_status = 'suspended',
             suspension_reason = $2,
             suspension_note = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [orgId, dto.reason, dto.note ?? null]
      );
      await client.query(
        `UPDATE organization_branches SET is_active = FALSE, updated_at = NOW()
         WHERE organization_id = $1`,
        [orgId]
      );
      await client.query(
        `UPDATE queues SET is_active = FALSE, status = 'closed', updated_at = NOW()
         WHERE organization_id = $1`,
        [orgId]
      );
      await client.query(
        `UPDATE products SET is_active = FALSE, updated_at = NOW()
         WHERE organization_id = $1`,
        [orgId]
      );
      await client.query(
        `UPDATE branch_memberships
         SET is_active = FALSE, deactivated_at = NOW()
         WHERE organization_id = $1`,
        [orgId]
      );
      await client.query(
        `UPDATE organization_members SET is_active = FALSE
         WHERE organization_id = $1`,
        [orgId]
      );
      if (userIds.length > 0) {
        await client.query(
          `UPDATE users
           SET is_active = FALSE,
               account_status = 'disabled',
               deactivated_at = NOW(),
               deactivated_by = $2,
               updated_at = NOW()
           WHERE id = ANY($1::uuid[])`,
          [userIds, actorId]
        );
      }
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, action, resource_type, resource_id, organization_id, changes)
         VALUES ($1,'organization.suspend','organization',$2,$2,$3)`,
        [
          actorId,
          orgId,
          JSON.stringify({
            reason: dto.reason,
            note: dto.note ?? null,
            deactivatedUserCount: userIds.length,
          }),
        ]
      );

      return {
        id: orgId,
        activationStatus: 'suspended' as const,
        suspensionReason: dto.reason,
        suspensionNote: dto.note ?? null,
      };
    });
  },

  async listManagers(orgId: string) {
    const org = await organizationsRepository.findByIdForAdmin(orgId);
    if (!org) throw AppError.notFound('Organization not found');
    const owner = await usersRepository.findOrganizationOwner(orgId);
    return owner ? [toUserResponse(owner)] : [];
  },

  async updateOwnerEmail(orgId: string, userId: string, dto: UpdateOwnerEmailDto) {
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member || member.role !== 'manager' || !member.is_owner) {
      throw AppError.notFound('Organization owner manager not found');
    }

    const user = await usersRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    if (dto.email === user.email) return toUserResponse(user);

    const duplicate = await usersRepository.findByEmail(dto.email);
    if (duplicate && duplicate.id !== userId) {
      throw AppError.conflict('A user with this email already exists');
    }

    const updated = await usersRepository.updateProfile(userId, {
      email: dto.email,
    });
    await authSessionService.revokeAllForUser(userId, 'admin_owner_email_changed');

    const refreshed = await usersRepository.findById(updated?.id ?? userId);
    return refreshed ? toUserResponse(refreshed) : null;
  },
};
