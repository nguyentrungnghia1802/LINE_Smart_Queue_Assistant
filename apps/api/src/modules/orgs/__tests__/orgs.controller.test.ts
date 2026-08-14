/**
 * Unit tests for branch-first public QR token lookup (getOrgByToken).
 *
 * These tests verify:
 *   1. Branch QR lookup takes precedence over the legacy organization fallback.
 *   2. The response exposes the resolved branch token.
 *   3. A 404 is returned when neither branch nor organization token matches.
 *
 * We mock all repository calls so no database is required.
 */
import type { Request, Response } from 'express';

import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { productsRepository } from '../../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../../db/repositories/queues.repository';
import { branchesRepository } from '../../branches/branches.repository';
import { getOrgByToken } from '../orgs.controller';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/products.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../branches/branches.repository');

const mockFindOrgByPublicToken = organizationsRepository.findByPublicToken as jest.MockedFunction<
  typeof organizationsRepository.findByPublicToken
>;
const mockFindById = organizationsRepository.findById as jest.MockedFunction<
  typeof organizationsRepository.findById
>;
const mockFindLocalizedById = organizationsRepository.findLocalizedById as jest.MockedFunction<
  typeof organizationsRepository.findLocalizedById
>;
const mockFindActiveByBranches = queuesRepository.findActiveByBranches as jest.MockedFunction<
  typeof queuesRepository.findActiveByBranches
>;
const mockFindByQueue = productsRepository.findByQueue as jest.MockedFunction<
  typeof productsRepository.findByQueue
>;
const mockCountWaiting = queueEntriesRepository.countWaiting as jest.MockedFunction<
  typeof queueEntriesRepository.countWaiting
>;
const mockFindBranchByPublicToken = branchesRepository.findByPublicToken as jest.MockedFunction<
  typeof branchesRepository.findByPublicToken
>;
const mockFindFirstBranch = branchesRepository.findFirstByOrganization as jest.MockedFunction<
  typeof branchesRepository.findFirstByOrganization
>;
const mockIsOpenNow = branchesRepository.isOpenNow as jest.MockedFunction<
  typeof branchesRepository.isOpenNow
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BRANCH_TOKEN = 'branch_abc123def456';

const orgRow = {
  id: 'org-uuid-001',
  name: 'Test Salon',
  slug: 'test-salon',
  line_channel_id: null,
  line_oa_basic_id: null,
  timezone: 'Asia/Bangkok',
  default_locale: 'ja' as const,
  settings: {},
  logo_url: null,
  phone: null,
  address: null,
  postal_code: null,
  prefecture: null,
  city: null,
  address_line1: null,
  address_line2: null,
  payment_info: null,
  public_qr_token: 'legacy_org_abc123def456',
  is_active: true,
  activation_status: 'active' as const,
  suspension_reason: null,
  suspension_note: null,
  created_at: new Date(),
  updated_at: new Date(),
};
const branchRow = {
  id: 'branch-uuid-001',
  organization_id: orgRow.id,
  name: 'Test Salon Tokyo',
  code: 'tokyo',
  phone: '03-1234-5678',
  email: null,
  postal_code: '100-0001',
  prefecture: 'Tokyo',
  city: 'Chiyoda',
  address_line1: '1-1',
  address_line2: null,
  latitude: null,
  longitude: null,
  google_place_id: null,
  formatted_map_address: null,
  timezone: 'Asia/Tokyo',
  public_qr_token: BRANCH_TOKEN,
  payment_settings: {},
  is_active: true,
  created_by: null,
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
  return { params: { token }, get: jest.fn().mockReturnValue(undefined) } as unknown as Request;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('getOrgByToken controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue(orgRow);
    mockFindLocalizedById.mockResolvedValue(orgRow);
    mockFindActiveByBranches.mockResolvedValue([]);
    mockFindByQueue.mockResolvedValue([]);
    mockCountWaiting.mockResolvedValue(0);
    mockFindFirstBranch.mockResolvedValue(branchRow);
    mockIsOpenNow.mockResolvedValue(true);
  });

  it('returns the branch catalog and token when a branch token matches', async () => {
    mockFindBranchByPublicToken.mockResolvedValue(branchRow);

    const req = makeReq(BRANCH_TOKEN);
    const res = makeRes();

    getOrgByToken(req, res, jest.fn());
    await flushPromises();

    expect(mockFindBranchByPublicToken).toHaveBeenCalledWith(BRANCH_TOKEN);
    expect(mockFindOrgByPublicToken).not.toHaveBeenCalled();

    // sendSuccess calls res.status(200).json({ success: true, data: ... })
    expect(res.status).toHaveBeenCalledWith(200);
    const statusMock = res.status as jest.Mock;
    const jsonMock = statusMock.mock.results[0]?.value?.json;
    expect(jsonMock).toBeDefined();
    const body = jsonMock?.mock.calls[0]?.[0] as {
      success: boolean;
      data?: { org?: { publicQrToken?: string } };
    };
    expect(body?.success).toBe(true);
    expect(body?.data?.org?.publicQrToken).toBe(BRANCH_TOKEN);
  });

  it('throws AppError.notFound when token matches neither branch nor organization', async () => {
    mockFindBranchByPublicToken.mockResolvedValue(null);
    mockFindOrgByPublicToken.mockResolvedValue(null);

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

  it('uses the exact token and supports the legacy organization fallback', async () => {
    mockFindBranchByPublicToken.mockResolvedValue(null);
    mockFindOrgByPublicToken.mockResolvedValue(orgRow);
    const token = 'legacy_org_specific_token_xyz';

    getOrgByToken(makeReq(token), makeRes(), jest.fn());
    await flushPromises();

    expect(mockFindBranchByPublicToken).toHaveBeenCalledWith(token);
    expect(mockFindOrgByPublicToken).toHaveBeenCalledWith(token);
    expect(mockFindOrgByPublicToken).toHaveBeenCalledTimes(1);
  });
});
