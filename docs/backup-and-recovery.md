# Backup and Recovery

This document defines the minimum backup and recovery process for LINE Smart Queue Assistant in a production-like environment.

## Scope

- PostgreSQL application data
- Schema migrations
- Docker Compose deployment on a single server

## Backup Strategy

### PostgreSQL logical backup

Take a compressed logical dump at least once per day:

```bash
docker exec lq-postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > backup-$(date +%Y%m%d-%H%M%S).sql.gz
```

Recommended retention:

- Daily backups: 14 days
- Weekly backups: 8 weeks
- Monthly backups: 6 months

### Backup storage

- Store backups outside the application host when possible.
- Encrypt backups at rest.
- Restrict access to operators only.

### Configuration backup

- Keep a secure copy of `.env` values in a secret manager or encrypted vault.
- Do not store plaintext production secrets in the repository.

## Restore Procedure

### Full restore

1. Stop write traffic to the API.
2. Verify the target database name and credentials.
3. Recreate the database if needed.
4. Restore the latest valid dump.

Example:

```bash
gunzip -c backup-20260618-010000.sql.gz | docker exec -i lq-postgres psql -U "$DB_USER" "$DB_NAME"
```

### Post-restore validation

Run these checks after restore:

```bash
curl http://localhost:4000/health
curl http://localhost:4000/ready
curl http://localhost:4000/metrics
```

Also verify:

- Users can authenticate
- Queue list loads for staff/manager
- Orders can be queried
- Scheduler reports running status

## Migration Recovery

If a migration fails:

1. Stop additional deployments.
2. Identify the last successful migration in `pgmigrations`.
3. Restore from the latest known-good backup if data integrity is uncertain.
4. Fix the migration script.
5. Re-run migrations in a staging environment first.
6. Re-run production migration only after verification.

Useful commands:

```bash
npm run db:migrate:status --workspace=apps/api
npm run db:migrate:down --workspace=apps/api
npm run db:migrate --workspace=apps/api
```

## Disaster Recovery

### Minimum targets

- RTO: 1 hour
- RPO: 24 hours

### Basic disaster recovery flow

1. Provision a replacement host.
2. Restore Docker and Docker Compose.
3. Restore `.env` from secure secret storage.
4. Start PostgreSQL.
5. Restore the latest backup.
6. Start API and web containers.
7. Validate `/health`, `/ready`, and business-critical flows.

## Recovery Drill

Run a recovery drill at least once per quarter:

- Restore a recent dump into a non-production environment
- Verify migrations, auth, queue operations, and notifications
- Record recovery time and issues found
