import bcrypt from 'bcryptjs';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { organizationApplicationsRepository } from '../organization-applications/organization-applications.repository';

import { UpdateManagerDto } from './admin.validator';

export const adminService = {
  async listOrganizations() {
    const organizations = await organizationsRepository.listActive();
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

  async removeOrganization(orgId: string, actorId: string) {
    const org = await organizationsRepository.findById(orgId);
    if (!org) throw AppError.notFound('Organization not found');
    await withTransaction(async (client) => {
      const members = await client.query<{ user_id: string }>(
        `SELECT user_id FROM organization_members
         WHERE organization_id = $1
         FOR UPDATE`,
        [orgId]
      );
      const userIds = members.rows.map((member) => member.user_id);
      await client.query(
        `UPDATE organizations
         SET is_active = FALSE, activation_status = 'suspended', updated_at = NOW()
         WHERE id = $1`,
        [orgId]
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
         VALUES ($1,'organization.deactivate','organization',$2,$2,$3)`,
        [actorId, orgId, JSON.stringify({ deactivatedUserCount: userIds.length })]
      );
    });
  },

  async listManagers(orgId: string) {
    const org = await organizationsRepository.findById(orgId);
    if (!org) throw AppError.notFound('Organization not found');
    const owner = await usersRepository.findOrganizationOwner(orgId);
    return owner ? [owner] : [];
  },

  async updateManager(orgId: string, userId: string, dto: UpdateManagerDto) {
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member || member.role !== 'manager' || !member.is_owner) {
      throw AppError.notFound('Organization owner manager not found');
    }

    const user = await usersRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    if (dto.email && dto.email !== user.email) {
      const duplicate = await usersRepository.findByEmail(dto.email);
      if (duplicate && duplicate.id !== userId) {
        throw AppError.conflict('A user with this email already exists');
      }
    }

    const updated = await usersRepository.updateProfile(userId, {
      displayName: dto.displayName,
      email: dto.email,
    });

    if (dto.password?.trim()) {
      const passwordHash = await bcrypt.hash(dto.password, 10);
      await usersRepository.setPassword(userId, passwordHash);
    }

    if (dto.isActive !== undefined) {
      await usersRepository.setActive(userId, dto.isActive);
      await organizationsRepository.setMemberActive(orgId, userId, dto.isActive);
    }

    return usersRepository.findById(updated?.id ?? userId);
  },
};
