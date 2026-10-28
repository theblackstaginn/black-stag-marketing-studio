#!/usr/bin/env bash
set -euo pipefail
repo_root=$(pwd)
sandbox_dir=$(mktemp -d)
trap 'supabase stop --workdir "$sandbox_dir" --no-backup >/dev/null 2>&1 || true; rm -rf "$sandbox_dir"' EXIT
supabase init --workdir "$sandbox_dir"
# Start an unlinked, empty LOCAL stack. Never run db push/link or use a hosted URL.
supabase start --workdir "$sandbox_dir" -x realtime,imgproxy,studio,edge-runtime,logflare,vector,supavisor > "$sandbox_dir/start.log" 2>&1 || { tail -80 "$sandbox_dir/start.log"; exit 1; }
supabase status --workdir "$sandbox_dir" -o json > "$sandbox_dir/status.json"
export BSWD_LOCAL_STATUS="$sandbox_dir/status.json"
node tests/bswd/integration.cjs
