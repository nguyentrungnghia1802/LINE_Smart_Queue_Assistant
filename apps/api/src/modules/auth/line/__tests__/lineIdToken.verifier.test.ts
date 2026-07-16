import { config } from '../../../../config';
import { verifyLineIdToken } from '../lineIdToken.verifier';

type MutableLineConfig = {
  idTokenVerificationMode: 'line' | 'mock';
  mockIdToken: string;
  mockUserId: string;
  mockDisplayName: string;
};

describe('verifyLineIdToken mock mode', () => {
  const runtime = config as unknown as { nodeEnv: 'development' | 'production' | 'test' };
  const line = config.line as MutableLineConfig;
  const originalNodeEnv = runtime.nodeEnv;
  const originalMode = line.idTokenVerificationMode;
  const originalToken = line.mockIdToken;
  const originalUserId = line.mockUserId;
  const originalDisplayName = line.mockDisplayName;

  beforeEach(() => {
    runtime.nodeEnv = 'test';
    line.idTokenVerificationMode = 'mock';
    line.mockIdToken = 'expected-mock-token';
    line.mockUserId = 'mock-user-e2e';
    line.mockDisplayName = 'E2Eテストユーザー';
  });

  afterAll(() => {
    runtime.nodeEnv = originalNodeEnv;
    line.idTokenVerificationMode = originalMode;
    line.mockIdToken = originalToken;
    line.mockUserId = originalUserId;
    line.mockDisplayName = originalDisplayName;
  });

  it('returns only the configured local identity for the exact mock token', async () => {
    await expect(verifyLineIdToken('expected-mock-token')).resolves.toEqual({
      lineUserId: 'mock-user-e2e',
      displayName: 'E2Eテストユーザー',
    });
  });

  it('rejects any other token without calling LINE', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(verifyLineIdToken('attacker-token')).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('cannot be enabled in production', async () => {
    runtime.nodeEnv = 'production';

    await expect(verifyLineIdToken('expected-mock-token')).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
