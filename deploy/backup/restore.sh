#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

init_runtime
validate_compose
snapshot=$(resolve_snapshot "${1:-latest}")
backup_id=$(basename -- "$snapshot")
verify_snapshot "$snapshot" true || die "Refusing to restore invalid backup: $backup_id"

log "Restore target: $backup_id"
log "Created: $(manifest_value "$snapshot" created_at)"
log "API image at snapshot: $(manifest_value "$snapshot" api_image)"
log 'This replaces the current PostgreSQL database and, for local media, the media volume contents.'
confirm_exact "RESTORE $backup_id" "${RESTORE_CONFIRMATION:-}" 'Type the destructive restore confirmation'

compose up -d postgres redis >/dev/null
require_running_service postgres
assert_media_mount

restore_succeeded=false
on_restore_exit() {
  local status=$?
  if [[ "$restore_succeeded" != true ]]; then
    log 'Restore did not complete. API, worker, and web remain stopped to prevent writes to partial state.'
    log "Repair the failure or retry: $SCRIPT_DIR/restore.sh $backup_id"
  fi
  exit "$status"
}
trap on_restore_exit EXIT

log 'Stopping public traffic and application writers'
compose stop web api worker >/dev/null

log 'Restoring PostgreSQL with clean, ownership-neutral semantics'
# Variables in this command are intentionally expanded inside the PostgreSQL container.
# shellcheck disable=SC2016
compose exec -T postgres sh -eu -c \
  'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges --exit-on-error' \
  < "$snapshot/database/postgres.dump"

if [[ $(manifest_value "$snapshot" media_included) == true ]]; then
  log 'Restoring persistent local media volume'
  api_container=$(container_id api)
  api_runtime_image=$(docker inspect --format '{{.Image}}' "$api_container")
  docker run --rm -i --user 0 --volumes-from "$api_container" --entrypoint sh "$api_runtime_image" -eu -c "
    root=/app/var/media
    stage=\"\$root/.restore-stage-$backup_id\"
    rm -rf -- \"\$stage\"
    mkdir -p -- \"\$stage\"
    tar -xzf - -C \"\$stage\"
    find \"\$root\" -mindepth 1 -maxdepth 1 ! -name '.restore-stage-$backup_id' -exec rm -rf -- {} +
    cp -a \"\$stage\"/. \"\$root\"/
    rm -rf -- \"\$stage\"
  " < "$snapshot/media/media.tar.gz"
else
  log 'Snapshot uses external media; no local media data was restored'
fi

run_migrations
log 'Starting application services after successful data restoration'
compose up -d --remove-orphans --wait api worker web
verify_runtime_health
restore_succeeded=true
trap - EXIT
log "Restore completed and health-checked: $backup_id"
