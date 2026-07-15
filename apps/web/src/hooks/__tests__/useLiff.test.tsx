import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useLiff', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  async function loadHook({
    loggedIn = true,
    idToken = 'line-id-token',
    mockMode = true,
    loginWithLine = vi.fn().mockResolvedValue(undefined),
  }: {
    loggedIn?: boolean;
    idToken?: string | null;
    mockMode?: boolean;
    loginWithLine?: ReturnType<typeof vi.fn>;
  } = {}) {
    const liffLogin = vi.fn();
    vi.doMock('../../services/liff', () => ({
      isLiffMockMode: mockMode,
      liffAdapter: {
        init: vi.fn().mockResolvedValue(undefined),
        isLoggedIn: vi.fn(() => loggedIn),
        isInClient: vi.fn(() => false),
        getProfile: vi.fn().mockResolvedValue({ userId: 'U123', displayName: 'Taro' }),
        getAccessToken: vi.fn(() => 'line-access-token'),
        getIDToken: vi.fn(() => idToken),
        login: liffLogin,
        logout: vi.fn(),
      },
    }));
    vi.doMock('../../store/authStore', () => ({
      useAuthStore: () => ({ loginWithLine }),
    }));

    if (!mockMode) {
      vi.stubEnv('VITE_LIFF_ID', '1234567890-AbCdEfGh');
    }

    const { useLiff } = await import('../useLiff');
    return { useLiff, loginWithLine, liffLogin };
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('exchanges the LIFF ID token for the system JWT on initialization', async () => {
    const { useLiff, loginWithLine } = await loadHook();

    const { result } = renderHook(() => useLiff());

    await waitFor(() => expect(result.current.authStatus).toBe('authenticated'));
    expect(loginWithLine).toHaveBeenCalledWith('line-id-token');
    expect(result.current.profile?.displayName).toBe('Taro');
  });

  it('marks LIFF auth as error when backend LINE auth fails', async () => {
    const loginWithLine = vi.fn().mockRejectedValue(new Error('LINE auth failed'));
    const { useLiff } = await loadHook({ loginWithLine });

    const { result } = renderHook(() => useLiff());

    await waitFor(() => expect(result.current.authStatus).toBe('error'));
    expect(result.current.authError?.message).toBe('LINE auth failed');
    expect(result.current.initStatus).toBe('ready');
  });

  it('starts LINE Login automatically in real LIFF mode when signed out', async () => {
    const { useLiff, liffLogin } = await loadHook({ loggedIn: false, mockMode: false });

    renderHook(() => useLiff());

    await waitFor(() => expect(liffLogin).toHaveBeenCalledTimes(1));
  });
});
