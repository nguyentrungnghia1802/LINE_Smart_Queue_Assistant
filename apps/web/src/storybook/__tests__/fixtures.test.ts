import { describe, expect, it } from 'vitest';

import { friendshipContext, queueFixtures, ticketFixtures } from '../fixtures';

describe('Storybook fixtures', () => {
  it('covers the reusable queue and ticket states without external data', () => {
    expect(queueFixtures.active.status).toBe('open');
    expect(queueFixtures.paused.status).toBe('paused');
    expect(ticketFixtures.waiting.entry.status).toBe('waiting');
    expect(ticketFixtures.called.entry.status).toBe('called');
  });

  it('provides deterministic LIFF friendship contexts', async () => {
    expect(friendshipContext('not_friend').friendshipStatus).toBe('not_friend');
    await expect(friendshipContext('friend').requestFriendship()).resolves.toBe(false);
  });
});
