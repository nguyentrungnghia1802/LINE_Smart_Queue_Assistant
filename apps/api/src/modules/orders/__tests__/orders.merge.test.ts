import { pool } from '../../../db/client';
import { ordersRepository } from '../../../db/repositories/orders.repository';
import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { paymentTransactionsRepository } from '../../../db/repositories/payment-transactions.repository';
import { productsRepository } from '../../../db/repositories/products.repository';
import { queueEntriesRepository } from '../../../db/repositories/queue-entries.repository';
import { queuesRepository } from '../../../db/repositories/queues.repository';
import { branchesRepository } from '../../branches/branches.repository';
import { queueNotificationService } from '../../notifications/queue-notification.service';
import { tryAutoCallNextWaiting } from '../../queue/queue-auto-call.service';
import { ordersService } from '../orders.service';

jest.mock('../../../db/repositories/orders.repository');
jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/payment-transactions.repository');
jest.mock('../../../db/repositories/products.repository');
jest.mock('../../../db/repositories/queue-entries.repository');
jest.mock('../../../db/repositories/queues.repository');
jest.mock('../../branches/branches.repository');
jest.mock('../../inventory/inventory.service');
jest.mock('../../location/location.repository');
jest.mock('../../notifications/notification-outbox.repository');
jest.mock('../../notifications/queue-notification.service');
jest.mock('../../queue/queue-auto-call.service');
jest.mock('../../../utils/cache');
jest.mock('../../../db/client', () => {
  const client = {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('COUNT(*) AS pos')) return Promise.resolve({ rows: [{ pos: '1' }] });
      return Promise.resolve({ rows: [] });
    }),
    release: jest.fn(),
  };
  return {
    pool: { connect: jest.fn().mockResolvedValue(client), query: jest.fn() },
    __client: client,
  };
});

describe('ordersService active-order merge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (organizationsRepository.findBySlug as jest.Mock).mockResolvedValue({
      id: 'org-1',
      slug: 'test-store',
    });
    (queuesRepository.findById as jest.Mock).mockResolvedValue({
      id: 'queue-1',
      organization_id: 'org-1',
      branch_id: 'branch-1',
      status: 'open',
      prefix: 'A',
      max_capacity: 10,
      avg_service_seconds: 600,
      notify_ahead_positions: 5,
    });
    (queuesRepository.lockById as jest.Mock).mockResolvedValue({
      id: 'queue-1',
      status: 'open',
      max_capacity: 10,
    });
    (branchesRepository.findById as jest.Mock).mockResolvedValue({
      id: 'branch-1',
      organization_id: 'org-1',
      latitude: null,
      longitude: null,
    });
    (branchesRepository.isOpenNow as jest.Mock).mockResolvedValue(true);
    (productsRepository.findByQueue as jest.Mock).mockResolvedValue([
      {
        id: 'product-1',
        organization_id: 'org-1',
        name: 'Cut',
        price: '1500',
        service_time_minutes: 30,
        requires_prepayment: false,
        stock_quantity: null,
        is_active: true,
      },
    ]);
    (paymentTransactionsRepository.findById as jest.Mock).mockResolvedValue(null);
    (ordersRepository.findActiveOrderForLineUserInQueue as jest.Mock).mockResolvedValue({
      order: {
        id: 'order-1',
        booking_group_id: 'group-1',
        status: 'pending',
      },
      entry: {
        id: 'entry-1',
        queue_id: 'queue-1',
        ticket_number: 7,
        ticket_code: 'A007',
        status: 'waiting',
        priority: 0,
        line_user_id: 'U001',
        user_id: 'customer-1',
      },
    });
    (ordersRepository.createItem as jest.Mock).mockResolvedValue({ id: 'item-2' });
    (ordersRepository.refreshActiveOrder as jest.Mock).mockResolvedValue({
      id: 'order-1',
      booking_group_id: 'group-1',
      queue_entry_id: 'entry-1',
      subtotal: '3000',
      payment_status: 'unpaid',
    });
    (tryAutoCallNextWaiting as jest.Mock).mockResolvedValue(null);
  });

  it('adds items to the active order without creating another order or queue entry', async () => {
    const result = await ordersService.create(
      {
        orgSlug: 'test-store',
        branchId: 'branch-1',
        queueId: 'queue-1',
        customerName: '山田太郎',
        customerPhone: '0901234567',
        items: [{ productId: 'product-1', quantity: 1 }],
      },
      { userId: 'customer-1', lineUserId: 'U001' }
    );

    expect(ordersRepository.create).not.toHaveBeenCalled();
    expect(queueEntriesRepository.create).not.toHaveBeenCalled();
    expect(queuesRepository.incrementAndGetCounter).not.toHaveBeenCalled();
    expect(queuesRepository.countWaiting).not.toHaveBeenCalled();
    expect(ordersRepository.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-1', productId: 'product-1', quantity: 1 }),
      expect.anything()
    );
    expect(ordersRepository.refreshActiveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-1',
        customerName: '山田太郎',
        customerPhone: '0901234567',
      }),
      expect.anything()
    );
    expect(queueNotificationService.notifyBookingCreated).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      order: { id: 'order-1', subtotal: '3000' },
      entry: { id: 'entry-1', ticket_code: 'A007' },
    });
    expect(pool.connect).toHaveBeenCalled();
  });
});
