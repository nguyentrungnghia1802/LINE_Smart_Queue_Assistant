#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../../.." && pwd -P)
BUILD_SCRIPT="$REPO_ROOT/deploy/scripts/build-push.sh"
DEPLOY_SCRIPT="$REPO_ROOT/deploy/scripts/deploy.sh"
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

git_sha=$(git -C "$REPO_ROOT" rev-parse HEAD)
release_tag="git-$git_sha"

build_output=$(
  IMAGE_NAMESPACE=example.invalid/line-queue \
  VITE_LIFF_ID=rehearsal-liff-id \
  DRY_RUN=true \
  bash "$BUILD_SCRIPT" "$release_tag" 2>&1
)
printf '%s\n' "$build_output"
grep -Fq "line-smart-queue-api:$release_tag" <<<"$build_output"
grep -Fq "line-smart-queue-web:$release_tag" <<<"$build_output"
grep -Fq "RELEASE_TAG=$release_tag" <<<"$build_output"
if grep -Eq '(:latest|latest)' <<<"$build_output"; then
  printf 'Manual build/push plan unexpectedly references latest\n' >&2
  exit 1
fi

deploy_output=$(DRY_RUN=true bash "$DEPLOY_SCRIPT" "$release_tag" 2>&1)
printf '%s\n' "$deploy_output"
grep -Fq 'deploy-safe.sh' <<<"$deploy_output"
grep -Fq "$release_tag" <<<"$deploy_output"

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
