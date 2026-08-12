#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

init_runtime
snapshot=$(resolve_snapshot "${1:-latest}")
backup_id=$(basename -- "$snapshot")
log "Verifying backup: $backup_id"
verify_snapshot "$snapshot" true || die "Backup is incomplete, corrupt, or unsafe: $backup_id"
log "Backup is valid: $backup_id"
printf '%s\n' "$backup_id"
