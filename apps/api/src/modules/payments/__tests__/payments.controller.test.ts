import type { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { createPaymentIntent, reconcilePayment } from '../payments.controller';
import { paymentsService } from '../payments.service';

jest.mock('../payments.service');

const mockCreateIntent = paymentsService.createIntent as jest.MockedFunction<
  typeof paymentsService.createIntent
>;
const mockReconcile = paymentsService.reconcile as jest.MockedFunction<
  typeof paymentsService.reconcile
>;
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

function makeResponse(): Response {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

describe('createPaymentIntent controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateIntent.mockResolvedValue({ id: 'payment-001' } as never);
  });

  it('allows a customer with verified LINE identity', async () => {
    const body = { orgSlug: 'store', items: [] };
    const req = {
      body,
      user: {
        id: 'customer-001',
        role: UserRole.CUSTOMER,
        lineUserId: 'U1234567890',
      },
    } as unknown as Request;
    const next = jest.fn();

    createPaymentIntent(req, makeResponse(), next);
    await flushPromises();

    expect(next).not.toHaveBeenCalled();
    expect(mockCreateIntent).toHaveBeenCalledWith(body);
  });

  it('rejects a customer without verified LINE identity', async () => {
    const req = {
      body: { orgSlug: 'store', items: [] },
      user: { id: 'customer-001', role: UserRole.CUSTOMER },
    } as unknown as Request;
    const next = jest.fn();

    createPaymentIntent(req, makeResponse(), next);
    await flushPromises();

    expect(mockCreateIntent).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'LINE_ACCOUNT_REQUIRED' })
    );
  });
});

describe('reconcilePayment controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReconcile.mockResolvedValue({ id: 'payment-001' } as never);
  });

  it('passes the assigned branch scope for a branch manager', async () => {
    const req = {
      params: { transactionId: 'payment-001' },
      user: {
        id: 'manager-001',
        role: UserRole.MANAGER,
        organizationId: 'org-001',
        branchIds: ['branch-001'],
        isOrganizationOwner: false,
      },
    } as unknown as Request;
    const next = jest.fn();

    reconcilePayment(req, makeResponse(), next);
    await flushPromises();

    expect(next).not.toHaveBeenCalled();
    expect(mockReconcile).toHaveBeenCalledWith('payment-001', {
      organizationId: 'org-001',
      branchId: 'branch-001',
    });
  });

  it('rejects an organization owner manager', async () => {
    const req = {
      params: { transactionId: 'payment-001' },
      user: {
        id: 'owner-001',
        role: UserRole.MANAGER,
        organizationId: 'org-001',
        branchIds: [],
        isOrganizationOwner: true,
      },
    } as unknown as Request;
    const next = jest.fn();

    reconcilePayment(req, makeResponse(), next);
    await flushPromises();

    expect(mockReconcile).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'FORBIDDEN' })
    );
  });
});
