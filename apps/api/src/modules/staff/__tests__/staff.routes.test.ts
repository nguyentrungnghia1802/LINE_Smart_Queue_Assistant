import request from 'supertest';

import { UserRole } from '@line-queue/shared';

import { createApp } from '../../../app';
import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import { signToken } from '../../../utils/jwt';
import { staffService } from '../staff.service';

jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../staff.service');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ORG_ID = '22222222-2222-4222-8222-222222222222';
const ENTRY_ID = '33333333-3333-4333-8333-333333333333';

const app = createApp();

const mockFindUserById = usersRepository.findById as jest.MockedFunction<
  typeof usersRepository.findById
>;
const mockFindMembershipByUserId =
  organizationsRepository.findMembershipByUserId as jest.MockedFunction<
    typeof organizationsRepository.findMembershipByUserId
  >;
const mockFindOrganizationById = organizationsRepository.findById as jest.MockedFunction<
  typeof organizationsRepository.findById
>;
const mockComplete = staffService.complete as jest.MockedFunction<typeof staffService.complete>;

function authToken(): string {
  return signToken({ sub: USER_ID, role: UserRole.STAFF, orgId: ORG_ID });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFindUserById.mockResolvedValue({
    id: USER_ID,
    display_name: 'Staff Test',
    email: 'staff@example.com',
    password_hash: 'hash',
    role: UserRole.STAFF,
    is_active: true,
    preferred_locale: 'ja',
    created_at: new Date(),
    updated_at: new Date(),
  });
  mockFindMembershipByUserId.mockResolvedValue({
    id: '44444444-4444-4444-8444-444444444444',
    organization_id: ORG_ID,
    user_id: USER_ID,
    role: UserRole.STAFF,
    joined_at: new Date(),
  });
  mockFindOrganizationById.mockResolvedValue({
    id: ORG_ID,
    name: 'Test Organization',
    slug: 'test-organization',
    line_channel_id: null,
    line_oa_basic_id: null,
    timezone: 'Asia/Tokyo',
    default_locale: 'ja',
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
    public_qr_token: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  mockComplete.mockResolvedValue({
    id: ENTRY_ID,
    queue_id: '55555555-5555-4555-8555-555555555555',
    user_id: null,
    order_id: null,
    line_user_id: null,
    ticket_number: 4,
    ticket_code: 'A004',
    status: 'served',
    priority: 0,
    position_snapshot: null,
    called_at: new Date(),
    serving_started_at: new Date(),
    served_at: new Date(),
    skipped_at: null,
    cancelled_at: null,
    no_show_at: null,
    estimated_wait_seconds: null,
    created_at: new Date(),
    updated_at: new Date(),
  });
});

describe('POST /api/v1/staff/entries/:entryId/complete', () => {
  it('accepts a valid entry UUID without requiring a request body', async () => {
    const response = await request(app)
      .post(`/api/v1/staff/entries/${ENTRY_ID}/complete`)
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { entry: { id: ENTRY_ID, status: 'served' } },
    });
    expect(mockComplete).toHaveBeenCalledWith(ENTRY_ID, USER_ID, ORG_ID);
  });

  it('returns a useful field error for an invalid entry UUID', async () => {
    const response = await request(app)
      .post('/api/v1/staff/entries/not-a-uuid/complete')
      .set('Authorization', `Bearer ${authToken()}`);

    expect(response.status).toBe(422);
    expect(response.body.error.details.fieldErrors).toHaveProperty('entryId');
    expect(mockComplete).not.toHaveBeenCalled();
  });
});
