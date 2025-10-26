import { Spacing } from '@/constants/theme';
import type { FeedbackMode, HeatmapMode, MapViewMode } from '@/types/mapMode';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapActionButtons } from './MapActionButtons';
import { MapLayer, MapLayerSelector } from './MapLayerSelector';
import { MapModeToggle } from './MapModeToggle';
import { MapSubModeToggle } from './MapSubModeToggle';

interface MapControlsProps {
  viewMode: MapViewMode;
  heatmapMode: HeatmapMode;
  feedbackMode: FeedbackMode;
  selectedLayer: MapLayer;
  onViewModeChange: (mode: MapViewMode) => void;
  onHeatmapModeChange: (mode: HeatmapMode) => void;
  onFeedbackModeChange: (mode: FeedbackMode) => void;
  onLayerChange: (layer: MapLayer) => void;
  onFindLocation: () => void;
  on3DToggle: () => void;
  is3DEnabled?: boolean;
}

export function MapControls({
  viewMode,
  heatmapMode,
  feedbackMode,
  selectedLayer,
  onViewModeChange,
  onHeatmapModeChange,
  onFeedbackModeChange,
  onLayerChange,
  onFindLocation,
  on3DToggle,
  is3DEnabled = false,
}: MapControlsProps) {
  const insets = useSafeAreaInsets();

  const [showLayerSelector, setShowLayerSelector] = React.useState(false);

  // Position buttons just above bottom sheet
  const bottomPosition = insets.bottom + 152;

  return (
    <>
      {/* Top Right Mode Toggle - Pill shaped segmented control */}
      <View style={[styles.topRightContainer, { top: insets.top + Spacing.md }]} pointerEvents="box-none">
        <MapModeToggle activeMode={viewMode} onModeChange={onViewModeChange} />
      </View>

      {/* Bottom Right Controls - Always visible, z-index handles layering */}
      <>
        {/* Vertical Sub-mode toggle - Above buttons with matching spacing */}
        <View style={[styles.subModeContainer, { bottom: bottomPosition + 112 }]} pointerEvents="box-none">
          <MapSubModeToggle
            mode={viewMode}
            activeSubMode={viewMode === 'heatmap' ? heatmapMode : feedbackMode}
            onSubModeChange={(subMode) => {
              if (viewMode === 'heatmap') {
                onHeatmapModeChange(subMode as import('@/types/mapMode').HeatmapMode);
              } else {
                onFeedbackModeChange(subMode as import('@/types/mapMode').FeedbackMode);
              }
            }}
          />
        </View>

        {/* Action Buttons */}
        <View
          style={[styles.actionButtonsContainer, { bottom: bottomPosition }]}
          pointerEvents="box-none"
        >
          <MapActionButtons
            onLayersPress={() => setShowLayerSelector(true)}
            onFindLocation={onFindLocation}
          />
        </View>
      </>

      {/* Layer selector modal */}
      {showLayerSelector && (
        <MapLayerSelector
          selectedLayer={selectedLayer}
          onLayerChange={(layer) => {
            onLayerChange(layer);
            setShowLayerSelector(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  topRightContainer: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 100,
    alignItems: 'flex-end',
  },
  subModeContainer: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 100,
    alignItems: 'flex-end',
  },
  actionButtonsContainer: {
    position: 'absolute',
    right: Spacing.md,
    zIndex: 100,
    elevation: 10,
  },
});
