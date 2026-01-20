#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [[ "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage: ./scripts/testing/test-cua-docker-vm-smoke.sh [args...]

Runs the Docker VM smoke test harness for CUA.

Examples:
  ./scripts/testing/test-cua-docker-vm-smoke.sh
  ./scripts/testing/test-cua-docker-vm-smoke.sh --url https://example.com --output /tmp/cua_smoke.png

All arguments are passed through to backend/worker/run_docker_vm_smoke.py.
EOF
  exit 0
fi

python3 "$REPO_ROOT/backend/worker/run_docker_vm_smoke.py" "$@"
