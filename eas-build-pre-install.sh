#!/usr/bin/env bash

set -euo pipefail

echo "🔧 Pre-install hook: Setting up Mapbox tokens..."

# Check if the environment variable is set
if [ -z "${RNMAPBOX_MAPS_DOWNLOAD_TOKEN:-}" ]; then
  echo ""
  echo "❌ ERROR: RNMAPBOX_MAPS_DOWNLOAD_TOKEN not found in environment"
  echo ""
  echo "   For REMOTE builds (recommended):"
  echo "   Run without --local flag: eas build --platform ios --profile preview"
  echo "   Secrets are automatically injected from EAS."
  echo ""
  echo "   For LOCAL builds:"
  echo "   Export the variable before building:"
  echo "   export RNMAPBOX_MAPS_DOWNLOAD_TOKEN='sk.your_mapbox_secret_token'"
  echo "   eas build --platform ios --profile preview --local"
  echo ""
  exit 1
fi

echo "✅ RNMAPBOX_MAPS_DOWNLOAD_TOKEN found in environment"

# Configure iOS .netrc for Mapbox SDK download
if [ "${EAS_BUILD_PLATFORM:-}" = "ios" ]; then
  echo "📱 Configuring .netrc for iOS Mapbox SDK download..."
  
  # Create or append to .netrc file
  cat >> ~/.netrc <<EOF
machine api.mapbox.com
login mapbox
password ${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}
EOF
  
  chmod 600 ~/.netrc
  echo "✅ .netrc configured for iOS Mapbox SDK download"
fi

# Configure Android gradle.properties for Mapbox SDK download
if [ "${EAS_BUILD_PLATFORM:-}" = "android" ]; then
  echo "🤖 Configuring gradle.properties for Android Mapbox SDK download..."
  
  GRADLE_PROPS="android/gradle.properties"
  
  if [ -f "$GRADLE_PROPS" ]; then
    if grep -q "MAPBOX_DOWNLOADS_TOKEN" "$GRADLE_PROPS" 2>/dev/null; then
      echo "📝 Updating existing MAPBOX_DOWNLOADS_TOKEN in gradle.properties"
      sed -i.bak "s/^MAPBOX_DOWNLOADS_TOKEN=.*/MAPBOX_DOWNLOADS_TOKEN=${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}/" "$GRADLE_PROPS"
    else
      echo "📝 Adding MAPBOX_DOWNLOADS_TOKEN to gradle.properties"
      echo "" >> "$GRADLE_PROPS"
      echo "# Mapbox Downloads token (set by EAS build hook)" >> "$GRADLE_PROPS"
      echo "MAPBOX_DOWNLOADS_TOKEN=${RNMAPBOX_MAPS_DOWNLOAD_TOKEN}" >> "$GRADLE_PROPS"
    fi
    echo "✅ Mapbox token configured for Android"
  else
    echo "⚠️  WARNING: gradle.properties not found at $GRADLE_PROPS"
  fi
fi

echo "✅ Mapbox setup complete for ${EAS_BUILD_PLATFORM:-unknown} platform"

