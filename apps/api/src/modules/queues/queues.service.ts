import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';
import { metricsService } from '../../utils/metrics';

import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

export const queuesService = {
  async listQueues(orgId: string) {
    return queuesRepository.findActiveByOrg(orgId);
  },

  async getQueue(id: string, orgId: string) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw AppError.notFound(`Queue ${id} not found`);
    if (queue.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');
    return queue;
  },

  async createQueue(orgId: string, dto: CreateQueueDto) {
    const queue = await queuesRepository.create({
      organizationId: orgId,
      name: dto.name,
      description: dto.description,
      prefix: dto.prefix,
      maxCapacity: dto.maxCapacity,
      avgServiceSeconds: dto.avgServiceMs ? Math.floor(dto.avgServiceMs / 1000) : undefined,
    });
    metricsService.increment('queue_created_total');
    return queue;
  },

  async updateQueue(id: string, orgId: string, dto: UpdateQueueDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');

    return queuesRepository.update(id, {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      maxCapacity: dto.maxCapacity,
      avgServiceMs: dto.avgServiceMs,
    });
  },

  async updateQueueStatus(id: string, orgId: string, dto: UpdateQueueStatusDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');

    return queuesRepository.update(id, { status: dto.status });
  },

  async deleteQueue(id: string, orgId: string) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);
    if (existing.organization_id !== orgId)
      throw AppError.forbidden('Queue is outside your organization');

    await queuesRepository.softDelete(id);
  },
};
