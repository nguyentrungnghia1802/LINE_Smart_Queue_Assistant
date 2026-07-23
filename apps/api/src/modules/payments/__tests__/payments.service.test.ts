import { pool } from '../../../db/client';
import { organizationsRepository } from '../../../db/repositories/organizations.repository';
import { paymentTransactionsRepository } from '../../../db/repositories/payment-transactions.repository';
import { productsRepository } from '../../../db/repositories/products.repository';
import { canApplyPaymentEvent, paymentsService, resolveRefundState } from '../payments.service';

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
    jest
      .mocked(paymentTransactionsRepository.findByIdForUpdate)
      .mockResolvedValue(baseTransaction as never);
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

  it('rejects stale and regressive provider transitions', () => {
    const latest = new Date('2026-07-16T10:00:00Z');
    expect(canApplyPaymentEvent('paid', 'pending', latest, new Date('2026-07-16T11:00:00Z'))).toBe(
      false
    );
    expect(canApplyPaymentEvent('pending', 'paid', latest, new Date('2026-07-16T09:00:00Z'))).toBe(
      false
    );
    expect(
      canApplyPaymentEvent('authorized', 'paid', latest, new Date('2026-07-16T11:00:00Z'))
    ).toBe(true);
  });

  it('keeps partial refunds paid and marks full refunds refunded', () => {
    expect(resolveRefundState(1500, 500)).toEqual({ status: 'paid', refundedAmount: 500 });
    expect(resolveRefundState(1500, 1500)).toEqual({ status: 'refunded', refundedAmount: 1500 });
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

  it('casts refund states to the PostgreSQL payment_status enum', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'item-1', prepaid_amount: '1500.00' }] })
      .mockResolvedValue({ rows: [] });

    await paymentsService.reconcileTransactionInClient(
      {
        ...baseTransaction,
        status: 'refunded',
        order_id: '33333333-3333-4333-8333-333333333333',
        amount: '1500.00',
        refunded_amount: '1500.00',
        metadata: {
          scope: 'all_items',
          coveredProductIds: [prepaidProduct.id],
        },
      } as never,
      { query } as never
    );

    const statements = query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes("'refunded'::payment_status"))).toBe(true);
    expect(statements.some((sql) => sql.includes("'paid'::payment_status"))).toBe(true);
  });

  it('backfills an audited manual transaction before refunding a legacy paid order', async () => {
    const orderId = '33333333-3333-4333-8333-333333333333';
    const actorId = '55555555-5555-4555-8555-555555555555';
    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: orderId,
              organization_id: org.id,
              subtotal: '2000.00',
              payment_status: 'paid',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ product_id: prepaidProduct.id }, { product_id: normalProduct.id }],
        })
        .mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    };
    const paidManualTransaction = {
      ...baseTransaction,
      order_id: orderId,
      provider: 'manual',
      method: 'cash_or_terminal',
      status: 'paid',
      amount: '2000.00',
      metadata: {
        scope: 'all_items',
        coveredProductIds: [prepaidProduct.id, normalProduct.id],
      },
    };
    const refundedTransaction = {
      ...paidManualTransaction,
      status: 'refunded',
      refunded_amount: '2000.00',
    };

    jest.mocked(pool.connect).mockResolvedValue(client as never);
    jest.mocked(paymentTransactionsRepository.findLatestByOrder).mockResolvedValue(null);
    jest
      .mocked(paymentTransactionsRepository.createManual)
      .mockResolvedValue(paidManualTransaction as never);
    jest.mocked(paymentTransactionsRepository.recordReconciliation).mockResolvedValue(true);
    jest
      .mocked(paymentTransactionsRepository.updateStatus)
      .mockResolvedValue(refundedTransaction as never);
    const reconcileSpy = jest
      .spyOn(paymentsService, 'reconcileTransactionInClient')
      .mockResolvedValue(undefined);

    const result = await paymentsService.manualReconcileOrder({
      orderId,
      organizationId: org.id,
      actorId,
      status: 'refunded',
      reason: 'Customer refund',
      idempotencyKey: 'refund-legacy-order',
    });

    expect(paymentTransactionsRepository.createManual).toHaveBeenCalledWith(
      {
        organizationId: org.id,
        orderId,
        amount: 2000,
        method: 'cash_or_terminal',
        coveredProductIds: [prepaidProduct.id, normalProduct.id],
      },
      client
    );
    expect(reconcileSpy).toHaveBeenNthCalledWith(1, paidManualTransaction, client);
    expect(paymentTransactionsRepository.recordReconciliation).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'legacy_paid_backfill',
        actorId,
        idempotencyKey: 'refund-legacy-order:paid-backfill',
      }),
      client
    );
    expect(paymentTransactionsRepository.updateStatus).toHaveBeenCalledWith(
      paidManualTransaction.id,
      expect.objectContaining({ status: 'refunded', refundedAmount: 2000 }),
      client
    );
    expect(result.status).toBe('refunded');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });
});
