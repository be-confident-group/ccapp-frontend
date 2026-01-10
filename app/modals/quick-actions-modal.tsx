import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  MegaphoneIcon,
  PencilSquareIcon,
  StarIcon,
  XMarkIcon,
  UserGroupIcon,
} from 'react-native-heroicons/solid';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

type ActionItem = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  onPress: () => void;
};

export default function QuickActionsModal() {
  const { colors } = useTheme();

  const opacity = useSharedValue(0);
  const scale1 = useSharedValue(0);
  const scale2 = useSharedValue(0);
  const scale3 = useSharedValue(0);
  const scale4 = useSharedValue(0);
  const closeButtonScale = useSharedValue(0);

  // Animate in on mount
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) });
    scale1.value = withDelay(36, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
    scale2.value = withDelay(72, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
    scale3.value = withDelay(108, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
    scale4.value = withDelay(144, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
    closeButtonScale.value = withDelay(180, withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
  }, []);

  const handleClose = () => {
    router.back();
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const button1Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale1.value }],
    opacity: scale1.value,
  }));

  const button2Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale2.value }],
    opacity: scale2.value,
  }));

  const button3Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale3.value }],
    opacity: scale3.value,
  }));

  const button4Style = useAnimatedStyle(() => ({
    transform: [{ scale: scale4.value }],
    opacity: scale4.value,
  }));

  const closeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closeButtonScale.value }],
    opacity: closeButtonScale.value,
  }));

  const actions: ActionItem[] = [
    {
      icon: PencilSquareIcon,
      title: 'Log Ride Manually',
      onPress: () => {
        router.back(); // Close the modal immediately
        setTimeout(() => {
          router.push('/home/manual-entry');
        }, 100); // Small delay to ensure modal is closed
      },
    },
    {
      icon: StarIcon,
      title: 'Rate My Routes',
      onPress: () => {
        router.back(); // Close the modal immediately
        setTimeout(() => {
          router.push('/home/unrated-trips');
        }, 100); // Small delay to ensure modal is closed
      },
    },
    {
      icon: UserGroupIcon,
      title: 'Create Group',
      onPress: () => {
        router.back(); // Close the modal immediately
        setTimeout(() => {
          router.push('/clubs/create');
        }, 100); // Small delay to ensure modal is closed
      },
    },
    {
      icon: MegaphoneIcon,
      title: 'Share Update',
      onPress: () => {
        router.back(); // Close the modal immediately
        setTimeout(() => {
          router.push('/posts/create-standalone');
        }, 100); // Small delay to ensure modal is closed
      },
    },
  ];

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={handleClose} />
      </Animated.View>

      {/* Floating Action Buttons */}
      <View style={styles.buttonsContainer}>
        {/* First Action Button */}
        <Animated.View style={[button1Style]}>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.card }]}
            onPress={actions[0].onPress}
            activeOpacity={0.8}
          >
            <View style={[styles.floatingIconContainer, { backgroundColor: colors.primary }]}>
              <PencilSquareIcon size={24} color="#fff" />
            </View>
            <ThemedText style={styles.floatingButtonText}>{actions[0].title}</ThemedText>
          </TouchableOpacity>
        </Animated.View>

        {/* Second Action Button - Rate My Routes */}
        <Animated.View style={[button2Style]}>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.card }]}
            onPress={actions[1].onPress}
            activeOpacity={0.8}
          >
            <View style={[styles.floatingIconContainer, { backgroundColor: colors.accent }]}>
              <StarIcon size={24} color="#fff" />
            </View>
            <ThemedText style={styles.floatingButtonText}>{actions[1].title}</ThemedText>
          </TouchableOpacity>
        </Animated.View>

        {/* Third Action Button - Create Group */}
        <Animated.View style={[button3Style]}>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.card }]}
            onPress={actions[2].onPress}
            activeOpacity={0.8}
          >
            <View style={[styles.floatingIconContainer, { backgroundColor: colors.primary }]}>
              <UserGroupIcon size={24} color="#fff" />
            </View>
            <ThemedText style={styles.floatingButtonText}>{actions[2].title}</ThemedText>
          </TouchableOpacity>
        </Animated.View>

        {/* Fourth Action Button - Share Update */}
        <Animated.View style={[button4Style]}>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.card }]}
            onPress={actions[3].onPress}
            activeOpacity={0.8}
          >
            <View style={[styles.floatingIconContainer, { backgroundColor: colors.primary }]}>
              <MegaphoneIcon size={24} color="#fff" />
            </View>
            <ThemedText style={styles.floatingButtonText}>{actions[3].title}</ThemedText>
          </TouchableOpacity>
        </Animated.View>

        {/* Close Button */}
        <Animated.View style={[closeButtonStyle]}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: colors.primary }]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <XMarkIcon size={28} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  buttonsContainer: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 100,
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 22,
    minWidth: 216,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },
  floatingButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
});
