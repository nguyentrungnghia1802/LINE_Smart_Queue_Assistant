import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';

import { bookingGroupsRepository } from './booking-groups.repository';

export const bookingGroupsService = {
  async listMine(userId: string, page: number, limit: number) {
    return bookingGroupsRepository.listForCustomer(userId, page, limit);
  },

  async getById(id: string, actor: AuthUser) {
    const group = await bookingGroupsRepository.findById(id);
    if (!group) throw AppError.notFound('Booking group');

    if (actor.role === 'customer' && group.customer_user_id !== actor.id) {
      throw AppError.forbidden('This booking history belongs to another customer');
    }
    if (
      actor.role !== 'admin' &&
      actor.role !== 'customer' &&
      group.organization_id !== actor.organizationId
    ) {
      throw AppError.forbidden('This booking group belongs to another organization');
    }
    return group;
  },
};
