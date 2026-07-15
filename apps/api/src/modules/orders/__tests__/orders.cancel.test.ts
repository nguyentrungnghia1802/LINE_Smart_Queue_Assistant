/**
 * Unit tests for ordersService.cancelByOrderId.
 *
 * Verifies:
 *   1. Throws 404 when order not found.
 *   2. Throws 409 when order is already completed/cancelled.
 *   3. Throws 403 when actorUserId doesn't match customer_user_id (authenticated order).
 *   4. Cancels order and linked queue entry for anonymous orders.
 *   5. Cancels order and linked queue entry for authenticated orders (matching user).
 */
import { ordersRepository } from '../../../db/repositories/orders.repository';
import type { QueueEntryRow } from '../../../db/repositories/queue-entries.repository';
import { queueEntriesRepository } from '../../../db/repositories/queue-entries.repository';
import { ordersService } from '../orders.service';

jest.mock('../../../db/repositories/orders.repository');
jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/products.repository');
jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/queues.repository');

const mockFindById = ordersRepository.findById as jest.MockedFunction<
  typeof ordersRepository.findById
>;
const mockUpdateStatus = ordersRepository.updateStatus as jest.MockedFunction<
  typeof ordersRepository.updateStatus
>;
const mockMarkCancelled = queueEntriesRepository.markCancelled as jest.MockedFunction<
  typeof queueEntriesRepository.markCancelled
>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORDER_ID = 'order-uuid-001';
const ENTRY_ID = 'entry-uuid-001';
const USER_ID = 'user-uuid-001';
const cancelledEntry: QueueEntryRow = {
  id: ENTRY_ID,
  queue_id: 'queue-uuid-001',
  user_id: USER_ID,
  order_id: null,
  line_user_id: null,
  ticket_number: 1,
  ticket_code: 'A001',
  status: 'cancelled',
  priority: 0,
  position_snapshot: null,
  called_at: null,
  serving_started_at: null,
  served_at: null,
  skipped_at: null,
  cancelled_at: new Date(),
  no_show_at: null,
  estimated_wait_seconds: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeOrder(
  overrides: Partial<{
    status: string;
    customer_user_id: string | null;
    queue_entry_id: string | null;
  }> = {}
) {
  return {
    id: ORDER_ID,
    organization_id: 'org-001',
    queue_entry_id: ENTRY_ID,
    order_number: 'A001',
    customer_name: 'Test',
    customer_user_id: null,
    customer_phone: null,
    status: 'pending',
    subtotal: '120000',
    payment_status: 'unpaid',
    payment_code: null,
    notes: null,
    created_at: new Date(),
    updated_at: new Date(),
    items: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ordersService.cancelByOrderId', () => {
  const operatorActor = { userId: 'staff-uuid-001', role: 'staff', organizationId: 'org-001' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMarkCancelled.mockResolvedValue(cancelledEntry);
    mockUpdateStatus.mockResolvedValue({ ...makeOrder(), status: 'cancelled' });
  });

  it('throws 404 when order not found', async () => {
    mockFindById.mockResolvedValue(null);

    await expect(ordersService.cancelByOrderId('nonexistent')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 409 when order is already completed', async () => {
    mockFindById.mockResolvedValue(makeOrder({ status: 'completed', customer_user_id: USER_ID }));

    await expect(ordersService.cancelByOrderId(ORDER_ID, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 409 when order is already cancelled', async () => {
    mockFindById.mockResolvedValue(makeOrder({ status: 'cancelled', customer_user_id: USER_ID }));

    await expect(ordersService.cancelByOrderId(ORDER_ID, USER_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('throws 403 when actorUserId does not match customer_user_id', async () => {
    mockFindById.mockResolvedValue(makeOrder({ customer_user_id: 'other-user-id' }));

    await expect(ordersService.cancelByOrderId(ORDER_ID, USER_ID)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('throws 401 when actor is missing', async () => {
    mockFindById.mockResolvedValue(makeOrder({ customer_user_id: null }));

    await expect(ordersService.cancelByOrderId(ORDER_ID)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('allows an operator to cancel an anonymous order inside the same organization', async () => {
    mockFindById.mockResolvedValue(makeOrder({ customer_user_id: null }));

    await ordersService.cancelByOrderId(ORDER_ID, operatorActor);

    expect(mockUpdateStatus).toHaveBeenCalledWith(ORDER_ID, 'cancelled');
    expect(mockMarkCancelled).toHaveBeenCalledWith(ENTRY_ID);
  });

  it('cancels authenticated order when actorUserId matches', async () => {
    mockFindById.mockResolvedValue(makeOrder({ customer_user_id: USER_ID }));

    await ordersService.cancelByOrderId(ORDER_ID, USER_ID);

    expect(mockUpdateStatus).toHaveBeenCalledWith(ORDER_ID, 'cancelled');
    expect(mockMarkCancelled).toHaveBeenCalledWith(ENTRY_ID);
  });

  it('does not throw when queue entry cancel fails (non-fatal)', async () => {
    mockFindById.mockResolvedValue(makeOrder());
    mockMarkCancelled.mockRejectedValue(new Error('Entry already cancelled'));

    // Should NOT throw — entry cancel failure is non-fatal
    await expect(ordersService.cancelByOrderId(ORDER_ID, operatorActor)).resolves.not.toThrow();
    expect(mockUpdateStatus).toHaveBeenCalledWith(ORDER_ID, 'cancelled');
  });

  it('handles order with no queue_entry_id gracefully', async () => {
    mockFindById.mockResolvedValue(makeOrder({ queue_entry_id: null }));

    await ordersService.cancelByOrderId(ORDER_ID, operatorActor);

    expect(mockUpdateStatus).toHaveBeenCalledWith(ORDER_ID, 'cancelled');
    expect(mockMarkCancelled).not.toHaveBeenCalled();
  });
});
