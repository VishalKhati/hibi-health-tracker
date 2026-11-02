#!/usr/bin/env bash
# Creates an extra photo-estimate access code (for example, one per friend) and redeploys.
# To revoke one later, edit HIBI_ACCESS_CODE in Netlify (Project configuration → Environment
# variables) and remove that code from the comma-separated list.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib-netlify.sh

code=$(new_code)
existing=$(get_env HIBI_ACCESS_CODE)
netlify env:set HIBI_ACCESS_CODE "${existing:+$existing,}$code" >/dev/null
redeploy
echo "New access code${1:+ for $1}: $code"
echo "It works in about a minute. Each code gets its own daily photo limit."
