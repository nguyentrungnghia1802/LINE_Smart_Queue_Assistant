/**
 * Integration tests for the LINE webhook handler.
 *
 * Uses supertest to exercise the full Express middleware stack.
 * The DB pool and LINE messaging adapter are mocked so these tests run
 * in isolation — no real database or LINE API connections required.
 *
 * Signature verification uses the real HMAC logic against the test secret.
 */

import { createHmac } from 'node:crypto';

import request from 'supertest';

import { createApp } from '../../../app';

// ── Mocks ──────────────────────────────────────────────────────────────────────

jest.mock('../../../db/client', () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
  query: jest.fn().mockResolvedValue([]),
  queryOne: jest.fn().mockResolvedValue(null),
  queryWithClient: jest.fn().mockResolvedValue([]),
  closePool: jest.fn().mockResolvedValue(undefined),
}));

// Define mocks inline — jest.mock factories are hoisted before variable
// declarations, so module-scope `const` references would be undefined here.
// Retrieve the live mock references after setup via jest.requireMock.
jest.mock('../line.messaging', () => ({
  lineMessagingAdapter: {
    pushMessage: jest.fn().mockResolvedValue(undefined),
    replyMessage: jest.fn().mockResolvedValue(undefined),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

// Must be a plain string literal — jest.mock factories are hoisted before
// variable declarations, so module-scope `const` values are not accessible.
const TEST_SECRET = 'test-channel-secret';

// Override the LINE channel secret for all tests.
// The channel secret string must be inlined here (no const reference).
jest.mock('../../../config', () => ({
  config: {
    nodeEnv: 'test',
    line: {
      channelSecret: 'test-channel-secret',
      channelAccessToken: '',
      channelId: '',
    },
    cors: { origin: 'http://localhost:5173' },
    jwt: { secret: 'test-jwt-secret', expiresIn: '7d' },
    database: { url: '' },
    port: 4000,
    host: '0.0.0.0',
  },
}));

function makeSignature(body: string): string {
  return createHmac('sha256', TEST_SECRET).update(body).digest('base64');
}

function followEvent(userId = 'U_follow_001'): object {
  return {
    destination: 'U_bot',
    events: [
      {
        type: 'follow',
        timestamp: Date.now(),
        source: { type: 'user', userId },
        replyToken: 'mock-reply-token',
      },
    ],
  };
}

function messageEvent(text: string, userId = 'U_msg_001'): object {
  return {
    destination: 'U_bot',
    events: [
      {
        type: 'message',
        timestamp: Date.now(),
        source: { type: 'user', userId },
        replyToken: 'mock-reply-token',
        message: { id: 'msg1', type: 'text', text },
      },
    ],
  };
}

// ── Shared app instance + live mock refs ──────────────────────────────────────

const app = createApp();

// Retrieve the live mock functions after all jest.mock factories have run.
type MockAdapter = { pushMessage: jest.Mock; replyMessage: jest.Mock };
const { lineMessagingAdapter: mockAdapter } = jest.requireMock('../line.messaging') as {
  lineMessagingAdapter: MockAdapter;
};

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockAdapter.pushMessage.mockClear();
  mockAdapter.replyMessage.mockClear();
});

describe('POST /api/v1/line/webhook — signature validation', () => {
  it('returns 401 when X-Line-Signature header is missing', async () => {
    const body = JSON.stringify(followEvent());
    const res = await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a tampered body (signature mismatch)', async () => {
    const body = JSON.stringify(followEvent());
    // Sign a DIFFERENT body — simulates a tampered payload.
    const sig = makeSignature(JSON.stringify({ destination: 'other', events: [] }));

    const res = await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Line-Signature', sig)
      .send(body);

    expect(res.status).toBe(401);
  });

  it('returns 200 for a valid signature', async () => {
    const body = JSON.stringify({ destination: 'U_bot', events: [] });
    const sig = makeSignature(body);

    const res = await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Line-Signature', sig)
      .send(body);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/line/webhook — follow event', () => {
  it('replies with a welcome message on follow', async () => {
    const body = JSON.stringify(followEvent());
    const sig = makeSignature(body);

    const res = await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Line-Signature', sig)
      .send(body);

    expect(res.status).toBe(200);

    // Give the async event processing time to complete.
    await new Promise((r) => setTimeout(r, 50));

    expect(mockAdapter.replyMessage).toHaveBeenCalledTimes(1);
    const [token, messages] = mockAdapter.replyMessage.mock.calls[0] as [
      string,
      { type: string; text: string }[],
    ];
    expect(token).toBe('mock-reply-token');
    expect(messages[0].type).toBe('text');
    expect(messages[0].text).toContain('ようこそ');
  });
});

describe('POST /api/v1/line/webhook — message events', () => {
  it('replies to HELP command', async () => {
    const body = JSON.stringify(messageEvent('help'));
    const sig = makeSignature(body);

    await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Line-Signature', sig)
      .send(body);

    await new Promise((r) => setTimeout(r, 50));

    expect(mockAdapter.replyMessage).toHaveBeenCalledTimes(1);
    const [, messages] = mockAdapter.replyMessage.mock.calls[0] as [string, { text: string }[]];
    expect(messages[0].text).toContain('STATUS');
  });

  it('replies to STATUS command', async () => {
    const body = JSON.stringify(messageEvent('status'));
    const sig = makeSignature(body);

    await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Line-Signature', sig)
      .send(body);

    await new Promise((r) => setTimeout(r, 50));

    expect(mockAdapter.replyMessage).toHaveBeenCalledTimes(1);
    const [, statusMessages] = mockAdapter.replyMessage.mock.calls[0] as [
      string,
      { text: string }[],
    ];
    expect(statusMessages[0].text.length).toBeGreaterThan(0);
  });

  it('replies with a nudge for unrecognised messages', async () => {
    const body = JSON.stringify(messageEvent('random text'));
    const sig = makeSignature(body);

    await request(app)
      .post('/api/v1/line/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Line-Signature', sig)
      .send(body);

    await new Promise((r) => setTimeout(r, 50));

    expect(mockAdapter.replyMessage).toHaveBeenCalledTimes(1);
    const [, nudgeMessages] = mockAdapter.replyMessage.mock.calls[0] as [
      string,
      { text: string }[],
    ];
    expect(nudgeMessages[0].text).toContain('HELP');
  });
});
