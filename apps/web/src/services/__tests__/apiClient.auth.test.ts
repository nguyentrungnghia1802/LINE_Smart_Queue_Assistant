import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient, ApiClientError, get } from '../apiClient';

const auth = vi.hoisted(() => ({
  token: 'expired-token' as string | null,
  refreshAuthSession: vi.fn(),
  terminateAuthSession: vi.fn().mockResolvedValue(undefined),
  isAuthSessionTerminated: vi.fn().mockReturnValue(false),
}));

vi.mock('../../store/authSession', () => ({
  getAuthToken: () => auth.token,
  refreshAuthSession: auth.refreshAuthSession,
  terminateAuthSession: auth.terminateAuthSession,
  isAuthSessionTerminated: auth.isAuthSessionTerminated,
}));

const refreshedSession = {
  token: 'new-access-token',
  user: { id: 'staff-1', role: 'staff' },
  session: {
    kind: 'business' as const,
    idleTimeoutSeconds: 900,
    absoluteExpiresAt: '2030-01-01T00:00:00.000Z',
  },
};

describe('apiClient authentication interceptor', () => {
  beforeEach(() => {
    auth.token = 'expired-token';
    auth.refreshAuthSession.mockReset();
    auth.terminateAuthSession.mockReset().mockResolvedValue(undefined);
    auth.isAuthSessionTerminated.mockReset().mockReturnValue(false);
  });

  it('refreshes the access token and retries the failed request once', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    auth.refreshAuthSession.mockImplementationOnce(async () => {
      auth.token = refreshedSession.token;
      return refreshedSession;
    });
    apiClient.defaults.adapter = async (config) => {
      requests.push(config);
      if (requests.length === 1) return reject401(config, 'UNAUTHORIZED', 'Expired JWT');
      return success(config, { ok: true });
    };

    await expect(get<{ ok: boolean }>('/api/v1/private')).resolves.toEqual({ ok: true });

    expect(auth.refreshAuthSession).toHaveBeenCalledTimes(1);
    expect(requests).toHaveLength(2);
    expect(requests[1]?.headers.Authorization).toBe('Bearer new-access-token');
    expect(auth.terminateAuthSession).not.toHaveBeenCalled();
  });

  it('clears the session with a friendly local error when refresh fails', async () => {
    auth.refreshAuthSession.mockRejectedValueOnce(new Error('database session detail'));
    apiClient.defaults.adapter = (config) =>
      reject401(config, 'UNAUTHORIZED', 'Invalid or expired backend token');

    const request = get('/api/v1/private');

    await expect(request).rejects.toMatchObject({
      code: 'AUTH_SESSION_EXPIRED',
      status: 401,
    });
    await expect(request).rejects.not.toThrow('Invalid or expired backend token');
    expect(auth.terminateAuthSession).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the backend requires a new session', async () => {
    apiClient.defaults.adapter = (config) =>
      reject401(config, 'AUTH_SESSION_REQUIRED', 'Refresh session is required');

    await expect(get('/api/v1/private')).rejects.toBeInstanceOf(ApiClientError);

    expect(auth.refreshAuthSession).not.toHaveBeenCalled();
    expect(auth.terminateAuthSession).toHaveBeenCalledTimes(1);
  });

  it('does not enter a refresh loop when the retried request is still unauthorized', async () => {
    let requestCount = 0;
    auth.refreshAuthSession.mockImplementationOnce(async () => {
      auth.token = refreshedSession.token;
      return refreshedSession;
    });
    apiClient.defaults.adapter = (config) => {
      requestCount += 1;
      return reject401(config, 'UNAUTHORIZED', 'Still unauthorized');
    };

    await expect(get('/api/v1/private')).rejects.toMatchObject({
      code: 'AUTH_SESSION_EXPIRED',
    });

    expect(requestCount).toBe(2);
    expect(auth.refreshAuthSession).toHaveBeenCalledTimes(1);
    expect(auth.terminateAuthSession).toHaveBeenCalledTimes(1);
  });

  it('normalizes a plain-text upstream 502 without reading a missing error code', async () => {
    apiClient.defaults.adapter = (config) =>
      Promise.reject(
        new AxiosError(
          'Request failed with status code 502',
          'ERR_BAD_RESPONSE',
          config,
          undefined,
          {
            data: 'error code: 502',
            status: 502,
            statusText: 'Bad Gateway',
            headers: { 'content-type': 'text/plain' },
            config,
          }
        )
      );

    await expect(get('/api/v1/health')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 502,
    });
    expect(auth.refreshAuthSession).not.toHaveBeenCalled();
    expect(auth.terminateAuthSession).not.toHaveBeenCalled();
  });

  it('normalizes a malformed non-server error response without exposing transport text', async () => {
    apiClient.defaults.adapter = (config) =>
      Promise.reject(
        new AxiosError('unsafe proxy detail', 'ERR_BAD_RESPONSE', config, undefined, {
          data: { success: false },
          status: 429,
          statusText: 'Too Many Requests',
          headers: {},
          config,
        })
      );

    await expect(get('/api/v1/public')).rejects.toMatchObject({
      code: 'UNKNOWN',
      status: 429,
    });
  });
});

function success<T>(config: InternalAxiosRequestConfig, data: T) {
  return Promise.resolve({
    data: { success: true as const, data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  });
}

function reject401(config: InternalAxiosRequestConfig, code: string, message: string) {
  return Promise.reject(
    new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
      data: { success: false as const, error: { code, message } },
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config,
    })
  );
}
