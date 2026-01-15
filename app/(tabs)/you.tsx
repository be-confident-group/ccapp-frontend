import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert, ScrollView, TouchableOpacity, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  UserIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
  BellIcon,
  ChatBubbleBottomCenterTextIcon,
  StarIcon,
  ArrowRightOnRectangleIcon,
  SunIcon,
  WrenchScrewdriverIcon,
} from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
// NOTE: ActivityChart is hidden for next version release but import kept for future use
import { ActivityChart } from '@/components/profile/ActivityChart';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { showConfirmAlert, showInfoAlert, showComingSoonAlert } from '@/lib/utils/alert';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types';
import { authApi, User } from '@/lib/api/auth';
import { useTracking } from '@/contexts/TrackingContext';
import * as Location from 'expo-location';

export default function YouScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { currentLanguage } = useLanguage();
  const { unitSystem, setUnitSystem } = useUnits();
  const { isTracking, toggleTracking, hasPermissions } = useTracking();
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const [userProfile, setUserProfile] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    dateOfBirth: '1990-05-15',
    gender: 'M' as 'M' | 'F' | 'O' | '',
    profilePicture: undefined as string | undefined,
    joinedDate: 'Sep 2025',
  });

  // Fetch user profile on mount
  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      setFetchingProfile(true);
      const user = await authApi.getProfile();

      console.log('[YouScreen] Fetched user profile:', {
        name: user.name,
        profile_picture: user.profile_picture,
        hasProfile: !!user.profile,
      });

      // Map API response to local state
      // Backend returns: name, last_name, email, date_of_birth, gender, profile_picture (all at root level)
      const profilePicture = user.profile_picture || user.profile?.avatar;
      
      console.log('[YouScreen] Setting profile picture to:', profilePicture);

      // Format joined date from backend's joined_at field
      let joinedDateDisplay = 'Date not found';
      if (user.joined_at) {
        const joinedDate = new Date(user.joined_at);
        joinedDateDisplay = joinedDate.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric'
        });
      }

      setUserProfile({
        firstName: user.name || user.first_name || 'User',
        lastName: user.last_name || '',
        email: user.email || '',
        dateOfBirth: user.date_of_birth || user.profile?.date_of_birth || '',
        gender: user.gender || user.profile?.gender || '',
        profilePicture: profilePicture,
        joinedDate: joinedDateDisplay,
      });
    } catch (error) {
      console.error('[YouScreen] Failed to fetch profile:', error);
      // Keep default values if fetch fails
    } finally {
      setFetchingProfile(false);
    }
  };

  const handleLogout = async () => {
    showConfirmAlert(
      'alerts:logout.title',
      'alerts:logout.message',
      async () => {
        setLoading(true);
        await signOut();
      },
      'alerts:logout.confirmButton',
      'alerts:logout.cancelButton',
      'destructive'
    );
  };

  const handleSaveProfile = async (profile: any) => {
    try {
      setLoading(true);

      // Map local profile format to API format
      // Backend requires: name, last_name, date_of_birth, gender (all required)
      const updateData: any = {
        name: profile.firstName,  // Backend uses 'name' not 'first_name'
        last_name: profile.lastName,
        // Backend requires date_of_birth - use current value or a default
        date_of_birth: profile.dateOfBirth && profile.dateOfBirth.match(/^\d{4}-\d{2}-\d{2}$/)
          ? profile.dateOfBirth
          : '2000-01-01',  // Default date if not set
        // Backend requires gender - use current value or default to 'O'
        gender: profile.gender || 'O',
      };

      // Handle profile picture if it was changed
      if (profile.profilePicture) {
        // Check if it's a base64 data URI (from image picker)
        if (profile.profilePicture.startsWith('data:image')) {
          // Already base64, use as is
          updateData.profile_picture = profile.profilePicture;
        }
        // If it's an HTTP/HTTPS URL (existing image from S3), don't include it in update
        // If it's a local file URI, it means something went wrong in the picker
      }

      // Call API to update profile
      await authApi.updateProfile(updateData);

      // Refetch the profile to get the updated profile picture URL from S3
      // (ProfileUpdateSerializer has write_only=True for profile_picture, so it's not returned in update response)
      await fetchUserProfile();

      showInfoAlert('alerts:profileUpdated.title', 'alerts:profileUpdated.message');
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      const errorMessage = error?.response?.data?.message || 'Failed to update profile';
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackgroundTrackingToggle = async (value: boolean) => {
    if (value) {
      // Turning ON - check if we have permissions first
      try {
        // Check current permission status
        const { status: fgStatus } = await Location.getForegroundPermissionsAsync();
        const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
        
        const hasFullPermissions = 
          fgStatus === Location.PermissionStatus.GRANTED && 
          bgStatus === Location.PermissionStatus.GRANTED;

        if (!hasFullPermissions) {
          // Show permission explanation
          Alert.alert(
            'Background Tracking Permission',
            Platform.OS === 'ios'
              ? 'To track your activities automatically, Radzi needs "Always Allow" location access.\n\n' +
                '1. Tap "Settings" below\n' +
                '2. Go to Location\n' +
                '3. Select "Always"\n\n' +
                'This allows the app to track your walks and rides even when you\'re not actively using it.'
              : 'To track your activities automatically, Radzi needs location access all the time.\n\n' +
                'Please grant "Allow all the time" permission in the next screen.\n\n' +
                'This allows the app to track your walks and rides in the background.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: Platform.OS === 'ios' ? 'Open Settings' : 'Grant Permission',
                onPress: async () => {
                  if (Platform.OS === 'ios') {
                    // On iOS, open app settings
                    Linking.openSettings();
                  } else {
                    // On Android, request permission
                    await toggleTracking();
                  }
                },
              },
            ]
          );
        } else {
          // Already have permissions, just start tracking
          await toggleTracking();
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        // Fallback to toggle
        await toggleTracking();
      }
    } else {
      // Turning OFF - confirm first
      Alert.alert(
        'Stop Background Tracking?',
        'Your activities will no longer be tracked automatically. You can still log trips manually.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Stop Tracking',
            style: 'destructive',
            onPress: async () => {
              await toggleTracking();
            },
          },
        ]
      );
    }
  };

  const handleRateApp = () => {
    const storeUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id123456789' // Replace with actual App Store ID
        : 'https://play.google.com/store/apps/details?id=com.ccapp'; // Replace with actual package name

    Linking.openURL(storeUrl).catch(() =>
      showInfoAlert('alerts:error.title', 'alerts:error.appStore')
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {fetchingProfile ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading profile...
            </ThemedText>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Profile Header */}
            <View style={styles.profileHeader}>
              <ProfileAvatar
                imageUri={userProfile.profilePicture}
                firstName={userProfile.firstName}
                lastName={userProfile.lastName}
                size={120}
                editable={false}
              />
              <ThemedText style={styles.userName}>
                {userProfile.firstName} {userProfile.lastName}
              </ThemedText>
              <ThemedText style={[styles.joinedDate, { color: colors.textSecondary }]}>
                {t('profile:header.joined', { date: userProfile.joinedDate })}
              </ThemedText>
            </View>

          {/* ===========================================
              ACTIVITY CHART - HIDDEN FOR NEXT VERSION
              ===========================================
              This section contains dummy data and is planned for release in
              the next version. Keeping the code commented out for future implementation.
          */}
          {/* <View style={styles.chartSection}>
            <View style={[styles.chartCard, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                <View style={styles.chartContent}>
                  <ActivityChart />
                </View>
              </View>
            </View>
          </View> */}

          {/* Account Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>{t('profile:sections.account')}</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                <SettingsItem
                  icon={<UserIcon size={22} color={colors.text} />}
                  title={t('profile:account.editProfile')}
                  subtitle={t('profile:account.editProfileSubtitle')}
                  onPress={() => setShowEditProfile(true)}
                  isFirst
                  isLast
                />
              </View>
            </View>
          </View>

          {/* Preferences Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>{t('profile:sections.preferences')}</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                <SettingsItem
                  icon={<SunIcon size={22} color={colors.text} />}
                  title={t('profile:preferences.theme')}
                  subtitle={isDark ? t('profile:preferences.themeDark') : t('profile:preferences.themeLight')}
                  toggleValue={isDark}
                  onToggleChange={toggleTheme}
                  showChevron={false}
                  isFirst
                />
                <SettingsItem
                  icon={<DevicePhoneMobileIcon size={22} color={colors.text} />}
                  title="Background Tracking"
                  subtitle={isTracking ? 'Automatically tracking your activities' : 'Track activities in the background'}
                  toggleValue={isTracking}
                  onToggleChange={handleBackgroundTrackingToggle}
                  showChevron={false}
                />
                <SettingsItem
                  icon={<Cog6ToothIcon size={22} color={colors.text} />}
                  title={t('profile:preferences.unitsOfMeasure')}
                  subtitle={unitSystem === 'metric' ? t('profile:preferences.unitsMetric') : t('profile:preferences.unitsImperial')}
                  toggleValue={unitSystem === 'imperial'}
                  onToggleChange={async (value) => {
                    await setUnitSystem(value ? 'imperial' : 'metric');
                  }}
                  showChevron={false}
                />
                <SettingsItem
                  icon={<GlobeAltIcon size={22} color={colors.text} />}
                  title={t('profile:preferences.systemLanguage')}
                  subtitle={SUPPORTED_LANGUAGES[currentLanguage]}
                  onPress={() => setShowLanguagePicker(true)}
                  isLast
                />
              </View>
            </View>
          </View>

          {/* Privacy & Notifications Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>{t('profile:sections.privacyNotifications')}</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                <SettingsItem
                  icon={<ShieldCheckIcon size={22} color={colors.text} />}
                  title={t('profile:privacy.privacy')}
                  subtitle={t('profile:privacy.privacySubtitle')}
                  onPress={() => {
                    Alert.alert(
                      'Coming Soon',
                      'Privacy settings will come soon!',
                      [{ text: 'OK', style: 'default' }]
                    );
                  }}
                  isFirst
                />
                <SettingsItem
                  icon={<BellIcon size={22} color={colors.text} />}
                  title={t('profile:privacy.notificationSettings')}
                  subtitle={t('profile:privacy.notificationSettingsSubtitle')}
                  onPress={() => {
                    Alert.alert(
                      'Coming Soon',
                      'Notifications will come soon!',
                      [{ text: 'OK', style: 'default' }]
                    );
                  }}
                  isLast
                />
              </View>
            </View>
          </View>

          {/* Feedback Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>{t('profile:sections.feedback')}</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                <SettingsItem
                  icon={<ChatBubbleBottomCenterTextIcon size={22} color={colors.text} />}
                  title={t('profile:feedback.sendFeedback')}
                  subtitle={t('profile:feedback.sendFeedbackSubtitle')}
                  onPress={() => router.push('/feedback')}
                  isFirst
                />
                <SettingsItem
                  icon={<StarIcon size={22} color={colors.text} />}
                  title={t('profile:feedback.rateUs')}
                  subtitle={t('profile:feedback.rateUsSubtitle')}
                  onPress={handleRateApp}
                  isLast
                />
              </View>
            </View>
          </View>

          {/* Developer Section - visible in preview/dev builds for testing */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Developer</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <View style={[styles.cardInner, { backgroundColor: colors.card }]}>
                {!isDark && (
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.3 }}
                    style={styles.cardTopHighlight}
                  />
                )}
                <SettingsItem
                  icon={<WrenchScrewdriverIcon size={22} color={colors.text} />}
                  title="Debug Tracking"
                  subtitle="View real-time tracking status and diagnostics"
                  onPress={() => router.push('/debug-tracking')}
                  isFirst
                  isLast
                />
              </View>
            </View>
          </View>

          {/* Log Out Button */}
          <View style={styles.logoutSection}>
            <Button
              title={t('profile:logout')}
              onPress={handleLogout}
              variant="outline"
              size="large"
              fullWidth
              loading={loading}
              icon={<ArrowRightOnRectangleIcon size={20} color={colors.primary} />}
              iconPosition="left"
            />
          </View>
          </ScrollView>
        )}

        {/* Edit Profile Modal */}
        <EditProfileModal
          visible={showEditProfile}
          onClose={() => setShowEditProfile(false)}
          profile={userProfile}
          onSave={handleSaveProfile}
        />

        {/* Language Picker Modal */}
        <LanguagePicker
          visible={showLanguagePicker}
          onClose={() => setShowLanguagePicker(false)}
        />
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  joinedDate: {
    fontSize: 14,
    marginTop: 4,
  },
  // ===========================================
  // ACTIVITY CHART STYLES - HIDDEN FOR NEXT VERSION
  // ===========================================
  // Keeping styles commented out for future implementation
  // chartSection: {
  //   paddingHorizontal: 24,
  //   marginBottom: 32,
  // },
  // chartCard: {
  //   borderRadius: 16,
  // },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '30%',
    zIndex: 1,
  },
  // chartContent: {
  //   padding: 20,
  // },
  settingsSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  settingsCard: {
    borderRadius: 16,
  },
  cardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  themeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  themeBadgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  logoutSection: {
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 32,
  },
});
