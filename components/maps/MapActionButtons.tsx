import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Square3Stack3DIcon, ViewfinderCircleIcon } from 'react-native-heroicons/outline';

import type { MenuAnchor } from '@/components/maps/MapLayerSelector';
import { GlassButton } from '@/components/ui/GlassButton';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';

interface MapActionButtonsProps {
  /** Receives the layers button's on-screen frame so a menu can grow out of it. */
  onLayersPress: (anchor: MenuAnchor) => void;
  onFindLocation: () => void;
}

export function MapActionButtons({ onLayersPress, onFindLocation }: MapActionButtonsProps) {
  const { t } = useTranslation('maps');
  const { colors } = useTheme();
  const layersRef = useRef<View>(null);

  const handleLayersPress = () => {
    layersRef.current?.measureInWindow((x, y, width, height) => onLayersPress({ x, y, width, height }));
  };

  return (
    <View style={styles.container}>
      <View ref={layersRef} collapsable={false}>
        <GlassButton onPress={handleLayersPress} accessibilityLabel={t('controls.layers')}>
          <Square3Stack3DIcon size={22} color={colors.glassInactive} />
        </GlassButton>
      </View>
      <GlassButton onPress={onFindLocation} accessibilityLabel={t('controls.findLocation')}>
        <ViewfinderCircleIcon size={22} color={colors.glassTint} />
      </GlassButton>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
});
