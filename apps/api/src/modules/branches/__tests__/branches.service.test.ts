import type { PoolClient } from 'pg';

import { withTransaction } from '../../../db/transaction';
import type { AuthUser } from '../../../types/auth.types';
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
});
