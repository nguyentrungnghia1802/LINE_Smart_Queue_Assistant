import { UserRole } from '@line-queue/shared';

import { withTransaction } from '../../../db/transaction';
import { authSessionRepository, AuthSessionRow } from '../auth-session.repository';
import { authSessionService, hashRefreshToken } from '../auth-session.service';

jest.mock('../../../db/transaction');
jest.mock('../auth-session.repository');

const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockCreate = authSessionRepository.create as jest.MockedFunction<
  typeof authSessionRepository.create
>;
const mockLock = authSessionRepository.lockByTokenHash as jest.MockedFunction<
  typeof authSessionRepository.lockByTokenHash
>;
const mockReplace = authSessionRepository.replace as jest.MockedFunction<
  typeof authSessionRepository.replace
>;
const mockRevokeFamily = authSessionRepository.revokeFamily as jest.MockedFunction<
  typeof authSessionRepository.revokeFamily
>;

function sessionRow(overrides: Partial<AuthSessionRow> = {}): AuthSessionRow {
  return {
    id: 'session-1',
    user_id: 'user-1',
    family_id: 'family-1',
    token_hash: hashRefreshToken('refresh-token'),
    session_kind: 'business',
    idle_expires_at: new Date(Date.now() + 10 * 60_000),
    absolute_expires_at: new Date(Date.now() + 10 * 60 * 60_000),
    last_used_at: new Date(),
    revoked_at: null,
    revocation_reason: null,
    replaced_by_session_id: null,
    created_at: new Date(),
    ...overrides,
  };
}

describe('authSessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWithTransaction.mockImplementation(async (fn) => fn({} as never));
  });

  it('issues a 15-minute idle business session without exposing the raw token to storage', async () => {
    mockCreate.mockImplementation(async (params) =>
      sessionRow({
        id: 'session-new',
        family_id: params.familyId,
        token_hash: params.tokenHash,
        session_kind: params.sessionKind,
        idle_expires_at: params.idleExpiresAt,
        absolute_expires_at: params.absoluteExpiresAt,
      })
    );

    const issued = await authSessionService.issue('user-1', UserRole.ADMIN);

    expect(issued.kind).toBe('business');
    expect(issued.idleTimeoutMs).toBe(15 * 60_000);
    expect(issued.refreshToken).not.toBe(issued.id);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        tokenHash: hashRefreshToken(issued.refreshToken),
        sessionKind: 'business',
      })
    );
  });

  it('rotates an active refresh token and preserves the session family', async () => {
    const current = sessionRow();
    mockLock.mockResolvedValue(current);
    mockCreate.mockImplementation(async (params) =>
      sessionRow({
        id: 'session-2',
        family_id: params.familyId,
        token_hash: params.tokenHash,
        idle_expires_at: params.idleExpiresAt,
        absolute_expires_at: params.absoluteExpiresAt,
      })
    );

    const rotated = await authSessionService.rotate('refresh-token');

    expect(rotated.familyId).toBe(current.family_id);
    expect(rotated.refreshToken).not.toBe('refresh-token');
    expect(mockReplace).toHaveBeenCalledWith(current.id, 'session-2', expect.anything());
  });

  it('persists expiry revocation before returning an expired-session error', async () => {
    const expired = sessionRow({ idle_expires_at: new Date(Date.now() - 1_000) });
    mockLock.mockResolvedValue(expired);

    await expect(authSessionService.rotate('refresh-token')).rejects.toMatchObject({
      code: 'AUTH_SESSION_EXPIRED',
    });
    expect(mockRevokeFamily).toHaveBeenCalledWith(expired.family_id, 'expired', expect.anything());
  });

  it('revokes a family when a rotated token is replayed outside the grace window', async () => {
    const replayed = sessionRow({
      revoked_at: new Date(Date.now() - 60_000),
      revocation_reason: 'rotated',
    });
    mockLock.mockResolvedValue(replayed);

    await expect(authSessionService.rotate('refresh-token')).rejects.toMatchObject({
      code: 'AUTH_SESSION_REUSED',
    });
    expect(mockRevokeFamily).toHaveBeenCalledWith(
      replayed.family_id,
      'refresh_token_reuse',
      expect.anything()
    );
  });

  it('allows a concurrent refresh during the short rotation grace window', async () => {
    const concurrent = sessionRow({
      revoked_at: new Date(Date.now() - 1_000),
      revocation_reason: 'rotated',
    });
    mockLock.mockResolvedValue(concurrent);
    mockCreate.mockImplementation(async (params) =>
      sessionRow({
        id: 'session-concurrent',
        family_id: params.familyId,
        token_hash: params.tokenHash,
        idle_expires_at: params.idleExpiresAt,
        absolute_expires_at: params.absoluteExpiresAt,
      })
    );

    await expect(authSessionService.rotate('refresh-token')).resolves.toMatchObject({
      familyId: concurrent.family_id,
    });
    expect(mockRevokeFamily).not.toHaveBeenCalled();
  });
});
