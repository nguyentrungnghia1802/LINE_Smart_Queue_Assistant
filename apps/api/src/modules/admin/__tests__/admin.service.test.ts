import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { organizationApplicationsRepository } from '../../organization-applications/organization-applications.repository';
import { adminService } from '../admin.service';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/transaction');
jest.mock('../../organization-applications/organization-applications.repository');

const mockListActive = organizationsRepository.listActive as jest.MockedFunction<
  typeof organizationsRepository.listActive
>;
const mockGetAdminDashboard =
  organizationApplicationsRepository.getAdminDashboard as jest.MockedFunction<
    typeof organizationApplicationsRepository.getAdminDashboard
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
});
