import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckIcon } from 'react-native-heroicons/solid';

export type MapLayer = 'light' | 'dark' | 'outdoors' | 'satellite' | 'streets';

interface MapLayerSelectorProps {
  selectedLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
}

const LAYERS: Array<{ key: MapLayer; label: string; description: string }> = [
  { key: 'light', label: 'Light', description: 'Clean minimal style' },
  { key: 'dark', label: 'Dark', description: 'Dark mode friendly' },
  { key: 'streets', label: 'Streets', description: 'Standard map' },
  { key: 'outdoors', label: 'Outdoors', description: 'Topographic with terrain' },
  { key: 'satellite', label: 'Satellite', description: 'Satellite imagery' },
];

export function MapLayerSelector({ selectedLayer, onLayerChange }: MapLayerSelectorProps) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
      onRequestClose={() => onLayerChange(selectedLayer)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => onLayerChange(selectedLayer)}
      >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: colors.card,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Map Style
            </Text>
          </View>

          {LAYERS.map((layer) => {
            const isSelected = selectedLayer === layer.key;
            return (
              <Pressable
                key={layer.key}
                style={[
                  styles.layerOption,
                  { borderBottomColor: colors.border },
                ]}
                onPress={() => {
                  onLayerChange(layer.key);
                }}
                android_ripple={{ color: colors.primary + '10' }}
              >
                <View style={styles.layerInfo}>
                  <Text style={[styles.layerLabel, { color: colors.text }]}>
                    {layer.label}
                  </Text>
                  <Text style={[styles.layerDescription, { color: colors.textSecondary }]}>
                    {layer.description}
                  </Text>
                </View>
                {isSelected && (
                  <CheckIcon size={20} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxWidth: 400,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  layerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  layerInfo: {
    flex: 1,
  },
  layerLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  layerDescription: {
    fontSize: 13,
  },
});
