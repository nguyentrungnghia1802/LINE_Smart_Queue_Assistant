import { queuesRepository } from '../../db/repositories/queues.repository';
import { AppError } from '../../utils/AppError';

import { CreateQueueDto, UpdateQueueDto, UpdateQueueStatusDto } from './queues.validator';

export const queuesService = {
  async listQueues(orgId: string) {
    return queuesRepository.findActiveByOrg(orgId);
  },

  async getQueue(id: string) {
    const queue = await queuesRepository.findById(id);
    if (!queue) throw AppError.notFound(`Queue ${id} not found`);
    return queue;
  },

  async createQueue(dto: CreateQueueDto) {
    return queuesRepository.create({
      organizationId: dto.orgId,
      name: dto.name,
      description: dto.description,
      prefix: dto.prefix,
      maxCapacity: dto.maxCapacity,
      avgServiceSeconds: dto.avgServiceMs ? Math.floor(dto.avgServiceMs / 1000) : undefined,
    });
  },

  async updateQueue(id: string, dto: UpdateQueueDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);

    return queuesRepository.update(id, {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      maxCapacity: dto.maxCapacity,
      avgServiceMs: dto.avgServiceMs,
    });
  },

  async updateQueueStatus(id: string, dto: UpdateQueueStatusDto) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);

    return queuesRepository.update(id, { status: dto.status });
  },

  async deleteQueue(id: string) {
    const existing = await queuesRepository.findById(id);
    if (!existing) throw AppError.notFound(`Queue ${id} not found`);

    await queuesRepository.softDelete(id);
  },
};
