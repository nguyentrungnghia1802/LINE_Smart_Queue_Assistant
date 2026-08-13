#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../../.." && pwd -P)
BUILD_SCRIPT="$REPO_ROOT/deploy/scripts/build-push.ps1"
DEPLOY_SCRIPT="$REPO_ROOT/deploy/scripts/deploy.sh"
BACKUP_COMMON="$REPO_ROOT/deploy/backup/common.sh"
NGINX_CONFIG="$REPO_ROOT/docker/nginx/default.conf"
DEPLOY_COMPOSE="$REPO_ROOT/deploy/docker-compose.yml"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing command: %s\n' "$1" >&2
    exit 1
  }
}

require bash
require git
require grep
require pwsh

test_root=$(mktemp -d "${TMPDIR:-/tmp}/line-queue-deploy-config.XXXXXX")
cleanup() {
  rm -rf -- "$test_root"
}
trap cleanup EXIT

git_sha=$(git -C "$REPO_ROOT" rev-parse HEAD)
short_sha=${git_sha:0:12}
release_tag="git-$short_sha"
[[ "$release_tag" =~ ^git-[0-9a-f]{12}$ ]]

# The manual wrapper is deliberately short-tag-only, while the shared backup gate must retain
# compatibility with the full-SHA automatic GitHub CD publisher.
# shellcheck source=../../backup/common.sh
# shellcheck disable=SC1091
source "$BACKUP_COMMON"
require_release_tag "$release_tag"
require_release_tag "git-$git_sha"
if (require_release_tag "git-${short_sha}0") >/dev/null 2>&1; then
  printf 'Shared backup gate unexpectedly accepted a 13-character SHA tag\n' >&2
  exit 1
fi
is_immutable_image 'registry.example:5000/team/api:git-111111111111'
is_immutable_image 'registry.example/team/api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
if is_immutable_image 'registry.example:5000/team/api'; then
  printf 'Registry port without an image tag was unexpectedly accepted as immutable\n' >&2
  exit 1
fi
if is_immutable_image 'registry.example/team/api@sha256:short'; then
  printf 'Malformed image digest was unexpectedly accepted as immutable\n' >&2
  exit 1
fi

cat > "$test_root/.env" <<'EOF'
LINE_QUEUE_API_REPOSITORY=example.invalid/line-queue-api
LINE_QUEUE_WEB_REPOSITORY=example.invalid/line-queue-web
LINE_QUEUE_API_IMAGE=example.invalid/line-queue-api:latest
LINE_QUEUE_WEB_IMAGE=example.invalid/line-queue-web:git-111111111111
BACKUP_ROOT=/var/backups/line-smart-queue
BACKUP_RETENTION_COUNT=14
EOF
chmod 600 "$test_root/.env"
config_output=$(
  ENV_FILE="$test_root/.env" bash -c '
    source "$1"
    load_release_configuration
    release_image_references "$2"
  ' _ "$BACKUP_COMMON" "$release_tag"
)
[[ "$config_output" == $'example.invalid/line-queue-api:'"$release_tag"$'\texample.invalid/line-queue-web:'"$release_tag" ]]

printf '%s\n' 'LINE_QUEUE_API_REPOSITORY=example.invalid/duplicate' >> "$test_root/.env"
if ENV_FILE="$test_root/.env" bash -c 'source "$1"; load_release_configuration' \
  _ "$BACKUP_COMMON" >/dev/null 2>&1; then
  printf 'Release configuration unexpectedly accepted a duplicate environment key\n' >&2
  exit 1
fi
sed -i '$d' "$test_root/.env"

mkdir -p "$test_root/bin"
cat > "$test_root/bin/docker" <<'EOF'
#!/usr/bin/env bash
printf '%s\t%s\t%s\t%s\n' \
  "${LINE_QUEUE_API_REPOSITORY-unset}" "${LINE_QUEUE_WEB_REPOSITORY-unset}" \
  "${LINE_QUEUE_API_IMAGE-unset}" "${LINE_QUEUE_WEB_IMAGE-unset}" > "$COMPOSE_ENV_PROBE"
EOF
chmod +x "$test_root/bin/docker"
touch "$test_root/docker-compose.yml"
COMPOSE_ENV_PROBE="$test_root/compose-env.txt" PATH="$test_root/bin:$PATH" \
  ENV_FILE="$test_root/.env" COMPOSE_FILE="$test_root/docker-compose.yml" \
  LINE_QUEUE_API_REPOSITORY=ambient.invalid/api \
  LINE_QUEUE_WEB_REPOSITORY=ambient.invalid/web \
  LINE_QUEUE_API_IMAGE=ambient.invalid/api:latest \
  LINE_QUEUE_WEB_IMAGE=ambient.invalid/web:latest \
  bash -c 'source "$1"; compose config -q' _ "$BACKUP_COMMON"
[[ $(cat "$test_root/compose-env.txt") == $'unset\tunset\tunset\tunset' ]]

env_source_pattern='(^|[[:space:]])(source|\.)[[:space:]]+[^#]*\.env'
mkdir -p "$test_root/source-scan"
printf '%s\n' 'source deploy/.env' > "$test_root/source-scan/unsafe.sh"
if ! grep -R -E --include='*.sh' --include='*.ps1' \
  "$env_source_pattern" "$test_root/source-scan" >/dev/null; then
  printf 'Environment-source safety scan did not detect its unsafe fixture\n' >&2
  exit 1
fi

if grep -R -n -E --include='*.sh' --include='*.ps1' \
  "$env_source_pattern" "$REPO_ROOT/deploy" >/dev/null; then
  printf 'Deployment tooling must parse selected keys and never source an environment file\n' >&2
  exit 1
fi

for contract_file in "$DEPLOY_SCRIPT" "$REPO_ROOT/deploy/backup/deploy-safe.sh" "$BACKUP_COMMON"; do
  grep -Fxq '# DEPLOY_TOOLING_CONTRACT_VERSION=2' "$contract_file"
done

mkdir -p "$test_root/mismatch/scripts" "$test_root/mismatch/backup"
cp "$DEPLOY_SCRIPT" "$test_root/mismatch/scripts/deploy.sh"
printf '%s\n' '#!/usr/bin/env bash' 'exit 0' > "$test_root/mismatch/backup/deploy-safe.sh"
printf '%s\n' '#!/usr/bin/env bash' > "$test_root/mismatch/backup/common.sh"
chmod +x "$test_root/mismatch/scripts/deploy.sh" "$test_root/mismatch/backup/deploy-safe.sh"
if DRY_RUN=true bash "$test_root/mismatch/scripts/deploy.sh" "$release_tag" >/dev/null 2>&1; then
  printf 'Manual deploy wrapper unexpectedly accepted mixed tooling versions\n' >&2
  exit 1
fi

build_output=$(
  pwsh -NoProfile -File "$BUILD_SCRIPT" \
    -ImageNamespace example.invalid/line-queue \
    -LiffId rehearsal-liff-id \
    -DryRun \
    -AllowDirty 2>&1
)
printf '%s\n' "$build_output"
grep -Fq "line-smart-queue-api:$release_tag" <<<"$build_output"
grep -Fq "line-smart-queue-web:$release_tag" <<<"$build_output"
grep -Fq "org.opencontainers.image.revision=$git_sha" <<<"$build_output"
grep -Fq 'LINE_LOGIN_LIFF_ID=rehearsal-liff-id' <<<"$build_output"
retired_liff_variable='VITE_''LIFF_ID'
if grep -Fq "$retired_liff_variable" <<<"$build_output"; then
  printf 'Manual build/push plan still uses the retired %s build argument\n' \
    "$retired_liff_variable" >&2
  exit 1
fi
grep -Fq "DEPLOY_TAG=$release_tag" <<<"$build_output"
grep -Fq "API_IMAGE=example.invalid/line-queue/line-smart-queue-api:$release_tag" <<<"$build_output"
grep -Fq "WEB_IMAGE=example.invalid/line-queue/line-smart-queue-web:$release_tag" <<<"$build_output"
grep -Fq "VPS_COMMAND=bash deploy/scripts/deploy.sh $release_tag" <<<"$build_output"
if grep -Eq '(:latest|latest)' <<<"$build_output"; then
  printf 'Manual build/push plan unexpectedly references latest\n' >&2
  exit 1
fi

if pwsh -NoProfile -File "$BUILD_SCRIPT" "$release_tag" \
  -ImageNamespace example.invalid/line-queue -LiffId rehearsal-liff-id \
  -DryRun -AllowDirty >/dev/null 2>&1; then
  printf 'Manual build/push unexpectedly accepted an operator-supplied tag\n' >&2
  exit 1
fi

deploy_output=$(DRY_RUN=true bash "$DEPLOY_SCRIPT" "$release_tag" 2>&1)
printf '%s\n' "$deploy_output"
grep -Fq 'deploy-safe.sh' <<<"$deploy_output"
grep -Fq "$release_tag" <<<"$deploy_output"

if DRY_RUN=true bash "$DEPLOY_SCRIPT" >/dev/null 2>&1; then
  printf 'Manual deploy wrapper unexpectedly accepted a missing tag\n' >&2
  exit 1
fi
if DRY_RUN=true bash "$DEPLOY_SCRIPT" "$release_tag" "$release_tag" >/dev/null 2>&1; then
  printf 'Manual deploy wrapper unexpectedly accepted more than one argument\n' >&2
  exit 1
fi

if DRY_RUN=true bash "$DEPLOY_SCRIPT" "git-$git_sha" >/dev/null 2>&1; then
  printf 'Manual deploy wrapper unexpectedly accepted a non-generated full-SHA tag\n' >&2
  exit 1
fi

[[ "$(grep -Fc "image: \${LINE_QUEUE_API_IMAGE" "$DEPLOY_COMPOSE")" -eq 2 ]]
[[ "$(grep -Fc "image: \${LINE_QUEUE_WEB_IMAGE" "$DEPLOY_COMPOSE")" -eq 1 ]]

grep -Fq 'resolver 127.0.0.11 valid=10s ipv6=off;' "$NGINX_CONFIG"
grep -Fq "set \$api_upstream http://api:4000;" "$NGINX_CONFIG"
grep -Fq "proxy_pass \$api_upstream;" "$NGINX_CONFIG"
if grep -Eq 'proxy_pass http://api:4000;' "$NGINX_CONFIG"; then
  printf 'Web nginx still contains startup-only API hostname proxying\n' >&2
  exit 1
fi

printf 'Manual immutable build/deploy and runtime-DNS rehearsal passed: %s\n' "$release_tag"
