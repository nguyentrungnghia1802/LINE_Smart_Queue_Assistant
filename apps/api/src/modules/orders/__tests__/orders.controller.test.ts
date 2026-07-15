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

  it('keeps guest order creation anonymous', async () => {
    const dto = { orgSlug: 'smart-queue', items: [] };
    const req = { body: dto } as Request;
    const res = makeResponse();

    createOrder(req, res, jest.fn());
    await flushPromises();

    expect(mockCreate).toHaveBeenCalledWith(dto, undefined);
  });
});
