import type { Request, Response } from 'express';

import { UserRole } from '@line-queue/shared';

import { joinQueue } from '../queue.controller';
import { queueService } from '../queue.service';

jest.mock('../queue.service');

const mockJoinQueue = queueService.joinQueue as jest.MockedFunction<typeof queueService.joinQueue>;
const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('joinQueue controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a business account before joining a customer queue', async () => {
    const req = {
      body: { queueId: 'queue-001' },
      user: { id: 'manager-001', role: UserRole.MANAGER },
    } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    joinQueue(req, res, next);
    await flushPromises();

    expect(mockJoinQueue).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 403, code: 'CUSTOMER_ACCOUNT_REQUIRED' })
    );
  });
});
