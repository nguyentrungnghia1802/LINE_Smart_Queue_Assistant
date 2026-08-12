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
verify_snapshot "$snapshot" true || die "Refusing rollback from invalid backup metadata: $backup_id"

previous_api=$(manifest_value "$snapshot" api_image)
previous_web=$(manifest_value "$snapshot" web_image)
require_immutable_image "$previous_api" 'snapshot API image'
require_immutable_image "$previous_web" 'snapshot Web image'

log "Application rollback target: $backup_id"
log "API image: $previous_api"
log "Web image: $previous_web"
log 'This changes application images only. PostgreSQL and media are not restored.'
confirm_exact "ROLLBACK $backup_id" "${ROLLBACK_CONFIRMATION:-}" 'Type the application rollback confirmation'

export LINE_QUEUE_API_IMAGE=$previous_api
export LINE_QUEUE_WEB_IMAGE=$previous_web
compose config -q
compose pull api worker web
compose up -d --remove-orphans --wait api worker web
assert_media_mount
verify_runtime_health
log "Application rollback completed without data restore: $backup_id"
