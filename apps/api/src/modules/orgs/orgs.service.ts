import { auditLogRepository } from '../../db/repositories/audit-log.repository';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { AppError } from '../../utils/AppError';

import { UpdateOrgSettingsDto } from './orgs.validator';

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
};
