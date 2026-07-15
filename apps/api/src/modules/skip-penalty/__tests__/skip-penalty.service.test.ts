/**
 * Unit tests for skipPenaltyService.
 *
 * Covers the key business cases:
 *   - onSkipExhausted: records a 'skip' penalty when skip allowance is exhausted
 *   - onNoShow: records a 'no_show' penalty
 *   - calculatePriorityAdjustment: returns PENALTY_PRIORITY_DEDUCTION when active
 *     penalties exist, 0 when none
 *   - getActivePenalties: delegates to repository correctly
 */

import { PenaltyRecordRow, penaltyRepository } from '../../../db/repositories/penalty.repository';
import { SKIP_PENALTY_POLICY } from '../skip-penalty.policy';
import { skipPenaltyService } from '../skip-penalty.service';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../db/repositories/penalty.repository');

// db/client must be mocked so repository module loads cleanly
jest.mock('../../../db/client', () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
  closePool: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  queryWithClient: jest.fn().mockResolvedValue([]),
}));

// ── Typed handles ─────────────────────────────────────────────────────────────

const mockCreate = penaltyRepository.create as jest.MockedFunction<typeof penaltyRepository.create>;
const mockFindActiveByUser = penaltyRepository.findActiveByUser as jest.MockedFunction<
  typeof penaltyRepository.findActiveByUser
>;
const mockCountActiveByUser = penaltyRepository.countActiveByUser as jest.MockedFunction<
  typeof penaltyRepository.countActiveByUser
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER_ID = '00000000-0000-0000-0000-000000000001';
const QUEUE_ID = '00000000-0000-0000-0000-000000000002';
const ENTRY_ID = '00000000-0000-0000-0000-000000000003';
const ORG_ID = '00000000-0000-0000-0000-000000000010';

const basePenalty: PenaltyRecordRow = {
  id: '00000000-0000-0000-0000-000000000099',
  user_id: USER_ID,
  organization_id: ORG_ID,
  queue_id: QUEUE_ID,
  queue_entry_id: ENTRY_ID,
  penalty_type: 'excessive_cancel',
  points: 1,
  reason: null,
  metadata: {},
  created_at: new Date(),
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockResolvedValue(basePenalty);
  mockFindActiveByUser.mockResolvedValue([]);
  mockCountActiveByUser.mockResolvedValue(0);
});

// ── onSkipExhausted ───────────────────────────────────────────────────────────

describe('skipPenaltyService.onSkipExhausted', () => {
  it('creates a skip penalty record with correct type and severity', async () => {
    await skipPenaltyService.onSkipExhausted({
      userId: USER_ID,
      queueId: QUEUE_ID,
      entryId: ENTRY_ID,
      organizationId: ORG_ID,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const params = mockCreate.mock.calls[0][0];
    expect(params.userId).toBe(USER_ID);
    expect(params.queueId).toBe(QUEUE_ID);
    expect(params.queueEntryId).toBe(ENTRY_ID);
    expect(params.organizationId).toBe(ORG_ID);
    expect(params.penaltyType).toBe('excessive_cancel');
    expect(params.points).toBe(1);
    expect(params.reason).toBeTruthy();
  });

  it('propagates repository errors so callers can catch them', async () => {
    mockCreate.mockRejectedValue(new Error('DB failure'));

    await expect(
      skipPenaltyService.onSkipExhausted({
        userId: USER_ID,
        queueId: QUEUE_ID,
        entryId: ENTRY_ID,
        organizationId: ORG_ID,
      })
    ).rejects.toThrow('DB failure');
  });
});

// ── onNoShow ──────────────────────────────────────────────────────────────────

describe('skipPenaltyService.onNoShow', () => {
  it('creates a no_show penalty record with correct type and severity', async () => {
    await skipPenaltyService.onNoShow({
      userId: USER_ID,
      queueId: QUEUE_ID,
      entryId: ENTRY_ID,
      organizationId: ORG_ID,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const params = mockCreate.mock.calls[0][0];
    expect(params.penaltyType).toBe('no_show');
    expect(params.points).toBe(2);
    expect(params.userId).toBe(USER_ID);
    expect(params.reason).toBeTruthy();
  });

  it('propagates repository errors so callers can catch them', async () => {
    mockCreate.mockRejectedValue(new Error('network timeout'));

    await expect(
      skipPenaltyService.onNoShow({
        userId: USER_ID,
        queueId: QUEUE_ID,
        entryId: ENTRY_ID,
        organizationId: ORG_ID,
      })
    ).rejects.toThrow('network timeout');
  });
});

// ── calculatePriorityAdjustment ───────────────────────────────────────────────

describe('skipPenaltyService.calculatePriorityAdjustment', () => {
  it('returns 0 when the user has no active penalties', async () => {
    mockCountActiveByUser.mockResolvedValue(0);

    const result = await skipPenaltyService.calculatePriorityAdjustment({
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result).toBe(0);
    expect(mockCountActiveByUser).toHaveBeenCalledWith(USER_ID, ORG_ID);
  });

  it('returns PENALTY_PRIORITY_DEDUCTION when the user has one active penalty', async () => {
    mockCountActiveByUser.mockResolvedValue(1);

    const result = await skipPenaltyService.calculatePriorityAdjustment({
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result).toBe(SKIP_PENALTY_POLICY.PENALTY_PRIORITY_DEDUCTION);
    expect(result).toBeLessThan(0);
  });

  it('returns PENALTY_PRIORITY_DEDUCTION when the user has multiple active penalties', async () => {
    mockCountActiveByUser.mockResolvedValue(3);

    const result = await skipPenaltyService.calculatePriorityAdjustment({
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result).toBe(SKIP_PENALTY_POLICY.PENALTY_PRIORITY_DEDUCTION);
  });
});

// ── getActivePenalties ────────────────────────────────────────────────────────

describe('skipPenaltyService.getActivePenalties', () => {
  it('returns empty array when user has no active penalties', async () => {
    mockFindActiveByUser.mockResolvedValue([]);

    const result = await skipPenaltyService.getActivePenalties({ userId: USER_ID });

    expect(result).toEqual([]);
    expect(mockFindActiveByUser).toHaveBeenCalledWith(USER_ID, undefined);
  });

  it('returns all active penalties for the user', async () => {
    const noPenalty: PenaltyRecordRow = { ...basePenalty, penalty_type: 'no_show', points: 2 };
    mockFindActiveByUser.mockResolvedValue([basePenalty, noPenalty]);

    const result = await skipPenaltyService.getActivePenalties({
      userId: USER_ID,
      organizationId: ORG_ID,
    });

    expect(result).toHaveLength(2);
    expect(mockFindActiveByUser).toHaveBeenCalledWith(USER_ID, ORG_ID);
  });

  it('scopes lookup to organizationId when provided', async () => {
    mockFindActiveByUser.mockResolvedValue([basePenalty]);

    await skipPenaltyService.getActivePenalties({ userId: USER_ID, organizationId: ORG_ID });

    expect(mockFindActiveByUser).toHaveBeenCalledWith(USER_ID, ORG_ID);
  });
});
