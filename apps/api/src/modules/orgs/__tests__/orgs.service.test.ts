import { auditLogRepository } from '../../../db/repositories/audit-log.repository';
import {
  OrganizationRow,
  organizationsRepository,
} from '../../../db/repositories/organizations.repository';
import { orgsService } from '../orgs.service';

jest.mock('../../../db/repositories/audit-log.repository');
jest.mock('../../../db/repositories/organizations.repository');

const mockFindById = organizationsRepository.findById as jest.MockedFunction<
  typeof organizationsRepository.findById
>;
const mockUpdateOrg = organizationsRepository.updateOrg as jest.MockedFunction<
  typeof organizationsRepository.updateOrg
>;
const mockAuditCreate = auditLogRepository.create as jest.MockedFunction<
  typeof auditLogRepository.create
>;

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';

function makeOrg(overrides: Partial<OrganizationRow> = {}): OrganizationRow {
  return {
    id: ORG_ID,
    name: 'The Queue Lab',
    slug: 'the-queue-lab',
    line_channel_id: null,
    line_oa_basic_id: null,
    timezone: 'Asia/Tokyo',
    default_locale: 'ja',
    settings: {},
    logo_url: null,
    phone: '0900000000',
    address: 'Bangkok',
    postal_code: null,
    prefecture: null,
    city: null,
    address_line1: null,
    address_line2: null,
    payment_info: 'Bank transfer',
    public_qr_token: 'org_demo_token',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('orgsService.updateSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({ id: '1' } as never);
  });

  it('updates organization settings and writes audit log', async () => {
    const existing = makeOrg();
    const updated = makeOrg({ name: 'Updated Queue Lab', phone: '0911111111' });
    const dto = { name: 'Updated Queue Lab', phone: '0911111111' };
    mockFindById.mockResolvedValue(existing);
    mockUpdateOrg.mockResolvedValue(updated);

    await expect(
      orgsService.updateSettings(ORG_ID, dto, { actorUserId: ACTOR_ID })
    ).resolves.toEqual(updated);

    expect(mockUpdateOrg).toHaveBeenCalledWith(ORG_ID, dto);
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: 'organization.update_settings',
        resourceType: 'organization',
        resourceId: ORG_ID,
        organizationId: ORG_ID,
        changes: { old: existing, new: updated },
      })
    );
  });

  it('throws 404 when organization does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    await expect(
      orgsService.updateSettings(ORG_ID, { name: 'Missing' }, { actorUserId: ACTOR_ID })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(mockUpdateOrg).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});
