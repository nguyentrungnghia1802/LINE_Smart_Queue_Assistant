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

  it('proxies persisted media without stripping the /media prefix', () => {
    const nginxConfig = readRepoFile('docker/nginx/default.conf');

    expect(nginxConfig).toMatch(/location\s+\/media\/\s*\{/);
    expect(nginxConfig).toMatch(/proxy_pass\s+http:\/\/api:4000;/);
    expect(nginxConfig).not.toMatch(/proxy_pass\s+http:\/\/api:4000\/;/);
  });

  it('passes all public production Vite build arguments to the web image', () => {
    const dockerfile = readRepoFile('docker/web/Dockerfile');
    const compose = readRepoFile('docker-compose.yml');

    const publicBuildArgs = [
      'VITE_API_URL',
      'VITE_APP_NAME',
      'VITE_LIFF_ID',
      'VITE_LIFF_DEFAULT_BOOKING_PATH',
      'VITE_LIFF_MOCK',
      'VITE_PAYMENT_MODE',
      'VITE_PAYMENT_REDIRECT_BASE_URL',
    ];

    for (const arg of publicBuildArgs) {
      expect(dockerfile).toContain(`ARG ${arg}`);
      expect(dockerfile).toContain(`ENV ${arg}=$${arg}`);
      expect(compose).toContain(`${arg}:`);
    }

    expect(compose).toContain('VITE_API_URL: ${VITE_API_URL:-/api}');
  });

  it('keeps the deploy Compose stack synchronized with the canonical production stack', () => {
    const canonicalCompose = readRepoFile('docker-compose.prod.yml');
    const deployCompose = readRepoFile('deploy/docker-compose.yml');
    const apiDockerfile = readRepoFile('docker/api/Dockerfile');

    expect(deployCompose).toBe(canonicalCompose);
    expect(canonicalCompose).toContain('media_data:/app/var/media');
    expect(canonicalCompose).toContain('MEDIA_LOCAL_DIR: ${MEDIA_LOCAL_DIR:-/app/var/media}');
    expect(apiDockerfile).toContain('mkdir -p /app/var/media');
    expect(apiDockerfile).toContain('chown appuser:appgroup /app/var/media');
  });
});
