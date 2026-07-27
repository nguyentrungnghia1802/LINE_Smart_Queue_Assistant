import type { PoolClient } from 'pg';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { issueAccountAction } from '../account-lifecycle/account-lifecycle.service';
import { requireBranchManager } from '../branches/branch-scope';
import { branchesRepository } from '../branches/branches.repository';

import type { CreateUserDto, InviteStaffDto, UpdateStaffDto } from './users.validator';

async function assertTargetStaffBranch(actor: AuthUser, userId: string, client?: PoolClient) {
  const scope = requireBranchManager(actor);
  const targetBranchId = await usersRepository.findAssignedBranchId(
    scope.organizationId,
    userId,
    client
  );
  if (targetBranchId !== scope.branchId) {
    throw AppError.forbidden('Staff member is outside your assigned branch');
  }
  return scope;
}

export const usersService = {
  async getUser(id: string) {
    const user = await usersRepository.findById(id);
    if (!user) throw AppError.notFound(`User ${id} not found`);
    return user;
  },

  async listUsersByOrg(orgId: string, role?: string) {
    return usersRepository.findByOrgAndRole(orgId, role);
  },

  async listUsersForBranchManager(actor: AuthUser, role?: string) {
    const scope = requireBranchManager(actor);
    return usersRepository.findByBranchAndRole(scope.branchId, role);
  },

  async updateMyProfile(
    userId: string,
    data: { displayName?: string; email?: string; preferredLocale?: 'ja' | 'vi' | 'en' | null }
  ) {
    const existing = await usersRepository.findById(userId);
    if (!existing) throw AppError.notFound(`User ${userId} not found`);
    const updated = await usersRepository.updateProfile(userId, data);
    if (!updated) throw AppError.notFound('User not found');
    return updated;
  },

  async createUser(dto: CreateUserDto) {
    const existing = dto.email ? await usersRepository.findByEmail(dto.email) : null;
    if (existing) throw AppError.conflict('A user with this email already exists');

    return usersRepository.create({
      displayName: dto.displayName,
      email: dto.email,
      role: dto.role,
    });
  },

  async deactivateUser(id: string) {
    const existing = await usersRepository.findById(id);
    if (!existing) throw AppError.notFound(`User ${id} not found`);
    await usersRepository.deactivate(id);
  },

  /**
   * Create a staff account and add them to the organization.
   * Manager-only action.
   */
  async createStaff(actor: AuthUser, data: InviteStaffDto) {
    const scope = requireBranchManager(actor);
    const orgId = scope.organizationId;
    return withTransaction(async (client) => {
      const branch = await branchesRepository.findById(scope.branchId, orgId, client);
      if (!branch) throw AppError.notFound('Branch');
      if (await usersRepository.findByEmail(data.email, client)) {
        throw AppError.conflict('A user with this email already exists');
      }
      const org = await client.query<{ name: string; default_locale: 'ja' | 'vi' | 'en' }>(
        'SELECT name, default_locale FROM organizations WHERE id = $1',
        [orgId]
      );
      const user = await usersRepository.createInvited(
        {
          displayName: data.displayName,
          email: data.email,
          phone: data.phone,
          role: 'staff',
          addressLine1: data.currentAddress,
          jobTitle: data.jobTitle,
          employeeCode: data.employeeCode,
          invitedBy: actor.id,
        },
        client
      );
      await organizationsRepository.addMember(orgId, user.id, 'staff', client, {
        isActive: false,
        isOwner: false,
      });
      await branchesRepository.assignMember(
        {
          organizationId: orgId,
          branchId: scope.branchId,
          userId: user.id,
          role: 'staff',
          assignedBy: actor.id,
          isActive: false,
        },
        client
      );
      await issueAccountAction(
        {
          userId: user.id,
          recipientEmail: data.email,
          displayName: data.displayName,
          organizationName: org.rows[0]?.name ?? 'Smart Queue Assistant',
          locale: org.rows[0]?.default_locale ?? 'ja',
          purpose: 'account_activation',
          createdBy: actor.id,
        },
        client
      );
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, action, resource_type, resource_id, organization_id, changes)
         VALUES ($1,'staff_invited','organization_member',$2,$3,$4)`,
        [actor.id, user.id, orgId, JSON.stringify({ branchId: scope.branchId })]
      );
      return user;
    });
  },

  /**
   * Toggle a staff member's active status.
   */
  async updateStaffStatus(actor: AuthUser, userId: string, isActive: boolean) {
    const { organizationId: orgId } = await assertTargetStaffBranch(actor, userId);
    if (actor.id === userId) throw AppError.forbidden('You cannot change your own account status');
    // Verify the user is a member of this org
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member) throw AppError.notFound('Staff member not found in this organization');

    const user = await usersRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    if (isActive) {
      throw AppError.conflict('Disabled staff must be invited again through the invitation flow');
    }
    await this.removeStaff(actor, userId);
    return usersRepository.findById(userId);
  },

  async updateStaff(actor: AuthUser, userId: string, data: UpdateStaffDto) {
    const { organizationId: orgId } = await assertTargetStaffBranch(actor, userId);
    const member = await organizationsRepository.findMember(orgId, userId);
    if (!member) throw AppError.notFound('Staff member not found in this organization');
    if (member.role !== 'staff')
      throw AppError.badRequest('Only staff accounts can be edited here');

    const user = await usersRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');

    if (data.email && data.email !== user.email) {
      const dup = await usersRepository.findByEmail(data.email);
      if (dup && dup.id !== userId)
        throw AppError.conflict('A user with this email already exists');
    }

    return withTransaction(async (client) => {
      const updated = await usersRepository.updateEmployeeProfile(userId, data, client);
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, action, resource_type, resource_id, organization_id, changes)
         VALUES ($1,'staff_updated','organization_member',$2,$3,$4)`,
        [actor.id, userId, orgId, JSON.stringify({ fields: Object.keys(data) })]
      );
      return updated ?? usersRepository.findById(userId);
    });
  },

  async removeStaff(actor: AuthUser, userId: string) {
    const scope = requireBranchManager(actor);
    const orgId = scope.organizationId;
    if (actor.id === userId) throw AppError.forbidden('You cannot remove your own account');
    await withTransaction(async (client) => {
      await assertTargetStaffBranch(actor, userId, client);
      const member = await organizationsRepository.findMember(orgId, userId, client);
      if (!member) throw AppError.notFound('Staff member not found in this organization');
      if (member.role !== 'staff') {
        throw AppError.badRequest('Only staff accounts can be removed here');
      }
      await client.query(
        `UPDATE branch_memberships
         SET is_active = FALSE, deactivated_at = NOW()
         WHERE organization_id = $1 AND branch_id = $2 AND user_id = $3`,
        [orgId, scope.branchId, userId]
      );
      await client.query(
        `UPDATE organization_members SET is_active = FALSE
         WHERE organization_id = $1 AND user_id = $2`,
        [orgId, userId]
      );
      await client.query(
        `UPDATE users
         SET is_active = FALSE, account_status = 'disabled',
             deactivated_at = NOW(), deactivated_by = $2, updated_at = NOW()
         WHERE id = $1`,
        [userId, actor.id]
      );
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, action, resource_type, resource_id, organization_id, changes)
         VALUES ($1,'staff_removed','organization_member',$2,$3,'{}')`,
        [actor.id, userId, orgId]
      );
    });
  },
};
