#!/usr/bin/env bash
# Load Apple Developer ID + notarization credentials into the environment.
# Prefer the shared agmux loader (same 1Password items as APPLE_SIGNING.md).
#
# Usage (source, do not execute):
#   source scripts/load-apple-creds.sh
#   # or: source /Users/neel/Documents/GitHub/agmux/scripts/load-apple-creds.sh
#
# Exports (via agmux loader):
#   APPLE_CERTIFICATE / APPLE_CERTIFICATE_PASSWORD / APPLE_SIGNING_IDENTITY
#   APPLE_TEAM_ID
#   APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_PATH  (when notary item complete)
#   AGMUX_APPLE_CREDS_DIR  (caller should rm -rf on EXIT)
#
# Shared items (Personal vault):
#   Signing: "Apple Developer ID Certificate"
#   Notary:  "Xanom Apple Dev Creds"
# Docs: ~/Documents/GitHub/APPLE_SIGNING.md

set -euo pipefail

_APEXLINE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
_AGMUX_LOADER="${APEXLINE_APPLE_CREDS_LOADER:-/Users/neel/Documents/GitHub/agmux/scripts/load-apple-creds.sh}"
_LOCAL_FALLBACK="${_APEXLINE_ROOT}/scripts/load-apple-creds-fallback.sh"

if [ -f "$_AGMUX_LOADER" ]; then
  # shellcheck disable=SC1090
  source "$_AGMUX_LOADER"
else
  echo "warning: shared agmux loader not found at $_AGMUX_LOADER" >&2
  if [ -f "$_LOCAL_FALLBACK" ]; then
    # shellcheck disable=SC1090
    source "$_LOCAL_FALLBACK"
  else
    echo "error: no Apple creds loader available. See ~/Documents/GitHub/APPLE_SIGNING.md" >&2
    return 1 2>/dev/null || exit 1
  fi
fi

# Apexline package-macos.cjs also accepts these aliases.
export APEXLINE_CODESIGN="${APEXLINE_CODESIGN:-1}"
if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
  export APEXLINE_SIGN_IDENTITY="${APEXLINE_SIGN_IDENTITY:-$APPLE_SIGNING_IDENTITY}"
fi
