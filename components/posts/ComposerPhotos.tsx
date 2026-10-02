import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PhotoIcon, XMarkIcon } from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';

import { GlassButton } from '@/components/ui/GlassButton';
import { useTheme } from '@/contexts/ThemeContext';
import { PressableScale } from './PressableScale';

const THUMB = 88;

interface ComposerPhotosProps {
  photos: string[];
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addLabel: string;
}

/** Horizontal strip of rounded photo thumbnails (glass remove button) plus an add tile. */
export function ComposerPhotos({ photos, max, onAdd, onRemove, addLabel }: ComposerPhotosProps) {
  const { colors } = useTheme();
  const { t } = useTranslation('groups');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {photos.map((uri, index) => (
        <View key={`${index}-${uri.slice(-12)}`} style={styles.thumbWrap}>
          <Image source={{ uri }} style={styles.thumb} />
          <GlassButton
            size={28}
            style={styles.remove}
            accessibilityLabel={t('posts.removePhoto', { defaultValue: 'Remove photo' })}
            onPress={() => onRemove(index)}
          >
            <XMarkIcon size={14} color={colors.glassTint} />
          </GlassButton>
        </View>
      ))}
      {photos.length < max && (
        <PressableScale
          accessibilityLabel={addLabel}
          onPress={onAdd}
          style={[styles.add, { backgroundColor: colors.glassHighlight }]}
        >
          <PhotoIcon size={24} color={colors.glassTint} />
          <Text style={[styles.addCount, { color: colors.textSecondary }]}>
            {photos.length}/{max}
          </Text>
        </PressableScale>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -16 },
  row: { paddingHorizontal: 16, gap: 10 },
  thumbWrap: { width: THUMB, height: THUMB },
  thumb: { width: THUMB, height: THUMB, borderRadius: 14 },
  remove: { position: 'absolute', top: 4, right: 4 },
  add: {
    width: THUMB,
    height: THUMB,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addCount: { fontSize: 12, fontWeight: '500' },
});
