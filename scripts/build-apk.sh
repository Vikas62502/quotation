#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if command -v /usr/libexec/java_home >/dev/null 2>&1; then
  JAVA_21_HOME="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  if [[ -n "${JAVA_21_HOME}" ]]; then
    export JAVA_HOME="${JAVA_21_HOME}"
  fi
fi

# Pin the WebView URL for release APKs so a dev-only .env (e.g. http://10.0.2.2:3000) cannot be synced by mistake.
export CAPACITOR_LIVE_URL="${CAPACITOR_LIVE_URL:-https://quotation.chairbordsolar.com}"

npx cap sync android
(cd android && ./gradlew assembleDebug --no-daemon)

SRC="${ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "${SRC}" ]]; then
  echo "ERROR: Gradle did not produce ${SRC}" >&2
  exit 1
fi

mkdir -p "${ROOT}/apk"
OUT="${ROOT}/apk/solar-quotation-debug.apk"
cp "${SRC}" "${OUT}"
echo ""
echo "APK ready:"
echo "  ${OUT}"
echo ""
