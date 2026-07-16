#!/usr/bin/env bash
# Official macOS release build for Apexline:
#   CastLabs VMP → Developer ID codesign → notarize + staple → update feed zip
#
# Usage:
#   ./scripts/release-macos.sh              # sign + notarize + prepare feed
#   ./scripts/release-macos.sh --no-notarize
#   ./scripts/release-macos.sh --feed-only  # only run release:update-feed (app already built)
#   ./scripts/release-macos.sh --skip-feed  # package/sign only
#
# Prerequisites:
#   - 1Password CLI signed in (op account list)
#   - CastLabs EVS Python module for VMP (python3 -m castlabs_evs.vmp)
#   - Xcode CLT (codesign, notarytool, stapler)
# Credentials: ~/Documents/GitHub/APPLE_SIGNING.md

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NPM="${NPM:-/opt/homebrew/bin/npm}"
NODE="${NODE:-/opt/homebrew/bin/node}"
NOTARIZE="yes"
DO_PACKAGE=1
DO_FEED=1

usage() {
  cat <<'EOF'
Official Apexline macOS release (Developer ID + notarize + update feed).

  ./scripts/release-macos.sh
  ./scripts/release-macos.sh --no-notarize
  ./scripts/release-macos.sh --feed-only
  ./scripts/release-macos.sh --skip-feed

Env:
  APEXLINE_RELEASE_NOTES   notes string for releases.json
  APEXLINE_UPDATE_BASE_URL  override feed base URL
  APEXLINE_BUNDLE_ID       default io.apexline.app
  PITWALL_EVS_PYTHON       python with castlabs_evs (default python3)
EOF
  exit "${1:-0}"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --no-notarize) NOTARIZE="no"; shift ;;
    --with-notarize|--notarize) NOTARIZE="yes"; shift ;;
    --feed-only) DO_PACKAGE=0; DO_FEED=1; shift ;;
    --skip-feed) DO_FEED=0; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown option: $1" >&2; usage 1 ;;
  esac
done

cleanup() {
  if declare -F apexline_cleanup_apple_creds >/dev/null 2>&1; then
    apexline_cleanup_apple_creds
  elif [ -n "${AGMUX_APPLE_CREDS_DIR:-}" ] && [ -d "${AGMUX_APPLE_CREDS_DIR}" ]; then
    rm -rf "${AGMUX_APPLE_CREDS_DIR}"
  fi
  unset APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_API_KEY \
        APPLE_API_ISSUER APPLE_API_KEY_PATH APPLE_SIGNING_IDENTITY \
        APPLE_TEAM_ID APEXLINE_CODESIGN APEXLINE_SIGN_IDENTITY \
        APEXLINE_SIGN_KEYCHAIN APEXLINE_NOTARIZE 2>/dev/null || true
}
trap cleanup EXIT

if [ "$DO_PACKAGE" = "1" ]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/load-apple-creds.sh"

  if declare -F agmux_require_developer_id >/dev/null 2>&1; then
    agmux_require_developer_id || exit 1
  fi

  export APEXLINE_CODESIGN=1
  export PITWALL_CASTLABS_VMP="${PITWALL_CASTLABS_VMP:-1}"
  export APEXLINE_BUNDLE_ID="${APEXLINE_BUNDLE_ID:-io.apexline.app}"
  export PITWALL_EVS_PYTHON="${PITWALL_EVS_PYTHON:-/opt/homebrew/opt/python@3.9/bin/python3.9}"

  if [ "$NOTARIZE" = "yes" ]; then
    if [ -z "${APPLE_API_KEY:-}" ] || [ -z "${APPLE_API_ISSUER:-}" ] || [ -z "${APPLE_API_KEY_PATH:-}" ]; then
      echo "error: notarization requested but APPLE_API_* incomplete." >&2
      echo "       Use --no-notarize for Developer ID sign-only, or fix 1Password item 'Xanom Apple Dev Creds'." >&2
      exit 1
    fi
    export APEXLINE_NOTARIZE=1
    echo "Release mode: VMP + Developer ID + notarize + staple"
  else
    export APEXLINE_NOTARIZE=0
    export APEXLINE_SKIP_NOTARIZE=1
    if declare -F agmux_disable_notarization_env >/dev/null 2>&1; then
      agmux_disable_notarization_env
    fi
    echo "Release mode: VMP + Developer ID (no notarize)"
  fi

  echo "Building renderer + packaging…"
  "$NPM" run build
  # Keep shell-prepared APEXLINE_SIGN_KEYCHAIN; do not re-import in Node when present.
  "$NODE" "$ROOT/scripts/package-macos.cjs"

  echo "Verifying signature…"
  codesign -dv --verbose=2 "$ROOT/dist/Apexline.app" 2>&1 | head -40 || true
  if [ "$NOTARIZE" = "yes" ]; then
    spctl --assess --type execute --verbose "$ROOT/dist/Apexline.app" || {
      echo "warning: spctl assess failed (can happen before first launch on some macOS versions); stapler validate is authoritative after notary." >&2
    }
  fi
fi

if [ "$DO_FEED" = "1" ]; then
  echo "Preparing Vercel update feed + zip…"
  "$NPM" run release:update-feed
  echo ""
  echo "Next: deploy the updates site, e.g."
  echo "  /usr/bin/env CI=1 /opt/homebrew/bin/vercel deploy updates-site --prod -y"
  echo "Then confirm public JSON:"
  echo "  https://apexline.io/updates/darwin/arm64/releases.json"
fi

echo "Done."
