import { UserRole } from '@line-queue/shared';

import { usersRepository } from '../../../db/repositories/users.repository';
import { withTransaction } from '../../../db/transaction';
import { authService } from '../auth.service';
import * as verifier from '../line/lineIdToken.verifier';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../line/lineIdToken.verifier');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/transaction');

const mockVerify = verifier.verifyLineIdToken as jest.MockedFunction<
  typeof verifier.verifyLineIdToken
>;
const mockFindByLineUserId = usersRepository.findByLineUserId as jest.MockedFunction<
  typeof usersRepository.findByLineUserId
>;
const mockUpsertLineAccount = usersRepository.upsertLineAccount as jest.MockedFunction<
  typeof usersRepository.upsertLineAccount
>;
const mockCreate = usersRepository.create as jest.MockedFunction<typeof usersRepository.create>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const profile = {
  lineUserId: 'U12345678901234567890123456789012',
  displayName: 'Tester',
  pictureUrl: 'https://example.com/pic.jpg',
};

const existingUserRow = {
  id: 'user-uuid-001',
  display_name: 'Tester',
  email: null,
  role: UserRole.CUSTOMER, // value: 'CUSTOMER' — matches enum used in auth service
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authService.loginWithLineToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('returning user (findByLineUserId returns a row)', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue(profile);
      mockFindByLineUserId.mockResolvedValue(existingUserRow);
      mockUpsertLineAccount.mockResolvedValue({} as never);
    });

    it('returns a token and user with correct fields', async () => {
      const { token, user } = await authService.loginWithLineToken('fake-id-token');

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
      expect(user.id).toBe(existingUserRow.id);
      expect(user.lineUserId).toBe(profile.lineUserId);
      expect(user.role).toBe(UserRole.CUSTOMER);
    });

    it('calls upsertLineAccount to sync the profile', async () => {
      await authService.loginWithLineToken('fake-id-token');

      expect(mockUpsertLineAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: existingUserRow.id,
          lineUserId: profile.lineUserId,
          displayName: profile.displayName,
        })
      );
    });

    it('does NOT call withTransaction for an existing user', async () => {
      await authService.loginWithLineToken('fake-id-token');

      expect(mockWithTransaction).not.toHaveBeenCalled();
    });
  });

  describe('new user (findByLineUserId returns null)', () => {
    beforeEach(() => {
      mockVerify.mockResolvedValue(profile);
      mockFindByLineUserId.mockResolvedValue(null);

      // Simulate withTransaction executing the callback synchronously
      mockWithTransaction.mockImplementation(async (fn) => {
        mockCreate.mockResolvedValue(existingUserRow);
        mockUpsertLineAccount.mockResolvedValue({} as never);
        return fn({} as never);
      });
    });

    it('returns a token and user for a first-time login', async () => {
      const { token, user } = await authService.loginWithLineToken('fake-id-token');

      expect(typeof token).toBe('string');
      expect(user.id).toBe(existingUserRow.id);
      expect(user.role).toBe(UserRole.CUSTOMER);
    });

    it('creates the user with role "customer" inside a transaction', async () => {
      await authService.loginWithLineToken('fake-id-token');

      expect(mockWithTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: profile.displayName, role: 'customer' }),
        expect.anything() // PoolClient
      );
    });

    it('links the LINE account inside the same transaction', async () => {
      await authService.loginWithLineToken('fake-id-token');

      expect(mockUpsertLineAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          lineUserId: profile.lineUserId,
          displayName: profile.displayName,
        }),
        expect.anything() // PoolClient
      );
    });
  });

  describe('LINE verification failure', () => {
    it('propagates the AppError when LINE rejects the token', async () => {
      const { AppError } = await import('../../../utils/AppError');
      mockVerify.mockRejectedValue(AppError.unauthorized('LINE id_token verification failed'));

      await expect(authService.loginWithLineToken('bad-token')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });
});
