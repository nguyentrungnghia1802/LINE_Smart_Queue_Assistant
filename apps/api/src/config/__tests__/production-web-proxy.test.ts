import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../../../');

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

describe('production web reverse proxy configuration', () => {
  it('keeps the /api prefix when proxying to the API service', () => {
    const nginxConfig = readRepoFile('docker/nginx/default.conf');

    expect(nginxConfig).toMatch(/location\s+\/api\/\s*\{/);
    expect(nginxConfig).toMatch(/proxy_pass\s+http:\/\/api:4000;/);
    expect(nginxConfig).not.toMatch(/proxy_pass\s+http:\/\/api:4000\/;/);
    expect(nginxConfig).toMatch(/proxy_set_header\s+Host\s+\$host;/);
    expect(nginxConfig).toMatch(/proxy_set_header\s+X-Real-IP\s+\$remote_addr;/);
    expect(nginxConfig).toMatch(
      /proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for;/
    );
    expect(nginxConfig).toMatch(/proxy_set_header\s+X-Forwarded-Proto\s+\$scheme;/);
  });

  it('streams realtime events without buffering through the web proxy', () => {
    const nginxConfig = readRepoFile('docker/nginx/default.conf');
    const realtimeLocation = nginxConfig.match(
      /location\s+\^~\s+\/api\/v1\/realtime\/\s*\{([\s\S]*?)\n\s*\}/
    )?.[1];

    expect(realtimeLocation).toBeDefined();
    expect(realtimeLocation).toMatch(/proxy_pass\s+http:\/\/api:4000;/);
    expect(realtimeLocation).not.toMatch(/proxy_pass\s+http:\/\/api:4000\/;/);
    expect(realtimeLocation).toMatch(/proxy_buffering\s+off;/);
    expect(realtimeLocation).toMatch(/proxy_cache\s+off;/);
    expect(realtimeLocation).toMatch(/gzip\s+off;/);
    expect(realtimeLocation).toMatch(/proxy_read_timeout\s+6m;/);
    expect(realtimeLocation).toMatch(/proxy_set_header\s+Connection\s+"";/);
  });

  it('proxies persisted media without stripping the /media prefix', () => {
    const nginxConfig = readRepoFile('docker/nginx/default.conf');

    expect(nginxConfig).toMatch(/location\s+\/media\/\s*\{/);
    expect(nginxConfig).toMatch(/proxy_pass\s+http:\/\/api:4000;/);
    expect(nginxConfig).not.toMatch(/proxy_pass\s+http:\/\/api:4000\/;/);
  });

  it('proxies persisted media through the API during Vite development', () => {
    const viteConfig = readRepoFile('apps/web/vite.config.ts');
    const developmentCompose = readRepoFile('docker-compose.dev.yml');

    expect(viteConfig).toMatch(/'\/media'\s*:\s*\{/);
    expect(viteConfig).toMatch(/const apiProxyTarget\s*=\s*process\.env\.API_PROXY_TARGET/);
    expect(viteConfig).toMatch(/http:\/\/127\.0\.0\.1:4000/);
    expect(viteConfig).toMatch(/'\/media'[\s\S]*?target:\s*apiProxyTarget/);
    expect(developmentCompose).toContain('API_PROXY_TARGET: http://api:4000');
    expect(developmentCompose).toContain('./apps/web/public:/app/apps/web/public');
  });

  it('keeps the web image build arguments and deploy image contract aligned with production', () => {
    const dockerfile = readRepoFile('docker/web/Dockerfile');
    const compose = readRepoFile('deploy/docker-compose.yml');

    const publicBuildArgs = [
      'VITE_API_URL',
      'VITE_APP_NAME',
      'VITE_LIFF_ID',
      'VITE_LIFF_DEFAULT_BOOKING_PATH',
      'VITE_LIFF_ENDPOINT_PATH',
      'VITE_LIFF_MOCK',
      'VITE_PAYMENT_MODE',
      'VITE_PAYMENT_REDIRECT_BASE_URL',
    ];

    for (const arg of publicBuildArgs) {
      expect(dockerfile).toContain(`ARG ${arg}`);
      expect(dockerfile).toContain(`ENV ${arg}=$${arg}`);
    }

    expect(compose).toContain('image: ${LINE_QUEUE_WEB_IMAGE:-line-smart-queue-web:latest}');
    expect(compose).not.toContain('build:');
    expect(compose).not.toContain('VITE_API_URL: ${VITE_API_URL:-}');
    expect(dockerfile).toContain('ARG VITE_LIFF_DEFAULT_BOOKING_PATH=');

    const authStore = readRepoFile('apps/web/src/store/authStore.ts');
    expect(authStore).toContain("'/api/v1/auth/login'");
  });

  it('keeps the deploy Compose stack aligned with the production image-based topology', () => {
    const deployCompose = readRepoFile('deploy/docker-compose.yml');
    const apiDockerfile = readRepoFile('docker/api/Dockerfile');

    expect(deployCompose).not.toContain('build:');
    expect(deployCompose).not.toContain('media_data:/app/var/media');
    expect(deployCompose).not.toContain('MEDIA_LOCAL_DIR: ${MEDIA_LOCAL_DIR:-/app/var/media}');
    expect(deployCompose).toContain('image: redis:7.4-alpine');
    expect(deployCompose).toContain('REDIS_URL: ${REDIS_URL:-redis://redis:6379}');
    expect(deployCompose).toContain('redis_data:/data');
    expect(apiDockerfile).toContain('mkdir -p /app/var/media');
    expect(apiDockerfile).toContain('chown appuser:appgroup /app/var/media');
    expect(apiDockerfile).toContain('/app/apps/api/node_modules');
    expect(apiDockerfile).toContain('./apps/api/node_modules');
  });

  it('uses the canonical production domain in deployment configuration', () => {
    const deployEnvironment = readRepoFile('deploy/.env.example');

    expect(deployEnvironment).toContain('WEB_ORIGIN=https://smartqueue.io.vn');
    expect(deployEnvironment).toContain('EMAIL_FROM_ADDRESS=no-reply@smartqueue.io.vn');
    expect(deployEnvironment).toMatch(/^MEDIA_STORAGE_PROVIDER=s3$/m);
    expect(deployEnvironment).not.toMatch(/^MEDIA_STORAGE_PROVIDER=local$/m);
    expect(deployEnvironment).not.toMatch(/^MEDIA_LOCAL_DIR=/m);
    expect(deployEnvironment).toMatch(/^S3_PUBLIC_BASE_URL=$/m);
    expect(deployEnvironment).not.toMatch(/playmcjava(?:21)?\.io\.vn/i);
  });
});
