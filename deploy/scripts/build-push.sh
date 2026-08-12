#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd -P)

die() {
  printf '[release-build] ERROR: %s\n' "$*" >&2
  exit 1
}

log() {
  printf '[release-build] %s\n' "$*" >&2
}

usage() {
  printf 'Usage: %s\n' "$0" >&2
  exit 2
}

[[ $# -eq 0 ]] || usage

git_sha=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null) || die 'Unable to resolve the repository HEAD SHA'
[[ "$git_sha" =~ ^[0-9a-f]{40}$ ]] || die 'Repository HEAD must resolve to a full lowercase Git SHA'
short_sha=${git_sha:0:12}
release_tag="git-$short_sha"

image_namespace=${IMAGE_NAMESPACE:-${DOCKERHUB_NAMESPACE:-}}
if [[ -z "$image_namespace" && -n "${DOCKERHUB_USERNAME:-}" ]]; then
  image_namespace="docker.io/$DOCKERHUB_USERNAME"
fi
[[ -n "$image_namespace" ]] ||
  die 'Set IMAGE_NAMESPACE (or DOCKERHUB_NAMESPACE/DOCKERHUB_USERNAME) before publishing'

api_repository=${API_IMAGE_REPOSITORY:-"$image_namespace/line-smart-queue-api"}
web_repository=${WEB_IMAGE_REPOSITORY:-"$image_namespace/line-smart-queue-web"}
for repository in "$api_repository" "$web_repository"; do
  [[ "$repository" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*[A-Za-z0-9]$ ]] ||
    die "Invalid image repository: $repository"
  [[ "$repository" != *//* && "$repository" != *..* && "$repository" != *@* && "$repository" != *:* ]] ||
    die "Image repository must be untagged and safe: $repository"
done

[[ -n "${VITE_LIFF_ID:-}" ]] || die 'VITE_LIFF_ID is required for the immutable Web image'
[[ "$VITE_LIFF_ID" =~ ^[A-Za-z0-9._-]+$ ]] || die 'VITE_LIFF_ID contains unsupported characters'

docker_platform=${DOCKER_PLATFORM:-linux/amd64}
[[ "$docker_platform" =~ ^linux/[A-Za-z0-9._/-]+$ ]] || die 'DOCKER_PLATFORM must be a Linux Docker platform'

api_image="$api_repository:$release_tag"
web_image="$web_repository:$release_tag"
dry_run=${DRY_RUN:-false}

if [[ "$dry_run" != true ]]; then
  command -v docker >/dev/null 2>&1 || die 'docker is required unless DRY_RUN=true'
fi

run_docker() {
  log "docker $*"
  if [[ "$dry_run" == true ]]; then
    return 0
  fi
  docker "$@"
}

log "Building API image: $api_image"
run_docker build \
  --platform "$docker_platform" \
  --target runner \
  --label "org.opencontainers.image.revision=$git_sha" \
  --tag "$api_image" \
  --file "$REPO_ROOT/docker/api/Dockerfile" \
  "$REPO_ROOT"

log "Building Web image: $web_image"
run_docker build \
  --platform "$docker_platform" \
  --target runner \
  --label "org.opencontainers.image.revision=$git_sha" \
  --build-arg VITE_API_URL= \
  --build-arg "VITE_LIFF_ID=$VITE_LIFF_ID" \
  --build-arg VITE_LIFF_ENDPOINT_PATH=/liff \
  --build-arg VITE_LIFF_MOCK=false \
  --build-arg VITE_PAYMENT_MODE=demo \
  --build-arg "VITE_SENTRY_RELEASE=$git_sha" \
  --tag "$web_image" \
  --file "$REPO_ROOT/docker/web/Dockerfile" \
  "$REPO_ROOT"

run_docker push "$api_image"
run_docker push "$web_image"
printf 'DEPLOY_TAG=%s\n' "$release_tag"
printf 'API_IMAGE=%s\n' "$api_image"
printf 'WEB_IMAGE=%s\n' "$web_image"
printf 'VPS_COMMAND=./scripts/deploy.sh %s\n' "$release_tag"
