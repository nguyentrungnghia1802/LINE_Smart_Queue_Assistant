/**
 * Unit tests for the public QR token lookup (getOrgByToken).
 *
 * These tests verify:
 *   1. That `organizationsRepository.findByPublicToken` is called with the token
 *      from the route parameter.
 *   2. That the response shape includes `publicQrToken`.
 *   3. That a 404 is returned when the token doesn't match any org.
 *
 * We mock all repository calls so no database is required.
 */
import type { Request, Response } from 'express';

import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { productsRepository } from '../../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../../db/repositories/queues.repository';
import { getOrgByToken } from '../orgs.controller';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/products.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/repositories/queue-entries.repository');

const mockFindByPublicToken = organizationsRepository.findByPublicToken as jest.MockedFunction<
  typeof organizationsRepository.findByPublicToken
>;
const mockFindActiveByOrg = queuesRepository.findActiveByOrg as jest.MockedFunction<
  typeof queuesRepository.findActiveByOrg
>;
const mockFindByOrgProducts = productsRepository.findByOrg as jest.MockedFunction<
  typeof productsRepository.findByOrg
>;
const mockListWaiting = queueEntriesRepository.listWaiting as jest.MockedFunction<
  typeof queueEntriesRepository.listWaiting
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_TOKEN = 'org_abc123def456';

const orgRow = {
  id: 'org-uuid-001',
  name: 'Test Salon',
  slug: 'test-salon',
  line_channel_id: null,
  line_oa_basic_id: null,
  timezone: 'Asia/Bangkok',
  settings: {},
  logo_url: null,
  phone: null,
  address: null,
  payment_info: null,
  public_qr_token: ORG_TOKEN,
  is_active: true,
  created_at: new Date(),
  updated_at: new Date(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush all pending microtasks + macrotasks so asyncHandler's inner promise settles. */
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

function makeRes() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { json, status, send: jest.fn() } as unknown as Response;
}

function makeReq(token: string) {
  return { params: { token } } as unknown as Request;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getOrgByToken controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindActiveByOrg.mockResolvedValue([]);
    mockFindByOrgProducts.mockResolvedValue([]);
    mockListWaiting.mockResolvedValue([]);
  });

  it('returns org data including publicQrToken when token matches', async () => {
    mockFindByPublicToken.mockResolvedValue(orgRow);

    const req = makeReq(ORG_TOKEN);
    const res = makeRes();

    getOrgByToken(req, res, jest.fn());
    await flushPromises();

    expect(mockFindByPublicToken).toHaveBeenCalledWith(ORG_TOKEN);

    // sendSuccess calls res.status(200).json({ success: true, data: ... })
    expect(res.status).toHaveBeenCalledWith(200);
    const jsonMock = (res.status as jest.Mock).mock.results[0]?.value?.json as jest.Mock | undefined;
    expect(jsonMock).toBeDefined();
    const body = jsonMock?.mock.calls[0]?.[0] as { success: boolean; data?: { org?: { publicQrToken?: string } } };
    expect(body?.success).toBe(true);
    expect(body?.data?.org?.publicQrToken).toBe(ORG_TOKEN);
  });

  it('throws AppError.notFound when token does not match any org', async () => {
    mockFindByPublicToken.mockResolvedValue(null);

    const req = makeReq('invalid-token');
    const res = makeRes();
    const next = jest.fn();

    getOrgByToken(req, res, next);
    await flushPromises();

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0]?.[0];
    expect(err).toBeDefined();
    expect(err).toHaveProperty('statusCode', 404);
  });

  it('calls findByPublicToken with the exact token from params', async () => {
    mockFindByPublicToken.mockResolvedValue(orgRow);
    const token = 'org_specific_token_xyz';

    getOrgByToken(makeReq(token), makeRes(), jest.fn());
    await flushPromises();

    expect(mockFindByPublicToken).toHaveBeenCalledWith(token);
    expect(mockFindByPublicToken).toHaveBeenCalledTimes(1);
  });
});
