#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

init_runtime
validate_compose
require_running_service postgres
require_running_service api
assert_media_mount

backup_id=$(date -u +%Y%m%d_%H%M%S)
partial="$BACKUP_ROOT/.partial-$backup_id"
snapshot="$BACKUP_ROOT/$backup_id"
[[ ! -e "$partial" && ! -e "$snapshot" ]] || die "Backup ID collision: $backup_id"
mkdir -p -- "$partial/database" "$partial/media" "$partial/metadata"
chmod 700 -- "$partial" "$partial/database" "$partial/media" "$partial/metadata"

restart_services=()
cleanup() {
  local status=$?
  if ((${#restart_services[@]})); then
    log "Restarting services quiesced for the snapshot: ${restart_services[*]}"
    compose start "${restart_services[@]}" >/dev/null || true
  fi
  if ((status != 0)); then
    log "Incomplete snapshot retained for diagnosis: $partial"
  fi
  exit "$status"
}
trap cleanup EXIT

media_provider=$(runtime_media_provider)
case "$media_provider" in
  local) media_included=true ;;
  s3) media_included=false ;;
  *) die "Unsupported production media provider for backup: $media_provider" ;;
esac

api_image=$(image_reference api)
web_image=$(image_reference web)
api_image_id=$(image_id api)
web_image_id=$(image_id web)
postgres_image=$(image_reference postgres)
repo_revision=${BACKUP_TOOLING_REVISION:-$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || printf 'not-available')}
safe_metadata_value "$repo_revision" 'tooling revision'
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

for service in api worker; do
  if service_is_running "$service"; then
    restart_services+=("$service")
  fi
done
if ((${#restart_services[@]})); then
  log 'Quiescing API and worker writes'
  compose stop "${restart_services[@]}" >/dev/null
fi

log 'Creating PostgreSQL custom-format dump'
# Variables in this command are intentionally expanded inside the PostgreSQL container.
# shellcheck disable=SC2016
compose exec -T postgres sh -eu -c \
  'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' \
  > "$partial/database/postgres.dump"

if [[ "$media_included" == true ]]; then
  log 'Archiving persistent local media volume'
  api_container=$(container_id api)
  docker run --rm --volumes-from "$api_container" --entrypoint sh "$api_image_id" -eu -c \
    'exec tar -C /app/var/media -czf - .' > "$partial/media/media.tar.gz"
fi

postgres_version=$(compose exec -T postgres postgres --version | tr -d '\r\n')
safe_metadata_value "$postgres_version" 'PostgreSQL version'
cat > "$partial/metadata/manifest.tsv" <<EOF
schema_version	1
backup_id	$backup_id
created_at	$created_at
media_provider	$media_provider
media_included	$media_included
api_image	$api_image
api_image_id	$api_image_id
web_image	$web_image
web_image_id	$web_image_id
postgres_image	$postgres_image
postgres_version	$postgres_version
tooling_revision	$repo_revision
EOF

(
  cd -- "$partial"
  find database media metadata -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)
chmod 600 -- "$partial/database/postgres.dump" "$partial/metadata/manifest.tsv" "$partial/SHA256SUMS"
[[ "$media_included" == false ]] || chmod 600 -- "$partial/media/media.tar.gz"

log 'Verifying snapshot before publishing completion marker'
verify_snapshot "$partial" false || die 'Snapshot verification failed'
mv -- "$partial" "$snapshot"
partial=$snapshot
printf 'completed_at\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$snapshot/BACKUP_SUCCESS"
chmod 600 -- "$snapshot/BACKUP_SUCCESS"
verify_snapshot "$snapshot" true || die 'Published snapshot verification failed'

if ((${#restart_services[@]})); then
  compose start "${restart_services[@]}" >/dev/null
fi
restart_services=()
trap - EXIT

log "Backup completed and verified: $backup_id"

# Conservative retention: delete only old completed snapshots that still verify.
mapfile -t completed < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
  -name '????????_??????' -exec test -f '{}/BACKUP_SUCCESS' \; -print | sort -r)
valid_completed=()
for retained_snapshot in "${completed[@]}"; do
  if verify_snapshot "$retained_snapshot" true; then
    valid_completed+=("$retained_snapshot")
  else
    log "Retention skipped invalid backup: $(basename -- "$retained_snapshot")"
  fi
done
if ((${#valid_completed[@]} > BACKUP_RETENTION_COUNT)); then
  for old_snapshot in "${valid_completed[@]:BACKUP_RETENTION_COUNT}"; do
    log "Removing verified backup beyond retention: $(basename -- "$old_snapshot")"
    rm -rf -- "$old_snapshot"
  done
fi

printf '%s\n' "$backup_id"
