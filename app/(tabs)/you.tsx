import React, { useState } from 'react';
import { StyleSheet, View, Alert, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
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
  LinkIcon,
} from 'react-native-heroicons/outline';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { ActivityChart } from '@/components/profile/ActivityChart';
import { SettingsItem } from '@/components/profile/SettingsItem';
import { EditProfileModal } from '@/components/profile/EditProfileModal';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { showConfirmAlert, showInfoAlert, showComingSoonAlert } from '@/lib/utils/alert';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n/types';

export default function YouScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { currentLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(true);

  // Mock user data - replace with actual user data from context/API
  const [userProfile, setUserProfile] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    dateOfBirth: '1990-05-15',
    gender: 'M' as 'M' | 'F' | 'O' | '',
    profilePicture: undefined as string | undefined,
    joinedDate: 'Sep 2025',
  });

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

  const handleSaveProfile = (profile: any) => {
    setUserProfile({ ...userProfile, ...profile });
    showInfoAlert('alerts:profileUpdated.title', 'alerts:profileUpdated.message');
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

          {/* Activity Chart Card */}
          <View style={styles.chartSection}>
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
          </View>

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
                  onPress={toggleTheme}
                  showChevron={false}
                  rightElement={
                    <TouchableOpacity
                      onPress={toggleTheme}
                      style={[
                        styles.themeBadge,
                        {
                          backgroundColor: isDark
                            ? colors.primary + '20'
                            : colors.backgroundSecondary,
                        },
                      ]}
                    >
                      <ThemedText style={[styles.themeBadgeText, { color: colors.primary }]}>
                        {isDark ? t('profile:preferences.themeLabelDark') : t('profile:preferences.themeLabelLight')}
                      </ThemedText>
                    </TouchableOpacity>
                  }
                  isFirst
                />
                <SettingsItem
                  icon={<GlobeAltIcon size={22} color={colors.text} />}
                  title={t('profile:preferences.systemLanguage')}
                  subtitle={SUPPORTED_LANGUAGES[currentLanguage]}
                  onPress={() => setShowLanguagePicker(true)}
                />
                <SettingsItem
                  icon={<Cog6ToothIcon size={22} color={colors.text} />}
                  title={t('profile:preferences.unitsOfMeasure')}
                  subtitle={t('profile:preferences.unitsMetric')}
                  onPress={() => showComingSoonAlert('unitSettings')}
                  isLast
                />
              </View>
            </View>
          </View>

          {/* Integrations Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>{t('profile:sections.integrations')}</ThemedText>
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
                  icon={<LinkIcon size={22} color={colors.text} />}
                  title={t('profile:integrations.connectedApps')}
                  subtitle={t('profile:integrations.connectedAppsSubtitle')}
                  onPress={() => showComingSoonAlert('appConnections')}
                  isFirst
                />
                <SettingsItem
                  icon={<DevicePhoneMobileIcon size={22} color={colors.text} />}
                  title={t('profile:integrations.backgroundTracking')}
                  subtitle={t('profile:integrations.backgroundTrackingSubtitle')}
                  onPress={() => showComingSoonAlert('backgroundTracking')}
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
                  onPress={() => showComingSoonAlert('privacySettings')}
                  isFirst
                />
                <SettingsItem
                  icon={<BellIcon size={22} color={colors.text} />}
                  title={t('profile:privacy.dailyReminder')}
                  subtitle={t('profile:privacy.dailyReminderSubtitle')}
                  toggleValue={dailyReminderEnabled}
                  onToggleChange={setDailyReminderEnabled}
                  showChevron={false}
                />
                <SettingsItem
                  icon={<BellIcon size={22} color={colors.text} />}
                  title={t('profile:privacy.notificationSettings')}
                  subtitle={t('profile:privacy.notificationSettingsSubtitle')}
                  onPress={() => showComingSoonAlert('notificationSettings')}
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

          {/* Log Out Button */}
          <View style={styles.logoutSection}>
            <Button
              title={t('profile:logout')}
              onPress={handleLogout}
              variant="outline"
              size="large"
              fullWidth
              loading={loading}
              icon={<ArrowRightOnRectangleIcon size={20} color={colors.error} />}
              iconPosition="left"
            />
          </View>
        </ScrollView>

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
  chartSection: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  chartCard: {
    borderRadius: 16,
  },
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
  chartContent: {
    padding: 20,
  },
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
