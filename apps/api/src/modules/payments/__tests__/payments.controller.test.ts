import type { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { createPaymentIntent } from '../payments.controller';
import { paymentsService } from '../payments.service';

jest.mock('../payments.service');

const mockCreateIntent = paymentsService.createIntent as jest.MockedFunction<
  typeof paymentsService.createIntent
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
