#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

[[ $# -eq 1 ]] || die 'Usage: deploy-safe.sh <git-12-or-40-character-sha-tag>'
release_tag=$1
require_release_tag "$release_tag"
init_runtime
validate_compose
IFS=$'\t' read -r target_api target_web < <(release_image_references "$release_tag")
[[ -n "$target_api" && -n "$target_web" ]] || die 'Failed to resolve release image references'

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
log "Release tag: $release_tag"
log "API image: $target_api"
log "Web image: $target_web"
confirm_exact "DEPLOY $backup_id" "$confirmation" 'Type the deployment confirmation'

deploy_succeeded=false
release_mutation_started=false
on_deploy_exit() {
  local status=$?
  if [[ "$deploy_succeeded" != true ]]; then
    trap - EXIT
    if [[ "$release_mutation_started" == true ]]; then
      log "Deployment failed. Attempting application rollback from verified metadata: $backup_id"
      if ROLLBACK_CONFIRMATION="ROLLBACK $backup_id" "$SCRIPT_DIR/rollback.sh" "$backup_id"; then
        log 'Application rollback completed; deployment remains failed for operator investigation'
      else
        log "Automatic application rollback failed. Retry manually: $SCRIPT_DIR/rollback.sh $backup_id"
      fi
    else
      log 'Deployment failed before release state was changed; application rollback was not required'
    fi
    log "Full data restore requires separate confirmation: $SCRIPT_DIR/restore.sh $backup_id"
  fi
  exit "$status"
}
trap on_deploy_exit EXIT

release_mutation_started=true
update_env_image_references "$target_api" "$target_web"
export LINE_QUEUE_API_IMAGE=$target_api
export LINE_QUEUE_WEB_IMAGE=$target_web
compose config -q
pull_release_images
compose up -d postgres redis
run_migrations
compose up -d --remove-orphans --wait api worker web
assert_media_mount
verify_runtime_health
deploy_succeeded=true
trap - EXIT
log "Deployment completed. Pre-deployment restore point: $backup_id"
printf '%s\n' "$backup_id"
