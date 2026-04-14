/**
 * Route-level contract tests for /api/v1/queue/* endpoints.
 *
 * Validates:
 *   - validate() middleware rejects bad input with 422 + correct shape
 *   - Stub controllers respond with 501 (not 500) for valid input
 *   - The error response always has { success: false, error: { code, message } }
 *
 * The DB pool is mocked so no live DB is required.
 */

import request from 'supertest';

import { createApp } from '../../../app';

// Stub out DB so app boots cleanly
jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
  closePool: jest.fn().mockResolvedValue(undefined),
}));

const app = createApp();

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';
const VALID_UUID2 = '223e4567-e89b-12d3-a456-426614174000';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Assert the 422 error shape from validate() middleware */
function expectValidationError(body: Record<string, unknown>): void {
  expect(body.success).toBe(false);
  const error = body.error as Record<string, unknown>;
  expect(error.code).toBe('VALIDATION_ERROR');
  expect(typeof error.message).toBe('string');
}

/** Assert the 501 stub shape from queue controllers */
function expectNotImplemented(body: Record<string, unknown>): void {
  expect(body.success).toBe(false);
  const error = body.error as Record<string, unknown>;
  expect(error.code).toBe('NOT_IMPLEMENTED');
}

// ── POST /api/v1/queue/join ───────────────────────────────────────────────────

describe('POST /api/v1/queue/join', () => {
  it('returns 422 when queueId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/queue/join')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
  });

  it('returns 422 when queueId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/queue/join').send({ queueId: 'not-a-uuid' });

    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
    const details = (res.body as { error: { details: { fieldErrors: Record<string, string[]> } } })
      .error.details.fieldErrors;
    expect(details).toHaveProperty('queueId');
  });

  it('returns 501 for a valid request (stub)', async () => {
    const res = await request(app).post('/api/v1/queue/join').send({ queueId: VALID_UUID });

    expect(res.status).toBe(501);
    expectNotImplemented(res.body as Record<string, unknown>);
  });
});

// ── GET /api/v1/queue/current ─────────────────────────────────────────────────

describe('GET /api/v1/queue/current', () => {
  it('returns 422 when queueId query param is missing', async () => {
    const res = await request(app).get('/api/v1/queue/current');
    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
  });

  it('returns 422 when queueId is not a UUID', async () => {
    const res = await request(app).get('/api/v1/queue/current?queueId=bad-id');
    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
  });

  it('returns 501 for a valid request (stub)', async () => {
    const res = await request(app).get(`/api/v1/queue/current?queueId=${VALID_UUID}`);
    expect(res.status).toBe(501);
    expectNotImplemented(res.body as Record<string, unknown>);
  });
});

// ── GET /api/v1/queue/me ──────────────────────────────────────────────────────

describe('GET /api/v1/queue/me', () => {
  it('returns 501 (stub — no validation needed)', async () => {
    const res = await request(app).get('/api/v1/queue/me');
    expect(res.status).toBe(501);
    expectNotImplemented(res.body as Record<string, unknown>);
  });
});

// ── POST /api/v1/queue/:entryId/cancel ───────────────────────────────────────

describe('POST /api/v1/queue/:entryId/cancel', () => {
  it('returns 422 when entryId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/queue/not-a-uuid/cancel');
    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
  });

  it('returns 501 for a valid UUID param (stub)', async () => {
    const res = await request(app).post(`/api/v1/queue/${VALID_UUID}/cancel`);
    expect(res.status).toBe(501);
    expectNotImplemented(res.body as Record<string, unknown>);
  });
});

// ── POST /api/v1/queue/:entryId/skip ─────────────────────────────────────────

describe('POST /api/v1/queue/:entryId/skip', () => {
  it('returns 422 when entryId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/queue/bad/skip');
    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
  });

  it('returns 501 for a valid UUID param (stub)', async () => {
    const res = await request(app).post(`/api/v1/queue/${VALID_UUID}/skip`);
    expect(res.status).toBe(501);
    expectNotImplemented(res.body as Record<string, unknown>);
  });
});

// ── GET /api/v1/queue/:queueId/status ────────────────────────────────────────

describe('GET /api/v1/queue/:queueId/status', () => {
  it('returns 422 when queueId param is not a UUID', async () => {
    const res = await request(app).get('/api/v1/queue/bad-id/status');
    expect(res.status).toBe(422);
    expectValidationError(res.body as Record<string, unknown>);
  });

  it('returns 501 for a valid UUID param (stub)', async () => {
    const res = await request(app).get(`/api/v1/queue/${VALID_UUID2}/status`);
    expect(res.status).toBe(501);
    expectNotImplemented(res.body as Record<string, unknown>);
  });
});

// ── Static routes don't conflict with parameterised ──────────────────────────

describe('route ordering — static paths win over parameterised', () => {
  it('GET /current is NOT matched by /:queueId/status', async () => {
    // /current has no /status suffix — it should hit the /current handler (501 stub)
    // not the /:queueId/status handler
    const res = await request(app).get('/api/v1/queue/current');
    // /current without ?queueId fails validation — proves it hit the /current route
    expect(res.status).toBe(422);
  });
});
