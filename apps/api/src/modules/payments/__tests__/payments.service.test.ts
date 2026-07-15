import { pool } from '../../../db/client';
import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { paymentTransactionsRepository } from '../../../db/repositories/payment-transactions.repository';
import { productsRepository } from '../../../db/repositories/products.repository';
import { paymentsService } from '../payments.service';

jest.mock('../../../db/client', () => ({
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../../../db/repositories/payment-transactions.repository');
jest.mock('../../../db/repositories/organizations.repository');
jest.mock('../../../db/repositories/products.repository');

const org = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'demo-shop',
};

const prepaidProduct = {
  id: '44444444-4444-4444-8444-444444444441',
  organization_id: org.id,
  name: '前払いサービス',
  price: '1500',
  is_active: true,
  requires_prepayment: true,
  stock_quantity: 10,
};

const normalProduct = {
  id: '44444444-4444-4444-8444-444444444442',
  organization_id: org.id,
  name: '通常商品',
  price: '500',
  is_active: true,
  requires_prepayment: false,
  stock_quantity: null,
};

const baseTransaction = {
  id: '22222222-2222-4222-8222-222222222222',
  organization_id: org.id,
  order_id: null,
  provider: 'demo',
  method: 'credit_card',
  payment_intent_id: null,
  external_transaction_id: null,
  status: 'pending',
  amount: '1500.00',
  currency: 'JPY',
  redirect_url: null,
  checkout_url: null,
  return_url: null,
  metadata: {},
  raw_payload: {},
  paid_at: null,
  refunded_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('paymentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(organizationsRepository.findBySlug).mockResolvedValue(org as never);
    jest.mocked(productsRepository.findById).mockImplementation(async (id: string) => {
      if (id === prepaidProduct.id) return prepaidProduct as never;
      if (id === normalProduct.id) return normalProduct as never;
      return null;
    });
    jest
      .mocked(paymentTransactionsRepository.createIntent)
      .mockResolvedValue(baseTransaction as never);
    jest
      .mocked(paymentTransactionsRepository.updateProviderIntent)
      .mockImplementation(
        async (_id, data) => ({ ...baseTransaction, ...data, status: data.status }) as never
      );
  });

  it('creates a server-side payment intent from product prices and prepayment rules', async () => {
    const intent = await paymentsService.createIntent({
      orgSlug: org.slug,
      items: [
        { productId: prepaidProduct.id, quantity: 1 },
        { productId: normalProduct.id, quantity: 1 },
      ],
      scope: 'required_items',
      provider: 'demo',
      method: 'credit_card',
      currency: 'JPY',
    });

    expect(paymentTransactionsRepository.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: org.id,
        provider: 'demo',
        amount: 1500,
        status: 'pending',
      })
    );
    expect(intent.status).toBe('pending');
    expect(intent.coveredProductIds).toEqual([prepaidProduct.id]);
    expect(intent.demoToken).toHaveLength(64);
  });

  it('does not process duplicate webhook events twice', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    jest.mocked(pool.connect).mockResolvedValue(client as never);
    jest.mocked(paymentTransactionsRepository.findById).mockResolvedValue(baseTransaction as never);
    jest.mocked(paymentTransactionsRepository.insertWebhookEvent).mockResolvedValue({
      row: {} as never,
      inserted: false,
    });

    const result = await paymentsService.applyProviderEvent('demo', {
      eventId: 'evt_duplicate',
      eventType: 'demo.payment.paid',
      transactionId: baseTransaction.id,
      status: 'paid',
      rawPayload: { eventId: 'evt_duplicate' },
    });

    expect(result.duplicate).toBe(true);
    expect(paymentTransactionsRepository.updateStatus).not.toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('reconciles paid all-item transactions to order and item payment state', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await paymentsService.reconcileTransactionInClient(
      {
        ...baseTransaction,
        status: 'paid',
        order_id: '33333333-3333-4333-8333-333333333333',
        metadata: {
          scope: 'all_items',
          coveredProductIds: [prepaidProduct.id, normalProduct.id],
        },
      } as never,
      { query } as never
    );

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE order_items'), [
      baseTransaction.id,
      [prepaidProduct.id, normalProduct.id],
      true,
      '33333333-3333-4333-8333-333333333333',
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE orders'), [
      '33333333-3333-4333-8333-333333333333',
    ]);
  });
});
