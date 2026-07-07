import { Spacing } from '@/constants/theme';
import type { FeedbackMode, MapViewMode } from '@/types/mapMode';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapActionButtons } from './MapActionButtons';
import { MapLayer, MapLayerSelector } from './MapLayerSelector';
import { MapModeToggle } from './MapModeToggle';
import { MapSubModeToggle } from './MapSubModeToggle';

interface MapControlsProps {
  viewMode: MapViewMode;
  feedbackMode: FeedbackMode;
  selectedLayer: MapLayer;
  onViewModeChange: (mode: MapViewMode) => void;
  onFeedbackModeChange: (mode: FeedbackMode) => void;
  onLayerChange: (layer: MapLayer) => void;
  onFindLocation: () => void;
  on3DToggle: () => void;
  is3DEnabled?: boolean;
}

export function MapControls({
  viewMode,
  feedbackMode,
  selectedLayer,
  onViewModeChange,
  onFeedbackModeChange,
  onLayerChange,
  onFindLocation,
  on3DToggle,
  is3DEnabled = false,
}: MapControlsProps) {
  const insets = useSafeAreaInsets();

  const [showLayerSelector, setShowLayerSelector] = React.useState(false);

  // Consistent spacing between all elements
  const buttonGap = Spacing.sm; // 8px gap

  return (
    <>
      {/* Top Right Controls Stack */}
      <View style={[styles.topRightContainer, { top: insets.top + Spacing.md }]} pointerEvents="box-none">
        {/* Heatmap/Feedback Mode Toggle */}
        <MapModeToggle activeMode={viewMode} onModeChange={onViewModeChange} />

        {/* Community/Personal Sub-mode Toggle (feedback only — global heatmap isn't built yet, see MapSubModeToggle) */}
        {viewMode === 'feedback' && (
          <View style={{ marginTop: buttonGap }}>
            <MapSubModeToggle
              mode={viewMode}
              activeSubMode={feedbackMode}
              onSubModeChange={(subMode) => onFeedbackModeChange(subMode as import('@/types/mapMode').FeedbackMode)}
            />
          </View>
        )}

        {/* Layers and Location Buttons */}
        <View style={{ marginTop: buttonGap }}>
          <MapActionButtons
            onLayersPress={() => setShowLayerSelector(true)}
            onFindLocation={onFindLocation}
          />
        </View>
      </View>

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
});
