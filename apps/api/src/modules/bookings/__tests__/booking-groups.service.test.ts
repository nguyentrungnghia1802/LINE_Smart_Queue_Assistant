jest.mock('../booking-groups.repository');

import { UserRole } from '@line-queue/shared';

import { bookingGroupsRepository } from '../booking-groups.repository';
import { bookingGroupsService } from '../booking-groups.service';

const group = {
  id: '11111111-1111-4111-8111-111111111111',
  organization_id: '22222222-2222-4222-8222-222222222222',
  organization_name: '東京店',
  customer_user_id: '33333333-3333-4333-8333-333333333333',
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
  orders: [],
};

describe('bookingGroupsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the authenticated user for paginated cross-device history', async () => {
    jest.mocked(bookingGroupsRepository.listForCustomer).mockResolvedValue({
      items: [group],
      total: 21,
    });

    const result = await bookingGroupsService.listMine(group.customer_user_id, 2, 10);

    expect(bookingGroupsRepository.listForCustomer).toHaveBeenCalledWith(
      group.customer_user_id,
      2,
      10
    );
    expect(result.total).toBe(21);
  });

  it('rejects a customer reading another customer booking group', async () => {
    jest.mocked(bookingGroupsRepository.findById).mockResolvedValue(group);

    await expect(
      bookingGroupsService.getById(group.id, {
        id: '44444444-4444-4444-8444-444444444444',
        role: UserRole.CUSTOMER,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('rejects staff without exactly one branch assignment', async () => {
    jest.mocked(bookingGroupsRepository.findById).mockResolvedValue(group);

    await expect(
      bookingGroupsService.getById(group.id, {
        id: '55555555-5555-4555-8555-555555555555',
        role: UserRole.STAFF,
        organizationId: group.organization_id,
        branchIds: [],
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('allows assigned staff to inspect only branch-filtered related bookings', async () => {
    jest.mocked(bookingGroupsRepository.findById).mockResolvedValue(group);
    const branchId = '66666666-6666-4666-8666-666666666666';

    await expect(
      bookingGroupsService.getById(group.id, {
        id: '55555555-5555-4555-8555-555555555555',
        role: UserRole.STAFF,
        organizationId: group.organization_id,
        branchIds: [branchId],
      })
    ).resolves.toEqual(group);
    expect(bookingGroupsRepository.findById).toHaveBeenCalledWith(group.id, branchId);
  });

  it('rejects organization owners from customer booking details', async () => {
    await expect(
      bookingGroupsService.getById(group.id, {
        id: '77777777-7777-4777-8777-777777777777',
        role: UserRole.MANAGER,
        organizationId: group.organization_id,
        branchIds: [],
        isOrganizationOwner: true,
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(bookingGroupsRepository.findById).not.toHaveBeenCalled();
  });
});
