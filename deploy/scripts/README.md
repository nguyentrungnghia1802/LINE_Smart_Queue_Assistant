# Manual immutable production release

This directory is the reviewed manual/emergency release path for the production-oriented
VPS demo. Normal GitHub Actions delivery remains backup-gated and environment-approved; these
scripts provide the same immutable-tag contract when an operator needs to build or deploy
outside that workflow.

## Local build and push

Run from the repository checkout at the exact commit that will be released:

```powershell
$env:VITE_LIFF_ID = '<production-liff-id>'
pwsh -NoProfile -File deploy/scripts/build-push.ps1
```

The script derives the checked-out full `HEAD`, generates `git-<12-character-sha>`, builds the API
and Web `runner` images with that same tag, and keeps the full SHA in the OCI revision label. It
pushes no `latest` alias. After both pushes succeed, copy the printed `DEPLOY_TAG`, full API/Web
references, and VPS command. By default, the script reads only
`LINE_QUEUE_API_REPOSITORY`/`LINE_QUEUE_WEB_REPOSITORY` from `deploy/.env` (falling back to
`deploy/.env.example`) and never reads or prints other runtime values. `-ImageNamespace`,
`-ApiImageRepository`, and `-WebImageRepository` provide explicit overrides; the legacy
`IMAGE_NAMESPACE`, `DOCKERHUB_NAMESPACE`, `DOCKERHUB_USERNAME`, `API_IMAGE_REPOSITORY`, and
`WEB_IMAGE_REPOSITORY` environment variables remain supported. Docker Desktop must be running and
Docker Hub credentials must already be available to the local Docker CLI.

## VPS deploy

Copy the versioned `deploy/` tooling to the VPS through the approved delivery path, then run from
the repository root (or use the equivalent path after changing into `deploy/`):

```bash
bash deploy/scripts/deploy.sh git-<12-character-sha>
# from the deploy directory:
bash scripts/deploy.sh git-<12-character-sha>
```

`deploy.sh` is intentionally a thin entry point. It delegates to `deploy/backup/deploy-safe.sh`,
which performs preflight, PostgreSQL/local-media backup and independent verification, atomic
`LINE_QUEUE_API_IMAGE`/`LINE_QUEUE_WEB_IMAGE` updates, pull, migrations, service recreation, and
health checks. The API, Worker, and Web services therefore receive the selected release tag
together; no manual `.env` edit is required. Existing snapshot metadata remains the source for
image-only rollback, and data restore stays a separately confirmed operation.

The production Compose file keeps local media in the named `media_data` volume. Redeploys and
container recreation must not use `docker compose down -v` or remove that volume. Web nginx uses
Docker's embedded DNS resolver for the `api` service, so a recreated API container does not leave
the proxy pinned to its old container IP.

## Rehearsal

The dry-run rehearsal checks Windows PowerShell 12-character tag generation, the full-SHA OCI revision,
the printed VPS handoff, the backup-gated delegation boundary, the no-`latest` contract, and the
runtime-DNS nginx configuration without publishing images or touching a production `.env`:

```bash
npm run ops:manual-release:rehearse
```

The command requires PowerShell, Bash, Git, and the repository files. On Windows it can use Git
for Windows Bash; CI runs it on Linux without publishing images.
