import type { Queue, SupportedLocale } from '@line-queue/shared';

import { type QueueRow, queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import { metricsService } from '../../utils/metrics';

import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

function toQueue(row: QueueRow): Queue {
  return {
    id: row.id,
    organizationId: row.organization_id,
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
  async listQueues(orgId: string, locale: SupportedLocale = 'ja') {
    const queues = await queuesRepository.findActiveByOrg(orgId, locale);
    return queues.map(toQueue);
  },

  async getQueue(id: string, orgId: string) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw AppError.notFound(`Queue ${id} not found`);
    if (queue.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');
    return toQueue(queue);
  },

  async createQueue(orgId: string, dto: CreateQueueDto) {
    const existing = await queuesRepository.findActiveByBranches(orgId, [dto.branchId]);
    if (existing.length > 0) {
      throw AppError.conflict('This branch already has an active queue');
    }
    const queue = await queuesRepository.create({
      organizationId: orgId,
      branchId: dto.branchId,
      name: dto.name,
      description: dto.description,
      status: dto.status,
      prefix: dto.prefix,
      maxCapacity: dto.maxCapacity,
      avgServiceSeconds: dto.avgServiceMs ? Math.floor(dto.avgServiceMs / 1000) : undefined,
    });
    metricsService.increment('queue_created_total');
    return toQueue(queue);
  },

  async updateQueue(id: string, orgId: string, dto: UpdateQueueDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');

    const updated = await queuesRepository.update(id, {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      maxCapacity: dto.maxCapacity,
      avgServiceMs: dto.avgServiceMs,
    });
    if (!updated) throw AppError.notFound(`Queue ${id} not found`);
    return toQueue(updated);
  },

  async updateQueueStatus(id: string, orgId: string, dto: UpdateQueueStatusDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');

    const updated = await queuesRepository.update(id, { status: dto.status });
    if (!updated) throw AppError.notFound(`Queue ${id} not found`);
    return toQueue(updated);
  },

  async deleteQueue(id: string, orgId: string) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');

    await queuesRepository.softDelete(id);
  },
};
