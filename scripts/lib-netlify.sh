# Shared helpers for the setup scripts. Requires a repo linked with `npx netlify-cli link`.

netlify() { npx -y netlify-cli@latest "$@" 2> >(grep -v -E 'ExperimentalWarning|trace-warnings' >&2); }

# Prints a variable's value, or nothing when it isn't set.
get_env() { netlify env:get "$1" --context production 2>/dev/null | grep -v -i -E 'no value|not set|found' | tail -n 1 || true; }

# Secret values are a paid-plan feature on some Netlify accounts; fall back to a normal value.
set_secret() {
  netlify env:set "$1" "$2" --secret >/dev/null 2>&1 || netlify env:set "$1" "$2" >/dev/null
  echo "  ✓ $1"
}

# Functions only see new environment variables after a fresh deploy.
redeploy() {
  local site_id
  site_id=$(node -e "console.log(require('./.netlify/state.json').siteId)")
  netlify api createSiteBuild --data "{\"site_id\":\"$site_id\"}" >/dev/null
  echo "  ✓ Started a fresh deploy (about a minute)"
}
