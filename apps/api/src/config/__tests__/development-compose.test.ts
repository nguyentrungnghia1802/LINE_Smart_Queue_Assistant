import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '../../../../../');

describe('development Compose configuration', () => {
  const compose = readFileSync(resolve(repoRoot, 'docker-compose.dev.yml'), 'utf8');

  it('builds shared and migrates the database before starting the API dev server', () => {
    const sharedBuild = 'npm run build --workspace=packages/shared';
    const databaseMigration = 'npm run db:migrate --workspace=apps/api';
    const apiDev = 'npm run dev --workspace=apps/api';
    const command = compose.match(/'npm run build --workspace=packages\/shared[^']+'/)?.[0] ?? '';

    expect(command).toContain(`${sharedBuild} && ${databaseMigration} && ${apiDev}`);
  });

  it('mounts the TypeScript configuration required by both workspaces', () => {
    expect(compose).toContain('./apps/api/tsconfig.json:/app/apps/api/tsconfig.json');
    expect(compose).toContain('./packages/shared/tsconfig.json:/app/packages/shared/tsconfig.json');
    expect(compose).toContain('./packages/config:/app/packages/config');
    expect(compose).toContain(
      './db/migrations/node-pg-migrate:/app/db/migrations/node-pg-migrate:ro'
    );
  });

  it('probes the IPv4 listener used by the API server', () => {
    expect(compose).toContain('wget -qO- http://127.0.0.1:4000/health');
    expect(compose).not.toContain('wget -qO- http://localhost:4000/health');
  });
});
