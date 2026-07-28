#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=/root/workspace/tt.ai
LOG_FILE="$ROOT_DIR/logs/media-expiration.log"
LOCK_FILE=/tmp/ttai-media-expiration.lock
CONTAINER=ttai-wechat-login-1

mkdir -p "$ROOT_DIR/logs"
exec 9>"$LOCK_FILE"
if ! /usr/bin/flock -n 9; then
  exit 0
fi

if [[ -f "$LOG_FILE" ]] && [[ $(stat -c %s "$LOG_FILE") -gt 5242880 ]]; then
  mv -f "$LOG_FILE" "$LOG_FILE.1"
fi

{
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] media expiration start"
  if ! /usr/bin/docker exec "$CONTAINER" printenv OSS_MEDIA_EXPIRATION_DELETE_ENABLED | grep -qx true; then
    echo "media expiration skipped: delete flag is not enabled"
    exit 1
  fi
  /usr/bin/docker exec "$CONTAINER" node scripts/expire-standard-media.js --apply --limit=1000
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] media expiration complete"
} >> "$LOG_FILE" 2>&1
