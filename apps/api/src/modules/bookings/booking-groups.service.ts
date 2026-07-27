import type { AuthUser } from '../../types/auth.types';
import { AppError } from '../../utils/AppError';
import { requireBranchOperator } from '../branches/branch-scope';

import { bookingGroupsRepository } from './booking-groups.repository';

export const bookingGroupsService = {
  async listMine(userId: string, page: number, limit: number) {
    return bookingGroupsRepository.listForCustomer(userId, page, limit);
  },

  async getById(id: string, actor: AuthUser) {
    if (actor.role === 'customer') {
      const group = await bookingGroupsRepository.findById(id);
      if (!group) throw AppError.notFound('Booking group');
      if (group.customer_user_id !== actor.id) {
        throw AppError.forbidden('This booking history belongs to another customer');
      }
      return group;
    }

    const scope = requireBranchOperator(actor);
    const group = await bookingGroupsRepository.findById(id, scope.branchId);
    if (!group || group.organization_id !== scope.organizationId) {
      throw AppError.notFound('Booking group');
    }
    return group;
  },
};
