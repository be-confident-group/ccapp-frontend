import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  CameraIcon,
  LinkIcon,
  MegaphoneIcon,
  PencilSquareIcon,
  RocketLaunchIcon,
  UserGroupIcon,
} from 'react-native-heroicons/solid';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type ActionItem = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  onPress: () => void;
};

export default function QuickActionsModal() {
  const { colors, isDark } = useTheme();
  
  const translateY = useSharedValue(0);
  const startY = useSharedValue(0);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const gesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Only allow dragging down (positive values)
      const newValue = startY.value + event.translationY;
      translateY.value = Math.max(0, newValue);
    })
    .onEnd((event) => {
      // Close if dragged down more than 150px or with fast velocity
      if (translateY.value > 150 || event.velocityY > 800) {
        runOnJS(handleClose)();
      } else {
        // Spring back to original position
        translateY.value = withSpring(0, {
          damping: 20,
          stiffness: 300,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const actions: ActionItem[] = [
    {
      icon: RocketLaunchIcon,
      title: 'Start a Ride',
      onPress: () => {
        handleClose();
        // TODO: Navigate to tracking screen
      },
    },
    {
      icon: PencilSquareIcon,
      title: 'Log Ride Manually',
      onPress: () => {
        handleClose();
        // TODO: Navigate to manual entry
      },
    },
    {
      icon: MegaphoneIcon,
      title: 'Share Update',
      onPress: () => {
        handleClose();
        // TODO: Navigate to create post
      },
    },
    {
      icon: CameraIcon,
      title: 'Share Photo',
      onPress: () => {
        handleClose();
        // TODO: Navigate to photo picker
      },
    },
    {
      icon: UserGroupIcon,
      title: 'Create Group',
      onPress: () => {
        handleClose();
        // TODO: Navigate to create group
      },
    },
    {
      icon: LinkIcon,
      title: 'Join Group',
      onPress: () => {
        handleClose();
        // TODO: Show join group dialog
      },
    },
  ];

  return (
    <GestureHandlerRootView style={styles.container}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={handleClose} />
      
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.background },
            animatedStyle,
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          <View style={styles.content}>
            {actions.map((action, index) => {
              const IconComponent = action.icon;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={action.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                    <IconComponent size={22} color="#fff" />
                  </View>
                  <ThemedText style={styles.actionText}>{action.title}</ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '60%',
    paddingBottom: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    gap: 8,
    paddingBottom: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
