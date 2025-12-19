#!/usr/bin/env bash
set -euo pipefail

# Local helper: run commands inside the shell-executor container using your host ~/.aws (mounted),
# WITHOUT copying credentials into the image.
#
# This prints the command output directly (it does NOT run via runner.js), so you can quickly
# verify `aws` works inside the container.
#
# Usage:
#   backend/shell-executor/run-local-with-aws.sh aws --version
#   backend/shell-executor/run-local-with-aws.sh aws sts get-caller-identity
#   AWS_DEFAULT_REGION=us-west-2 backend/shell-executor/run-local-with-aws.sh aws s3 ls
#
# Notes:
# - This is for LOCAL dev only. ECS/Fargate cannot access your laptop ~/.aws.
# - Mount mode defaults to read-only. If you use SSO and need to refresh tokens, set AWS_MOUNT_MODE=rw.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_TAG="leadmagnet-shell-executor:local"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <command...>" >&2
  exit 2
fi

AWS_MOUNT_MODE="${AWS_MOUNT_MODE:-ro}"
if [[ "${AWS_MOUNT_MODE}" != "ro" && "${AWS_MOUNT_MODE}" != "rw" ]]; then
  echo "AWS_MOUNT_MODE must be 'ro' or 'rw' (got: ${AWS_MOUNT_MODE})" >&2
  exit 2
fi

docker build -t "${IMAGE_TAG}" "${SCRIPT_DIR}"

# Default to your current AWS_PROFILE / AWS_DEFAULT_REGION if set, otherwise let AWS CLI use [default] + ~/.aws/config.
AWS_PROFILE_ENV="${AWS_PROFILE:-}"
AWS_DEFAULT_REGION_ENV="${AWS_DEFAULT_REGION:-}"

docker run --rm \
  -v "${HOME}/.aws:/home/runner/.aws:${AWS_MOUNT_MODE}" \
  -e HOME="/home/runner" \
  ${AWS_PROFILE_ENV:+-e AWS_PROFILE="${AWS_PROFILE_ENV}"} \
  ${AWS_DEFAULT_REGION_ENV:+-e AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION_ENV}"} \
  --entrypoint /bin/bash \
  "${IMAGE_TAG}" -lc "$*"


