#!/usr/bin/env bash

set -Eeuo pipefail
umask 077
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
# shellcheck source=common.sh
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

init_runtime
printf '%-16s  %-20s  %-8s  %-10s  %-10s  %s\n' ID CREATED_AT STATUS DATABASE MEDIA API_IMAGE
while IFS= read -r snapshot; do
  [[ -n "$snapshot" ]] || continue
  id=$(basename -- "$snapshot")
  created=$(manifest_value "$snapshot" created_at 2>/dev/null || printf '-')
  image=$(manifest_value "$snapshot" api_image 2>/dev/null || printf '-')
  db_size=$(du -h "$snapshot/database/postgres.dump" 2>/dev/null | awk '{print $1}' || printf '-')
  media_size=$(du -h "$snapshot/media/media.tar.gz" 2>/dev/null | awk '{print $1}' || printf '-')
  if verify_snapshot "$snapshot" true >/dev/null 2>&1; then
    status=VALID
  else
    status=INVALID
  fi
  printf '%-16s  %-20s  %-8s  %-10s  %-10s  %s\n' \
    "$id" "$created" "$status" "$db_size" "$media_size" "$image"
done < <(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '????????_??????' -print | sort -r)
