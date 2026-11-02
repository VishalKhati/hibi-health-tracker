#!/usr/bin/env bash
# One-time setup of the server-side settings for photo estimates and reminders.
# Run from anywhere after `npx netlify-cli login` and `npx netlify-cli link` in this repo.
set -euo pipefail
cd "$(dirname "$0")/.."

netlify() { npx -y netlify-cli@latest "$@" 2> >(grep -v -E 'ExperimentalWarning|trace-warnings' >&2); }

# Secret values are a paid-plan feature on some Netlify accounts; fall back to a normal value.
set_secret() {
  netlify env:set "$1" "$2" --secret >/dev/null 2>&1 || netlify env:set "$1" "$2" >/dev/null
  echo "  ✓ $1"
}

echo "Setting Hibi's server settings on the linked Netlify site…"

# Push keys identify this server to browsers. Regenerating them would silently break every
# device's existing reminder subscription, so only create them once.
if netlify env:get VAPID_PUBLIC_KEY 2>/dev/null | grep -q '^B'; then
  echo "  • Push keys already set; keeping them"
else
  keys=$(npx -y web-push generate-vapid-keys --json)
  netlify env:set VAPID_PUBLIC_KEY "$(node -e 'console.log(JSON.parse(process.argv[1]).publicKey)' "$keys")" >/dev/null
  echo "  ✓ VAPID_PUBLIC_KEY"
  set_secret VAPID_PRIVATE_KEY "$(node -e 'console.log(JSON.parse(process.argv[1]).privateKey)' "$keys")"
fi

code=$(node -e "const a='abcdefghjkmnpqrstuvwxyz23456789',r=require('crypto').randomBytes(12);console.log([0,4,8].map(i=>[...r.subarray(i,i+4)].map(b=>a[b%a.length]).join('')).join('-'))")
set_secret HIBI_ACCESS_CODE "$code"

read -rsp "Paste your Anthropic API key for photo estimates (input hidden; Enter to skip): " key
echo
if [ -n "$key" ]; then set_secret ANTHROPIC_API_KEY "$key"; else echo "  • Skipped the Anthropic key; photo estimates stay off until you add it"; fi

# Functions only see new environment variables after a fresh deploy.
site_id=$(node -e "console.log(require('./.netlify/state.json').siteId)")
netlify api createSiteBuild --data "{\"site_id\":\"$site_id\"}" >/dev/null
echo "  ✓ Started a fresh deploy (about a minute)"

echo
echo "Your photo-estimate access code: $code"
echo "Enter it once on each device under Log food → Photo."
