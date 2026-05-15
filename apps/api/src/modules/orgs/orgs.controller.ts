import { Request, Response } from 'express';

import { organizationsRepository } from '../../db/repositories/organizations.repository';
import { productsRepository } from '../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';

export const getOrgBySlug = asyncHandler(async (req: Request, res: Response) => {
  const { slug } = req.params;

  const org = await organizationsRepository.findBySlug(slug);
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
    avgWaitMinutes = Math.ceil(
      (waitingCount * (queue.avg_service_seconds ?? 300)) / 60
    );
  }

  sendSuccess(res, {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      logoUrl: org.logo_url,
      phone: org.phone,
      address: org.address,
      paymentInfo: org.payment_info,
    },
    queue: queue
      ? {
          id: queue.id,
          name: queue.name,
          prefix: queue.prefix,
          waitingCount,
          avgWaitMinutes,
        }
      : null,
    products,
  });
});
