#!/usr/bin/env bash
set -euo pipefail

# Only run for Android builds
if [ "${EAS_BUILD_PLATFORM:-}" = "android" ]; then
  echo "🔧 Injecting Mapbox token into gradle.properties..."

  GRADLE_PROPS="android/gradle.properties"

  if [ -f "$GRADLE_PROPS" ]; then
    if [ -n "${RNMAPBOX_MAPS_DOWNLOAD_TOKEN:-}" ]; then
      echo "" >> "$GRADLE_PROPS"
      echo "# Mapbox Downloads token (injected by EAS build hook)" >> "$GRADLE_PROPS"
      echo "MAPBOX_DOWNLOADS_TOKEN=${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}" >> "$GRADLE_PROPS"
      echo "✅ Mapbox token injected successfully"
    else
      echo "⚠️ RNMAPBOX_MAPS_DOWNLOAD_TOKEN not found in environment"
    fi
  else
    echo "⚠️ gradle.properties not found at $GRADLE_PROPS"
  fi
fi
