import React, { useEffect } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { CheckIcon } from 'react-native-heroicons/solid';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing, BorderRadius } from '@/constants/theme';
import type { MonthOption } from '@/types/leaderboard';

interface MonthPickerModalProps {
  visible: boolean;
  onClose: () => void;
  options: MonthOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
}

export function MonthPickerModal({
  visible,
  onClose,
  options,
  selectedValue,
  onSelect,
}: MonthPickerModalProps) {
  const { colors } = useTheme();
  const translateY = useSharedValue(300);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, {
        damping: 30,
        stiffness: 200,
      });
    } else {
      translateY.value = 300;
    }
  }, [visible, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSelect = (value: string | null) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.modalContainer,
          { backgroundColor: colors.card },
          animatedStyle,
        ]}
      >
        <View style={styles.dragHandle}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
        </View>

        <ThemedText style={styles.title}>Select Month</ThemedText>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {options.map((option) => (
            <TouchableOpacity
              key={option.value ?? 'all-time'}
              style={[
                styles.optionItem,
                { borderBottomColor: colors.border },
              ]}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.7}
            >
              <ThemedText
                style={[
                  styles.optionText,
                  selectedValue === option.value && { color: colors.primary },
                ]}
              >
                {option.label}
              </ThemedText>
              {selectedValue === option.value && (
                <CheckIcon size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '60%',
    paddingBottom: Spacing.xl,
  },
  dragHandle: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  scrollView: {
    paddingHorizontal: Spacing.lg,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 16,
  },
});
