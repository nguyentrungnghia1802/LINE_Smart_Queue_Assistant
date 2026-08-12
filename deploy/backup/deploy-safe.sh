#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

init_runtime
validate_compose
target_api=${LINE_QUEUE_API_IMAGE:-}
target_web=${LINE_QUEUE_WEB_IMAGE:-}
require_immutable_image "$target_api" LINE_QUEUE_API_IMAGE
require_immutable_image "$target_web" LINE_QUEUE_WEB_IMAGE

log 'Creating mandatory pre-deployment backup'
backup_id=$(
  BACKUP_ROOT="$BACKUP_ROOT" BACKUP_RETENTION_COUNT="$BACKUP_RETENTION_COUNT" \
    COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" POSTGRES_VERIFY_IMAGE="$POSTGRES_VERIFY_IMAGE" \
    "$SCRIPT_DIR/backup.sh"
)
"$SCRIPT_DIR/verify-backup.sh" "$backup_id" >/dev/null

if [[ ${DEPLOY_APPROVED:-} == GITHUB_ENVIRONMENT_APPROVED ]]; then
  confirmation="DEPLOY $backup_id"
else
  confirmation=${DEPLOY_CONFIRMATION:-}
fi
log "Verified restore point: $backup_id"
confirm_exact "DEPLOY $backup_id" "$confirmation" 'Type the deployment confirmation'

deploy_succeeded=false
on_deploy_exit() {
  local status=$?
  if [[ "$deploy_succeeded" != true ]]; then
    log "Deployment failed. Application rollback (no data restore): $SCRIPT_DIR/rollback.sh $backup_id"
    log "Full data restore requires separate confirmation: $SCRIPT_DIR/restore.sh $backup_id"
  fi
  exit "$status"
}
trap on_deploy_exit EXIT

export LINE_QUEUE_API_IMAGE=$target_api
export LINE_QUEUE_WEB_IMAGE=$target_web
compose config -q
compose pull api worker web
compose up -d postgres redis
run_migrations
compose up -d --remove-orphans --wait api worker web
assert_media_mount
verify_runtime_health
deploy_succeeded=true
trap - EXIT
log "Deployment completed. Pre-deployment restore point: $backup_id"
printf '%s\n' "$backup_id"
