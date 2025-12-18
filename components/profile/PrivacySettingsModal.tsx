/**
 * Privacy Settings Modal Component
 *
 * Allows users to manage their privacy preferences including
 * data sharing, activity visibility, and profile privacy
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { XMarkIcon } from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ShieldCheckIcon,
  EyeIcon,
  MapPinIcon,
  ChartBarIcon,
  UserGroupIcon,
  GlobeAltIcon,
} from 'react-native-heroicons/outline';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface PrivacySettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PrivacySettingsModal({ visible, onClose }: PrivacySettingsModalProps) {
  const { colors } = useTheme();
  
  // Privacy preferences state
  const [activityVisible, setActivityVisible] = useState(true);
  const [profilePublic, setProfilePublic] = useState(false);
  const [shareLocation, setShareLocation] = useState(true);
  const [allowAnalytics, setAllowAnalytics] = useState(true);
  const [showInLeaderboards, setShowInLeaderboards] = useState(true);
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 30, stiffness: 200 });
      backdropOpacity.value = withSpring(1, { damping: 30, stiffness: 200 });
    } else {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const handleActivityVisibilityToggle = (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Hide Activity?',
        'Your trips and activities will be hidden from other users. You can still see your own activity.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Hide',
            style: 'destructive',
            onPress: () => setActivityVisible(false),
          },
        ]
      );
    } else {
      setActivityVisible(true);
    }
  };

  const handleProfilePublicToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Make Profile Public?',
        'Your profile will be visible to all users. Anyone can view your stats and achievements.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Make Public',
            onPress: () => setProfilePublic(true),
          },
        ]
      );
    } else {
      setProfilePublic(false);
    }
  };

  const handleLocationSharingToggle = (value: boolean) => {
    if (!value) {
      Alert.alert(
        'Stop Sharing Location?',
        'Your location data will not be shared with the community. This may limit some social features.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop Sharing',
            style: 'destructive',
            onPress: () => setShareLocation(false),
          },
        ]
      );
    } else {
      setShareLocation(true);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.fullScreenContainer}>
        <Animated.View style={[styles.overlayBackdrop, backdropStyle]}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]}
            onPress={handleClose}
          />
        </Animated.View>

        <Animated.View
          style={[styles.modalContent, { backgroundColor: colors.background }, animatedStyle]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                <ShieldCheckIcon size={24} color={colors.primary} />
              </View>
              <ThemedText style={styles.title}>Privacy Settings</ThemedText>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <XMarkIcon size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Activity & Profile Section */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Activity & Profile
              </ThemedText>
              <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
                <SettingsItem
                  icon={<EyeIcon size={22} color={colors.text} />}
                  title="Activity Visibility"
                  subtitle={activityVisible ? 'Others can see your trips' : 'Your trips are private'}
                  toggleValue={activityVisible}
                  onToggleChange={handleActivityVisibilityToggle}
                  showChevron={false}
                  isFirst
                />
                <SettingsItem
                  icon={<GlobeAltIcon size={22} color={colors.text} />}
                  title="Public Profile"
                  subtitle={profilePublic ? 'Anyone can view your profile' : 'Only friends can view'}
                  toggleValue={profilePublic}
                  onToggleChange={handleProfilePublicToggle}
                  showChevron={false}
                />
                <SettingsItem
                  icon={<UserGroupIcon size={22} color={colors.text} />}
                  title="Show in Leaderboards"
                  subtitle={showInLeaderboards ? 'Visible in rankings' : 'Hidden from rankings'}
                  toggleValue={showInLeaderboards}
                  onToggleChange={setShowInLeaderboards}
                  showChevron={false}
                  isLast
                />
              </View>
            </View>

            {/* Location & Data Section */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Location & Data
              </ThemedText>
              <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
                <SettingsItem
                  icon={<MapPinIcon size={22} color={colors.text} />}
                  title="Share Location Data"
                  subtitle={shareLocation ? 'Location shared with community' : 'Location is private'}
                  toggleValue={shareLocation}
                  onToggleChange={handleLocationSharingToggle}
                  showChevron={false}
                  isFirst
                />
                <SettingsItem
                  icon={<ChartBarIcon size={22} color={colors.text} />}
                  title="Analytics & Improvements"
                  subtitle={allowAnalytics ? 'Help improve the app' : 'No analytics collected'}
                  toggleValue={allowAnalytics}
                  onToggleChange={setAllowAnalytics}
                  showChevron={false}
                  isLast
                />
              </View>
            </View>

            {/* Social Section */}
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Social
              </ThemedText>
              <View style={[styles.settingsCard, { backgroundColor: colors.card }]}>
                <SettingsItem
                  icon={<UserGroupIcon size={22} color={colors.text} />}
                  title="Allow Friend Requests"
                  subtitle={allowFriendRequests ? 'Others can send requests' : 'Friend requests disabled'}
                  toggleValue={allowFriendRequests}
                  onToggleChange={setAllowFriendRequests}
                  showChevron={false}
                  isFirst
                  isLast
                />
              </View>
            </View>

            {/* Info Section */}
            <View style={styles.infoSection}>
              <View style={[styles.infoCard, { backgroundColor: colors.cardSecondary }]}>
                <ThemedText style={[styles.infoText, { color: colors.textSecondary }]}>
                  Your privacy is important to us. These settings control how your data is shared within
                  the Radzi community. Your location and trip data is always encrypted and never sold to
                  third parties.
                </ThemedText>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.85,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  settingsCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  infoSection: {
    marginTop: 8,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

