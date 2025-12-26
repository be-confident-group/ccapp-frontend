import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, ActionSheetIOS, Platform, Alert } from 'react-native';
import { ChevronDownIcon } from 'react-native-heroicons/outline';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import { mockGroups } from '@/lib/utils/mockFeedData';
import { generateMonthOptions } from '@/lib/utils/mockLeaderboardData';
import type { FeedGroup } from '@/types/feed';

interface FilterRowProps {
  selectedMonth: string | null;
  onMonthChange: (month: string | null) => void;
  selectedGroup: FeedGroup | null;
  onGroupChange: (group: FeedGroup | null) => void;
}

export function FilterRow({
  selectedMonth,
  onMonthChange,
  selectedGroup,
  onGroupChange,
}: FilterRowProps) {
  const { colors } = useTheme();

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const selectedMonthLabel = useMemo(() => {
    const option = monthOptions.find((opt) => opt.value === selectedMonth);
    return option?.label || 'All Time';
  }, [monthOptions, selectedMonth]);

  const selectedGroupLabel = selectedGroup?.name || 'All Groups';

  const handleMonthPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...monthOptions.map((opt) => opt.label)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = monthOptions[buttonIndex - 1];
            onMonthChange(selected.value);
          }
        }
      );
    } else {
      // For Android, show a simple selection (in production, use a proper picker)
      Alert.alert(
        'Select Month',
        '',
        [
          ...monthOptions.map((opt) => ({
            text: opt.label,
            onPress: () => onMonthChange(opt.value),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const handleGroupPress = () => {
    const groupOptions = [{ id: null, name: 'All Groups' }, ...mockGroups];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', ...groupOptions.map((g) => g.name)],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            const selected = groupOptions[buttonIndex - 1];
            onGroupChange(selected.id ? selected as FeedGroup : null);
          }
        }
      );
    } else {
      Alert.alert(
        'Select Group',
        '',
        [
          ...groupOptions.map((g) => ({
            text: g.name,
            onPress: () => onGroupChange(g.id ? g as FeedGroup : null),
          })),
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.filterButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={handleMonthPress}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.filterText} numberOfLines={1}>
          {selectedMonthLabel}
        </ThemedText>
        <ChevronDownIcon size={16} color={colors.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.filterButton,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
        onPress={handleGroupPress}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.filterText} numberOfLines={1}>
          {selectedGroupLabel}
        </ThemedText>
        <ChevronDownIcon size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    flex: 1,
  },
});
