#!/usr/bin/env bash
# One-time setup of the server-side settings for photo estimates and reminders.
# Safe to re-run: existing push keys and access codes are kept.
# Needs `npx netlify-cli login` and `npx netlify-cli link` in this repo first.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/lib-netlify.sh

echo "Setting Hibi's server settings on the linked Netlify site…"

# Push keys identify this server to browsers. Regenerating them would silently break every
# device's existing reminder subscription, so only create them once.
if [ -n "$(get_env VAPID_PUBLIC_KEY)" ]; then
  echo "  • Push keys already set; keeping them"
else
  keys=$(npx -y web-push generate-vapid-keys --json)
  netlify env:set VAPID_PUBLIC_KEY "$(node -e 'console.log(JSON.parse(process.argv[1]).publicKey)' "$keys")" >/dev/null
  echo "  ✓ VAPID_PUBLIC_KEY"
  set_secret VAPID_PRIVATE_KEY "$(node -e 'console.log(JSON.parse(process.argv[1]).privateKey)' "$keys")"
fi

codes=$(get_env HIBI_ACCESS_CODE)
if [ -z "$codes" ]; then
  codes=$(new_code)
  netlify env:set HIBI_ACCESS_CODE "$codes" >/dev/null
  echo "  ✓ HIBI_ACCESS_CODE"
else
  echo "  • Access code already set; keeping it"
fi

read -rsp "Paste your Gemini API key from aistudio.google.com (input hidden; Enter to skip): " gemini
echo
if [ -n "$gemini" ]; then set_secret GEMINI_API_KEY "$gemini"; fi

read -rsp "Optional: paste an Anthropic API key to use Claude instead when no Gemini key is set (Enter to skip): " anthropic
echo
if [ -n "$anthropic" ]; then set_secret ANTHROPIC_API_KEY "$anthropic"; fi

redeploy
echo
echo "Access code(s) for photo estimates: $codes"
echo "Enter one once on each device under Log food → Photo. Add one per friend with: npm run access-code:add"
