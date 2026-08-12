#!/usr/bin/env bash

# Container commands intentionally expand POSTGRES_* inside their target containers, and the
# append-only log makes each failure step visible in retained rehearsal evidence.
# shellcheck disable=SC2016,SC2129
set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
BACKUP_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd -P)
require() { command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 1; }; }
require docker
require bash

test_root=$(mktemp -d "${TMPDIR:-/tmp}/line-queue-backup-rehearsal.XXXXXX")
project="sqa_backup_test_${RANDOM}_$$"
export COMPOSE_PROJECT_NAME=$project
export COMPOSE_FILE="$test_root/docker-compose.yml"
export ENV_FILE="$test_root/.env"
export BACKUP_ROOT="$test_root/backups"
export BACKUP_RETENTION_COUNT=4
export POSTGRES_VERIFY_IMAGE=postgres:16-alpine
export OPS_TEST_MODE=true
export OPS_SKIP_MIGRATIONS=true
export OPS_SKIP_HEALTH=true
export OPS_SKIP_PULL=true
release_tag="git-$(printf '2%.0s' {1..12})"
release_image="alpine:$release_tag"
test_secret='rehearsal-password-must-not-appear'
log_file="$test_root/rehearsal.log"

cleanup() {
  local status=$?
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down --remove-orphans >/dev/null 2>&1 || true
  for volume in "${project}_postgres_data" "${project}_media_data" "${project}_redis_data"; do
    if docker volume inspect "$volume" >/dev/null 2>&1; then
      docker volume rm "$volume" >/dev/null 2>&1 || true
    fi
  done
  docker image rm "$release_image" >/dev/null 2>&1 || true
  if ((status == 0)); then
    rm -rf -- "$test_root"
  else
    echo "Rehearsal evidence retained at $test_root" >&2
    [[ ! -f "$log_file" ]] || tail -n 200 "$log_file" >&2
  fi
  exit "$status"
}
trap cleanup EXIT

cat > "$COMPOSE_FILE" <<'YAML'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: [CMD-SHELL, 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 2s
      timeout: 2s
      retries: 20
  redis:
    image: redis:7.4-alpine
    volumes:
      - redis_data:/data
  api:
    image: ${LINE_QUEUE_API_IMAGE}
    environment:
      MEDIA_STORAGE_PROVIDER: local
    command: [sh, -c, 'sleep 3600']
    volumes:
      - media_data:/app/var/media
    depends_on:
      postgres:
        condition: service_healthy
  worker:
    image: ${LINE_QUEUE_API_IMAGE}
    command: [sh, -c, 'sleep 3600']
  web:
    image: ${LINE_QUEUE_WEB_IMAGE}
    command: [sh, -c, 'sleep 3600']
volumes:
  postgres_data:
  redis_data:
  media_data:
YAML

cat > "$ENV_FILE" <<EOF
DB_NAME=line_queue_rehearsal
DB_USER=rehearsal
DB_PASSWORD=$test_secret
LINE_QUEUE_API_REPOSITORY=alpine
LINE_QUEUE_WEB_REPOSITORY=alpine
LINE_QUEUE_API_IMAGE=alpine:3.19
LINE_QUEUE_WEB_IMAGE=alpine:3.19
EOF
chmod 600 "$ENV_FILE"

compose=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
"${compose[@]}" up -d --wait postgres redis api worker web >>"$log_file" 2>&1
"${compose[@]}" exec -T postgres sh -eu -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "CREATE TABLE restore_probe (id integer PRIMARY KEY, value text NOT NULL); INSERT INTO restore_probe VALUES (1, '\''before-backup'\'');"' \
  >>"$log_file" 2>&1
api_id=$("${compose[@]}" ps -q api)
docker exec "$api_id" sh -eu -c 'printf original-media > /app/var/media/probe.txt' >>"$log_file" 2>&1

backup_id=$("$BACKUP_DIR/backup.sh" 2>>"$log_file")
"$BACKUP_DIR/verify-backup.sh" "$backup_id" >>"$log_file" 2>&1
ENV_FILE="$test_root/missing.env" "$BACKUP_DIR/verify-backup.sh" "$backup_id" >>"$log_file" 2>&1
"$BACKUP_DIR/list-backups.sh" >>"$log_file" 2>&1

"${compose[@]}" exec -T postgres sh -eu -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "UPDATE restore_probe SET value = '\''after-backup'\'' WHERE id = 1;"' \
  >>"$log_file" 2>&1
docker exec "$api_id" sh -eu -c 'printf changed-media > /app/var/media/probe.txt' >>"$log_file" 2>&1

if "$BACKUP_DIR/restore.sh" "$backup_id" </dev/null >>"$log_file" 2>&1; then
  echo 'Restore unexpectedly accepted missing confirmation' >&2
  exit 1
fi
current_value=$("${compose[@]}" exec -T postgres sh -eu -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT value FROM restore_probe WHERE id = 1"')
[[ "$current_value" == after-backup ]]

RESTORE_CONFIRMATION="RESTORE $backup_id" "$BACKUP_DIR/restore.sh" "$backup_id" >>"$log_file" 2>&1
restored_value=$("${compose[@]}" exec -T postgres sh -eu -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT value FROM restore_probe WHERE id = 1"')
[[ "$restored_value" == before-backup ]]
api_id=$("${compose[@]}" ps -q api)
[[ $(docker exec "$api_id" cat /app/var/media/probe.txt) == original-media ]]

clone_snapshot_as() {
  local clone_id=$1 clone="$BACKUP_ROOT/$1"
  cp -a "$BACKUP_ROOT/$backup_id" "$clone"
  sed -i "s/^backup_id	.*/backup_id	$clone_id/" "$clone/metadata/manifest.tsv"
  (
    cd "$clone"
    find database media metadata -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
  )
}

clone_snapshot_as 20990101_010101
printf corruption >> "$BACKUP_ROOT/20990101_010101/database/postgres.dump"
if "$BACKUP_DIR/verify-backup.sh" 20990101_010101 >>"$log_file" 2>&1; then
  echo 'Corrupt dump unexpectedly verified' >&2
  exit 1
fi
clone_snapshot_as 20990101_010102
rm -f "$BACKUP_ROOT/20990101_010102/database/postgres.dump"
if "$BACKUP_DIR/verify-backup.sh" 20990101_010102 >>"$log_file" 2>&1; then
  echo 'Missing dump unexpectedly verified' >&2
  exit 1
fi
mkdir -p "$BACKUP_ROOT/20990101_010103"
if "$BACKUP_DIR/verify-backup.sh" 20990101_010103 >>"$log_file" 2>&1; then
  echo 'Incomplete snapshot unexpectedly verified' >&2
  exit 1
fi
clone_snapshot_as 20990101_010104
sed -i '\|  media/media.tar.gz$|d' "$BACKUP_ROOT/20990101_010104/SHA256SUMS"
if "$BACKUP_DIR/verify-backup.sh" 20990101_010104 >>"$log_file" 2>&1; then
  echo 'Snapshot with an unchecksummed required artifact unexpectedly verified' >&2
  exit 1
fi

if "$BACKUP_DIR/deploy-safe.sh" latest >>"$log_file" 2>&1; then
  echo 'Safe deploy unexpectedly accepted a mutable tag' >&2
  exit 1
fi
grep -Fxq 'LINE_QUEUE_API_IMAGE=alpine:3.19' "$ENV_FILE"
grep -Fxq 'LINE_QUEUE_WEB_IMAGE=alpine:3.19' "$ENV_FILE"

printf blocked > "$test_root/not-a-directory"
if BACKUP_ROOT="$test_root/not-a-directory" \
  DEPLOY_CONFIRMATION='unused' "$BACKUP_DIR/deploy-safe.sh" "$release_tag" >>"$log_file" 2>&1; then
  echo 'Safe deploy unexpectedly continued after backup-root failure' >&2
  exit 1
fi
api_id=$("${compose[@]}" ps -q api)
[[ $(docker inspect --format '{{.Config.Image}}' "$api_id") == alpine:3.19 ]]
grep -Fxq 'LINE_QUEUE_API_IMAGE=alpine:3.19' "$ENV_FILE"
grep -Fxq 'LINE_QUEUE_WEB_IMAGE=alpine:3.19' "$ENV_FILE"

sleep 1
docker tag alpine:3.19 "$release_image"
export DEPLOY_APPROVED=GITHUB_ENVIRONMENT_APPROVED
predeploy_id=$("$BACKUP_DIR/deploy-safe.sh" "$release_tag" 2>>"$log_file")
api_id=$("${compose[@]}" ps -q api)
[[ $(docker inspect --format '{{.Config.Image}}' "$api_id") == "$release_image" ]]
grep -Fxq "LINE_QUEUE_API_IMAGE=$release_image" "$ENV_FILE"
grep -Fxq "LINE_QUEUE_WEB_IMAGE=$release_image" "$ENV_FILE"
[[ -n "$predeploy_id" && "$predeploy_id" != "$backup_id" ]]

ROLLBACK_CONFIRMATION="ROLLBACK $predeploy_id" "$BACKUP_DIR/rollback.sh" "$predeploy_id" >>"$log_file" 2>&1
api_id=$("${compose[@]}" ps -q api)
[[ $(docker inspect --format '{{.Config.Image}}' "$api_id") == alpine:3.19 ]]
grep -Fxq 'LINE_QUEUE_API_IMAGE=alpine:3.19' "$ENV_FILE"
grep -Fxq 'LINE_QUEUE_WEB_IMAGE=alpine:3.19' "$ENV_FILE"
restored_value=$("${compose[@]}" exec -T postgres sh -eu -c \
  'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT value FROM restore_probe WHERE id = 1"')
[[ "$restored_value" == before-backup ]]

if grep -Fq "$test_secret" "$log_file"; then
  echo 'Secret leaked into rehearsal output' >&2
  exit 1
fi
if grep -R -E 'docker (compose )?.*down (-v|--volumes)|docker system prune|chmod 777' \
  "$BACKUP_DIR" --include='*.sh' --exclude='rehearsal.sh' >/dev/null; then
  echo 'Unsafe destructive command found in production backup tooling' >&2
  exit 1
fi

echo "Backup/restore/deploy/rollback rehearsal passed: $backup_id"
