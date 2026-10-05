import { Spacing } from '@/constants/theme';
import type { FeedbackMode, MapViewMode } from '@/types/mapMode';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapActionButtons } from './MapActionButtons';
import type { MapLayerPreference } from '@/lib/hooks/useMapLayer';
import { MapLayerSelector, type MenuAnchor } from './MapLayerSelector';
import { MapModeToggle } from './MapModeToggle';
import { MapSubModeToggle } from './MapSubModeToggle';

interface MapControlsProps {
  viewMode: MapViewMode;
  feedbackMode: FeedbackMode;
  layerPreference: MapLayerPreference;
  onViewModeChange: (mode: MapViewMode) => void;
  onFeedbackModeChange: (mode: FeedbackMode) => void;
  onLayerChange: (layer: MapLayerPreference) => void;
  onFindLocation: () => void;
  on3DToggle: () => void;
  is3DEnabled?: boolean;
}

export function MapControls({
  viewMode,
  feedbackMode,
  layerPreference,
  onViewModeChange,
  onFeedbackModeChange,
  onLayerChange,
  onFindLocation,
  on3DToggle,
  is3DEnabled = false,
}: MapControlsProps) {
  const insets = useSafeAreaInsets();

  // Frame of the layers button while the style menu is open; null when closed.
  const [layerMenuAnchor, setLayerMenuAnchor] = React.useState<MenuAnchor | null>(null);

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
            onLayersPress={setLayerMenuAnchor}
            onFindLocation={onFindLocation}
          />
        </View>
      </View>

      {/* Layer selector modal */}
      {layerMenuAnchor && (
        <MapLayerSelector
          anchor={layerMenuAnchor}
          selectedLayer={layerPreference}
          onLayerChange={(layer) => {
            onLayerChange(layer);
            setLayerMenuAnchor(null);
          }}
          onClose={() => setLayerMenuAnchor(null)}
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
