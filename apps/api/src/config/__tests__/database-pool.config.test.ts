describe('PostgreSQL pool configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('uses a bounded test default and accepts an explicit per-process budget', () => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    delete process.env.DB_POOL_MAX;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require('../index') as typeof import('../index');
      expect(config.database.poolMax).toBe(2);
    });

    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DB_POOL_MAX: '7',
      DB_POOL_IDLE_TIMEOUT_MS: '12000',
      DB_POOL_CONNECTION_TIMEOUT_MS: '2500',
      MEDIA_STORAGE_PROVIDER: 'mock',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require('../index') as typeof import('../index');
      expect(config.database).toMatchObject({
        poolMax: 7,
        poolIdleTimeoutMs: 12_000,
        poolConnectionTimeoutMs: 2_500,
      });
    });
  });

  it('rejects an invalid connection budget before opening the pool', () => {
    process.env = {
      ...originalEnv,
      DB_POOL_MAX: '0',
      MEDIA_STORAGE_PROVIDER: 'mock',
    };

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../index');
      });
    }).toThrow('DB_POOL_MAX must be a positive integer');
  });
});
