import type { PoolClient } from 'pg';

import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import { withTransaction } from '../../../db/transaction';
import { authSessionService } from '../../auth/auth-session.service';
import { organizationApplicationsRepository } from '../../organization-applications/organization-applications.repository';
import { adminService } from '../admin.service';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/transaction');
jest.mock('../../auth/auth-session.service');
jest.mock('../../organization-applications/organization-applications.repository');

const mockListForAdmin = organizationsRepository.listForAdmin as jest.MockedFunction<
  typeof organizationsRepository.listForAdmin
>;
const mockFindOrganizationForAdmin =
  organizationsRepository.findByIdForAdmin as jest.MockedFunction<
    typeof organizationsRepository.findByIdForAdmin
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
const mockFindOrganizationOwner = usersRepository.findOrganizationOwner as jest.MockedFunction<
  typeof usersRepository.findOrganizationOwner
>;

describe('adminService dashboard and organization plans', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes the organization subscription plan for admin lists', async () => {
    mockListForAdmin.mockResolvedValue([
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

  it('lists suspended organizations for the admin status filters', async () => {
    mockListForAdmin.mockResolvedValue([
      {
        id: 'suspended-org',
        settings: {},
        is_active: false,
        activation_status: 'suspended',
        suspension_reason: 'organization_request',
        suspension_note: 'Seasonal closure',
      },
    ] as never);

    await expect(adminService.listOrganizations()).resolves.toEqual([
      expect.objectContaining({
        id: 'suspended-org',
        activation_status: 'suspended',
        suspension_reason: 'organization_request',
        suspension_note: 'Seasonal closure',
      }),
    ]);
  });

  it('suspends an active organization with a reason, note, and audit evidence', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT activation_status')) {
        return { rows: [{ activation_status: 'active', is_active: true }], rowCount: 1 };
      }
      if (sql.includes('SELECT user_id FROM organization_members')) {
        return { rows: [{ user_id: 'owner-user' }, { user_id: 'staff-user' }], rowCount: 2 };
      }
      return { rows: [], rowCount: 1 };
    });
    const client = { query } as unknown as PoolClient;
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));

    await expect(
      adminService.suspendOrganization('organization-id', 'admin-user', {
        reason: 'organization_request',
        note: 'Requested by the owner',
      })
    ).resolves.toEqual({
      id: 'organization-id',
      activationStatus: 'suspended',
      suspensionReason: 'organization_request',
      suspensionNote: 'Requested by the owner',
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('suspension_reason = $2'), [
      'organization-id',
      'organization_request',
      'Requested by the owner',
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("'organization.suspend'"), [
      'admin-user',
      'organization-id',
      JSON.stringify({
        reason: 'organization_request',
        note: 'Requested by the owner',
        deactivatedUserCount: 2,
      }),
    ]);
  });

  it('rejects suspension when the organization is not active', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ activation_status: 'suspended', is_active: false }],
      rowCount: 1,
    });
    const client = { query } as unknown as PoolClient;
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));

    await expect(
      adminService.suspendOrganization('organization-id', 'admin-user', {
        reason: 'other',
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('loads the owner for a suspended organization detail view', async () => {
    mockFindOrganizationForAdmin.mockResolvedValue({
      id: 'organization-id',
      activation_status: 'suspended',
      is_active: false,
    } as never);
    mockFindOrganizationOwner.mockResolvedValue({
      id: 'owner-user',
      display_name: 'Owner',
      email: 'owner@example.jp',
      password_hash: 'must-not-leak',
    } as never);

    await expect(adminService.listManagers('organization-id')).resolves.toEqual([
      expect.objectContaining({ id: 'owner-user', email: 'owner@example.jp' }),
    ]);
    expect(mockFindOrganizationForAdmin).toHaveBeenCalledWith('organization-id');
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
      password_hash: 'must-not-leak',
    };
    const updatedUser = { ...currentUser, email: 'new@example.com' };
    mockFindMember.mockResolvedValue({ role: 'manager', is_owner: true } as never);
    mockFindUserById
      .mockResolvedValueOnce(currentUser as never)
      .mockResolvedValueOnce(updatedUser as never);
    mockFindUserByEmail.mockResolvedValue(null);
    mockUpdateProfile.mockResolvedValue(updatedUser as never);

    const response = await adminService.updateOwnerEmail('organization-id', 'owner-user', {
      email: 'new@example.com',
    });

    expect(response).toEqual(
      expect.objectContaining({ id: 'owner-user', email: 'new@example.com' })
    );
    expect(response).not.toHaveProperty('password_hash');

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
      password_hash: 'must-not-leak',
    };
    mockFindMember.mockResolvedValue({ role: 'manager', is_owner: true } as never);
    mockFindUserById.mockResolvedValue(currentUser as never);

    const response = await adminService.updateOwnerEmail('organization-id', 'owner-user', {
      email: 'owner@example.com',
    });

    expect(response).toEqual(
      expect.objectContaining({ id: 'owner-user', email: 'owner@example.com' })
    );
    expect(response).not.toHaveProperty('password_hash');

    expect(mockUpdateProfile).not.toHaveBeenCalled();
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });
});
