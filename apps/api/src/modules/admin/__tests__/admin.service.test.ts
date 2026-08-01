import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import { authSessionService } from '../../auth/auth-session.service';
import { organizationApplicationsRepository } from '../../organization-applications/organization-applications.repository';
import { adminService } from '../admin.service';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/transaction');
jest.mock('../../auth/auth-session.service');
jest.mock('../../organization-applications/organization-applications.repository');

const mockListActive = organizationsRepository.listActive as jest.MockedFunction<
  typeof organizationsRepository.listActive
>;
const mockGetAdminDashboard =
  organizationApplicationsRepository.getAdminDashboard as jest.MockedFunction<
    typeof organizationApplicationsRepository.getAdminDashboard
  >;
const mockFindMember = organizationsRepository.findMember as jest.MockedFunction<
  typeof organizationsRepository.findMember
>;
const mockFindUserById = usersRepository.findById as jest.MockedFunction<
  typeof usersRepository.findById
>;
const mockFindUserByEmail = usersRepository.findByEmail as jest.MockedFunction<
  typeof usersRepository.findByEmail
>;
const mockUpdateProfile = usersRepository.updateProfile as jest.MockedFunction<
  typeof usersRepository.updateProfile
>;
const mockRevokeAllForUser = authSessionService.revokeAllForUser as jest.MockedFunction<
  typeof authSessionService.revokeAllForUser
>;

describe('adminService dashboard and organization plans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes the organization subscription plan for admin lists', async () => {
    mockListActive.mockResolvedValue([
      { id: 'starter-org', settings: {} },
      { id: 'standard-org', settings: { subscriptionPlan: 'standard' } },
      { id: 'scale-org', settings: { subscriptionPlan: 'scale' } },
      { id: 'invalid-org', settings: { subscriptionPlan: 'enterprise' } },
    ] as never);

    await expect(adminService.listOrganizations()).resolves.toEqual([
      expect.objectContaining({ id: 'starter-org', subscription_plan: 'starter' }),
      expect.objectContaining({ id: 'standard-org', subscription_plan: 'standard' }),
      expect.objectContaining({ id: 'scale-org', subscription_plan: 'scale' }),
      expect.objectContaining({ id: 'invalid-org', subscription_plan: 'starter' }),
    ]);
  });

  it('returns platform subscription revenue metrics from the application repository', async () => {
    const dashboard = {
      organizationCount: 8,
      pendingApplicationCount: 2,
      totalRevenue: 540000,
      planCounts: { starter: 3, standard: 4, scale: 1 },
      monthlyRevenue: [{ month: '2026-07', revenue: 120000 }],
    };
    mockGetAdminDashboard.mockResolvedValue(dashboard);

    await expect(adminService.getDashboard()).resolves.toEqual(dashboard);
  });

  it('updates only the organization owner email and revokes existing sessions', async () => {
    const currentUser = {
      id: 'owner-user',
      email: 'old@example.com',
      display_name: 'Owner Name',
    };
    const updatedUser = { ...currentUser, email: 'new@example.com' };
    mockFindMember.mockResolvedValue({ role: 'manager', is_owner: true } as never);
    mockFindUserById
      .mockResolvedValueOnce(currentUser as never)
      .mockResolvedValueOnce(updatedUser as never);
    mockFindUserByEmail.mockResolvedValue(null);
    mockUpdateProfile.mockResolvedValue(updatedUser as never);

    await expect(
      adminService.updateOwnerEmail('organization-id', 'owner-user', {
        email: 'new@example.com',
      })
    ).resolves.toEqual(updatedUser);

    expect(mockUpdateProfile).toHaveBeenCalledWith('owner-user', {
      email: 'new@example.com',
    });
    expect(mockRevokeAllForUser).toHaveBeenCalledWith('owner-user', 'admin_owner_email_changed');
  });

  it('does not write or revoke sessions when the owner email is unchanged', async () => {
    const currentUser = {
      id: 'owner-user',
      email: 'owner@example.com',
      display_name: 'Owner Name',
    };
    mockFindMember.mockResolvedValue({ role: 'manager', is_owner: true } as never);
    mockFindUserById.mockResolvedValue(currentUser as never);

    await expect(
      adminService.updateOwnerEmail('organization-id', 'owner-user', {
        email: 'owner@example.com',
      })
    ).resolves.toEqual(currentUser);

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });
});
