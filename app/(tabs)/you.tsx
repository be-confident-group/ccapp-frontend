import React, { useState, useMemo, useRef } from 'react';
import { StyleSheet, View, Alert, Linking, Platform, ActivityIndicator } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useTabBarInset, useTabBarScrollHandler } from '@/contexts/TabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  UserIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  ShieldCheckIcon,
  BellIcon,
  ChatBubbleBottomCenterTextIcon,
  StarIcon,
  SunIcon,
  WrenchScrewdriverIcon,
  LockClosedIcon,
  HeartIcon,
  LifebuoyIcon,
  ScaleIcon,
} from 'react-native-heroicons/solid';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui';
import { GlassMenu, type GlassMenuAnchor } from '@/components/ui/GlassMenu';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { ChevronUpDownIcon } from 'react-native-heroicons/mini';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUnits } from '@/contexts/UnitsContext';

import { SettingsItem } from '@/components/profile/SettingsItem';
import { SettingsGroup } from '@/components/profile/SettingsGroup';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { ChangePasswordModal } from '@/components/profile/ChangePasswordModal';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { showAlert, showConfirmAlert, showInfoAlert, showErrorAlert } from '@/lib/utils/alert';
import i18n from '@/lib/i18n';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types';
import { IOS_APP_STORE_ID, ANDROID_PACKAGE_NAME, PRIVACY_POLICY_URL, SUPPORT_EMAIL } from '@/config/env';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/lib/api/auth';
import { useTracking } from '@/contexts/TrackingContext';
import { useMyClubs } from '@/lib/hooks/useClubs';
import * as Location from 'expo-location';
import { isDebugEnabled } from '@/lib/utils/debugAccess';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

/** Shape of the profile object passed into/from EditProfileModal */
interface LocalProfile {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string; // YYYY-MM-DD or empty string
  gender?: 'M' | 'F' | 'O' | '';
  profilePicture?: string;
}

/** Shape sent to authApi.updateProfile */
interface UpdateProfilePayload {
  name: string;
  last_name: string;
  date_of_birth?: string;
  gender: 'M' | 'F' | 'O' | '';
  profile_picture?: string;
}

const HEADER_GAP = 8;
const TITLE_FADE_DISTANCE = 60;

// iOS Settings-style tile colours (kept identical in light and dark mode).
export default function YouScreen() {
  const { t } = useTranslation();
  const { signOut, user: contextUser } = useAuth();
  const isDebugBuild = isDebugEnabled();
  const { colors, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const tabBarScroll = useTabBarScrollHandler(scrollY);
  const tabBarInset = useTabBarInset();
  const { currentLanguage } = useLanguage();
  const { unitSystem, setUnitSystem } = useUnits();
  const { isTracking, toggleTracking } = useTracking();
  const [loading, setLoading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const queryClient = useQueryClient();

  const { data: profileData, isLoading: fetchingProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
    staleTime: 1000 * 60 * 10, // 10 minutes — show cached, refresh in background
    gcTime: 1000 * 60 * 30,    // keep in memory 30 minutes
  });

  const { data: myClubs } = useMyClubs();
  const currentUserId = profileData?.id ?? contextUser?.id;
  const ownedClubs = useMemo(
    () => (myClubs ?? []).filter((club) => currentUserId !== undefined && Number(club.owner.id) === Number(currentUserId)),
    [myClubs, currentUserId]
  );

  // Map API response to local profile shape
  const profilePicture = profileData?.profile_picture;
  const userProfile = {
    firstName: profileData?.name ?? profileData?.first_name ?? contextUser?.name ?? contextUser?.first_name ?? 'User',
    lastName: profileData?.last_name ?? contextUser?.last_name ?? '',
    email: profileData?.email ?? contextUser?.email ?? '',
    dateOfBirth: profileData?.date_of_birth ?? profileData?.profile?.date_of_birth ?? '',
    gender: (profileData?.gender ?? profileData?.profile?.gender ?? '') as 'M' | 'F' | 'O' | '',
    profilePicture,
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

  const handleDeleteAccount = () => {
    if (ownedClubs.length > 0) {
      const clubNames = ownedClubs.map((club) => club.name).join(', ');
      Alert.alert(
        i18n.t('alerts:deleteAccount.transferRequiredTitle'),
        i18n.t('alerts:deleteAccount.transferRequiredMessage', { clubNames }),
        [
          { text: i18n.t('common:buttons.cancel'), style: 'cancel' },
          { text: i18n.t('alerts:deleteAccount.manageClubs'), onPress: () => router.push('/clubs/my-clubs') },
        ]
      );
      return;
    }

    showConfirmAlert(
      'alerts:deleteAccount.title',
      'alerts:deleteAccount.message',
      async () => {
        setLoading(true);
        try {
          await authApi.deleteAccount();
          signOut();
        } catch (error) {
          console.error('Failed to delete account:', error);
          showErrorAlert('generic');
        } finally {
          setLoading(false);
        }
      },
      'alerts:deleteAccount.confirmButton',
      'alerts:deleteAccount.cancelButton',
      'destructive'
    );
  };

  const handleSaveProfile = async (profile: LocalProfile) => {
    try {
      setLoading(true);

      // Validate date format — abort and show error instead of silently using a fallback
      const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
      if (profile.dateOfBirth && !DOB_REGEX.test(profile.dateOfBirth)) {
        showAlert('alerts:error.title', 'alerts:error.invalidDateFormat');
        return;
      }

      // Map local profile format to API format
      // Backend requires: name, last_name, date_of_birth, gender (all required)
      const updateData: UpdateProfilePayload = {
        name: profile.firstName,  // Backend uses 'name' not 'first_name'
        last_name: profile.lastName,
        date_of_birth: profile.dateOfBirth || undefined,
        // Backend requires gender - use current value or default to 'O'
        gender: (profile.gender || 'O') as 'M' | 'F' | 'O',
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

      // Invalidate cached profile to refetch the updated data from S3
      // (ProfileUpdateSerializer has write_only=True for profile_picture, so it's not returned in update response)
      await queryClient.invalidateQueries({ queryKey: ['profile'] });

      showInfoAlert('alerts:profileUpdated.title', 'alerts:profileUpdated.message');
    } catch (error: unknown) {
      console.error('Failed to update profile:', error);
      const apiMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (apiMessage) {
        // API returned a specific error message — show it directly
        Alert.alert(t('alerts:error.title'), apiMessage);
      } else {
        showErrorAlert('generic');
      }
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
          const permissionMessageKey = Platform.OS === 'ios'
            ? 'alerts:backgroundPermission.iosMessage'
            : 'alerts:backgroundPermission.androidMessage';
          const actionButtonKey = Platform.OS === 'ios'
            ? 'alerts:backgroundPermission.openSettings'
            : 'alerts:backgroundPermission.grantPermission';
          showAlert(
            'alerts:backgroundPermission.title',
            permissionMessageKey,
            [
              { text: i18n.t('alerts:backgroundPermission.cancel'), style: 'cancel' },
              {
                text: i18n.t(actionButtonKey),
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
      showConfirmAlert(
        'alerts:tracking.stopConfirmTitle',
        'alerts:tracking.stopConfirmMessage',
        async () => {
          await toggleTracking();
        },
        'alerts:tracking.stopConfirmButton',
        'common:buttons.cancel',
        'destructive'
      );
    }
  };

  const hasStoreListing = Platform.OS === 'ios' ? IOS_APP_STORE_ID !== 'PLACEHOLDER_IOS_APP_ID' : true;

  const handleRateApp = () => {
    const storeUrl =
      Platform.OS === 'ios'
        ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`
        : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

    Linking.openURL(storeUrl).catch(() =>
      showInfoAlert('alerts:error.title', 'alerts:error.appStore')
    );
  };

  const scrollEdgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [TITLE_FADE_DISTANCE / 2, TITLE_FADE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }));

  const headerTop = insets.top + HEADER_GAP;
  const fullName = `${userProfile.firstName} ${userProfile.lastName}`.trim();
  const appVersion = Constants.expoConfig?.version;
  const themeItems = [
    { key: 'light' as const, label: t('profile:preferences.themeLabelLight', { defaultValue: 'Light' }) },
    { key: 'dark' as const, label: t('profile:preferences.themeLabelDark', { defaultValue: 'Dark' }) },
    { key: 'system' as const, label: t('profile:preferences.themeLabelSystem', { defaultValue: 'System' }) },
  ];
  const unitItems = [
    { key: 'metric' as const, label: t('profile:preferences.unitsMetricShort', { defaultValue: 'Metric' }) },
    { key: 'imperial' as const, label: t('profile:preferences.unitsImperialShort', { defaultValue: 'Imperial' }) },
  ];
  // Plain icons in the brand tint, no tiles.
  const tile = (Icon: typeof UserIcon) => <Icon size={22} color={colors.glassTint} />;

  // Theme / units open an iOS-style pull-down menu anchored to their row.
  const themeRowRef = useRef<View>(null);
  const unitsRowRef = useRef<View>(null);
  const [menu, setMenu] = useState<{ kind: 'theme' | 'units'; anchor: GlassMenuAnchor } | null>(null);
  const openMenu = (kind: 'theme' | 'units', ref: React.RefObject<View | null>) => {
    ref.current?.measureInWindow((x, y, width, height) => setMenu({ kind, anchor: { x, y, width, height } }));
  };
  const valueWithChevron = (label: string) => (
    <View style={styles.menuValue}>
      <ThemedText style={[styles.menuValueText, { color: colors.textSecondary }]}>{label}</ThemedText>
      <ChevronUpDownIcon size={16} color={colors.textSecondary} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      {fetchingProfile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={[styles.loadingText, { color: colors.textSecondary }]}>
            {t('common:loading.profile')}
          </ThemedText>
        </View>
      ) : (
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: headerTop + HEADER_GAP, paddingBottom: tabBarInset },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={tabBarScroll}
          scrollEventThrottle={16}
        >
          <View style={styles.profileCard}>
            <ProfileCard
              firstName={userProfile.firstName}
              lastName={userProfile.lastName}
              fullName={fullName}
              email={userProfile.email || undefined}
              imageUri={userProfile.profilePicture}
              onPress={() => setShowEditProfile(true)}
            />
          </View>

          {/* Account */}
          <SettingsGroup title={t('profile:sections.account')} index={0}>
            <SettingsItem
              icon={tile(LockClosedIcon)}
              title={t('profile:account.changePassword', { defaultValue: 'Change Password' })}
              subtitle={t('profile:account.changePasswordSubtitle', { defaultValue: 'Update your account password' })}
              onPress={() => setShowChangePassword(true)}
              grouped
              isLast
            />
          </SettingsGroup>

          {/* Preferences */}
          <SettingsGroup title={t('profile:sections.preferences')} index={1}>
            <View ref={themeRowRef} collapsable={false}>
              <SettingsItem
                icon={tile(SunIcon)}
                  title={t('profile:preferences.theme')}
                showChevron={false}
                rightElement={valueWithChevron(themeItems.find((item) => item.key === themeMode)?.label ?? '')}
                onPress={() => openMenu('theme', themeRowRef)}
                grouped
              />
            </View>
            <SettingsItem
              icon={tile(DevicePhoneMobileIcon)}
              title={t('profile:backgroundTracking.title', { defaultValue: 'Background Tracking' })}
              subtitle={
                isTracking
                  ? t('profile:backgroundTracking.subtitleOn', { defaultValue: 'Automatically tracking your activities' })
                  : t('profile:backgroundTracking.subtitleOff', { defaultValue: 'Track activities in the background' })
              }
              toggleValue={isTracking}
              onToggleChange={handleBackgroundTrackingToggle}
              toggleColor={colors.trackingActive}
              showChevron={false}
              grouped
            />
            <SettingsItem
              icon={tile(HeartIcon)}
              title={t('profile:trackingHealth.title')}
              subtitle={t('profile:trackingHealth.subtitle')}
              onPress={() => router.push('/settings/tracking-health')}
              grouped
            />
            <View ref={unitsRowRef} collapsable={false}>
              <SettingsItem
                icon={tile(ScaleIcon)}
                  title={t('profile:preferences.unitsOfMeasure')}
                showChevron={false}
                rightElement={valueWithChevron(unitItems.find((item) => item.key === unitSystem)?.label ?? '')}
                onPress={() => openMenu('units', unitsRowRef)}
                grouped
              />
            </View>
            <SettingsItem
              icon={tile(GlobeAltIcon)}
              title={t('profile:preferences.systemLanguage')}
              value={SUPPORTED_LANGUAGES[currentLanguage]}
              onPress={() => setShowLanguagePicker(true)}
              grouped
              isLast
            />
          </SettingsGroup>

          {/* Privacy & Notifications */}
          <SettingsGroup title={t('profile:sections.privacyNotifications')} index={2}>
            <SettingsItem
              icon={tile(ShieldCheckIcon)}
              title={t('profile:privacy.privacy')}
              subtitle={t('profile:privacy.privacySubtitle')}
              onPress={() => {
                Linking.openURL(PRIVACY_POLICY_URL).catch(() =>
                  showInfoAlert('alerts:error.title', 'alerts:error.generic')
                );
              }}
              grouped
            />
            <SettingsItem
              icon={tile(BellIcon)}
              title={t('profile:privacy.notificationSettings')}
              subtitle={t('profile:privacy.notificationSettingsSubtitle')}
              onPress={() => router.push('/settings/notifications')}
              grouped
            />
            <SettingsItem
              icon={tile(LifebuoyIcon)}
              title={t('profile:privacy.contactSupport')}
              subtitle={t('profile:privacy.contactSupportSubtitle')}
              onPress={async () => {
                const url = `mailto:${SUPPORT_EMAIL}`;
                const canOpen = await Linking.canOpenURL(url).catch(() => false);
                if (canOpen) {
                  Linking.openURL(url).catch(() =>
                    Alert.alert(t('alerts:error.title'), t('alerts:error.mailUnavailable', { email: SUPPORT_EMAIL }))
                  );
                } else {
                  Alert.alert(t('alerts:error.title'), t('alerts:error.mailUnavailable', { email: SUPPORT_EMAIL }));
                }
              }}
              grouped
              isLast
            />
          </SettingsGroup>

          {/* Feedback */}
          <SettingsGroup title={t('profile:sections.feedback')} index={3}>
            <SettingsItem
              icon={tile(ChatBubbleBottomCenterTextIcon)}
              title={t('profile:feedback.sendFeedback')}
              subtitle={t('profile:feedback.sendFeedbackSubtitle')}
              onPress={() => router.push('/feedback')}
              grouped
              isLast={!hasStoreListing}
            />
            {hasStoreListing && (
              <SettingsItem
                icon={tile(StarIcon)}
                  title={t('profile:feedback.rateUs')}
                subtitle={t('profile:feedback.rateUsSubtitle')}
                onPress={handleRateApp}
                grouped
                isLast
              />
            )}
          </SettingsGroup>

          {/* Developer - visible in dev and preview builds */}
          {isDebugBuild && (
            <SettingsGroup title={t('profile:sections.developer', { defaultValue: 'Developer' })} index={4}>
              <SettingsItem
                icon={tile(WrenchScrewdriverIcon)}
                  title={t('profile:developer.debugTracking', { defaultValue: 'Debug Tracking' })}
                subtitle={t('profile:developer.debugTrackingSubtitle', {
                  defaultValue: 'View real-time tracking status and diagnostics',
                })}
                onPress={() => router.push('/debug-tracking')}
                grouped
                isLast
              />
            </SettingsGroup>
          )}

          {/* Log out */}
          <SettingsGroup index={5}>
            <SettingsItem
              title={t('profile:logout')}
              titleColor={colors.error}
              onPress={handleLogout}
              centered
              grouped
              isLast
            />
          </SettingsGroup>

          {/* Delete account */}
          <View style={styles.deleteAccountSection}>
            <Button
              title={t('profile:deleteAccount')}
              onPress={handleDeleteAccount}
              variant="text"
              size="small"
              loading={loading}
              textStyle={{ color: colors.error }}
            />
          </View>

          {appVersion ? (
            <ThemedText style={[styles.version, { color: colors.textSecondary }]}>
              {t('profile:version', { version: appVersion, defaultValue: 'Version {{version}}' })}
            </ThemedText>
          ) : null}
        </Animated.ScrollView>
      )}

      {/* Scroll-edge fade under the status bar */}
      <Animated.View
        pointerEvents="none"
        style={[styles.scrollEdge, { height: headerTop + 24 }, scrollEdgeStyle]}
      >
        <LinearGradient
          colors={[colors.backgroundSecondary, colors.backgroundSecondary + '00']}
          locations={[0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <GlassMenu
        anchor={menu?.anchor ?? null}
        options={menu?.kind === 'units' ? unitItems : themeItems}
        selected={menu?.kind === 'units' ? unitSystem : themeMode}
        onSelect={(key) => {
          if (menu?.kind === 'units') void setUnitSystem(key as typeof unitSystem);
          else setThemeMode(key as typeof themeMode);
          setMenu(null);
        }}
        onClose={() => setMenu(null)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profile={userProfile}
        onSave={handleSaveProfile}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Language Picker */}
      <LanguagePicker
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  menuValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  menuValueText: {
    fontSize: 16,
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
  scrollEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  deleteAccountSection: {
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 8,
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
});
