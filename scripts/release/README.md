# Immutable image publishing

Run the publisher from a clean, reviewed Git commit on a Windows workstation with Docker Desktop
and an existing `docker login`. The script resolves the full lowercase commit SHA itself, builds
the API and Web `runner` stages, attaches the OCI revision label, and pushes both
`git-<40-character-sha>` and `latest` tags:

```powershell
$env:VITE_LIFF_ID = '<production-liff-id>'
pwsh -NoProfile -File scripts/release/publish-images.ps1 `
  -RegistryNamespace docker.io/trungnghia2703
```

The immutable tag printed as `RELEASE_TAG=...` is the only deployment input. `latest` is a mutable
operator convenience and must never be supplied to production deployment. Preview the exact build
and push plan without Docker access using `-DryRun`; `-AllowDirty` exists only for explicit tooling
tests because publishing a dirty worktree would break commit-to-image traceability.

The Web image deliberately compiles an empty same-origin `VITE_API_URL`, the supplied LIFF ID,
`/liff`, demo payment mode, disabled LIFF mock mode, and the commit SHA as its Sentry release. No
runtime secret is accepted or printed by this publisher.

On the VPS, configure the untagged `LINE_QUEUE_API_REPOSITORY` and
`LINE_QUEUE_WEB_REPOSITORY` once in `deploy/.env`, then deploy the printed tag:

```bash
deploy/backup/deploy-safe.sh git-0123456789abcdef0123456789abcdef01234567
# Type: DEPLOY <printed-predeployment-backup-id>
```

The server derives the two full image references, creates and verifies a restore point, atomically
updates only `LINE_QUEUE_API_IMAGE` and `LINE_QUEUE_WEB_IMAGE` in `deploy/.env`, pulls, migrates,
recreates application services, and checks health. Rollback takes a verified pre-deployment backup
ID and restores the prior image references from that snapshot's metadata; it never guesses a tag
or uses `latest`.
