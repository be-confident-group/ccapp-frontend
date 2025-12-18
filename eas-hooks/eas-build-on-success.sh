#!/usr/bin/env bash

# This hook runs after prebuild but before the actual Gradle build
# It injects the Mapbox token into gradle.properties

set -euo pipefail

echo "🔧 EAS Build Hook: Configuring Mapbox token..."

GRADLE_PROPS="android/gradle.properties"

if [ ! -f "$GRADLE_PROPS" ]; then
  echo "❌ Error: $GRADLE_PROPS not found!"
  exit 1
fi

# Check if environment variable is set
if [ -n "${RNMAPBOX_MAPS_DOWNLOAD_TOKEN:-}" ]; then
  echo "✅ RNMAPBOX_MAPS_DOWNLOAD_TOKEN found in environment"

  # Add the token to gradle.properties
  echo "" >> "$GRADLE_PROPS"
  echo "# Mapbox Downloads token (injected by EAS build hook)" >> "$GRADLE_PROPS"
  echo "MAPBOX_DOWNLOADS_TOKEN=${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}" >> "$GRADLE_PROPS"

  echo "✅ Mapbox token added to gradle.properties"
  echo "📄 gradle.properties contents:"
  tail -5 "$GRADLE_PROPS"
else
  echo "⚠️  WARNING: RNMAPBOX_MAPS_DOWNLOAD_TOKEN not found in environment"
  echo "Build may fail due to Mapbox authentication issues"
fi
