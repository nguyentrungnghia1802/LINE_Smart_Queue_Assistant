import { UserRole } from '@line-queue/shared';

import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import type { UserRow } from '../../../db/repositories/users.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import type { AuthUser } from '../../../types/auth.types';
import { usersService } from '../users.service';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/users.repository');

const targetId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const organizationId = '44444444-4444-4444-8444-444444444444';

const target: UserRow = {
  id: targetId,
  display_name: 'Assigned Staff',
  email: 'staff@example.jp',
  password_hash: 'must-not-leak',
  role: UserRole.STAFF,
  is_active: true,
  account_status: 'active',
  created_at: new Date('2026-08-11T00:00:00.000Z'),
  updated_at: new Date('2026-08-11T00:00:00.000Z'),
};

const branchManager: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: UserRole.MANAGER,
  organizationId,
  branchIds: [branchId],
  isOrganizationOwner: false,
};

describe('usersService authorization boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(usersRepository.findById).mockResolvedValue(target);
    jest.mocked(usersRepository.findAssignedQueue).mockResolvedValue(null);
  });

  it.each([
    ['platform admin', { id: 'admin-1', role: UserRole.ADMIN }],
    [
      'organization owner',
      {
        id: 'owner-1',
        role: UserRole.MANAGER,
        organizationId,
        isOrganizationOwner: true,
        branchIds: [],
      },
    ],
    [
      'staff',
      {
        id: 'staff-2',
        role: UserRole.STAFF,
        organizationId,
        branchIds: [branchId],
      },
    ],
    ['another customer', { id: 'customer-2', role: UserRole.CUSTOMER }],
  ] as Array<[string, AuthUser]>)(
    'rejects %s reading another user profile',
    async (_label, actor) => {
      await expect(usersService.getUser(actor, targetId)).rejects.toMatchObject({
        statusCode: 403,
      });
    }
  );

  it('rejects a branch manager reading staff assigned to another branch', async () => {
    jest.mocked(organizationsRepository.findMember).mockResolvedValue({ role: 'staff' } as never);
    jest.mocked(usersRepository.findAssignedBranchId).mockResolvedValue('other-branch');

    await expect(usersService.getUser(branchManager, targetId)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('allows a branch manager to read assigned staff without exposing credentials', async () => {
    jest.mocked(organizationsRepository.findMember).mockResolvedValue({ role: 'staff' } as never);
    jest.mocked(usersRepository.findAssignedBranchId).mockResolvedValue(branchId);

    const response = await usersService.getUser(branchManager, targetId);

    expect(response).toEqual(expect.objectContaining({ id: targetId, role: UserRole.STAFF }));
    expect(response).not.toHaveProperty('password_hash');
  });

  it('allows users to read only their own profile without exposing credentials', async () => {
    jest.mocked(organizationsRepository.findMembershipByUserId).mockResolvedValue(null);
    const actor: AuthUser = { id: targetId, role: UserRole.STAFF };

    const response = await usersService.getUser(actor, targetId);

    expect(response.id).toBe(targetId);
    expect(response).not.toHaveProperty('password_hash');
  });

  it('projects assigned-branch lists through the same safe response allowlist', async () => {
    jest.mocked(usersRepository.findByBranchAndRole).mockResolvedValue([target]);

    const response = await usersService.listUsersForBranchManager(branchManager);

    expect(response).toHaveLength(1);
    expect(response[0]).not.toHaveProperty('password_hash');
    expect(usersRepository.findByBranchAndRole).toHaveBeenCalledWith(branchId, 'staff');
  });
});
