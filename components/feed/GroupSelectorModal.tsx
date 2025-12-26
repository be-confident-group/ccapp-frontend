import React, { useEffect } from 'react';
import {
  View,
  Modal,
  Pressable,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { CheckIcon, UserGroupIcon } from 'react-native-heroicons/solid';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { FeedGroup } from '@/types/feed';
import { useTranslation } from 'react-i18next';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface GroupSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  groups: FeedGroup[];
  selectedGroupId?: string;
  onSelectGroup: (group: FeedGroup | null) => void;
}

export function GroupSelectorModal({
  visible,
  onClose,
  groups,
  selectedGroupId,
  onSelectGroup,
}: GroupSelectorModalProps) {
  const { t } = useTranslation('groups');
  const { colors } = useTheme();
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, {
        damping: 30,
        stiffness: 200,
      });
    } else {
      translateY.value = SCREEN_HEIGHT;
    }
  }, [visible]);

  const handleClose = () => {
    translateY.value = withSpring(SCREEN_HEIGHT, {
      damping: 30,
      stiffness: 200,
    });
    setTimeout(onClose, 200);
  };

  const gesture = Gesture.Pan()
    .onStart(() => {
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const newValue = startY.value + event.translationY;
      translateY.value = Math.max(0, newValue);
    })
    .onEnd((event) => {
      if (translateY.value > 150 || event.velocityY > 800) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, {
          damping: 30,
          stiffness: 200,
        });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleSelectGroup = (group: FeedGroup | null) => {
    onSelectGroup(group);
    handleClose();
  };

  const renderGroupItem = ({ item }: { item: FeedGroup }) => {
    const isSelected = item.id === selectedGroupId;

    return (
      <TouchableOpacity
        style={[
          styles.groupItem,
          {
            backgroundColor: colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
          },
        ]}
        onPress={() => handleSelectGroup(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.groupIcon, { backgroundColor: colors.primary + '20' }]}>
          <UserGroupIcon size={20} color={colors.primary} />
        </View>
        <View style={styles.groupInfo}>
          <ThemedText style={styles.groupName}>{item.name}</ThemedText>
          <ThemedText style={[styles.memberCount, { color: colors.textSecondary }]}>
            {item.memberCount} members
          </ThemedText>
        </View>
        {isSelected && (
          <CheckIcon size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.container}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={handleClose}
        />

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

            {/* Title */}
            <ThemedText style={styles.title}>{t('feed.selectGroup')}</ThemedText>

            {/* All Groups Option */}
            <TouchableOpacity
              style={[
                styles.groupItem,
                {
                  backgroundColor: colors.card,
                  borderColor: !selectedGroupId ? colors.primary : colors.border,
                },
              ]}
              onPress={() => handleSelectGroup(null)}
              activeOpacity={0.7}
            >
              <View style={[styles.groupIcon, { backgroundColor: colors.primary + '20' }]}>
                <UserGroupIcon size={20} color={colors.primary} />
              </View>
              <View style={styles.groupInfo}>
                <ThemedText style={styles.groupName}>{t('feed.allGroups')}</ThemedText>
                <ThemedText style={[styles.memberCount, { color: colors.textSecondary }]}>
                  See posts from all groups
                </ThemedText>
              </View>
              {!selectedGroupId && (
                <CheckIcon size={20} color={colors.primary} />
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Groups List */}
            <FlatList
              data={groups}
              renderItem={renderGroupItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  listContent: {
    gap: 8,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  groupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    gap: 2,
  },
  groupName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberCount: {
    fontSize: 13,
  },
});
