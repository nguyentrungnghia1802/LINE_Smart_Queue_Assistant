# Production backup and recovery

These Bash tools protect the authoritative PostgreSQL database and, when
`MEDIA_STORAGE_PROVIDER=local`, the persistent `/app/var/media` Docker volume used by the current
VPS production-oriented demo. Redis is deliberately excluded because its queues, cache, rate-limit
state, and Pub/Sub messages are disposable; PostgreSQL remains authoritative.

Runtime snapshots must stay outside the Git checkout. The default is
`/var/backups/line-smart-queue`; set `BACKUP_ROOT` and `BACKUP_RETENTION_COUNT` in the server-only
`deploy/.env` when another restricted, absolute path is required. Copy completed snapshots to
encrypted off-host storage. The scripts never copy or print `deploy/.env`, database passwords,
LINE credentials, or other secrets.

## Snapshot layout and guarantees

Each UTC `YYYYMMDD_HHMMSS` directory contains:

- `database/postgres.dump`: custom-format logical PostgreSQL dump;
- `media/media.tar.gz`: local-media archive, omitted only for an active external/S3 provider;
- `metadata/manifest.tsv`: non-secret creation, image, tooling, and PostgreSQL metadata;
- `SHA256SUMS`: checksums for every payload and metadata file;
- `BACKUP_SUCCESS`: completion marker written only after payload verification.

Creation uses a `.partial-*` directory, briefly stops API/worker writes, verifies dump readability,
archive paths, gzip integrity, and checksums, then publishes the completed directory. Failed partial
snapshots are retained for diagnosis and are never eligible for restore or automatic retention.
Retention defaults to 14 completed snapshots, never fewer than two, and deletes only older
snapshots that independently pass verification. Keep an additional off-host retention policy.

## Operator commands

Run from the deployment checkout as the restricted Docker/deployment user:

```bash
deploy/backup/backup.sh
deploy/backup/list-backups.sh
deploy/backup/verify-backup.sh latest
```

`backup.sh` prints the new backup ID on stdout. Verification rejects a missing marker, required
artifact, checksum mismatch, unreadable PostgreSQL dump, corrupt gzip, or unsafe archive path.
`verify-backup.sh` and `list-backups.sh` need the snapshot root and Docker but do not require the
production `.env`, so an off-host copy can be checked before secrets are recovered.

Restore is destructive and does not restore Redis. It first verifies the selected snapshot, then
requires the exact confirmation shown by the script, stops Web/API/worker traffic, restores the
database and local media, applies canonical forward migrations, restarts services, and probes API
health/readiness plus Web health:

```bash
deploy/backup/restore.sh 20260812_153000
# Type: RESTORE 20260812_153000
```

On failure, application traffic remains stopped. Diagnose the error and rerun the same restore;
do not start writers against partially restored state. External S3-compatible media is never
copied by these tools and must use provider versioning/export recovery.

Configure the two untagged repositories once in `deploy/.env`, then pass only the publisher's exact
`git-<40-character-sha>` release tag to the backup gate:

```bash
# deploy/.env:
# LINE_QUEUE_API_REPOSITORY=docker.io/example/line-smart-queue-api
# LINE_QUEUE_WEB_REPOSITORY=docker.io/example/line-smart-queue-web
deploy/backup/deploy-safe.sh git-0123456789abcdef0123456789abcdef01234567
# Type: DEPLOY <the-printed-predeployment-backup-id>
```

The script will not pull, migrate, or recreate application containers unless pre-deployment backup
and independent verification succeed. After verification and confirmation it atomically updates
only `LINE_QUEUE_API_IMAGE` and `LINE_QUEUE_WEB_IMAGE` in the server's existing `deploy/.env`, then
pulls and deploys those exact references. It never runs `down`, removes volumes, copies secrets, or
automatically restores data.

Application rollback is intentionally separate from data recovery:

```bash
deploy/backup/rollback.sh <predeployment-backup-id>
# Type: ROLLBACK <predeployment-backup-id>
```

Rollback reads the prior immutable API/Web references from verified metadata, atomically writes
those exact references back to `deploy/.env`, and recreates only application services. It does not
restore PostgreSQL/media or reverse migrations and never derives rollback from `latest`. Use it
only while the prior application is compatible with the current expanded schema; otherwise prefer
a forward fix or an explicitly approved full restore.

## Permissions, scheduling, and disaster recovery

- Give the deployment user Docker access and exclusive `0700` access to `BACKUP_ROOT`; payloads are
  created as `0600`. Never make the directory world-readable.
- Schedule `backup.sh` at the business-approved RPO interval and alert on any non-zero exit. The
  brief API/worker quiesce is intentional for a matched database/media restore point.
- Replicate only completed, verified snapshot directories to encrypted off-host storage. Exclude
  `.partial-*` directories.
- Recover `deploy/.env` separately from the organization's approved secret manager or encrypted
  operator escrow, install it as `0600`, and run Compose configuration validation before restore.
  If that independent secret copy is unavailable, rotate and reissue database, JWT, LINE, SMTP,
  payment, maps, and telemetry credentials; they cannot be reconstructed from a data snapshot.
- Test `verify-backup.sh` after transfer and run an isolated restore drill regularly. The repository
  rehearsal is `bash deploy/backup/tests/rehearsal.sh`; it uses unique disposable Docker volumes and
  must never be pointed at production Compose or production data.
- Record the selected backup ID, restore/deploy timestamps, operator, incident/release ID, health
  evidence, and any provider-side media recovery in the external operations log.

Never run Docker volume pruning as part of backup, deployment, rollback, or cleanup. Removing
`postgres_data` or `media_data` is a separate destructive operation outside these runbooks.
