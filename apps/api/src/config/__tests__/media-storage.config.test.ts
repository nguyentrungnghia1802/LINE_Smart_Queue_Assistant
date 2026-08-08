describe('media storage configuration', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('supports S3-compatible production configuration without exposing credentials elsewhere', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      MEDIA_STORAGE_PROVIDER: 's3',
      S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      S3_REGION: 'auto',
      S3_BUCKET: 'smart-queue-media',
      S3_ACCESS_KEY_ID: 'access-key',
      S3_SECRET_ACCESS_KEY: 'secret-key',
      S3_PUBLIC_BASE_URL: 'https://cdn.example.com/media',
      S3_FORCE_PATH_STYLE: 'true',
    };

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require('../index') as typeof import('../index');

      expect(config.media.provider).toBe('s3');
      expect(config.media.s3).toMatchObject({
        endpoint: 'https://account.r2.cloudflarestorage.com',
        region: 'auto',
        bucket: 'smart-queue-media',
        publicBaseUrl: 'https://cdn.example.com/media',
        forcePathStyle: true,
      });
    });
  });

  it('fails fast when S3 production credentials are incomplete', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      MEDIA_STORAGE_PROVIDER: 's3',
      S3_REGION: 'auto',
      S3_BUCKET: 'smart-queue-media',
      S3_PUBLIC_BASE_URL: 'https://cdn.example.com/media',
    };
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;

    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('../index');
      });
    }).toThrow('S3_ACCESS_KEY_ID must be set when media storage is s3');
  });

  it('keeps local storage as the default for development', () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' };
    delete process.env.MEDIA_STORAGE_PROVIDER;
    delete process.env.MEDIA_STORAGE_MODE;
    delete process.env.S3_ENDPOINT;
    delete process.env.S3_REGION;
    delete process.env.S3_BUCKET;
    delete process.env.S3_ACCESS_KEY_ID;
    delete process.env.S3_SECRET_ACCESS_KEY;
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.S3_FORCE_PATH_STYLE;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { config } = require('../index') as typeof import('../index');
      expect(config.media.provider).toBe('local');
    });
  });
});
