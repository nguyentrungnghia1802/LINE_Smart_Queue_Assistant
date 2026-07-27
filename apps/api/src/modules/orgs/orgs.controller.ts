import { Request, Response } from 'express';

import { config } from '../../config';
import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { resolveLocale } from '../../i18n/locale';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { requireOrganizationOwner } from '../branches/branch-scope';
import { branchesRepository, type BranchRow } from '../branches/branches.repository';

import { buildOrganizationBookingUrl } from './org-booking-url';
import { orgsService } from './orgs.service';
import { BusinessCalendarDto, UpdateOrgSettingsDto } from './orgs.validator';

// ── Shared helper ─────────────────────────────────────────────────────────────

async function buildOrgResponse(orgId: string, clientLocale?: string, selectedBranch?: BranchRow) {
  const baseOrg = await organizationsRepository.findById(orgId);
  if (!baseOrg) throw AppError.notFound('Organization not found');
  const locale = resolveLocale({
    organizationLocale: baseOrg.default_locale,
    clientLocale,
  });
  const org = await organizationsRepository.findLocalizedById(orgId, locale);
  if (!org) throw AppError.notFound('Organization not found');

  const branch = selectedBranch ?? (await branchesRepository.findFirstByOrganization(org.id));
  if (!branch) throw AppError.notFound('Organization branch not found');
  const [queues, isBranchOpen] = await Promise.all([
    queuesRepository.findActiveByBranches(org.id, [branch.id], locale),
    branchesRepository.isOpenNow(branch.id),
  ]);
  const queueCatalogs = await Promise.all(
    queues.map(async (queue) => {
      const [waitingCount, products] = await Promise.all([
        queueEntriesRepository.countWaiting(queue.id),
        productsRepository.findByQueue(queue.id, locale),
      ]);
      return {
        id: queue.id,
        name: queue.name,
        description: queue.description,
        prefix: queue.prefix,
        status: queue.status,
        isQueueOpen: queue.status === 'open',
        isBranchOpen,
        isAcceptingBookings: isBranchOpen && queue.status === 'open',
        waitingCount,
        avgWaitMinutes: Math.ceil((waitingCount * (queue.avg_service_seconds ?? 300)) / 60),
        products,
      };
    })
  );
  const queue = queueCatalogs[0] ?? null;

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url,
      phone: org.phone,
      address: org.address,
      postalCode: org.postal_code,
      prefecture: org.prefecture,
      city: org.city,
      addressLine1: org.address_line1,
      addressLine2: org.address_line2,
      latitude: org.latitude,
      longitude: org.longitude,
      paymentInfo: org.payment_info,
      publicQrToken: branch.public_qr_token,
      defaultLocale: org.default_locale,
      locale,
    },
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      phone: branch.phone,
      email: branch.email,
      postalCode: branch.postal_code,
      prefecture: branch.prefecture,
      city: branch.city,
      addressLine1: branch.address_line1,
      addressLine2: branch.address_line2,
      latitude: branch.latitude,
      longitude: branch.longitude,
      timezone: branch.timezone,
      publicQrToken: branch.public_qr_token,
      isOpen: isBranchOpen,
    },
    queues: queueCatalogs,
    queue,
    products: queue?.products ?? [],
  };
}

// ── Public endpoints ──────────────────────────────────────────────────────────

export const getOrgBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const org = await organizationsRepository.findBySlug(slug);
  if (!org) throw AppError.notFound('Organization not found');
  const result = await buildOrgResponse(org.id, req.get('accept-language'));
  sendSuccess(res, result);
});

export const getOrgByToken = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const branch = await branchesRepository.findByPublicToken(token);
  if (branch) {
    const result = await buildOrgResponse(
      branch.organization_id,
      req.get('accept-language'),
      branch
    );
    sendSuccess(res, result);
    return;
  }
  const org = await organizationsRepository.findByPublicToken(token);
  if (!org) throw AppError.notFound('Organization not found');
  const result = await buildOrgResponse(org.id, req.get('accept-language'));
  sendSuccess(res, result);
});

// ── Authenticated endpoints ───────────────────────────────────────────────────

/** Manager's own org info including publicQrToken and join URL. */
export const getManagerOrg = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const orgId = requireOrganizationOwner(req.user);

  const org = await organizationsRepository.findById(orgId);
  if (!org) throw AppError.notFound('Organization not found');

  const joinUrl = org.public_qr_token
    ? buildOrganizationBookingUrl(config.web.origin, org.public_qr_token)
    : null;

  sendSuccess(res, {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    phone: org.phone,
    address: org.address,
    postalCode: org.postal_code,
    prefecture: org.prefecture,
    city: org.city,
    addressLine1: org.address_line1,
    addressLine2: org.address_line2,
    latitude: org.latitude,
    longitude: org.longitude,
    paymentInfo: org.payment_info,
    settings: org.settings,
    publicQrToken: org.public_qr_token,
    joinUrl,
    defaultLocale: org.default_locale,
  });
});

/** Manager updates their organization profile and payment information. */
export const updateManagerOrg = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const orgId = requireOrganizationOwner(req.user);
  const actorUserId = req.user.id;

  const org = await orgsService.updateSettings(orgId, req.body as UpdateOrgSettingsDto, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  const joinUrl = org.public_qr_token
    ? buildOrganizationBookingUrl(config.web.origin, org.public_qr_token)
    : null;

  sendSuccess(res, {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    phone: org.phone,
    address: org.address,
    postalCode: org.postal_code,
    prefecture: org.prefecture,
    city: org.city,
    addressLine1: org.address_line1,
    addressLine2: org.address_line2,
    latitude: org.latitude,
    longitude: org.longitude,
    paymentInfo: org.payment_info,
    settings: org.settings,
    publicQrToken: org.public_qr_token,
    joinUrl,
    defaultLocale: org.default_locale,
  });
});

export const getManagerBusinessCalendar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  sendSuccess(res, await orgsService.getBusinessCalendar(requireOrganizationOwner(req.user)));
});

export const updateManagerBusinessCalendar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw AppError.unauthorized();
  const organizationId = requireOrganizationOwner(req.user);
  sendSuccess(
    res,
    await orgsService.updateBusinessCalendar(organizationId, req.body as BusinessCalendarDto, {
      actorUserId: req.user.id,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    })
  );
});
