#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
RELEASES_DIR="$ROOT_DIR/releases"
AAB_SOURCE_PATH="$ANDROID_DIR/app/build/outputs/bundle/googleRelease/app-google-release.aab"
ANDROID_BUILD_FILE="$ANDROID_DIR/app/build.gradle"

VERSION_NAME="$(awk -F'\"' '/versionName[[:space:]]+\"/ { print $2; exit }' "$ANDROID_BUILD_FILE")"

if [ -z "$VERSION_NAME" ]; then
  echo "Android versionName을 찾지 못했습니다." >&2
  exit 1
fi

cd "$ROOT_DIR"
npm run cap:sync

cd "$ANDROID_DIR"
./gradlew bundleGoogleRelease

mkdir -p "$RELEASES_DIR"
cp -f "$AAB_SOURCE_PATH" "$RELEASES_DIR/BlockSlide-${VERSION_NAME}-google-release.aab"
cp -f "$AAB_SOURCE_PATH" "$RELEASES_DIR/BlockSlide-google-release-latest.aab"

echo "AAB ready:"
echo "  $RELEASES_DIR/BlockSlide-${VERSION_NAME}-google-release.aab"
echo "  $RELEASES_DIR/BlockSlide-google-release-latest.aab"
