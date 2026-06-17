/**
 * Integration tests for the 4 MVP queue APIs.
 *
 * Strategy: mock repositories + withTransaction (data layer) while keeping the
 * full HTTP stack in place (routing → middleware → controller → service).
 * This validates end-to-end contract without a live database.
 *
 * Tested endpoints:
 *   POST   /api/v1/queue/join
 *   GET    /api/v1/queue/me
 *   GET    /api/v1/queue/:queueId/status
 *   GET    /api/v1/queue/current?queueId=<uuid>
 */

import type { PoolClient } from 'pg';
import request from 'supertest';

import { UserRole } from '@line-queue/shared';

import { createApp } from '../../../app';
import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import {
  queueEntriesRepository,
  QueueEntryRow,
} from '../../../db/repositories/queue-entries.repository';
import { QueueRow, queuesRepository } from '../../../db/repositories/queues.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import { withTransaction } from '../../../db/transaction';
import { signToken } from '../../../utils/jwt';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/transaction');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/repositories/organizations.repository');

// Pool is referenced by withTransaction; mock it so the module loads cleanly.
jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
  closePool: jest.fn().mockResolvedValue(undefined),
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  queryWithClient: jest.fn().mockResolvedValue([]),
}));

// ── Mock handle aliases ───────────────────────────────────────────────────────

const mockFindQueueById = queuesRepository.findById as jest.MockedFunction<
  typeof queuesRepository.findById
>;
const mockCountWaiting = queuesRepository.countWaiting as jest.MockedFunction<
  typeof queuesRepository.countWaiting
>;
const mockGetWaitingPosition = queuesRepository.getWaitingPosition as jest.MockedFunction<
  typeof queuesRepository.getWaitingPosition
>;
const mockIncrementCounter = queuesRepository.incrementAndGetCounter as jest.MockedFunction<
  typeof queuesRepository.incrementAndGetCounter
>;
const mockFindActiveByUser = queueEntriesRepository.findActiveByUser as jest.MockedFunction<
  typeof queueEntriesRepository.findActiveByUser
>;
const mockFindActiveByLineUser = queueEntriesRepository.findActiveByLineUser as jest.MockedFunction<
  typeof queueEntriesRepository.findActiveByLineUser
>;
const mockFindAllActiveForActor =
  queueEntriesRepository.findAllActiveForActor as jest.MockedFunction<
    typeof queueEntriesRepository.findAllActiveForActor
  >;
const mockCreateEntry = queueEntriesRepository.create as jest.MockedFunction<
  typeof queueEntriesRepository.create
>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockFindUserById = usersRepository.findById as jest.MockedFunction<
  typeof usersRepository.findById
>;
const mockFindMembershipByUserId =
  organizationsRepository.findMembershipByUserId as jest.MockedFunction<
    typeof organizationsRepository.findMembershipByUserId
  >;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const QUEUE_ID = '123e4567-e89b-12d3-a456-426614174001';
const ENTRY_ID = '123e4567-e89b-12d3-a456-426614174002';
const USER_ID = '123e4567-e89b-12d3-a456-426614174003';
const LINE_USER_ID = 'Uf0000000000000000000000000000001';

const openQueue: QueueRow = {
  id: QUEUE_ID,
  organization_id: '123e4567-e89b-12d3-a456-426614174004',
  name: 'Counter A',
  description: 'Main service counter',
  status: 'open',
  queue_type: 'standard',
  prefix: 'A',
  max_capacity: null,
  daily_ticket_counter: 5,
  last_counter_reset_at: new Date('2025-01-15T00:00:00Z'),
  avg_service_seconds: 120,
  notify_ahead_positions: 3,
  allow_skip: true,
  max_skips_before_penalty: 2,
  opens_at: null,
  closes_at: null,
  settings: {},
  is_active: true,
  created_at: new Date('2025-01-01T00:00:00Z'),
  updated_at: new Date('2025-01-15T00:00:00Z'),
};

const waitingEntry: QueueEntryRow = {
  id: ENTRY_ID,
  queue_id: QUEUE_ID,
  user_id: USER_ID,
  line_user_id: LINE_USER_ID,
  ticket_number: 6,
  ticket_display: 'A006',
  status: 'waiting',
  priority: 0,
  skip_count: 0,
  notes: null,
  metadata: {},
  called_at: null,
  serving_at: null,
  completed_at: null,
  skipped_at: null,
  cancelled_at: null,
  estimated_call_at: null,
  created_at: new Date('2025-01-15T09:00:00Z'),
  updated_at: new Date('2025-01-15T09:00:00Z'),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const app = createApp();
const mockPoolClient = {
  connect: jest.fn(),
  query: jest.fn(),
  release: jest.fn(),
} as unknown as PoolClient;

/** Issue a test JWT for an authenticated user. */
function authToken(overrides: Partial<{ id: string; lineUserId: string; role: UserRole }> = {}) {
  return signToken({
    sub: overrides.id ?? USER_ID,
    lineUserId: overrides.lineUserId ?? LINE_USER_ID,
    role: overrides.role ?? UserRole.CUSTOMER,
  });
}

/** Make withTransaction execute the callback synchronously with a dummy client. */
function mockTx() {
  mockWithTransaction.mockImplementation(async (fn) => fn(mockPoolClient));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindActiveByUser.mockResolvedValue(null);
  mockFindActiveByLineUser.mockResolvedValue(null);
  mockFindUserById.mockResolvedValue({
    id: USER_ID,
    display_name: 'Queue Customer',
    email: null,
    password_hash: null,
    role: UserRole.CUSTOMER,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  mockFindMembershipByUserId.mockResolvedValue(null);
});

// ── POST /api/v1/queue/join ───────────────────────────────────────────────────

describe('POST /api/v1/queue/join', () => {
  describe('happy path', () => {
    it('returns 201 with ticket data when a new ticket is created', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockIncrementCounter.mockResolvedValue(6);
      mockCreateEntry.mockResolvedValue(waitingEntry);
      mockGetWaitingPosition.mockResolvedValue(2);
      mockTx();

      const res = await request(app)
        .post('/api/v1/queue/join')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({ queueId: QUEUE_ID });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const data = res.body.data as {
        entry: { ticket_display: string; status: string };
        aheadCount: number;
        estimatedWaitSeconds: number;
        isExisting: boolean;
      };
      expect(data.isExisting).toBe(false);
      expect(data.entry.ticket_display).toBe('A006');
      expect(data.entry.status).toBe('waiting');
      expect(data.aheadCount).toBe(2);
      expect(data.estimatedWaitSeconds).toBe(2 * 120); // 2 ahead × 120 s/ticket
    });

    it('returns 200 (not 201) when the caller already has an active ticket', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockFindActiveByUser.mockResolvedValue(waitingEntry); // ticket already exists
      mockGetWaitingPosition.mockResolvedValue(1);

      const res = await request(app)
        .post('/api/v1/queue/join')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({ queueId: QUEUE_ID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isExisting).toBe(true);
      expect(res.body.data.entry.id).toBe(ENTRY_ID);
      // No DB write should have occurred
      expect(mockCreateEntry).not.toHaveBeenCalled();
    });

    it('accepts an anonymous request with lineUserId in body', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockIncrementCounter.mockResolvedValue(7);
      mockCreateEntry.mockResolvedValue({ ...waitingEntry, user_id: null, ticket_display: 'A007' });
      mockGetWaitingPosition.mockResolvedValue(0);
      mockTx();

      // No Authorization header — anonymous LIFF user
      const res = await request(app).post('/api/v1/queue/join').send({
        queueId: QUEUE_ID,
        lineUserId: LINE_USER_ID,
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.aheadCount).toBe(0);
      // 0 ahead → 0 s wait → ceil(0/60) = 0 min
      expect(res.body.data.estimatedWaitSeconds).toBe(0);
    });

    it('includes estimatedWaitSeconds derived from ETA service', async () => {
      const queueWith90sAvg: QueueRow = { ...openQueue, avg_service_seconds: 90 };
      mockFindQueueById.mockResolvedValue(queueWith90sAvg);
      mockIncrementCounter.mockResolvedValue(8);
      mockCreateEntry.mockResolvedValue(waitingEntry);
      mockGetWaitingPosition.mockResolvedValue(5); // 5 people ahead
      mockTx();

      const res = await request(app)
        .post('/api/v1/queue/join')
        .set('Authorization', `Bearer ${authToken()}`)
        .send({ queueId: QUEUE_ID });

      expect(res.status).toBe(201);
      expect(res.body.data.estimatedWaitSeconds).toBe(5 * 90); // 450 s
    });
  });

  describe('business errors', () => {
    it('returns 409 when the queue is not open', async () => {
      mockFindQueueById.mockResolvedValue({ ...openQueue, status: 'closed' });

      const res = await request(app).post('/api/v1/queue/join').send({ queueId: QUEUE_ID });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when queue is at full capacity', async () => {
      const fullQueue: QueueRow = { ...openQueue, max_capacity: 5 };
      mockFindQueueById.mockResolvedValue(fullQueue);
      mockCountWaiting.mockResolvedValue(5); // at capacity

      const res = await request(app).post('/api/v1/queue/join').send({ queueId: QUEUE_ID });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
      expect(res.body.error.message).toMatch(/capacity/i);
    });

    it('returns 404 when the queue does not exist', async () => {
      mockFindQueueById.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/queue/join').send({ queueId: QUEUE_ID });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('validation', () => {
    it('returns 422 when queueId is missing', async () => {
      const res = await request(app).post('/api/v1/queue/join').send({});
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when queueId is not a valid UUID', async () => {
      const res = await request(app).post('/api/v1/queue/join').send({ queueId: 'not-a-uuid' });
      expect(res.status).toBe(422);
      expect(res.body.error.details.fieldErrors).toHaveProperty('queueId');
    });

    it('returns 422 when notes exceeds 500 characters', async () => {
      const res = await request(app)
        .post('/api/v1/queue/join')
        .send({ queueId: QUEUE_ID, notes: 'x'.repeat(501) });
      expect(res.status).toBe(422);
      expect(res.body.error.details.fieldErrors).toHaveProperty('notes');
    });
  });
});

// ── GET /api/v1/queue/me ──────────────────────────────────────────────────────

describe('GET /api/v1/queue/me', () => {
  describe('happy path', () => {
    it('returns 200 with tickets array for an authenticated user', async () => {
      mockFindAllActiveForActor.mockResolvedValue([waitingEntry]);
      mockFindQueueById.mockResolvedValue(openQueue);
      mockGetWaitingPosition.mockResolvedValue(3);

      const res = await request(app)
        .get('/api/v1/queue/me')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const ticket = res.body.data[0] as {
        entry: { ticket_display: string };
        aheadCount: number;
        estimatedWaitSeconds: number;
      };
      expect(ticket.entry.ticket_display).toBe('A006');
      expect(ticket.aheadCount).toBe(3);
      expect(ticket.estimatedWaitSeconds).toBe(3 * 120);
    });

    it('returns 200 with empty array when the caller has no active tickets', async () => {
      mockFindAllActiveForActor.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/queue/me')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('returns 401 for anonymous callers because /me now requires auth', async () => {
      const res = await request(app).get('/api/v1/queue/me');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns estimatedWaitSeconds = 0 when queue not found (defensive fallback)', async () => {
      mockFindAllActiveForActor.mockResolvedValue([waitingEntry]);
      mockFindQueueById.mockResolvedValue(null); // queue deleted between entry creation and query
      mockGetWaitingPosition.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/v1/queue/me')
        .set('Authorization', `Bearer ${authToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.data[0].estimatedWaitSeconds).toBe(0);
    });
  });
});

// ── GET /api/v1/queue/:queueId/status ────────────────────────────────────────

describe('GET /api/v1/queue/:queueId/status', () => {
  describe('happy path', () => {
    it('returns 200 with queue info, waitingCount, and estimatedWaitSeconds', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockCountWaiting.mockResolvedValue(8);

      const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data as {
        queue: { id: string; name: string; status: string };
        waitingCount: number;
        estimatedWaitSeconds: number;
      };
      expect(data.queue.id).toBe(QUEUE_ID);
      expect(data.queue.name).toBe('Counter A');
      expect(data.queue.status).toBe('open');
      expect(data.waitingCount).toBe(8);
      expect(data.estimatedWaitSeconds).toBe(8 * 120); // 8 × 120 s
    });

    it('is publicly accessible — no auth required', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockCountWaiting.mockResolvedValue(0);

      // No Authorization header
      const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
      expect(res.status).toBe(200);
    });

    it('returns estimatedWaitSeconds = 0 when waitingCount is 0', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockCountWaiting.mockResolvedValue(0);

      const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
      expect(res.body.data.estimatedWaitSeconds).toBe(0);
      expect(res.body.data.waitingCount).toBe(0);
    });

    it('uses fallback ETA (120 s/ticket) when avg_service_seconds is 0', async () => {
      const queueNoAvg: QueueRow = { ...openQueue, avg_service_seconds: 0 };
      mockFindQueueById.mockResolvedValue(queueNoAvg);
      mockCountWaiting.mockResolvedValue(3);

      const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
      // ETA service fallback: 3 × 120 (DEFAULT_AVG_SERVICE_SECONDS)
      expect(res.body.data.estimatedWaitSeconds).toBe(3 * 120);
    });
  });

  describe('errors', () => {
    it('returns 404 when the queue does not exist', async () => {
      mockFindQueueById.mockResolvedValue(null);

      const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 422 when queueId param is not a valid UUID', async () => {
      const res = await request(app).get('/api/v1/queue/bad-id/status');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

// ── GET /api/v1/queue/current?queueId=<uuid> ─────────────────────────────────

describe('GET /api/v1/queue/current', () => {
  describe('happy path', () => {
    it('returns 200 with queue status by query param', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockCountWaiting.mockResolvedValue(4);

      const res = await request(app).get(`/api/v1/queue/current?queueId=${QUEUE_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.queue.id).toBe(QUEUE_ID);
      expect(res.body.data.waitingCount).toBe(4);
      expect(res.body.data.estimatedWaitSeconds).toBe(4 * 120);
    });

    it('is publicly accessible — no auth required', async () => {
      mockFindQueueById.mockResolvedValue(openQueue);
      mockCountWaiting.mockResolvedValue(0);

      const res = await request(app).get(`/api/v1/queue/current?queueId=${QUEUE_ID}`);
      expect(res.status).toBe(200);
    });
  });

  describe('validation', () => {
    it('returns 422 when queueId query param is missing', async () => {
      const res = await request(app).get('/api/v1/queue/current');
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 422 when queueId is not a valid UUID', async () => {
      const res = await request(app).get('/api/v1/queue/current?queueId=bad-id');
      expect(res.status).toBe(422);
      expect(res.body.error.details.fieldErrors).toHaveProperty('queueId');
    });
  });

  describe('errors', () => {
    it('returns 404 when the queue does not exist', async () => {
      mockFindQueueById.mockResolvedValue(null);

      const res = await request(app).get(`/api/v1/queue/current?queueId=${QUEUE_ID}`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});

// ── Response contract ─────────────────────────────────────────────────────────

describe('response contract', () => {
  it('success responses always have { success: true, data: ... }', async () => {
    mockFindQueueById.mockResolvedValue(openQueue);
    mockCountWaiting.mockResolvedValue(0);

    const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).not.toHaveProperty('error');
  });

  it('error responses always have { success: false, error: { code, message } }', async () => {
    mockFindQueueById.mockResolvedValue(null);

    const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.code).toBe('string');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('invalid token returns 401 with UNAUTHORIZED code', async () => {
    const res = await request(app)
      .post('/api/v1/queue/join')
      .set('Authorization', 'Bearer invalid.token.value')
      .send({ queueId: QUEUE_ID });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('sets Content-Type application/json on success', async () => {
    mockFindQueueById.mockResolvedValue(openQueue);
    mockCountWaiting.mockResolvedValue(0);

    const res = await request(app).get(`/api/v1/queue/${QUEUE_ID}/status`);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
