#!/usr/bin/env bash

set -euo pipefail

echo "🔧 Pre-install hook: Setting up Mapbox token for Gradle..."

# Create gradle.properties if it doesn't exist
GRADLE_PROPS="android/gradle.properties"

# Check if the environment variable is set
if [ -n "${RNMAPBOX_MAPS_DOWNLOAD_TOKEN:-}" ]; then
  echo "✅ RNMAPBOX_MAPS_DOWNLOAD_TOKEN found in environment"

  # Add or update the MAPBOX_DOWNLOADS_TOKEN in gradle.properties
  if grep -q "MAPBOX_DOWNLOADS_TOKEN" "$GRADLE_PROPS" 2>/dev/null; then
    echo "📝 Updating existing MAPBOX_DOWNLOADS_TOKEN in gradle.properties"
    sed -i.bak "s/^MAPBOX_DOWNLOADS_TOKEN=.*/MAPBOX_DOWNLOADS_TOKEN=${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}/" "$GRADLE_PROPS"
  else
    echo "📝 Adding MAPBOX_DOWNLOADS_TOKEN to gradle.properties"
    echo "" >> "$GRADLE_PROPS"
    echo "# Mapbox Downloads token (set by EAS build hook)" >> "$GRADLE_PROPS"
    echo "MAPBOX_DOWNLOADS_TOKEN=${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}" >> "$GRADLE_PROPS"
  fi

  echo "✅ Mapbox token configured successfully"
else
  echo "⚠️  WARNING: RNMAPBOX_MAPS_DOWNLOAD_TOKEN not found in environment"
  exit 1
fi
