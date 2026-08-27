#!/usr/bin/env bash
# DEPLOY_TOOLING_CONTRACT_VERSION=2

set -Eeuo pipefail
umask 077

BACKUP_SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$BACKUP_SCRIPT_DIR/../.." && pwd -P)
COMPOSE_FILE=${COMPOSE_FILE:-"$REPO_ROOT/deploy/docker-compose.yml"}
ENV_FILE=${ENV_FILE:-"$REPO_ROOT/deploy/.env"}
POSTGRES_VERIFY_IMAGE=${POSTGRES_VERIFY_IMAGE:-postgres:16-alpine}

log() {
  printf '[backup-ops] %s\n' "$*" >&2
}

die() {
  log "ERROR: $*"
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

read_env_value() {
  local key=$1 file=$2 line count
  [[ -f "$file" ]] || return 1
  count=$(grep -Ec "^${key}=" "$file" || true)
  if ((count > 1)); then
    log "ERROR: Environment file contains duplicate key: $key"
    return 2
  fi
  ((count == 1)) || return 1
  line=$(grep -E "^${key}=" "$file")
  line=${line#*=}
  line=${line%$'\r'}
  if [[ "$line" == \"*\" && "$line" == *\" ]]; then
    line=${line:1:${#line}-2}
  elif [[ "$line" == \'*\' && "$line" == *\' ]]; then
    line=${line:1:${#line}-2}
  fi
  printf '%s' "$line"
}

require_env_value() {
  local key=$1 file=$2 value status
  if value=$(read_env_value "$key" "$file"); then
    :
  else
    status=$?
    ((status == 1)) && die "Required environment key is missing: $key"
    exit "$status"
  fi
  safe_metadata_value "$value" "$key"
  printf '%s' "$value"
}

load_backup_settings() {
  local value status
  if [[ -z "${BACKUP_ROOT:-}" ]]; then
    if value=$(read_env_value BACKUP_ROOT "$ENV_FILE"); then
      BACKUP_ROOT=$value
    else
      status=$?
      ((status == 1)) || exit "$status"
      BACKUP_ROOT=/var/backups/line-smart-queue
    fi
  fi
  if [[ -z "${BACKUP_RETENTION_COUNT:-}" ]]; then
    if value=$(read_env_value BACKUP_RETENTION_COUNT "$ENV_FILE"); then
      BACKUP_RETENTION_COUNT=$value
    else
      status=$?
      ((status == 1)) || exit "$status"
      BACKUP_RETENTION_COUNT=14
    fi
  fi
  export BACKUP_ROOT BACKUP_RETENTION_COUNT
}

validate_backup_root() {
  [[ "$BACKUP_ROOT" == /* ]] || die 'BACKUP_ROOT must be an absolute path'
  [[ "$BACKUP_ROOT" != / ]] || die 'BACKUP_ROOT cannot be /'
  [[ "$BACKUP_RETENTION_COUNT" =~ ^[0-9]+$ ]] || die 'BACKUP_RETENTION_COUNT must be an integer'
  (( BACKUP_RETENTION_COUNT >= 2 )) || die 'BACKUP_RETENTION_COUNT must be at least 2'

  local candidate parent resolved
  candidate=$BACKUP_ROOT
  while [[ ! -e "$candidate" ]]; do
    parent=$(dirname -- "$candidate")
    [[ "$parent" != "$candidate" ]] || break
    candidate=$parent
  done
  resolved=$(cd -- "$candidate" && pwd -P)
  case "$resolved/" in
    "$REPO_ROOT/"*) die 'BACKUP_ROOT must be outside the Git checkout' ;;
  esac
}

init_runtime() {
  require_command docker
  require_command sha256sum
  require_command tar
  require_command gzip
  load_backup_settings
  validate_backup_root
  mkdir -p -- "$BACKUP_ROOT"
  chmod 700 -- "$BACKUP_ROOT"
}

compose() {
  (
    cd -- "$REPO_ROOT"
    # The server-side file is authoritative for release selection. Docker Compose otherwise gives
    # ambient shell variables precedence over --env-file, which can silently select stale images.
    env -u LINE_QUEUE_API_REPOSITORY -u LINE_QUEUE_WEB_REPOSITORY \
      -u LINE_QUEUE_API_IMAGE -u LINE_QUEUE_WEB_IMAGE \
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
  )
}

validate_compose() {
  [[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
  [[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"
  compose config -q
  local service services
  services=$(compose config --services)
  for service in postgres api worker web; do
    grep -Fx "$service" <<<"$services" >/dev/null || die "Compose service missing: $service"
  done
}

container_id() {
  compose ps -aq "$1" | head -n 1
}

service_is_running() {
  local id
  id=$(container_id "$1")
  [[ -n "$id" ]] && [[ $(docker inspect --format '{{.State.Running}}' "$id") == true ]]
}

require_running_service() {
  service_is_running "$1" || die "Compose service must be running: $1"
}

assert_media_mount() {
  local id mount_type
  id=$(container_id api)
  [[ -n "$id" ]] || die 'API container does not exist; start the production stack first'
  mount_type=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/var/media"}}{{.Type}}{{end}}{{end}}' "$id")
  case "$mount_type" in
    volume|bind) ;;
    *) die 'API /app/var/media must be backed by a Docker volume or bind mount' ;;
  esac
}

runtime_media_provider() {
  local id value
  id=$(container_id api)
  [[ -n "$id" ]] || die 'API container does not exist'
  value=$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" |
    awk -F= '$1 == "MEDIA_STORAGE_PROVIDER" { print substr($0, index($0, "=") + 1); exit }')
  printf '%s' "${value:-local}"
}

safe_metadata_value() {
  local value=$1 label=$2
  [[ -n "$value" ]] || die "Metadata value is empty: $label"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* && "$value" != *$'\t'* ]] ||
    die "Metadata value contains control characters: $label"
}

image_reference() {
  local id value
  id=$(container_id "$1")
  [[ -n "$id" ]] || die "Container does not exist: $1"
  value=$(docker inspect --format '{{.Config.Image}}' "$id")
  safe_metadata_value "$value" "$1 image"
  printf '%s' "$value"
}

image_id() {
  local id value
  id=$(container_id "$1")
  [[ -n "$id" ]] || die "Container does not exist: $1"
  value=$(docker inspect --format '{{.Image}}' "$id")
  safe_metadata_value "$value" "$1 image ID"
  printf '%s' "$value"
}

validate_backup_id() {
  [[ "$1" =~ ^[0-9]{8}_[0-9]{6}$ ]] || die "Invalid backup ID: $1"
}

manifest_value() {
  local snapshot=$1 key=$2
  awk -F '\t' -v key="$key" '$1 == key { print substr($0, index($0, "\t") + 1); exit }' \
    "$snapshot/metadata/manifest.tsv"
}

resolve_snapshot() {
  local requested=${1:-latest} candidate
  if [[ "$requested" == latest ]]; then
    candidate=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
      -name '????????_??????' -exec test -f '{}/BACKUP_SUCCESS' \; -print |
      sort | tail -n 1)
    [[ -n "$candidate" ]] || die "No completed backup found under $BACKUP_ROOT"
    printf '%s' "$candidate"
    return
  fi
  validate_backup_id "$requested"
  candidate="$BACKUP_ROOT/$requested"
  [[ -d "$candidate" ]] || die "Backup not found: $requested"
  printf '%s' "$candidate"
}

validate_checksum_paths() {
  local file=$1 line marker path
  while IFS= read -r line; do
    [[ ${#line} -gt 66 ]] || return 1
    [[ ${line:0:64} =~ ^[0-9a-f]{64}$ ]] || return 1
    marker=${line:64:2}
    [[ "$marker" == '  ' || "$marker" == ' *' ]] || return 1
    path=${line:66}
    [[ -n "$path" && "$path" != /* && "$path" != ../* && "$path" != *'/../'* ]] ||
      return 1
  done < "$file"
}

checksum_contains_path() {
  local checksum_file=$1 expected_path=$2
  awk -v expected="$expected_path" \
    'length($1) == 64 && (substr($0, 65, 2) == "  " || substr($0, 65, 2) == " *") && substr($0, 67) == expected { found = 1 } END { exit(found ? 0 : 1) }' \
    "$checksum_file"
}

validate_media_archive_paths() {
  local archive=$1 entry listing
  listing=$(tar -tzf "$archive") || return 1
  while IFS= read -r entry; do
    [[ "$entry" != /* && "$entry" != ../* && "$entry" != *'/../'* ]] || return 1
  done <<< "$listing"
}

verify_snapshot() {
  local snapshot=$1 require_marker=${2:-true} media_included media_provider backup_id key value
  backup_id=$(manifest_value "$snapshot" backup_id 2>/dev/null || true)
  [[ "$backup_id" =~ ^[0-9]{8}_[0-9]{6}$ ]] || return 1

  [[ -d "$snapshot" ]] || return 1
  if [[ "$require_marker" == true ]]; then
    [[ -f "$snapshot/BACKUP_SUCCESS" ]] || return 1
  fi
  [[ -s "$snapshot/database/postgres.dump" ]] || return 1
  [[ -s "$snapshot/metadata/manifest.tsv" ]] || return 1
  [[ -s "$snapshot/SHA256SUMS" ]] || return 1
  [[ $(manifest_value "$snapshot" schema_version) == 1 ]] || return 1
  if [[ "$require_marker" == true ]]; then
    [[ $(basename -- "$snapshot") == "$backup_id" ]] || return 1
  fi

  validate_checksum_paths "$snapshot/SHA256SUMS" || return 1
  checksum_contains_path "$snapshot/SHA256SUMS" database/postgres.dump || return 1
  checksum_contains_path "$snapshot/SHA256SUMS" metadata/manifest.tsv || return 1
  (cd -- "$snapshot" && sha256sum -c --status SHA256SUMS) || return 1
  docker run --rm -i "$POSTGRES_VERIFY_IMAGE" pg_restore --list \
    < "$snapshot/database/postgres.dump" >/dev/null || return 1

  media_included=$(manifest_value "$snapshot" media_included)
  media_provider=$(manifest_value "$snapshot" media_provider)
  case "$media_included" in
    true)
      [[ "$media_provider" == local ]] || return 1
      [[ -s "$snapshot/media/media.tar.gz" ]] || return 1
      checksum_contains_path "$snapshot/SHA256SUMS" media/media.tar.gz || return 1
      gzip -t "$snapshot/media/media.tar.gz" || return 1
      validate_media_archive_paths "$snapshot/media/media.tar.gz" || return 1
      ;;
    false)
      [[ "$media_provider" == s3 ]] || return 1
      [[ ! -e "$snapshot/media/media.tar.gz" ]] || return 1
      ;;
    *) return 1 ;;
  esac

  for key in created_at api_image api_image_id web_image web_image_id postgres_image postgres_version tooling_revision; do
    value=$(manifest_value "$snapshot" "$key")
    [[ -n "$value" && "$value" != *$'\r'* && "$value" != *$'\n'* ]] || return 1
  done
  is_immutable_image "$(manifest_value "$snapshot" api_image)" || return 1
  is_immutable_image "$(manifest_value "$snapshot" web_image)" || return 1
}

test_mode_enabled() {
  [[ ${OPS_TEST_MODE:-false} == true ]]
}

allow_test_skip() {
  local variable=$1
  if [[ ${!variable:-false} == true ]]; then
    test_mode_enabled || die "$variable may only be used with OPS_TEST_MODE=true"
    return 0
  fi
  return 1
}

run_migrations() {
  if allow_test_skip OPS_SKIP_MIGRATIONS; then
    log 'Test mode: migration check skipped'
    return
  fi
  compose run --rm -T api npm run db:migrate
}

verify_runtime_health() {
  if allow_test_skip OPS_SKIP_HEALTH; then
    log 'Test mode: runtime health probes skipped'
    return
  fi
  compose exec -T api sh -eu -c 'wget -qO- http://127.0.0.1:4000/health >/dev/null; wget -qO- http://127.0.0.1:4000/ready >/dev/null'
  compose exec -T web wget -qO- http://127.0.0.1/health >/dev/null
}

require_immutable_image() {
  local image=$1 label=$2
  safe_metadata_value "$image" "$label"
  is_immutable_image "$image" || die "$label must use an immutable non-latest tag or digest"
}

is_immutable_image() {
  local image=$1 final_segment tag
  [[ -n "$image" && "$image" != latest && "$image" != *:latest ]] || return 1
  if [[ "$image" =~ @sha256:[0-9a-f]{64}$ ]]; then
    return 0
  fi
  [[ "$image" != *@* ]] || return 1
  final_segment=${image##*/}
  [[ "$final_segment" == *:* ]] || return 1
  tag=${final_segment##*:}
  [[ -n "$tag" && "$tag" =~ ^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$ ]]
}

require_release_tag() {
  local tag=$1
  [[ "$tag" =~ ^git-([0-9a-f]{12}|[0-9a-f]{40})$ ]] ||
    die 'Release tag must be git- followed by a 12- or 40-character lowercase Git SHA'
}

require_image_repository() {
  local repository=$1 label=$2 final_segment
  safe_metadata_value "$repository" "$label"
  [[ "$repository" =~ ^[A-Za-z0-9][A-Za-z0-9._:/-]*$ ]] ||
    die "$label contains unsupported characters"
  [[ "$repository" != *//* && "$repository" != *..* && "$repository" != *@* ]] ||
    die "$label must be an untagged Docker repository"
  final_segment=${repository##*/}
  [[ -n "$final_segment" && "$final_segment" != *:* ]] ||
    die "$label must not include an image tag or trailing slash"
}

image_uses_repository() {
  local image=$1 repository=$2
  [[ "$image" == "$repository":* || "$image" == "$repository"@sha256:* ]]
}

load_release_configuration() {
  local legacy_api_repository legacy_web_repository status
  [[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"

  RELEASE_API_REPOSITORY=$(require_env_value LINE_QUEUE_API_REPOSITORY "$ENV_FILE")
  RELEASE_WEB_REPOSITORY=$(require_env_value LINE_QUEUE_WEB_REPOSITORY "$ENV_FILE")
  CURRENT_API_IMAGE=$(require_env_value LINE_QUEUE_API_IMAGE "$ENV_FILE")
  CURRENT_WEB_IMAGE=$(require_env_value LINE_QUEUE_WEB_IMAGE "$ENV_FILE")

  # During the one-time registry migration the untagged repositories may already point to GHCR
  # while the running stack still references Docker Hub. These optional, server-owned aliases
  # make that transition explicit and allow backup to resolve the old running images exactly.
  RELEASE_API_LEGACY_REPOSITORY=''
  if legacy_api_repository=$(read_env_value LINE_QUEUE_API_LEGACY_REPOSITORY "$ENV_FILE"); then
    safe_metadata_value "$legacy_api_repository" LINE_QUEUE_API_LEGACY_REPOSITORY
    RELEASE_API_LEGACY_REPOSITORY=$legacy_api_repository
  else
    status=$?
    ((status == 1)) || exit "$status"
  fi
  RELEASE_WEB_LEGACY_REPOSITORY=''
  if legacy_web_repository=$(read_env_value LINE_QUEUE_WEB_LEGACY_REPOSITORY "$ENV_FILE"); then
    safe_metadata_value "$legacy_web_repository" LINE_QUEUE_WEB_LEGACY_REPOSITORY
    RELEASE_WEB_LEGACY_REPOSITORY=$legacy_web_repository
  else
    status=$?
    ((status == 1)) || exit "$status"
  fi

  require_image_repository "$RELEASE_API_REPOSITORY" LINE_QUEUE_API_REPOSITORY
  require_image_repository "$RELEASE_WEB_REPOSITORY" LINE_QUEUE_WEB_REPOSITORY
  if ! image_uses_repository "$CURRENT_API_IMAGE" "$RELEASE_API_REPOSITORY"; then
    [[ -n "$RELEASE_API_LEGACY_REPOSITORY" ]] ||
      die 'LINE_QUEUE_API_IMAGE must belong to LINE_QUEUE_API_REPOSITORY'
    require_image_repository "$RELEASE_API_LEGACY_REPOSITORY" LINE_QUEUE_API_LEGACY_REPOSITORY
    image_uses_repository "$CURRENT_API_IMAGE" "$RELEASE_API_LEGACY_REPOSITORY" ||
      die 'LINE_QUEUE_API_IMAGE must belong to the configured API repository or explicit migration alias'
  fi
  if ! image_uses_repository "$CURRENT_WEB_IMAGE" "$RELEASE_WEB_REPOSITORY"; then
    [[ -n "$RELEASE_WEB_LEGACY_REPOSITORY" ]] ||
      die 'LINE_QUEUE_WEB_IMAGE must belong to LINE_QUEUE_WEB_REPOSITORY'
    require_image_repository "$RELEASE_WEB_LEGACY_REPOSITORY" LINE_QUEUE_WEB_LEGACY_REPOSITORY
    image_uses_repository "$CURRENT_WEB_IMAGE" "$RELEASE_WEB_LEGACY_REPOSITORY" ||
      die 'LINE_QUEUE_WEB_IMAGE must belong to the configured Web repository or explicit migration alias'
  fi
}

normalized_repository() {
  local repository=$1
  repository=${repository#docker.io/}
  repository=${repository#index.docker.io/}
  if [[ "$repository" != */* ]]; then
    repository="library/$repository"
  fi
  printf '%s' "$repository"
}

rollback_image_reference() {
  local service=$1 repository=$2 configured image_id digest digest_repository expected_repository
  local legacy_repository=''
  case "$service" in
    api) legacy_repository=${RELEASE_API_LEGACY_REPOSITORY:-} ;;
    web) legacy_repository=${RELEASE_WEB_LEGACY_REPOSITORY:-} ;;
  esac
  configured=$(image_reference "$service")
  if is_immutable_image "$configured"; then
    printf '%s' "$configured"
    return
  fi

  [[ "$configured" == latest || "$configured" == *:latest ]] ||
    die "$service image is not an immutable tag or digest: $configured"

  image_id=$(image_id "$service")
  if ! image_uses_repository "$configured" "$repository" && [[ -n "$legacy_repository" ]]; then
    require_image_repository "$legacy_repository" "${service^^} legacy repository"
    image_uses_repository "$configured" "$legacy_repository" ||
      die "$service image does not belong to the configured or migration repository"
    repository=$legacy_repository
  fi
  expected_repository=$(normalized_repository "$repository")
  while IFS= read -r digest; do
    [[ "$digest" =~ @sha256:[0-9a-f]{64}$ ]] || continue
    digest_repository=${digest%@sha256:*}
    if [[ $(normalized_repository "$digest_repository") == "$expected_repository" ]]; then
      log "Resolved legacy $service latest reference to its running registry digest"
      printf '%s@sha256:%s' "$repository" "${digest##*@sha256:}"
      return
    fi
  done < <(docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' "$image_id")

  die "Cannot create an exact rollback reference for legacy $service image: $configured"
}

release_image_references() {
  local tag=$1
  require_release_tag "$tag"
  [[ -n "${RELEASE_API_REPOSITORY:-}" && -n "${RELEASE_WEB_REPOSITORY:-}" ]] ||
    load_release_configuration
  printf '%s\t%s\n' "$RELEASE_API_REPOSITORY:$tag" "$RELEASE_WEB_REPOSITORY:$tag"
}

update_env_image_references() {
  local api_image=$1 web_image=$2 temp_file api_count web_count
  require_immutable_image "$api_image" LINE_QUEUE_API_IMAGE
  require_immutable_image "$web_image" LINE_QUEUE_WEB_IMAGE
  [[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"

  api_count=$(grep -c '^LINE_QUEUE_API_IMAGE=' "$ENV_FILE" || true)
  web_count=$(grep -c '^LINE_QUEUE_WEB_IMAGE=' "$ENV_FILE" || true)
  (( api_count <= 1 && web_count <= 1 )) || die 'Environment file contains duplicate image keys'

  temp_file=$(mktemp "$(dirname -- "$ENV_FILE")/.env.images.XXXXXX")
  chmod 600 -- "$temp_file"
  if ! awk -v api="$api_image" -v web="$web_image" '
    BEGIN { api_seen = 0; web_seen = 0 }
    /^LINE_QUEUE_API_IMAGE=/ { print "LINE_QUEUE_API_IMAGE=" api; api_seen = 1; next }
    /^LINE_QUEUE_WEB_IMAGE=/ { print "LINE_QUEUE_WEB_IMAGE=" web; web_seen = 1; next }
    { print }
    END {
      if (!api_seen) print "LINE_QUEUE_API_IMAGE=" api
      if (!web_seen) print "LINE_QUEUE_WEB_IMAGE=" web
    }
  ' "$ENV_FILE" > "$temp_file"; then
    rm -f -- "$temp_file"
    die 'Failed to prepare the atomic image-reference update'
  fi
  if ! mv -f -- "$temp_file" "$ENV_FILE"; then
    rm -f -- "$temp_file"
    die 'Failed to install the atomic image-reference update'
  fi
  chmod 600 -- "$ENV_FILE"
}

pull_release_images() {
  if allow_test_skip OPS_SKIP_PULL; then
    log 'Test mode: image pull skipped'
    return
  fi
  compose pull api worker web
}

confirm_exact() {
  local expected=$1 supplied=${2:-} prompt=${3:-'Type the confirmation text'}
  if [[ -z "$supplied" && -t 0 ]]; then
    printf '%s [%s]: ' "$prompt" "$expected" >&2
    IFS= read -r supplied
  fi
  [[ "$supplied" == "$expected" ]] || die "Confirmation did not match exactly: $expected"
}
