import type { PoolClient } from 'pg';

import { withTransaction } from '../../../db/transaction';
import type { AuthUser } from '../../../types/auth.types';
import { revokeAccountAction } from '../../account-lifecycle/account-lifecycle.service';
import { branchesRepository } from '../branches.repository';
import { branchesService } from '../branches.service';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/transaction');
jest.mock('../../account-lifecycle/account-lifecycle.service');
jest.mock('../branches.repository');

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'manager',
  organizationId: '22222222-2222-4222-8222-222222222222',
  isOrganizationOwner: true,
  branchIds: [],
} as AuthUser;

const dto = {
  name: 'Shinjuku',
  phone: '0312345678',
  email: 'shinjuku@example.jp',
  postalCode: '160-0022',
  prefecture: 'Tokyo',
  city: 'Shinjuku',
  addressLine1: '1-1 Shinjuku',
  managers: [
    {
      displayName: 'Yuki Tanaka',
      email: 'manager@example.jp',
      phone: '09012345678',
      jobTitle: 'Branch manager',
    },
  ],
};

describe('branchesService subscription limits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks a fourth active branch for the Standard plan', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            name: 'Tokyo Service',
            default_locale: 'ja',
            settings: { subscriptionPlan: 'standard' },
          },
        ],
      }),
    } as unknown as PoolClient;
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(branchesRepository.countActive).mockResolvedValue(3);

    await expect(branchesService.create(actor, dto)).rejects.toMatchObject({
      statusCode: 409,
      code: 'BRANCH_PLAN_LIMIT_REACHED',
    });
    expect(branchesRepository.create).not.toHaveBeenCalled();
  });

  it('deletes an owned branch and its dependencies in one transaction', async () => {
    const client = { query: jest.fn() } as unknown as PoolClient;
    const branch = {
      id: '33333333-3333-4333-8333-333333333333',
      organization_id: actor.organizationId,
      name: 'Shinjuku',
    };
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(branchesRepository.findByIdForUpdate).mockResolvedValue(branch as never);
    jest.mocked(branchesRepository.deleteWithDependencies).mockResolvedValue({
      deleted: true,
      branchId: branch.id,
      deletedQueues: 2,
      deletedOrders: 3,
      deletedAccounts: 4,
    });

    await expect(branchesService.deleteBranch(actor, branch.id)).resolves.toMatchObject({
      deleted: true,
      branchId: branch.id,
    });
    expect(branchesRepository.deleteWithDependencies).toHaveBeenCalledWith(
      branch,
      actor.id,
      client
    );
  });

  it('rejects removing the final retained manager invitation', async () => {
    const client = { query: jest.fn() } as unknown as PoolClient;
    const branchId = '33333333-3333-4333-8333-333333333333';
    const managerId = '44444444-4444-4444-8444-444444444444';
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(branchesRepository.findByIdForUpdate).mockResolvedValue({ id: branchId } as never);
    jest.mocked(branchesRepository.findManagerAssignment).mockResolvedValue({
      is_owner: false,
      deactivated_at: null,
      account_status: 'invited',
    });
    jest.mocked(branchesRepository.countRetainedManagers).mockResolvedValue(0);

    await expect(branchesService.removeManager(actor, branchId, managerId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'A branch must keep at least one manager',
    });
    expect(branchesRepository.removeManager).not.toHaveBeenCalled();
  });

  it('allows revoking an invitation when another pending invitation remains', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;
    const branchId = '33333333-3333-4333-8333-333333333333';
    const managerId = '44444444-4444-4444-8444-444444444444';
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(branchesRepository.findByIdForUpdate).mockResolvedValue({ id: branchId } as never);
    jest.mocked(branchesRepository.findManagerAssignment).mockResolvedValue({
      is_owner: false,
      deactivated_at: null,
      account_status: 'invited',
    });
    jest.mocked(branchesRepository.countRetainedManagers).mockResolvedValue(1);

    await expect(branchesService.removeManager(actor, branchId, managerId)).resolves.toEqual({
      removed: true,
      invitationRevoked: true,
    });
    expect(revokeAccountAction).toHaveBeenCalledWith(managerId, 'account_activation', client);
    expect(branchesRepository.removeManager).toHaveBeenCalledWith(
      branchId,
      actor.organizationId,
      managerId,
      actor.id,
      true,
      client
    );
  });

  it('deactivates an active manager when another retained assignment remains', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;
    const branchId = '33333333-3333-4333-8333-333333333333';
    const managerId = '44444444-4444-4444-8444-444444444444';
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(branchesRepository.findByIdForUpdate).mockResolvedValue({ id: branchId } as never);
    jest.mocked(branchesRepository.findManagerAssignment).mockResolvedValue({
      is_owner: false,
      deactivated_at: null,
      account_status: 'active',
    });
    jest.mocked(branchesRepository.countRetainedManagers).mockResolvedValue(1);

    await expect(branchesService.removeManager(actor, branchId, managerId)).resolves.toEqual({
      removed: true,
      invitationRevoked: false,
    });
    expect(revokeAccountAction).not.toHaveBeenCalled();
    expect(branchesRepository.removeManager).toHaveBeenCalledWith(
      branchId,
      actor.organizationId,
      managerId,
      actor.id,
      false,
      client
    );
  });

  it('lets the organization owner update an owned branch with audit context', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;
    const branchId = '33333333-3333-4333-8333-333333333333';
    const previous = { id: branchId, organization_id: actor.organizationId, name: 'Old' };
    const updated = { ...previous, name: 'New' };
    jest.mocked(withTransaction).mockImplementation(async (callback) => callback(client));
    jest.mocked(branchesRepository.findByIdForUpdate).mockResolvedValue(previous as never);
    jest.mocked(branchesRepository.update).mockResolvedValue(updated as never);

    await expect(
      branchesService.updateOwnedBranch(
        actor,
        branchId,
        { name: 'New' },
        { ipAddress: '127.0.0.1' }
      )
    ).resolves.toEqual(updated);
    expect(branchesRepository.update).toHaveBeenCalledWith(
      branchId,
      actor.organizationId,
      { name: 'New' },
      client
    );
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'branch.update'"), [
      actor.id,
      branchId,
      actor.organizationId,
      JSON.stringify({ old: previous, new: updated }),
      '127.0.0.1',
      null,
    ]);
  });
});
