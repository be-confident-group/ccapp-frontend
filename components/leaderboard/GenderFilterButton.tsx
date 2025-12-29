import React from 'react';
import { TouchableOpacity, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native';
import { ChevronDownIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';

type GenderFilter = 'all' | 'male' | 'female';

interface GenderFilterButtonProps {
  selected: GenderFilter;
  onSelect: (value: GenderFilter) => void;
}

const GENDER_OPTIONS: { key: GenderFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'male', label: 'Male' },
  { key: 'female', label: 'Female' },
];

export function GenderFilterButton({ selected, onSelect }: GenderFilterButtonProps) {
  const { colors } = useTheme();

  const selectedLabel = GENDER_OPTIONS.find((opt) => opt.key === selected)?.label || 'All';

  const handlePress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...GENDER_OPTIONS.map((opt) => opt.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = GENDER_OPTIONS[buttonIndex - 1];
            onSelect(selected.key);
          }
        }
      );
    } else {
      Alert.alert(
        'Filter by Gender',
        '',
        [
          ...GENDER_OPTIONS.map((opt) => ({
            text: opt.label,
            onPress: () => onSelect(opt.key),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <ThemedText style={styles.label} numberOfLines={1}>
        Gender: {selectedLabel}
      </ThemedText>
      <ChevronDownIcon size={16} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    flex: 1,
  },
});
