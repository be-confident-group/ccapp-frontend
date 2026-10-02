/**
 * FeelingSelector Component
 *
 * Feeling buttons for route rating (single compact row, or a 2x2 grid).
 * Users select a feeling before painting route segments.
 * Feeling colours carry meaning (stressed -> enjoyable) and are kept; the
 * selected state is a solid fill with white content, readable in light & dark.
 */

import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  FaceFrownIcon,
  FaceSmileIcon,
  MinusCircleIcon,
  SparklesIcon,
} from 'react-native-heroicons/outline';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import {
  FeelingType,
  FEELING_ORDER,
  FEELINGS,
  getFeelingColor,
} from '@/types/rating';

// Near-critically damped: quick and settled, no visible wobble.
const PRESS_SPRING = { damping: 26, stiffness: 420 };
const SELECT_SPRING = { damping: 28, stiffness: 320 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FEELING_ICONS: Record<FeelingType, typeof FaceFrownIcon> = {
  stressed: FaceFrownIcon,
  uncomfortable: MinusCircleIcon,
  comfortable: FaceSmileIcon,
  enjoyable: SparklesIcon,
};

interface FeelingSelectorProps {
  selectedFeeling: FeelingType | null;
  onSelect: (feeling: FeelingType) => void;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
}

interface FeelingButtonProps {
  feelingType: FeelingType;
  isSelected: boolean;
  disabled: boolean;
  compact: boolean;
  onSelect: (feeling: FeelingType) => void;
}

function FeelingButton({ feelingType, isSelected, disabled, compact, onSelect }: FeelingButtonProps) {
  const { t } = useTranslation('maps');
  const press = useSharedValue(1);
  const selectScale = useSharedValue(1);
  const feelingColor = getFeelingColor(feelingType);
  const Icon = FEELING_ICONS[feelingType];
  const label = t(`rating.feelings.${feelingType}`, { defaultValue: FEELINGS[feelingType].label });

  // The selected tile lifts slightly; press shrinks it. Transforms only.
  useEffect(() => {
    selectScale.value = withSpring(isSelected ? 1.02 : 1, SELECT_SPRING);
  }, [isSelected, selectScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: selectScale.value * press.value }],
  }));

  const contentColor = isSelected ? '#FFFFFF' : feelingColor;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled }}
      onPress={() => onSelect(feelingType)}
      onPressIn={() => {
        press.value = withSpring(0.97, PRESS_SPRING);
        if (process.env.EXPO_OS !== 'web') {
          Haptics.selectionAsync().catch(() => {});
        }
      }}
      onPressOut={() => {
        press.value = withSpring(1, PRESS_SPRING);
      }}
      disabled={disabled}
      style={[
        compact ? styles.compactButton : styles.button,
        {
          backgroundColor: isSelected ? feelingColor : feelingColor + '22',
          borderColor: feelingColor,
          borderWidth: isSelected ? 0 : 1.5,
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
      ]}
    >
      <Icon size={compact ? 22 : 32} color={contentColor} />
      <ThemedText
        style={[compact ? styles.compactLabel : styles.label, { color: contentColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function FeelingSelector({
  selectedFeeling,
  onSelect,
  disabled = false,
  style,
  compact = false,
}: FeelingSelectorProps) {
  const { t } = useTranslation('maps');

  const buttons = FEELING_ORDER.map((feelingType) => (
    <FeelingButton
      key={feelingType}
      feelingType={feelingType}
      isSelected={selectedFeeling === feelingType}
      disabled={disabled}
      compact={compact}
      onSelect={onSelect}
    />
  ));

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={styles.compactRow}>{buttons}</View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ThemedText style={styles.title}>
        {t('rating.selectFeelingThenPaint', { defaultValue: 'Select a feeling, then paint' })}
      </ThemedText>
      <View style={styles.grid}>{buttons}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  button: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 80,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  compactContainer: {
    paddingVertical: 4,
  },
  compactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  compactLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
