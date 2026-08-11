describe('payment runtime configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('starts in demo mode without real PSP credentials', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      PAYMENT_MODE: 'demo',
      MEDIA_STORAGE_PROVIDER: 'mock',
    };
    delete process.env.PAYOS_CLIENT_ID;
    delete process.env.PAYOS_API_KEY;
    delete process.env.PAYOS_CHECKSUM_KEY;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require('../index') as typeof import('../index');
      expect(config.payments).toMatchObject({
        mode: 'demo',
        payos: { clientId: '', apiKey: '', checksumKey: '' },
      });
    });
  });

  it('fails safely when external mode is enabled without required credentials', () => {
    process.env = {
      ...originalEnv,
      PAYMENT_MODE: 'external',
      MEDIA_STORAGE_PROVIDER: 'mock',
    };
    delete process.env.PAYOS_CLIENT_ID;
    delete process.env.PAYOS_API_KEY;
    delete process.env.PAYOS_CHECKSUM_KEY;

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../index');
      });
    }).toThrow(
      'PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY must be set when PAYMENT_MODE=external'
    );
  });

  it('accepts external mode only when all required payOS credentials are present', () => {
    process.env = {
      ...originalEnv,
      PAYMENT_MODE: 'external',
      PAYOS_CLIENT_ID: 'test-client-id',
      PAYOS_API_KEY: 'test-api-key',
      PAYOS_CHECKSUM_KEY: 'test-checksum-key',
      MEDIA_STORAGE_PROVIDER: 'mock',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require('../index') as typeof import('../index');
      expect(config.payments.mode).toBe('external');
      expect(config.payments.payos).toEqual({
        clientId: 'test-client-id',
        apiKey: 'test-api-key',
        checksumKey: 'test-checksum-key',
      });
    });
  });

  it('rejects unknown payment modes instead of silently selecting a provider', () => {
    process.env = {
      ...originalEnv,
      PAYMENT_MODE: 'production',
      MEDIA_STORAGE_PROVIDER: 'mock',
    };

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../index');
      });
    }).toThrow('PAYMENT_MODE must be demo or external');
  });
});
