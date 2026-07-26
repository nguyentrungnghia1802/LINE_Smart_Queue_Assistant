import { randomBytes } from 'node:crypto';

import type { PoolClient } from 'pg';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { issueAccountAction } from '../account-lifecycle/account-lifecycle.service';

import { branchesRepository } from './branches.repository';
import type { CreateBranchDto, InviteBranchManagerDto } from './branches.validator';

function assertOwner(actor: AuthUser): string {
  if (!actor.organizationId) throw AppError.badRequest('User has no organization');
  if (actor.role !== 'manager' || !actor.isOrganizationOwner) {
    throw AppError.forbidden('Only the organization owner manager can perform this action');
  }
  return actor.organizationId;
}

function branchCode(name: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return `${base || 'branch'}-${randomBytes(3).toString('hex')}`;
}

function queuePrefix(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return ascii.slice(0, 3);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

async function inviteManagerInClient(
  params: {
    organizationId: string;
    organizationName: string;
    branchId: string;
    manager: InviteBranchManagerDto;
    actorId: string;
    locale: 'ja' | 'vi' | 'en';
  },
  client: PoolClient
) {
  const duplicate = await usersRepository.findByEmail(params.manager.email, client);
  if (duplicate) throw AppError.conflict('An account with this email already exists');
  const user = await usersRepository.createInvited(
    {
      displayName: params.manager.displayName,
      email: params.manager.email,
      phone: params.manager.phone,
      role: 'manager',
      jobTitle: params.manager.jobTitle,
      invitedBy: params.actorId,
    },
    client
  );
  await organizationsRepository.addMember(params.organizationId, user.id, 'manager', client, {
    isActive: false,
    isOwner: false,
  });
  await branchesRepository.assignMember(
    {
      organizationId: params.organizationId,
      branchId: params.branchId,
      userId: user.id,
      role: 'manager',
      assignedBy: params.actorId,
      isActive: false,
    },
    client
  );
  await issueAccountAction(
    {
      userId: user.id,
      recipientEmail: params.manager.email,
      displayName: params.manager.displayName,
      organizationName: params.organizationName,
      locale: params.locale,
      purpose: 'account_activation',
      createdBy: params.actorId,
    },
    client
  );
  await client.query(
    `INSERT INTO audit_logs
       (actor_id, action, resource_type, resource_id, organization_id, changes)
     VALUES ($1,'manager_invited','organization_member',$2,$3,$4)`,
    [
      params.actorId,
      user.id,
      params.organizationId,
      JSON.stringify({ branchId: params.branchId, email: params.manager.email }),
    ]
  );
  return user;
}

export const branchesService = {
  async list(actor: AuthUser) {
    if (!actor.organizationId) throw AppError.badRequest('User has no organization');
    return branchesRepository.list(actor.organizationId);
  },

  async create(actor: AuthUser, dto: CreateBranchDto) {
    const organizationId = assertOwner(actor);
    const emails = new Set(dto.managers.map((manager) => manager.email));
    if (emails.size !== dto.managers.length) {
      throw AppError.badRequest('Manager invitation emails must be unique');
    }
    try {
      return await withTransaction(async (client) => {
        const organizationResult = await client.query<{
          name: string;
          default_locale: 'ja' | 'vi' | 'en';
        }>(
          `SELECT name, default_locale
           FROM organizations
           WHERE id = $1 AND is_active = TRUE
           FOR UPDATE`,
          [organizationId]
        );
        const organization = organizationResult.rows[0];
        if (!organization) throw AppError.notFound('Organization');
        const branch = await branchesRepository.create(
          {
            organizationId,
            name: dto.name,
            code: branchCode(dto.name),
            phone: dto.phone,
            email: dto.email,
            postalCode: dto.postalCode,
            prefecture: dto.prefecture,
            city: dto.city,
            addressLine1: dto.addressLine1,
            addressLine2: dto.addressLine2,
            createdBy: actor.id,
          },
          client
        );
        const queue = await queuesRepository.create(
          {
            organizationId,
            branchId: branch.id,
            name: `${dto.name} 受付`,
            status: 'closed',
            prefix: queuePrefix(dto.name),
          },
          client
        );
        const managers = [];
        for (const manager of dto.managers) {
          managers.push(
            await inviteManagerInClient(
              {
                organizationId,
                organizationName: organization.name,
                branchId: branch.id,
                manager,
                actorId: actor.id,
                locale: organization.default_locale,
              },
              client
            )
          );
        }
        await client.query(
          `INSERT INTO audit_logs
             (actor_id, action, resource_type, resource_id, organization_id, changes)
           VALUES ($1,'branch_created','organization_branch',$2,$3,$4)`,
          [
            actor.id,
            branch.id,
            organizationId,
            JSON.stringify({ name: branch.name, queueId: queue.id }),
          ]
        );
        return { branch, queue, managers };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A branch or manager email conflicts with an existing record');
      }
      throw error;
    }
  },

  async inviteManager(actor: AuthUser, branchId: string, dto: InviteBranchManagerDto) {
    const organizationId = assertOwner(actor);
    return withTransaction(async (client) => {
      const branch = await branchesRepository.findById(branchId, organizationId, client);
      if (!branch) throw AppError.notFound('Branch');
      const organization = await client.query<{
        name: string;
        default_locale: 'ja' | 'vi' | 'en';
      }>('SELECT name, default_locale FROM organizations WHERE id = $1', [organizationId]);
      return inviteManagerInClient(
        {
          organizationId,
          organizationName: organization.rows[0]?.name ?? 'Smart Queue Assistant',
          branchId,
          manager: dto,
          actorId: actor.id,
          locale: organization.rows[0]?.default_locale ?? 'ja',
        },
        client
      );
    });
  },

  async removeManager(actor: AuthUser, branchId: string, userId: string) {
    const organizationId = assertOwner(actor);
    if (actor.id === userId) throw AppError.forbidden('Managers cannot remove their own account');
    return withTransaction(async (client) => {
      const assignment = await branchesRepository.findManagerAssignment(
        branchId,
        organizationId,
        userId,
        client
      );
      if (!assignment || assignment.deactivated_at) throw AppError.notFound('Branch manager');
      if (assignment.is_owner) throw AppError.forbidden('The organization owner cannot be removed');
      if ((await branchesRepository.countAssignedManagers(branchId, userId, client)) < 1) {
        throw AppError.conflict('A branch must keep at least one manager');
      }
      await branchesRepository.deactivateManager(
        branchId,
        organizationId,
        userId,
        actor.id,
        client
      );
      await client.query(
        `INSERT INTO audit_logs
           (actor_id, action, resource_type, resource_id, organization_id, changes)
         VALUES ($1,'manager_removed','organization_member',$2,$3,$4)`,
        [actor.id, userId, organizationId, JSON.stringify({ branchId })]
      );
      return { removed: true };
    });
  },

  async audit(actor: AuthUser, limit: number) {
    const organizationId = assertOwner(actor);
    return branchesRepository.listAudit(organizationId, limit);
  },
};
