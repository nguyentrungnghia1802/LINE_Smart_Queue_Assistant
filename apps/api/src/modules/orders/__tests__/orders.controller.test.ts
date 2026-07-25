import type { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { createOrder } from '../orders.controller';
import { ordersService } from '../orders.service';

jest.mock('../orders.service');

const mockCreate = ordersService.create as jest.MockedFunction<typeof ordersService.create>;
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

function makeResponse(): Response {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json } as unknown as Response;
}

describe('createOrder controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue({
      order: { id: 'order-001' },
      entry: { id: 'entry-001' },
    } as never);
  });

  it('forwards the verified LINE identity to the order service', async () => {
    const dto = { orgSlug: 'smart-queue', items: [] };
    const req = {
      body: dto,
      user: {
        id: 'user-001',
        lineUserId: 'U1234567890',
        role: UserRole.CUSTOMER,
      },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn();

    createOrder(req, res, next);
    await flushPromises();

    expect(next).not.toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledWith(dto, {
      userId: 'user-001',
      lineUserId: 'U1234567890',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects order creation without LINE authentication', async () => {
    const dto = { orgSlug: 'smart-queue', items: [] };
    const req = { body: dto } as Request;
    const res = makeResponse();
    const next = jest.fn();

    createOrder(req, res, next);
    await flushPromises();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, code: 'LINE_AUTH_REQUIRED' })
    );
  });

  it('rejects a customer JWT that is not linked to LINE', async () => {
    const req = {
      body: { orgSlug: 'smart-queue', items: [] },
      user: { id: 'customer-001', role: UserRole.CUSTOMER },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn();

    createOrder(req, res, next);
    await flushPromises();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'LINE_ACCOUNT_REQUIRED' })
    );
  });

  it('rejects a business account before creating a customer booking', async () => {
    const req = {
      body: { orgSlug: 'smart-queue', items: [] },
      user: { id: 'staff-001', role: UserRole.STAFF },
    } as unknown as Request;
    const res = makeResponse();
    const next = jest.fn();

    createOrder(req, res, next);
    await flushPromises();

    expect(mockCreate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'CUSTOMER_ACCOUNT_REQUIRED' })
    );
  });
});
