import { auditLogRepository } from '../../../db/repositories/audit-log.repository';
import { ProductRow, productsRepository } from '../../../db/repositories/products.repository';
import { productsService } from '../products.service';

jest.mock('../../../db/repositories/audit-log.repository');
jest.mock('../../../db/repositories/products.repository');

const mockCreate = productsRepository.create as jest.MockedFunction<
  typeof productsRepository.create
>;
const mockFindById = productsRepository.findById as jest.MockedFunction<
  typeof productsRepository.findById
>;
const mockUpdate = productsRepository.update as jest.MockedFunction<
  typeof productsRepository.update
>;
const mockSoftDelete = productsRepository.softDelete as jest.MockedFunction<
  typeof productsRepository.softDelete
>;
const mockAuditCreate = auditLogRepository.create as jest.MockedFunction<
  typeof auditLogRepository.create
>;

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BRANCH_ID = '44444444-4444-4444-8444-444444444444';
const QUEUE_ID = '55555555-5555-4555-8555-555555555555';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR_ID = '33333333-3333-4333-8333-333333333333';
const scope = { organizationId: ORG_ID, branchId: BRANCH_ID };

function makeProduct(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: PRODUCT_ID,
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    queue_ids: [QUEUE_ID],
    name: 'Haircut',
    description: 'Basic haircut',
    image_url: null,
    price: '120000',
    service_time_minutes: 30,
    max_wait_minutes: null,
    requires_prepayment: false,
    stock_quantity: null,
    product_type: 'service',
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('productsService CRUD audit logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({ id: '1' } as never);
  });

  it('creates a product and writes an audit log', async () => {
    const created = makeProduct();
    mockCreate.mockResolvedValue(created);

    const dto = {
      name: 'Haircut',
      price: 120000,
      serviceTimeMinutes: 30,
      requiresPrepayment: false,
      productType: 'service' as const,
    };

    await expect(productsService.create(scope, dto, { actorUserId: ACTOR_ID })).resolves.toEqual(
      created
    );

    expect(mockCreate).toHaveBeenCalledWith(
      {
        organizationId: ORG_ID,
        branchId: BRANCH_ID,
        name: dto.name,
        price: dto.price,
        serviceTimeMinutes: dto.serviceTimeMinutes,
        requiresPrepayment: dto.requiresPrepayment,
        productType: dto.productType,
      },
      expect.anything()
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        actorType: 'user',
        action: 'product.create',
        resourceType: 'product',
        resourceId: PRODUCT_ID,
        organizationId: ORG_ID,
      })
    );
  });

  it('updates a product and writes old/new audit data', async () => {
    const existing = makeProduct();
    const updated = makeProduct({ name: 'Premium Haircut' });
    mockFindById.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(updated);

    await expect(
      productsService.update(
        PRODUCT_ID,
        scope,
        { name: 'Premium Haircut' },
        { actorUserId: ACTOR_ID }
      )
    ).resolves.toEqual(updated);

    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        action: 'product.update',
        changes: { old: existing, new: updated },
      })
    );
  });

  it('rejects enabling prepayment on a zero-price product', async () => {
    mockFindById.mockResolvedValue(makeProduct({ price: '0' }));

    await expect(
      productsService.update(PRODUCT_ID, scope, { requiresPrepayment: true })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('clears finite stock when a product is converted to a service', async () => {
    const existing = makeProduct({ product_type: 'product', stock_quantity: 5 });
    const updated = makeProduct({ product_type: 'service', stock_quantity: null });
    mockFindById.mockResolvedValue(existing);
    mockUpdate.mockResolvedValue(updated);

    await productsService.update(PRODUCT_ID, scope, { productType: 'service' });

    expect(mockUpdate).toHaveBeenCalledWith(
      PRODUCT_ID,
      expect.objectContaining({ productType: 'service', stockQuantity: null }),
      expect.anything()
    );
  });

  it('soft deletes a product and writes an audit log', async () => {
    const existing = makeProduct();
    mockFindById.mockResolvedValue(existing);
    mockSoftDelete.mockResolvedValue(undefined);

    await productsService.remove(PRODUCT_ID, scope, { actorUserId: ACTOR_ID });

    expect(mockSoftDelete).toHaveBeenCalledWith(PRODUCT_ID);
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'user',
        action: 'product.delete',
        changes: { old: existing, new: { is_active: false } },
      })
    );
  });
});
