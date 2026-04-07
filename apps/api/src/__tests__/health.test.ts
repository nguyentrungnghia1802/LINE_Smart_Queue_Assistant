/**
 * Integration tests for /health and /ready endpoints.
 *
 * Uses supertest to spin up the app in-process without binding a real port.
 * The DB pool is mocked so these tests run without a live database.
 */
import request from 'supertest';

import { createApp } from '../app';

// ── Mock the DB pool so /ready can be tested without a live DB ─────────────────

jest.mock('../db/client', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }], rowCount: 1 }),
  },
  closePool: jest.fn().mockResolvedValue(undefined),
}));

// ── Shared app instance ────────────────────────────────────────────────────────

const app = createApp();

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
    });
    expect(typeof res.body.timestamp).toBe('string');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('sets X-Request-Id response header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('echoes a provided X-Request-Id', async () => {
    const id = 'test-trace-id-123';
    const res = await request(app).get('/health').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).toBe(id);
  });
});

describe('GET /ready', () => {
  it('returns 200 with status ready when DB is up', async () => {
    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ready',
      db: 'connected',
    });
  });

  it('returns 503 when DB pool throws', async () => {
    const { pool } = jest.requireMock('../db/client') as { pool: { query: jest.Mock } };
    pool.query.mockRejectedValueOnce(new Error('Connection refused'));

    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
  });
});

describe('404 handler', () => {
  it('returns 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
