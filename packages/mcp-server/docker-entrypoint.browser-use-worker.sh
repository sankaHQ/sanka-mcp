#!/bin/sh
set -eu

mkdir -p "$SANKA_BROWSER_USE_PROFILE_ROOT" "$SANKA_BROWSER_USE_ARTIFACT_DIR"
chown nodejs:nodejs "$SANKA_BROWSER_USE_PROFILE_ROOT" "$SANKA_BROWSER_USE_ARTIFACT_DIR"

exec su -s /bin/sh nodejs -c 'exec node packages/mcp-server/dist/browser-use-worker.js'
