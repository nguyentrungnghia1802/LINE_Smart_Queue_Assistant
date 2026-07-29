import { randomBytes } from 'node:crypto';

import type { PoolClient } from 'pg';

import {
  ERROR_CODES,
  getSubscriptionPlanBranchLimit,
  type SubscriptionPlanCode,
} from '@line-queue/shared';

import { config } from '../../config';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { usersRepository } from '../../db/repositories/users.repository';
import { withTransaction } from '../../db/transaction';
import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { issueAccountAction } from '../account-lifecycle/account-lifecycle.service';
import type { BusinessCalendarDto } from '../orgs/orgs.validator';

import { requireBranchManager, requireOrganizationOwner } from './branch-scope';
import { branchesRepository } from './branches.repository';
import type {
  CreateBranchDto,
  InviteBranchManagerDto,
  UpdateMyBranchDto,
} from './branches.validator';

function branchCode(name: string): string {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  return `${base || 'branch'}-${randomBytes(3).toString('hex')}`;
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
  async geocode(actor: AuthUser, dto: { query: string }) {
    if (!actor.organizationId) throw AppError.forbidden('Organization membership is required');
    if (!config.location.googleRoutesApiKey) {
      throw new AppError(
        'GOOGLE_ROUTES_API_KEY is required for address lookup',
        503,
        'MAP_PROVIDER_NOT_CONFIGURED'
      );
    }
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', dto.query);
    url.searchParams.set('key', config.location.googleRoutesApiKey);
    url.searchParams.set('language', actor.preferredLocale ?? actor.organizationLocale ?? 'ja');
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      throw new AppError(
        `Google Geocoding returned HTTP ${response.status}`,
        502,
        'MAP_PROVIDER_ERROR'
      );
    }
    const payload = (await response.json()) as {
      status?: string;
      error_message?: string;
      results?: Array<{
        formatted_address: string;
        place_id: string;
        geometry: { location: { lat: number; lng: number } };
      }>;
    };
    if (payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
      throw new AppError(
        payload.error_message ?? `Google Geocoding returned ${payload.status ?? 'UNKNOWN'}`,
        502,
        'MAP_PROVIDER_ERROR'
      );
    }
    return (payload.results ?? []).slice(0, 5).map((result) => ({
      formattedAddress: result.formatted_address,
      placeId: result.place_id,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng,
    }));
  },
  async list(actor: AuthUser) {
    return branchesRepository.list(requireOrganizationOwner(actor));
  },

  async create(actor: AuthUser, dto: CreateBranchDto) {
    const organizationId = requireOrganizationOwner(actor);
    const emails = new Set(dto.managers.map((manager) => manager.email));
    if (emails.size !== dto.managers.length) {
      throw AppError.badRequest('Manager invitation emails must be unique');
    }
    try {
      return await withTransaction(async (client) => {
        const organizationResult = await client.query<{
          name: string;
          default_locale: 'ja' | 'vi' | 'en';
          settings: Record<string, unknown>;
        }>(
          `SELECT name, default_locale, settings
           FROM organizations
           WHERE id = $1 AND is_active = TRUE
           FOR UPDATE`,
          [organizationId]
        );
        const organization = organizationResult.rows[0];
        if (!organization) throw AppError.notFound('Organization');
        const configuredPlan = organization.settings?.subscriptionPlan;
        const plan: SubscriptionPlanCode =
          configuredPlan === 'starter' ||
          configuredPlan === 'standard' ||
          configuredPlan === 'scale'
            ? configuredPlan
            : 'starter';
        const maxBranches = getSubscriptionPlanBranchLimit(plan);
        const activeBranchCount = await branchesRepository.countActive(organizationId, client);
        if (maxBranches !== null && activeBranchCount >= maxBranches) {
          throw new AppError(
            `The ${plan} plan supports at most ${maxBranches} branches`,
            409,
            ERROR_CODES.BRANCH_PLAN_LIMIT_REACHED
          );
        }
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
            latitude: dto.latitude,
            longitude: dto.longitude,
            googlePlaceId: dto.googlePlaceId,
            formattedMapAddress: dto.formattedMapAddress,
            createdBy: actor.id,
          },
          client
        );
        await client.query(
          `INSERT INTO branch_business_hours (
             branch_id, weekday, is_closed, opens_at, closes_at
           )
           SELECT $1, day.weekday,
                  COALESCE(org_hours.is_closed, day.weekday IN (0, 6)),
                  CASE
                    WHEN COALESCE(org_hours.is_closed, day.weekday IN (0, 6)) THEN NULL
                    ELSE COALESCE(org_hours.opens_at, TIME '09:00')
                  END,
                  CASE
                    WHEN COALESCE(org_hours.is_closed, day.weekday IN (0, 6)) THEN NULL
                    ELSE COALESCE(org_hours.closes_at, TIME '18:00')
                  END
           FROM generate_series(0, 6) AS day(weekday)
           LEFT JOIN organization_business_hours org_hours
             ON org_hours.organization_id = $2
            AND org_hours.weekday = day.weekday`,
          [branch.id, organizationId]
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
          [actor.id, branch.id, organizationId, JSON.stringify({ name: branch.name })]
        );
        return { branch, managers };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A branch or manager email conflicts with an existing record');
      }
      throw error;
    }
  },

  async inviteManager(actor: AuthUser, branchId: string, dto: InviteBranchManagerDto) {
    const organizationId = requireOrganizationOwner(actor);
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
    const organizationId = requireOrganizationOwner(actor);
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
    const organizationId = requireOrganizationOwner(actor);
    return branchesRepository.listAudit(organizationId, limit);
  },

  async getMyBranch(actor: AuthUser) {
    const scope = requireBranchManager(actor);
    const branch = await branchesRepository.findAssignedManagerBranch(
      scope.organizationId,
      actor.id
    );
    if (!branch) throw AppError.notFound('Assigned branch');
    const queues = await queuesRepository.findActiveByBranches(
      scope.organizationId,
      [scope.branchId],
      actor.preferredLocale ?? actor.organizationLocale ?? 'ja'
    );
    return { ...branch, queues };
  },

  async updateMyBranch(
    actor: AuthUser,
    dto: UpdateMyBranchDto,
    requestContext?: { ipAddress?: string; userAgent?: string }
  ) {
    const scope = requireBranchManager(actor);
    return withTransaction(async (client) => {
      const previous = await branchesRepository.findById(
        scope.branchId,
        scope.organizationId,
        client
      );
      if (!previous) throw AppError.notFound('Assigned branch');
      const updated = await branchesRepository.update(
        scope.branchId,
        scope.organizationId,
        dto,
        client
      );
      if (!updated) throw AppError.notFound('Assigned branch');
      await client.query(
        `INSERT INTO audit_logs (
           actor_id, action, resource_type, resource_id, organization_id,
           changes, ip_address, user_agent
         ) VALUES ($1,'branch.update','organization_branch',$2,$3,$4,$5,$6)`,
        [
          actor.id,
          scope.branchId,
          scope.organizationId,
          JSON.stringify({ old: previous, new: updated }),
          requestContext?.ipAddress ?? null,
          requestContext?.userAgent ?? null,
        ]
      );
      return updated;
    });
  },

  async getMyBusinessCalendar(actor: AuthUser) {
    const scope = requireBranchManager(actor);
    const calendar = await branchesRepository.getBusinessCalendar(scope.branchId);
    return {
      weeklyHours: calendar.weeklyHours.map((item) => ({
        weekday: item.weekday,
        isClosed: item.is_closed,
        opensAt: item.opens_at?.slice(0, 5) ?? null,
        closesAt: item.closes_at?.slice(0, 5) ?? null,
      })),
      exceptionDays: calendar.exceptionDays.map((item) => ({
        date: item.exception_date,
        isClosed: item.is_closed,
        opensAt: item.opens_at?.slice(0, 5) ?? null,
        closesAt: item.closes_at?.slice(0, 5) ?? null,
        reason: item.reason,
      })),
    };
  },

  async updateMyBusinessCalendar(
    actor: AuthUser,
    dto: BusinessCalendarDto,
    requestContext?: { ipAddress?: string; userAgent?: string }
  ) {
    const scope = requireBranchManager(actor);
    const previous = await this.getMyBusinessCalendar(actor);
    await withTransaction(async (client) => {
      await branchesRepository.replaceBusinessCalendar(scope.branchId, dto, client);
      await client.query(
        `INSERT INTO audit_logs (
           actor_id, action, resource_type, resource_id, organization_id,
           changes, ip_address, user_agent
         ) VALUES ($1,'branch.update_business_calendar','organization_branch',$2,$3,$4,$5,$6)`,
        [
          actor.id,
          scope.branchId,
          scope.organizationId,
          JSON.stringify({ old: previous, new: dto }),
          requestContext?.ipAddress ?? null,
          requestContext?.userAgent ?? null,
        ]
      );
    });
    return dto;
  },

  async analytics(actor: AuthUser) {
    const organizationId = requireOrganizationOwner(actor);
    const [branches, revenueSeries] = await Promise.all([
      branchesRepository.listAnalytics(organizationId),
      branchesRepository.revenueSeries(organizationId, 30),
    ]);
    const ranked = [...branches].sort(
      (left, right) => Number(right.total_revenue) - Number(left.total_revenue)
    );
    return {
      totalRevenue: branches.reduce((sum, branch) => sum + Number(branch.total_revenue), 0),
      totalBranches: branches.length,
      bestBranch: ranked[0] ?? null,
      lowestBranch: ranked[ranked.length - 1] ?? null,
      branches,
      revenueSeries,
    };
  },
};
