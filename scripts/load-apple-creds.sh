#!/usr/bin/env bash
# Load Apple Developer ID signing + notarization credentials for Apexline.
#
# Usage (source, do not execute):
#   source scripts/load-apple-creds.sh
#
# Mirrors strix/scripts/load-apple-creds.sh (see ~/Documents/GitHub/APPLE_SIGNING.md):
#   Apple CAs first → p12 → set-key-partition-list with KEYCHAIN password
#   search list = temp + login only (never CSC_LINK)
#   smoke-test codesign before returning
#   cleanup forces login-only (never leave stale temps on the search list)
#
# Exports:
#   APPLE_SIGNING_IDENTITY / APPLE_TEAM_ID
#   APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_PATH
#   APEXLINE_SIGN_KEYCHAIN / APEXLINE_SIGN_KEYCHAIN_PASS
#   APEXLINE_CODESIGN=1
#   AGMUX_APPLE_CREDS_DIR
#
# On EXIT call: apexline_cleanup_apple_creds

set -euo pipefail

_AGMUX_LOADER="${APEXLINE_APPLE_CREDS_LOADER:-${AGMUX_APPLE_CREDS_LOADER:-$HOME/Documents/GitHub/agmux/scripts/load-apple-creds.sh}}"
_DEFAULT_IDENTITY="Developer ID Application: Ramakrishna Satyavolu (VTQW687WBQ)"

if [ ! -f "$_AGMUX_LOADER" ]; then
  echo "error: shared Apple creds loader not found at $_AGMUX_LOADER" >&2
  echo "See ~/Documents/GitHub/APPLE_SIGNING.md" >&2
  return 1 2>/dev/null || exit 1
fi

# shellcheck disable=SC1090
source "$_AGMUX_LOADER"

IDENTITY="${APPLE_SIGNING_IDENTITY:-$_DEFAULT_IDENTITY}"
export APPLE_SIGNING_IDENTITY="$IDENTITY"
export APEXLINE_SIGN_IDENTITY="$IDENTITY"
export APEXLINE_CODESIGN=1

_apexline_fetch_apple_cas() {
  local dest="$1"
  mkdir -p "$dest"
  local base="https://www.apple.com/certificateauthority"
  local f
  for f in DeveloperIDG2CA.cer DeveloperIDCA.cer AppleRootCA-G2.cer AppleRootCA-G3.cer; do
    if [ ! -s "$dest/$f" ]; then
      python3 -c "import urllib.request; urllib.request.urlretrieve('${base}/$f', '${dest}/$f')" \
        || curl -fsSL -o "$dest/$f" "${base}/$f"
    fi
  done
  if [ ! -s "$dest/AppleIncRootCertificate.cer" ]; then
    python3 -c "import urllib.request; urllib.request.urlretrieve('https://www.apple.com/appleca/AppleIncRootCertificate.cer', '${dest}/AppleIncRootCertificate.cer')" \
      || curl -fsSL -o "$dest/AppleIncRootCertificate.cer" \
        "https://www.apple.com/appleca/AppleIncRootCertificate.cer"
  fi
}

_apexline_codesign_smoke() {
  local id="$1"
  local smoke smoke_c
  smoke="$(mktemp /tmp/apexline-codesign-smoke.XXXXXX)"
  smoke_c="${smoke}.c"
  echo 'int main(){return 0;}' >"$smoke_c"
  if ! cc -o "$smoke" "$smoke_c" 2>/dev/null; then
    rm -f "$smoke" "$smoke_c"
    return 1
  fi
  if ! codesign --force --sign "$id" --timestamp --options runtime "$smoke" >/dev/null 2>&1; then
    rm -f "$smoke" "$smoke_c"
    return 1
  fi
  rm -f "$smoke" "$smoke_c"
  return 0
}

apexline_prepare_signing_keychain() {
  local p12_path="" kc kc_pass login cas cer

  if [ -n "${AGMUX_APPLE_CREDS_DIR:-}" ] && [ -f "${AGMUX_APPLE_CREDS_DIR}/certificate.p12" ]; then
    p12_path="${AGMUX_APPLE_CREDS_DIR}/certificate.p12"
  fi

  login="$HOME/Library/Keychains/login.keychain-db"

  # Always drop stale temps from prior failed runs before deciding anything.
  security list-keychains -d user -s "$login" >/dev/null 2>&1 || true

  cas="${AGMUX_APPLE_CREDS_DIR}/apple-cas"
  _apexline_fetch_apple_cas "$cas"

  # Install Developer ID intermediates into LOGIN as well as the temp keychain.
  # Verified 2026-07: temp-only CA import can still yield
  # "unable to build chain to self-signed root" / errSecInternalComponent until
  # DeveloperIDG2CA is present on the login search path (APPLE_SIGNING.md).
  for cer in "$cas"/DeveloperIDG2CA.cer "$cas"/DeveloperIDCA.cer; do
    [ -f "$cer" ] || continue
    security import "$cer" -k "$login" -T /usr/bin/codesign -T /usr/bin/security >/dev/null 2>&1 || true
  done

  # Reuse only if a real codesign works (find-identity alone is not enough).
  if security find-identity -v -p codesigning 2>/dev/null | grep -Fq "$IDENTITY"; then
    if _apexline_codesign_smoke "$IDENTITY"; then
      echo "  Apexline: using existing keychain identity: $IDENTITY"
      return 0
    fi
    echo "  Apexline: existing identity failed smoke codesign; re-importing"
  fi

  if [ -z "$p12_path" ] || [ ! -f "$p12_path" ]; then
    echo "error: no Developer ID identity in keychain and no .p12 to import" >&2
    return 1
  fi
  if [ -z "${APPLE_CERTIFICATE_PASSWORD:-}" ]; then
    echo "error: APPLE_CERTIFICATE_PASSWORD missing; cannot import .p12" >&2
    return 1
  fi

  kc="${AGMUX_APPLE_CREDS_DIR}/apexline-sign.keychain-db"
  kc_pass="$(/usr/bin/openssl rand -base64 24 | tr -d '/+=' | head -c 24)"

  security delete-keychain "$kc" >/dev/null 2>&1 || true
  security create-keychain -p "$kc_pass" "$kc"
  security set-keychain-settings -lut 21600 "$kc"
  security unlock-keychain -p "$kc_pass" "$kc"

  # CAs first (Strix / APPLE_SIGNING.md), then leaf p12.
  for cer in "$cas"/*.cer; do
    [ -f "$cer" ] || continue
    security import "$cer" -k "$kc" -T /usr/bin/codesign -T /usr/bin/security >/dev/null 2>&1 || true
  done

  security import "$p12_path" -k "$kc" -P "$APPLE_CERTIFICATE_PASSWORD" \
    -T /usr/bin/codesign -T /usr/bin/security -T /usr/bin/productbuild >/dev/null
  # -k is KEYCHAIN password, not p12 password (electron-builder CSC_LINK bug).
  security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$kc_pass" "$kc" >/dev/null

  security list-keychains -d user -s "$kc" "$login"
  security unlock-keychain -p "$kc_pass" "$kc"

  export APEXLINE_SIGN_KEYCHAIN="$kc"
  export APEXLINE_SIGN_KEYCHAIN_PASS="$kc_pass"

  if ! security find-identity -v -p codesigning 2>/dev/null | grep -Fq "$IDENTITY"; then
    echo "error: imported p12 but identity not found: $IDENTITY" >&2
    security find-identity -v -p codesigning 2>&1 || true
    return 1
  fi

  if ! _apexline_codesign_smoke "$IDENTITY"; then
    echo "error: codesign smoke test failed after import (chain / key access)" >&2
    codesign --force --sign "$IDENTITY" --timestamp --options runtime \
      "$(mktemp /tmp/apexline-fail.XXXXXX)" 2>&1 || true
    return 1
  fi

  echo "  Apexline: imported Developer ID + Apple CAs into temp keychain (smoke OK)"
  return 0
}

apexline_prepare_signing_keychain || {
  echo "error: failed to prepare signing keychain" >&2
  return 1 2>/dev/null || exit 1
}

apexline_cleanup_apple_creds() {
  local login="$HOME/Library/Keychains/login.keychain-db"

  if [ -n "${APEXLINE_SIGN_KEYCHAIN:-}" ]; then
    security delete-keychain "$APEXLINE_SIGN_KEYCHAIN" >/dev/null 2>&1 || true
  fi
  # Always force login-only — never restore a list that still names deleted temps.
  security list-keychains -d user -s "$login" >/dev/null 2>&1 || true
  security default-keychain -d user -s "$login" >/dev/null 2>&1 || true

  if [ -n "${AGMUX_APPLE_CREDS_DIR:-}" ] && [ -d "${AGMUX_APPLE_CREDS_DIR}" ]; then
    rm -rf "${AGMUX_APPLE_CREDS_DIR}"
  fi
  unset APPLE_CERTIFICATE APPLE_CERTIFICATE_PASSWORD APPLE_API_KEY \
        APPLE_API_ISSUER APPLE_API_KEY_PATH APPLE_SIGNING_IDENTITY APPLE_TEAM_ID \
        APEXLINE_CODESIGN APEXLINE_SIGN_IDENTITY APEXLINE_SIGN_KEYCHAIN \
        APEXLINE_SIGN_KEYCHAIN_PASS APEXLINE_NOTARIZE \
        AGMUX_APPLE_CREDS_DIR 2>/dev/null || true
}

echo "  Apexline: signing ready (identity=$IDENTITY${APEXLINE_SIGN_KEYCHAIN:+, keychain set})"
