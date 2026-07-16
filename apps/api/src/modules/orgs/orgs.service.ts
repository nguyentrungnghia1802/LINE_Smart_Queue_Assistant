import { auditLogRepository } from '../../db/repositories/audit-log.repository';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';

import { BusinessCalendarDto, UpdateOrgSettingsDto } from './orgs.validator';

interface AuditContext {
  actorUserId: string;
  ipAddress?: string;
  userAgent?: string;
}

export const orgsService = {
  async updateSettings(orgId: string, dto: UpdateOrgSettingsDto, audit: AuditContext) {
    const existing = await organizationsRepository.findById(orgId);
    if (!existing) throw AppError.notFound('Organization not found');

    const updated = await organizationsRepository.updateOrg(orgId, dto);
    if (!updated) throw AppError.notFound('Organization not found');

    await auditLogRepository.create({
      actorId: audit.actorUserId,
      actorType: 'staff',
      action: 'organization.update_settings',
      resourceType: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      changes: { old: existing, new: updated },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });

    return updated;
  },

  async getBusinessCalendar(orgId: string) {
    const calendar = await organizationsRepository.getBusinessCalendar(orgId);
    if (calendar.weeklyHours.length === 0) {
      return {
        weeklyHours: Array.from({ length: 7 }, (_, weekday) => ({
          weekday,
          isClosed: weekday === 0,
          opensAt: weekday === 0 ? null : '09:00',
          closesAt: weekday === 0 ? null : '18:00',
        })),
        exceptionDays: [],
      };
    }
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

  async updateBusinessCalendar(orgId: string, dto: BusinessCalendarDto, audit: AuditContext) {
    const previous = await this.getBusinessCalendar(orgId);
    await withTransaction((client) =>
      organizationsRepository.replaceBusinessCalendar(orgId, dto, client)
    );
    await auditLogRepository.create({
      actorId: audit.actorUserId,
      actorType: 'staff',
      action: 'organization.update_business_calendar',
      resourceType: 'organization',
      resourceId: orgId,
      organizationId: orgId,
      changes: { old: previous, new: dto },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
    return dto;
  },
};
