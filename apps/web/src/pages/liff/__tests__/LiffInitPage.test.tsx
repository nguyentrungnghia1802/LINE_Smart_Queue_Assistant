import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LiffRuntimeProvider } from '../../../contexts/LiffRuntimeContext';
import type { LiffContext } from '../../../types/liff';
import { normalizeLiffState } from '../../../utils/liffState';
import { LiffInitPage } from '../LiffInitPage';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function makeLiffContext(): LiffContext {
  return {
    initStatus: 'ready',
    authStatus: 'authenticated',
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
  };
}

describe('LiffInitPage', () => {
  beforeEach(() => {
    navigateMock.mockClear();
  });

  it('normalizes safe LIFF state paths', () => {
    expect(normalizeLiffState('%2Fliff%2Fqr%2Fdemo-token')).toBe('/liff/qr/demo-token');
    expect(normalizeLiffState('/liff/tickets/entry-1')).toBe('/liff/tickets/entry-1');
  });

  it('rejects unsafe or unrelated state paths', () => {
    expect(normalizeLiffState('https://example.com/liff/qr/demo')).toBeNull();
    expect(normalizeLiffState('/admin')).toBeNull();
    expect(normalizeLiffState('//example.com/liff/qr/demo')).toBeNull();
  });

  it('redirects to the target carried by liff.state', async () => {
    window.history.pushState({}, '', '/liff?liff.state=%2Fliff%2Fqr%2Fdemo-token');

    render(
      <MemoryRouter initialEntries={['/liff?liff.state=%2Fliff%2Fqr%2Fdemo-token']}>
        <LiffRuntimeProvider value={makeLiffContext()}>
          <LiffInitPage />
        </LiffRuntimeProvider>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/liff/qr/demo-token', { replace: true })
    );
  });
});
