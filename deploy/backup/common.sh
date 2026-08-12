#!/usr/bin/env bash

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
  local key=$1 file=$2 line
  [[ -f "$file" ]] || return 1
  line=$(grep -E "^${key}=" "$file" | tail -n 1 || true)
  [[ -n "$line" ]] || return 1
  line=${line#*=}
  line=${line%$'\r'}
  if [[ "$line" == \"*\" && "$line" == *\" ]]; then
    line=${line:1:${#line}-2}
  elif [[ "$line" == \'*\' && "$line" == *\' ]]; then
    line=${line:1:${#line}-2}
  fi
  printf '%s' "$line"
}

load_backup_settings() {
  if [[ -z "${BACKUP_ROOT:-}" ]]; then
    BACKUP_ROOT=$(read_env_value BACKUP_ROOT "$ENV_FILE" || printf '/var/backups/line-smart-queue')
  fi
  if [[ -z "${BACKUP_RETENTION_COUNT:-}" ]]; then
    BACKUP_RETENTION_COUNT=$(read_env_value BACKUP_RETENTION_COUNT "$ENV_FILE" || printf '14')
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
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
  )
}

validate_compose() {
  [[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
  [[ -f "$ENV_FILE" ]] || die "Environment file not found: $ENV_FILE"
  compose config -q
  local service
  for service in postgres api worker web; do
    compose config --services | grep -Fxq "$service" || die "Compose service missing: $service"
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
  local file=$1 path
  while IFS= read -r path; do
    path=${path#*  }
    [[ -n "$path" && "$path" != /* && "$path" != ../* && "$path" != *'/../'* ]] ||
      return 1
  done < "$file"
}

checksum_contains_path() {
  local checksum_file=$1 expected_path=$2
  awk -v expected="$expected_path" \
    '$2 == expected && length($1) == 64 { found = 1 } END { exit(found ? 0 : 1) }' \
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
  [[ "$image" != latest && "$image" != *:latest ]] || die "$label cannot use the latest tag"
  [[ "$image" == *@sha256:* || "$image" == *:* ]] || die "$label must use an immutable tag or digest"
}

confirm_exact() {
  local expected=$1 supplied=${2:-} prompt=${3:-'Type the confirmation text'}
  if [[ -z "$supplied" && -t 0 ]]; then
    printf '%s [%s]: ' "$prompt" "$expected" >&2
    IFS= read -r supplied
  fi
  [[ "$supplied" == "$expected" ]] || die "Confirmation did not match exactly: $expected"
}
