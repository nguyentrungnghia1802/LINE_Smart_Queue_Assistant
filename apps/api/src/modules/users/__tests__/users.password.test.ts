import bcrypt from 'bcryptjs';

import { UserRole } from '@line-queue/shared';

import { usersRepository } from '../../../db/repositories/users.repository';
import { withTransaction } from '../../../db/transaction';
import type { AuthUser } from '../../../types/auth.types';
import { authSessionService } from '../../auth/auth-session.service';
import { usersService } from '../users.service';

jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/transaction');
jest.mock('../../auth/auth-session.service');
jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../account-lifecycle/account-lifecycle.service');
jest.mock('../../branches/branch-scope');
jest.mock('../../branches/branches.repository');

const actor: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: UserRole.ADMIN,
  displayName: 'Administrator',
  email: 'admin@example.com',
};

const mockFindById = usersRepository.findById as jest.MockedFunction<
  typeof usersRepository.findById
>;
const mockSetPassword = usersRepository.setPassword as jest.MockedFunction<
  typeof usersRepository.setPassword
>;
const mockRevokeAll = authSessionService.revokeAllForUser as jest.MockedFunction<
  typeof authSessionService.revokeAllForUser
>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

describe('usersService.changeMyPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithTransaction.mockImplementation(async (callback) => callback({} as never));
  });

  it('changes the password and revokes all active sessions atomically', async () => {
    const currentHash = await bcrypt.hash('Current1234', 4);
    mockFindById.mockResolvedValue({
      id: actor.id,
      display_name: 'Administrator',
      email: actor.email ?? null,
      password_hash: currentHash,
      role: UserRole.ADMIN,
      is_active: true,
      account_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      usersService.changeMyPassword(actor, {
        currentPassword: 'Current1234',
        newPassword: 'Replacement5678',
        passwordConfirmation: 'Replacement5678',
      })
    ).resolves.toEqual({ changed: true });

    expect(mockWithTransaction).toHaveBeenCalledTimes(1);
    expect(mockSetPassword).toHaveBeenCalledWith(actor.id, expect.any(String), expect.anything());
    const newHash = mockSetPassword.mock.calls[0]?.[1] ?? '';
    await expect(bcrypt.compare('Replacement5678', newHash)).resolves.toBe(true);
    expect(mockRevokeAll).toHaveBeenCalledWith(actor.id, 'password_changed', expect.anything());
  });

  it('rejects an incorrect current password without writing', async () => {
    mockFindById.mockResolvedValue({
      id: actor.id,
      display_name: 'Administrator',
      email: actor.email ?? null,
      password_hash: await bcrypt.hash('Current1234', 4),
      role: UserRole.ADMIN,
      is_active: true,
      account_status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await expect(
      usersService.changeMyPassword(actor, {
        currentPassword: 'Wrong12345',
        newPassword: 'Replacement5678',
        passwordConfirmation: 'Replacement5678',
      })
    ).rejects.toMatchObject({ statusCode: 401, code: 'AUTH_INVALID_PASSWORD' });

    expect(mockWithTransaction).not.toHaveBeenCalled();
    expect(mockSetPassword).not.toHaveBeenCalled();
    expect(mockRevokeAll).not.toHaveBeenCalled();
  });

  it('does not expose password changes to LINE customer accounts', async () => {
    await expect(
      usersService.changeMyPassword(
        { ...actor, role: UserRole.CUSTOMER },
        {
          currentPassword: 'Current1234',
          newPassword: 'Replacement5678',
          passwordConfirmation: 'Replacement5678',
        }
      )
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(mockFindById).not.toHaveBeenCalled();
  });
});
