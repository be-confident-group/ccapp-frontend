import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  ScrollView,
  Dimensions,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Spacing } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_PADDING = Spacing.md;
const IMAGE_GAP = Spacing.sm;
const PHOTO_WIDTH = SCREEN_WIDTH - GALLERY_PADDING * 2 - 40; // Account for card padding

interface PhotoGalleryProps {
  photos: string[];
  onPhotoPress?: (index: number) => void;
  height?: number;
}

export const PhotoGallery = React.memo(function PhotoGallery({ photos, onPhotoPress, height = 200 }: PhotoGalleryProps) {
  const { colors, isDark } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const isSinglePhoto = photos.length === 1;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const totalWidth = PHOTO_WIDTH + IMAGE_GAP;
    const newIndex = Math.round(contentOffsetX / totalWidth);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < photos.length) {
      setActiveIndex(newIndex);
    }
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={!isSinglePhoto}
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={isSinglePhoto ? undefined : PHOTO_WIDTH + IMAGE_GAP}
        snapToAlignment="start"
        style={isSinglePhoto && styles.singlePhotoScroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: GALLERY_PADDING },
          isSinglePhoto && styles.singlePhotoScrollContent,
        ]}
        scrollEnabled={!isSinglePhoto}
      >
        {photos.map((photo, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            onPress={() => onPhotoPress?.(index)}
            style={[
              styles.photoContainer,
              { width: PHOTO_WIDTH, height },
              !isSinglePhoto && index < photos.length - 1 && { marginRight: IMAGE_GAP },
            ]}
          >
            <Image
              source={{ uri: photo }}
              style={[
                styles.photo,
                { height },
                isDark && styles.photoDarkMode,
              ]}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Pagination dots */}
      {photos.length > 1 && (
        <View style={styles.pagination}>
          {photos.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === activeIndex ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.md,
    marginBottom: 8,
  },
  scrollContent: {
    // padding is set inline
  },
  singlePhotoScroll: {
    width: '100%',
  },
  singlePhotoScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    borderRadius: 12,
  },
  photoDarkMode: {
    opacity: 0.95,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
