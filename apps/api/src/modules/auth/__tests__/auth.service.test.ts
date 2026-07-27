import bcrypt from 'bcryptjs';

import { UserRole } from '@line-queue/shared';

import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import { withTransaction } from '../../../db/transaction';
import { authService } from '../auth.service';
import { authSessionService } from '../auth-session.service';
import * as verifier from '../line/lineIdToken.verifier';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../line/lineIdToken.verifier');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/transaction');
jest.mock('../auth-session.service');

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
const mockSetVerifiedLineEmail =
  usersRepository.setVerifiedLineEmailIfAvailable as jest.MockedFunction<
    typeof usersRepository.setVerifiedLineEmailIfAvailable
  >;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockFindByEmail = usersRepository.findByEmail as jest.MockedFunction<
  typeof usersRepository.findByEmail
>;
const mockFindMembershipByUserId =
  organizationsRepository.findMembershipByUserId as jest.MockedFunction<
    typeof organizationsRepository.findMembershipByUserId
  >;
const mockIssueSession = authSessionService.issue as jest.MockedFunction<
  typeof authSessionService.issue
>;

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
  password_hash: null,
  role: UserRole.CUSTOMER, // value: 'CUSTOMER' — matches enum used in auth service
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('authService.loginWithLineToken', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueSession.mockResolvedValue({
      id: 'session-row-id',
      familyId: 'session-family-id',
      userId: existingUserRow.id,
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      kind: 'customer',
      idleTimeoutMs: 30 * 24 * 60 * 60 * 1000,
    });
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

    it('stores an email verified by LINE when the user has no email', async () => {
      const verifiedEmail = 'customer@example.com';
      mockVerify.mockResolvedValue({ ...profile, email: verifiedEmail });
      mockSetVerifiedLineEmail.mockResolvedValue({
        ...existingUserRow,
        email: verifiedEmail,
      });

      const { user } = await authService.loginWithLineToken('fake-id-token');

      expect(mockSetVerifiedLineEmail).toHaveBeenCalledWith(existingUserRow.id, verifiedEmail);
      expect(user.email).toBe(verifiedEmail);
    });

    it('does not overwrite an existing platform email', async () => {
      mockVerify.mockResolvedValue({ ...profile, email: 'new@example.com' });
      mockFindByLineUserId.mockResolvedValue({
        ...existingUserRow,
        email: 'current@example.com',
      });

      const { user } = await authService.loginWithLineToken('fake-id-token');

      expect(mockSetVerifiedLineEmail).not.toHaveBeenCalled();
      expect(user.email).toBe('current@example.com');
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

describe('authService.loginWithEmailPassword', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIssueSession.mockResolvedValue({
      id: 'session-row-id',
      familyId: 'session-family-id',
      userId: 'admin-user-id',
      refreshToken: 'refresh-token',
      refreshExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
      kind: 'business',
      idleTimeoutMs: 15 * 60 * 1000,
    });
  });

  it('logs in admin without organization membership', async () => {
    const passwordHash = await bcrypt.hash('123456', 10);
    mockFindByEmail.mockResolvedValue({
      id: 'admin-user-id',
      display_name: 'Admin Demo',
      email: 'admin@gmail.com',
      password_hash: passwordHash,
      role: UserRole.ADMIN,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
    mockFindMembershipByUserId.mockResolvedValue(null);

    const { token, user } = await authService.loginWithEmailPassword('admin@gmail.com', '123456');

    expect(typeof token).toBe('string');
    expect(user).toMatchObject({
      id: 'admin-user-id',
      role: UserRole.ADMIN,
      organizationId: undefined,
      email: 'admin@gmail.com',
    });
  });

  it('returns a specific error when the account does not exist', async () => {
    mockFindByEmail.mockResolvedValue(null);

    await expect(
      authService.loginWithEmailPassword('missing@example.com', 'password')
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_ACCOUNT_NOT_FOUND',
    });
  });

  it('returns a specific error when an invited account is not activated', async () => {
    mockFindByEmail.mockResolvedValue({
      ...existingUserRow,
      email: 'invited@example.com',
      role: UserRole.STAFF,
      account_status: 'invited',
      password_hash: null,
    });

    await expect(
      authService.loginWithEmailPassword('invited@example.com', 'password')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'AUTH_ACCOUNT_NOT_ACTIVATED',
    });
  });

  it('returns a specific error when the password is incorrect', async () => {
    mockFindByEmail.mockResolvedValue({
      ...existingUserRow,
      email: 'staff@example.com',
      role: UserRole.STAFF,
      password_hash: await bcrypt.hash('correct-password', 10),
    });

    await expect(
      authService.loginWithEmailPassword('staff@example.com', 'wrong-password')
    ).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_PASSWORD',
    });
  });

  it('rejects email login for customer accounts', async () => {
    const passwordHash = await bcrypt.hash('123456', 10);
    mockFindByEmail.mockResolvedValue({
      ...existingUserRow,
      email: 'customer@gmail.com',
      password_hash: passwordHash,
      role: UserRole.CUSTOMER,
    });

    await expect(
      authService.loginWithEmailPassword('customer@gmail.com', '123456')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'CUSTOMER_LINE_LOGIN_REQUIRED',
    });
    expect(mockFindMembershipByUserId).not.toHaveBeenCalled();
  });
});
