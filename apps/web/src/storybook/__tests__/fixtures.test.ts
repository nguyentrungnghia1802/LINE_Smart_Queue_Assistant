import { describe, expect, it } from 'vitest';

import { friendshipContext, orderFixtures, queueFixtures, ticketFixtures } from '../fixtures';

describe('Storybook fixtures', () => {
  it('covers the reusable queue and ticket states without external data', () => {
    expect(queueFixtures.active.status).toBe('open');
    expect(queueFixtures.paused.status).toBe('paused');
    expect(queueFixtures.closed.status).toBe('closed');
    expect(ticketFixtures.waiting.entry.status).toBe('waiting');
    expect(ticketFixtures.called.entry.status).toBe('called');
    expect(ticketFixtures.completed.entry.status).toBe('served');
    expect(orderFixtures.partiallyPaid.payment_status).toBe('unpaid');
    expect(orderFixtures.paid.payment_status).toBe('paid');
  });

  it('provides deterministic LIFF friendship contexts', async () => {
    expect(friendshipContext('not_friend').friendshipStatus).toBe('not_friend');
    await expect(friendshipContext('friend').requestFriendship()).resolves.toBe(false);
  });
});
