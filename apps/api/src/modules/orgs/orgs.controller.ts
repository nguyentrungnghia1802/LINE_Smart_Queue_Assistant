import { Request, Response } from 'express';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

import { orgsService } from './orgs.service';
import { BusinessCalendarDto, UpdateOrgSettingsDto } from './orgs.validator';

// ── Shared helper ─────────────────────────────────────────────────────────────

async function buildOrgResponse(orgId: string) {
  const org = await organizationsRepository.findById(orgId);
  if (!org) throw AppError.notFound('Organization not found');

  const [queues, products] = await Promise.all([
    queuesRepository.findActiveByOrg(org.id),
    productsRepository.findByOrg(org.id),
  ]);

  const queue = queues[0] ?? null;
  let waitingCount = 0;
  let avgWaitMinutes = 0;

  if (queue) {
    const waitingEntries = await queueEntriesRepository.listWaiting(queue.id);
    waitingCount = waitingEntries.length;
    avgWaitMinutes = Math.ceil((waitingCount * (queue.avg_service_seconds ?? 300)) / 60);
  }

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
      publicQrToken: org.public_qr_token,
    },
    queue: queue
      ? { id: queue.id, name: queue.name, prefix: queue.prefix, waitingCount, avgWaitMinutes }
      : null,
    products,
  };
}

// ── Public endpoints ──────────────────────────────────────────────────────────

export const getOrgBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;
  const org = await organizationsRepository.findBySlug(slug);
  if (!org) throw AppError.notFound('Organization not found');
  const result = await buildOrgResponse(org.id);
  sendSuccess(res, result);
});

export const getOrgByToken = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;
  const org = await organizationsRepository.findByPublicToken(token);
  if (!org) throw AppError.notFound('Organization not found');
  const result = await buildOrgResponse(org.id);
  sendSuccess(res, result);
});

// ── Authenticated endpoints ───────────────────────────────────────────────────

/** Manager's own org info including publicQrToken and join URL. */
export const getManagerOrg = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  if (!orgId) {
    res
      .status(400)
      .json({ success: false, error: { code: 'NO_ORG', message: 'User has no organization' } });
    return;
  }

  const org = await organizationsRepository.findById(orgId);
  if (!org) throw AppError.notFound('Organization not found');

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const joinUrl = org.public_qr_token ? `${frontendUrl}/qr/${org.public_qr_token}` : null;

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
  });
});

/** Manager updates their organization profile and payment information. */
export const updateManagerOrg = asyncHandler(async (req: Request, res: Response) => {
  const orgId = req.user?.organizationId;
  const actorUserId = req.user?.id;
  if (!orgId || !actorUserId) {
    res.status(400).json({
      success: false,
      error: { code: 'NO_ORG', message: 'User has no organization' },
    });
    return;
  }

  const org = await orgsService.updateSettings(orgId, req.body as UpdateOrgSettingsDto, {
    actorUserId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const joinUrl = org.public_qr_token ? `${frontendUrl}/qr/${org.public_qr_token}` : null;

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
  });
});

export const getManagerBusinessCalendar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.organizationId) throw AppError.badRequest('組織が設定されていません');
  sendSuccess(res, await orgsService.getBusinessCalendar(req.user.organizationId));
});

export const updateManagerBusinessCalendar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user?.organizationId || !req.user.id) {
    throw AppError.badRequest('組織が設定されていません');
  }
  sendSuccess(
    res,
    await orgsService.updateBusinessCalendar(
      req.user.organizationId,
      req.body as BusinessCalendarDto,
      { actorUserId: req.user.id, ipAddress: req.ip, userAgent: req.get('user-agent') }
    )
  );
});
