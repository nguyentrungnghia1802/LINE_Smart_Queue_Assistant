import type { Queue, QueueSummary, SupportedLocale } from '@line-queue/shared';

import { productsRepository } from '../../db/repositories/products.repository';
import {
  queueEntriesRepository,
  type QueueLiveCounts,
} from '../../db/repositories/queue-entries.repository';
import { type QueueRow, queuesRepository } from '../../db/repositories/queues.repository';
import { withTransaction } from '../../db/transaction';
import { AppError } from '../../utils/AppError';
import { metricsService } from '../../utils/metrics';
import type { BranchManagerScope } from '../branches/branch-scope';

import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

function toQueue(row: QueueRow, productIds: string[] = []): Queue {
  return {
    id: row.id,
    organizationId: row.organization_id,
    branchId: row.branch_id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as Queue['status'],
    currentNumber: row.daily_ticket_counter,
    maxCapacity: row.max_capacity ?? undefined,
    avgServiceTimeMinutes: Math.max(1, Math.ceil(row.avg_service_seconds / 60)),
    ticketPrefix: row.prefix || undefined,
    productIds,
    absenceGraceMinutes: row.auto_no_show_minutes ?? 5,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const EMPTY_LIVE_COUNTS: QueueLiveCounts = {
  waitingCount: 0,
  calledCount: 0,
  servingCount: 0,
};

function toQueueSummary(
  row: QueueRow,
  liveCounts: QueueLiveCounts = EMPTY_LIVE_COUNTS,
  productIds: string[] = []
): QueueSummary {
  return {
    ...toQueue(row, productIds),
    ...liveCounts,
  };
}

async function getLiveCounts(queueIds: string[]) {
  return queueEntriesRepository.countLiveByQueueIds(queueIds);
}

export const queuesService = {
  async listQueues(orgId: string, branchId: string, locale: SupportedLocale = 'ja') {
    const queues = await queuesRepository.findActiveByBranches(orgId, [branchId], locale);
    const liveCounts = await getLiveCounts(queues.map((queue) => queue.id));
    return queues.map((queue) => toQueueSummary(queue, liveCounts[queue.id]));
  },

  async getQueue(id: string, scope: BranchManagerScope) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw AppError.notFound(`Queue ${id} not found`);
    if (queue.organization_id !== scope.organizationId || queue.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');
    const liveCounts = await getLiveCounts([queue.id]);
    return toQueueSummary(
      queue,
      liveCounts[queue.id],
      await productsRepository.findProductIdsByQueue(queue.id)
    );
  },

  async createQueue(scope: BranchManagerScope, dto: CreateQueueDto) {
    const queue = await withTransaction(async (client) => {
      const created = await queuesRepository.create(
        {
          organizationId: scope.organizationId,
          branchId: scope.branchId,
          name: dto.name,
          description: dto.description,
          status: dto.status,
          prefix: dto.prefix,
          maxCapacity: dto.maxCapacity,
          avgServiceSeconds: dto.avgServiceTimeMinutes ? dto.avgServiceTimeMinutes * 60 : undefined,
          autoNoShowMinutes: dto.absenceGraceMinutes,
        },
        client
      );
      try {
        await productsRepository.syncProductsForQueue(
          created.id,
          scope.organizationId,
          scope.branchId,
          dto.productIds,
          client
        );
      } catch {
        throw AppError.unprocessable('Queue products must belong to the organization catalog', {
          fieldErrors: { productIds: ['Select active products from your organization catalog'] },
        });
      }
      return created;
    });
    metricsService.increment('queue_created_total');
    return toQueueSummary(queue, EMPTY_LIVE_COUNTS, dto.productIds);
  },

  async updateQueue(id: string, scope: BranchManagerScope, dto: UpdateQueueDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== scope.organizationId || existing.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');

    const updated = await withTransaction(async (client) => {
      const result = await queuesRepository.update(
        id,
        {
          name: dto.name,
          description: dto.description,
          status: dto.status,
          maxCapacity: dto.maxCapacity,
          avgServiceSeconds: dto.avgServiceTimeMinutes ? dto.avgServiceTimeMinutes * 60 : undefined,
          autoNoShowMinutes: dto.absenceGraceMinutes,
        },
        client
      );
      if (!result) throw AppError.notFound(`Queue ${id} not found`);
      if (dto.productIds) {
        try {
          await productsRepository.syncProductsForQueue(
            result.id,
            scope.organizationId,
            scope.branchId,
            dto.productIds,
            client
          );
        } catch {
          throw AppError.unprocessable('Queue products must belong to the organization catalog', {
            fieldErrors: { productIds: ['Select active products from your organization catalog'] },
          });
        }
      }
      return result;
    });
    if (!updated) throw AppError.notFound(`Queue ${id} not found`);
    const liveCounts = await getLiveCounts([updated.id]);
    return toQueueSummary(
      updated,
      liveCounts[updated.id],
      dto.productIds ?? (await productsRepository.findProductIdsByQueue(updated.id))
    );
  },

  async updateQueueStatus(id: string, scope: BranchManagerScope, dto: UpdateQueueStatusDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== scope.organizationId || existing.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');

    const updated = await queuesRepository.update(id, { status: dto.status });
    if (!updated) throw AppError.notFound(`Queue ${id} not found`);
    const liveCounts = await getLiveCounts([updated.id]);
    return toQueueSummary(updated, liveCounts[updated.id]);
  },

  async deleteQueue(id: string, scope: BranchManagerScope) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== scope.organizationId || existing.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');

    if ((await queuesRepository.countStaffAssignments(id)) > 0) {
      throw AppError.conflict('Reassign staff before removing this queue');
    }

    await queuesRepository.softDelete(id);
  },
};
