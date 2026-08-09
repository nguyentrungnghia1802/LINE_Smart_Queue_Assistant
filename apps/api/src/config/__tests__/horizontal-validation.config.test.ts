import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../../../');
const readRepoFile = (path: string) => readFileSync(resolve(repoRoot, path), 'utf8');

describe('TASK-11 horizontal validation topology', () => {
  const compose = readRepoFile('docker-compose.validation.yml');
  const nginx = readRepoFile('docker/nginx/validation.conf');

  it('runs two API replicas against shared PostgreSQL and Redis with an explicit pool budget', () => {
    expect(compose).toMatch(/api-1:\s*[\s\S]*?api-2:/);
    expect(compose).toContain('DATABASE_URL: postgresql://postgres:postgres@postgres:5432/');
    expect(compose).toContain('REDIS_URL: redis://redis:6379');
    expect(compose).toContain('DB_POOL_MAX: 5');
    expect(compose).toContain('LINE_NOTIFICATION_DELIVERY_OWNER: bullmq');
    expect(compose).toContain('MEDIA_STORAGE_PROVIDER: mock');
    expect(compose).toContain("LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: ''");
  });

  it('balances normal requests and keeps SSE unbuffered', () => {
    expect(nginx).toMatch(/upstream validation_api[\s\S]*api-1:4000[\s\S]*api-2:4000/);
    expect(nginx).toMatch(/location \^~ \/api\/v1\/realtime\/[\s\S]*proxy_buffering off/);
    expect(nginx).toMatch(/location \/ \{[\s\S]*proxy_pass http:\/\/validation_api;/);
    expect(nginx).toContain('X-SQA-Upstream');
  });

  it('keeps the validation harness isolated from real providers', () => {
    expect(compose).toContain('LINE_ID_TOKEN_VERIFICATION_MODE: line');
    expect(compose).toContain('EMAIL_TRANSPORT: mock');
    expect(compose).toContain('LOCATION_TRAVEL_PROVIDER: mock');
    expect(compose).toContain("OTEL_SDK_DISABLED: 'true'");
    expect(compose).toContain("SENTRY_DSN: ''");
    expect(compose).toContain('target: validation');
    expect(compose).not.toContain('./docker/nginx/validation.conf:');
  });
});
