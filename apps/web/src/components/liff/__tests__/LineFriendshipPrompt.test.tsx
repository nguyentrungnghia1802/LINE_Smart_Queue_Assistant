import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LiffRuntimeProvider } from '../../../contexts/LiffRuntimeContext';
import type { LiffContext } from '../../../types/liff';
import { LineFriendshipPrompt } from '../LineFriendshipPrompt';

function liffContext(overrides: Partial<LiffContext> = {}): LiffContext {
  return {
    initStatus: 'ready',
    authStatus: 'authenticated',
    friendshipStatus: 'not_friend',
    isInitialized: true,
    isLoggedIn: true,
    isInClient: true,
    profile: { userId: 'U123', displayName: 'Taro' },
    accessToken: 'access-token',
    idToken: 'id-token',
    error: null,
    authError: null,
    login: vi.fn(),
    logout: vi.fn(),
    refreshFriendship: vi.fn().mockResolvedValue(false),
    requestFriendship: vi.fn().mockResolvedValue(false),
    scanQrCode: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('LineFriendshipPrompt', () => {
  it('is hidden after the linked Official Account is already a friend', () => {
    const { container } = render(
      <LiffRuntimeProvider value={liffContext({ friendshipStatus: 'friend' })}>
        <LineFriendshipPrompt />
      </LiffRuntimeProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('opens the official friendship request and reports an incomplete action', async () => {
    const user = userEvent.setup();
    const requestFriendship = vi.fn().mockResolvedValue(false);
    render(
      <LiffRuntimeProvider value={liffContext({ requestFriendship })}>
        <LineFriendshipPrompt />
      </LiffRuntimeProvider>
    );

    await user.click(screen.getByRole('button'));

    expect(requestFriendship).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
