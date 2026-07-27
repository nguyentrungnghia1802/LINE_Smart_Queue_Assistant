import type { Queue, SupportedLocale } from '@line-queue/shared';

import { type QueueRow, queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import { metricsService } from '../../utils/metrics';
import type { BranchManagerScope } from '../branches/branch-scope';

import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

function toQueue(row: QueueRow): Queue {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const queuesService = {
  async listQueues(orgId: string, branchId: string, locale: SupportedLocale = 'ja') {
    const queues = await queuesRepository.findActiveByBranches(orgId, [branchId], locale);
    return queues.map(toQueue);
  },

  async getQueue(id: string, scope: BranchManagerScope) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw AppError.notFound(`Queue ${id} not found`);
    if (queue.organization_id !== scope.organizationId || queue.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');
    return toQueue(queue);
  },

  async createQueue(scope: BranchManagerScope, dto: CreateQueueDto) {
    const queue = await queuesRepository.create({
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      name: dto.name,
      description: dto.description,
      status: dto.status,
      prefix: dto.prefix,
      maxCapacity: dto.maxCapacity,
      avgServiceSeconds: dto.avgServiceTimeMinutes ? dto.avgServiceTimeMinutes * 60 : undefined,
    });
    metricsService.increment('queue_created_total');
    return toQueue(queue);
  },

  async updateQueue(id: string, scope: BranchManagerScope, dto: UpdateQueueDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== scope.organizationId || existing.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');

    const updated = await queuesRepository.update(id, {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      maxCapacity: dto.maxCapacity,
      avgServiceSeconds: dto.avgServiceTimeMinutes ? dto.avgServiceTimeMinutes * 60 : undefined,
    });
    if (!updated) throw AppError.notFound(`Queue ${id} not found`);
    return toQueue(updated);
  },

  async updateQueueStatus(id: string, scope: BranchManagerScope, dto: UpdateQueueStatusDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== scope.organizationId || existing.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');

    const updated = await queuesRepository.update(id, { status: dto.status });
    if (!updated) throw AppError.notFound(`Queue ${id} not found`);
    return toQueue(updated);
  },

  async deleteQueue(id: string, scope: BranchManagerScope) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== scope.organizationId || existing.branch_id !== scope.branchId)
      throw AppError.forbidden('Queue is outside your assigned branch');

    const activeQueues = await queuesRepository.findActiveByBranches(scope.organizationId, [
      scope.branchId,
    ]);
    if (activeQueues.length <= 1) {
      throw AppError.conflict('A branch must keep at least one active queue');
    }
    await queuesRepository.softDelete(id);
  },
};
