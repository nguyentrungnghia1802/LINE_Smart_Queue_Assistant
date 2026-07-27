import type { PoolClient } from 'pg';

import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { queuesRepository } from '../../../db/repositories/queues.repository';
import { usersRepository } from '../../../db/repositories/users.repository';
import { withTransaction } from '../../../db/transaction';
import { issueAccountAction } from '../../account-lifecycle/account-lifecycle.service';
import { branchesRepository } from '../../branches/branches.repository';
import { emailOutboxRepository } from '../../email/email-outbox.repository';
import {
  type OrganizationApplicationRow,
  organizationApplicationsRepository,
} from '../organization-applications.repository';
import { organizationApplicationsService } from '../organization-applications.service';

jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/users.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../../db/transaction');
jest.mock('../../account-lifecycle/account-lifecycle.service');
jest.mock('../../branches/branches.repository');
jest.mock('../../email/email-outbox.repository');
jest.mock('../organization-applications.repository');

const mockFindPendingByEmail =
  organizationApplicationsRepository.findPendingByEmail as jest.MockedFunction<
    typeof organizationApplicationsRepository.findPendingByEmail
  >;
const mockCreateApplication = organizationApplicationsRepository.create as jest.MockedFunction<
  typeof organizationApplicationsRepository.create
>;
const mockUpdateApplication =
  organizationApplicationsRepository.updatePending as jest.MockedFunction<
    typeof organizationApplicationsRepository.updatePending
  >;
const mockFindByIdForUpdate =
  organizationApplicationsRepository.findByIdForUpdate as jest.MockedFunction<
    typeof organizationApplicationsRepository.findByIdForUpdate
  >;
const mockMarkApproved = organizationApplicationsRepository.markApproved as jest.MockedFunction<
  typeof organizationApplicationsRepository.markApproved
>;
const mockMarkRejected = organizationApplicationsRepository.markRejected as jest.MockedFunction<
  typeof organizationApplicationsRepository.markRejected
>;
const mockFindUserByEmail = usersRepository.findByEmail as jest.MockedFunction<
  typeof usersRepository.findByEmail
>;
const mockCreateUser = usersRepository.createInvited as jest.MockedFunction<
  typeof usersRepository.createInvited
>;
const mockCreateOrganization = organizationsRepository.create as jest.MockedFunction<
  typeof organizationsRepository.create
>;
const mockAddMember = organizationsRepository.addMember as jest.MockedFunction<
  typeof organizationsRepository.addMember
>;
const mockWithTransaction = withTransaction as jest.MockedFunction<typeof withTransaction>;
const mockCreateBranch = branchesRepository.create as jest.MockedFunction<
  typeof branchesRepository.create
>;
const mockAssignMember = branchesRepository.assignMember as jest.MockedFunction<
  typeof branchesRepository.assignMember
>;
const mockCreateQueue = queuesRepository.create as jest.MockedFunction<
  typeof queuesRepository.create
>;
const mockIssueAction = issueAccountAction as jest.MockedFunction<typeof issueAccountAction>;
const mockEnqueueEmail = emailOutboxRepository.enqueue as jest.MockedFunction<
  typeof emailOutboxRepository.enqueue
>;

const APPLICATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REVIEWER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORGANIZATION_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const MANAGER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function makeApplication(
  overrides: Partial<OrganizationApplicationRow> = {}
): OrganizationApplicationRow {
  return {
    id: APPLICATION_ID,
    reference_code: 'SQA-A1B2C3D4',
    status: 'pending',
    legal_name: 'Tokyo Service Company',
    trade_name: 'Smart Reception Tokyo',
    business_type: 'salon',
    registration_number: null,
    website_url: null,
    contact_name: 'Yuki Tanaka',
    contact_title: null,
    work_email: 'owner@example.jp',
    phone: '0312345678',
    postal_code: '100-0001',
    prefecture: '東京都',
    city: '千代田区',
    address_line1: '千代田1-1',
    address_line2: null,
    location_count: 2,
    expected_monthly_customers: 1200,
    plan_code: 'standard',
    billing_cycle: 'annual',
    default_locale: 'ja',
    logo_url: null,
    payment_provider: 'demo',
    payment_status: 'paid',
    payment_reference: 'demo-payment-reference',
    amount_yen: 298_000,
    organization_id: null,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    submitted_at: new Date('2026-07-26T00:00:00.000Z'),
    created_at: new Date('2026-07-26T00:00:00.000Z'),
    updated_at: new Date('2026-07-26T00:00:00.000Z'),
    ...overrides,
  };
}

const validDto = {
  legalName: 'Tokyo Service Company',
  tradeName: 'Smart Reception Tokyo',
  businessType: 'salon' as const,
  registrationNumber: null,
  websiteUrl: null,
  contactName: 'Yuki Tanaka',
  contactTitle: null,
  workEmail: 'owner@example.jp',
  phone: '0312345678',
  postalCode: '100-0001',
  prefecture: '東京都',
  city: '千代田区',
  addressLine1: '千代田1-1',
  addressLine2: null,
  locationCount: 2,
  expectedMonthlyCustomers: 1200,
  planCode: 'standard' as const,
  billingCycle: 'annual' as const,
  defaultLocale: 'ja' as const,
  logoUrl: null,
  termsAccepted: true as const,
};

describe('organizationApplicationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindPendingByEmail.mockResolvedValue(null);
    mockFindUserByEmail.mockResolvedValue(null);
    mockWithTransaction.mockImplementation(async (callback) => callback({} as PoolClient));
    mockEnqueueEmail.mockResolvedValue({ id: 'email-id' } as never);
  });

  it('calculates demo payment server-side and returns no password hash', async () => {
    const application = makeApplication();
    mockCreateApplication.mockResolvedValue(application);

    await expect(organizationApplicationsService.submit(validDto)).resolves.toEqual({
      id: APPLICATION_ID,
      referenceCode: 'SQA-A1B2C3D4',
      status: 'pending',
      paymentStatus: 'paid',
      amountYen: 298_000,
      submittedAt: application.submitted_at,
    });

    expect(mockCreateApplication).toHaveBeenCalledWith(
      expect.objectContaining({
        workEmail: 'owner@example.jp',
        amountYen: 298_000,
        paymentReference: expect.stringMatching(/^demo-/),
      }),
      expect.anything()
    );
    expect(mockEnqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `organization-application:${APPLICATION_ID}:submitted`,
        recipientEmail: 'owner@example.jp',
        templateKey: 'organization_application_submitted',
      }),
      expect.anything()
    );
  });

  it('rejects a duplicate pending work email', async () => {
    mockFindPendingByEmail.mockResolvedValue(makeApplication());

    await expect(organizationApplicationsService.submit(validDto)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
    expect(mockCreateApplication).not.toHaveBeenCalled();
  });

  it('updates only a pending application and recalculates its server-side price', async () => {
    const application = makeApplication();
    const updated = makeApplication({ trade_name: 'Updated Reception' });
    mockFindByIdForUpdate.mockResolvedValue(application);
    mockFindPendingByEmail.mockResolvedValue(application);
    mockUpdateApplication.mockResolvedValue(updated);

    await expect(
      organizationApplicationsService.update(APPLICATION_ID, {
        ...validDto,
        tradeName: 'Updated Reception',
      })
    ).resolves.toEqual(updated);

    expect(mockUpdateApplication).toHaveBeenCalledWith(
      APPLICATION_ID,
      expect.objectContaining({
        tradeName: 'Updated Reception',
        amountYen: 298_000,
      }),
      expect.anything()
    );
  });

  it('rejects changing a pending application to another pending work email', async () => {
    mockFindByIdForUpdate.mockResolvedValue(makeApplication());
    mockFindPendingByEmail.mockResolvedValue(
      makeApplication({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })
    );

    await expect(
      organizationApplicationsService.update(APPLICATION_ID, validDto)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
    expect(mockUpdateApplication).not.toHaveBeenCalled();
  });

  it('approves once and creates organization, manager, and membership atomically', async () => {
    const application = makeApplication();
    const reviewed = makeApplication({
      status: 'approved',
      organization_id: ORGANIZATION_ID,
      reviewed_by: REVIEWER_ID,
      reviewed_at: new Date(),
    });
    mockFindByIdForUpdate.mockResolvedValue(application);
    mockCreateOrganization.mockResolvedValue({
      id: ORGANIZATION_ID,
      name: application.trade_name,
    } as never);
    mockCreateUser.mockResolvedValue({
      id: MANAGER_ID,
      display_name: application.contact_name,
      email: application.work_email,
      role: 'manager',
    } as never);
    mockAddMember.mockResolvedValue({ id: 'membership-id' } as never);
    mockCreateBranch.mockResolvedValue({ id: 'branch-id', name: 'Main' } as never);
    mockAssignMember.mockResolvedValue(undefined);
    mockCreateQueue.mockResolvedValue({ id: 'queue-id', name: 'Queue' } as never);
    mockIssueAction.mockResolvedValue(undefined);
    mockMarkApproved.mockResolvedValue(reviewed);

    const result = await organizationApplicationsService.approve(APPLICATION_ID, REVIEWER_ID, {
      note: 'Verified',
    });

    expect(mockCreateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        name: application.trade_name,
        publicQrToken: expect.stringMatching(/^org-/),
      }),
      expect.anything()
    );
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: application.work_email,
        role: 'manager',
        invitedBy: REVIEWER_ID,
      }),
      expect.anything()
    );
    expect(mockAddMember).toHaveBeenCalledWith(
      ORGANIZATION_ID,
      MANAGER_ID,
      'manager',
      expect.anything(),
      expect.objectContaining({ isOwner: true, isActive: false })
    );
    expect(mockIssueAction).toHaveBeenCalledWith(
      expect.objectContaining({ userId: MANAGER_ID, purpose: 'account_activation' }),
      expect.anything()
    );
    expect(result.application.status).toBe('approved');
  });

  it('does not approve an application without a paid server-side payment', async () => {
    mockFindByIdForUpdate.mockResolvedValue(makeApplication({ payment_status: 'pending' }));

    await expect(
      organizationApplicationsService.approve(APPLICATION_ID, REVIEWER_ID, {})
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('rejects and enqueues a localized applicant result email', async () => {
    const application = makeApplication();
    const rejected = makeApplication({
      status: 'rejected',
      reviewed_by: REVIEWER_ID,
      reviewed_at: new Date(),
      review_note: 'Missing business documents',
      payment_status: 'refunded',
    });
    mockFindByIdForUpdate.mockResolvedValue(application);
    mockMarkRejected.mockResolvedValue(rejected);

    await expect(
      organizationApplicationsService.reject(APPLICATION_ID, REVIEWER_ID, {
        note: 'Missing business documents',
      })
    ).resolves.toEqual(rejected);

    expect(mockMarkRejected).toHaveBeenCalledWith(
      APPLICATION_ID,
      REVIEWER_ID,
      'Missing business documents',
      expect.anything()
    );
    expect(mockEnqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: `organization-application:${APPLICATION_ID}:rejected`,
        recipientEmail: application.work_email,
        templateKey: 'organization_application_rejected',
      }),
      expect.anything()
    );
  });
});
