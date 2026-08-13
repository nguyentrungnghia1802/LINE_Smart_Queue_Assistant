const lineEnvironmentKeys = [
  'LINE_LOGIN_CHANNEL_ID',
  'LINE_LOGIN_LIFF_ID',
  'LINE_MESSAGING_CHANNEL_SECRET',
  'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN',
  'LINE_CHANNEL_ID',
  'LINE_LIFF_ID',
  'LINE_CHANNEL_SECRET',
  'LINE_CHANNEL_ACCESS_TOKEN',
] as const;

const originalEnvironment = Object.fromEntries(
  lineEnvironmentKeys.map((key) => [key, process.env[key]])
);

function setLineEnvironment(values: Partial<Record<(typeof lineEnvironmentKeys)[number], string>>) {
  for (const key of lineEnvironmentKeys) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
}

function loadLineConfig() {
  jest.resetModules();
  let lineConfig: typeof import('../index').config.line | undefined;
  jest.isolateModules(() => {
    lineConfig = jest.requireActual<typeof import('../index')>('../index').config.line;
  });
  if (!lineConfig) throw new Error('LINE configuration did not load');
  return lineConfig;
}

afterAll(() => {
  for (const key of lineEnvironmentKeys) {
    const originalValue = originalEnvironment[key];
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
});

describe('LINE credential namespaces', () => {
  it('prefers channel-specific variable names', () => {
    setLineEnvironment({
      LINE_LOGIN_CHANNEL_ID: 'login-channel-new',
      LINE_LOGIN_LIFF_ID: 'login-liff-new',
      LINE_MESSAGING_CHANNEL_SECRET: 'messaging-secret-new',
      LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: 'messaging-token-new',
      LINE_CHANNEL_ID: 'legacy-login-channel',
      LINE_LIFF_ID: 'legacy-liff',
      LINE_CHANNEL_SECRET: 'legacy-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'legacy-token',
    });

    const line = loadLineConfig();

    expect(line.loginChannelId).toBe('login-channel-new');
    expect(line.loginLiffId).toBe('login-liff-new');
    expect(line.messagingChannelSecret).toBe('messaging-secret-new');
    expect(line.messagingChannelSecretSource).toBe('LINE_MESSAGING_CHANNEL_SECRET');
    expect(line.messagingChannelAccessToken).toBe('messaging-token-new');
  });

  it('keeps legacy names as a deployment migration fallback', () => {
    setLineEnvironment({
      LINE_CHANNEL_ID: 'legacy-login-channel',
      LINE_LIFF_ID: 'legacy-liff',
      LINE_CHANNEL_SECRET: 'legacy-secret',
      LINE_CHANNEL_ACCESS_TOKEN: 'legacy-token',
    });

    const line = loadLineConfig();

    expect(line.loginChannelId).toBe('legacy-login-channel');
    expect(line.loginLiffId).toBe('legacy-liff');
    expect(line.messagingChannelSecret).toBe('legacy-secret');
    expect(line.messagingChannelSecretSource).toBe('LINE_CHANNEL_SECRET (legacy)');
    expect(line.messagingChannelAccessToken).toBe('legacy-token');
  });
});
