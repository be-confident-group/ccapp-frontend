import React, { useState } from 'react';
import { StyleSheet, View, Alert, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
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

export default function YouScreen() {
  const { signOut } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
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
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          await signOut();
        },
      },
    ]);
  };

  const handleSaveProfile = (profile: any) => {
    setUserProfile({ ...userProfile, ...profile });
    Alert.alert('Success', 'Profile updated successfully!');
  };

  const handleRateApp = () => {
    const storeUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/id123456789' // Replace with actual App Store ID
        : 'https://play.google.com/store/apps/details?id=com.ccapp'; // Replace with actual package name

    Linking.openURL(storeUrl).catch(() =>
      Alert.alert('Error', 'Unable to open app store')
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
              Joined {userProfile.joinedDate}
            </ThemedText>
          </View>

          {/* Activity Chart Card */}
          <View style={styles.chartSection}>
            <View
              style={[
                styles.chartCard,
                { backgroundColor: colors.card },
                styles.cardShadow,
              ]}
            >
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

          {/* Account Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Account</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#DBEAFE' }]}>
                    <UserIcon size={20} color="#3B82F6" />
                  </View>
                }
                title="Edit Profile"
                subtitle="Update your personal information"
                onPress={() => setShowEditProfile(true)}
                isFirst
                isLast
              />
            </View>
          </View>

          {/* Preferences Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Preferences</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: isDark ? '#FEF3C7' : '#FEF3C7' }]}>
                    <SunIcon size={20} color={isDark ? '#F59E0B' : '#D97706'} />
                  </View>
                }
                title="Theme"
                subtitle={isDark ? 'Dark mode' : 'Light mode'}
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
                      {isDark ? 'Dark' : 'Light'}
                    </ThemedText>
                  </TouchableOpacity>
                }
                isFirst
              />
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#E0E7FF' }]}>
                    <GlobeAltIcon size={20} color="#6366F1" />
                  </View>
                }
                title="System Language"
                subtitle="English"
                onPress={() => Alert.alert('Coming Soon', 'Language settings will be available soon.')}
              />
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#FCE7F3' }]}>
                    <Cog6ToothIcon size={20} color="#EC4899" />
                  </View>
                }
                title="Units of Measure"
                subtitle="Metric (km, kg)"
                onPress={() => Alert.alert('Coming Soon', 'Unit settings will be available soon.')}
                isLast
              />
            </View>
          </View>

          {/* Integrations Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Integrations</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#D1FAE5' }]}>
                    <LinkIcon size={20} color="#10B981" />
                  </View>
                }
                title="Connected Apps & Devices"
                subtitle="Strava, Apple Health, Google Fit"
                onPress={() =>
                  Alert.alert('Coming Soon', 'App and device connections will be available soon.')
                }
                isFirst
              />
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#FEE2E2' }]}>
                    <DevicePhoneMobileIcon size={20} color="#EF4444" />
                  </View>
                }
                title="Phone Background Tracking"
                subtitle="Track rides automatically"
                onPress={() =>
                  Alert.alert('Coming Soon', 'Background tracking settings will be available soon.')
                }
                isLast
              />
            </View>
          </View>

          {/* Privacy & Notifications Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Privacy & Notifications</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#FEF3C7' }]}>
                    <ShieldCheckIcon size={20} color="#F59E0B" />
                  </View>
                }
                title="Privacy"
                subtitle="Manage your privacy settings"
                onPress={() => Alert.alert('Coming Soon', 'Privacy settings will be available soon.')}
                isFirst
              />
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#DBEAFE' }]}>
                    <BellIcon size={20} color="#3B82F6" />
                  </View>
                }
                title="Daily Reminder"
                subtitle="Get reminded to log your rides"
                toggleValue={dailyReminderEnabled}
                onToggleChange={setDailyReminderEnabled}
                showChevron={false}
              />
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#E0E7FF' }]}>
                    <BellIcon size={20} color="#6366F1" />
                  </View>
                }
                title="Notification Settings"
                subtitle="Manage all notifications"
                onPress={() =>
                  Alert.alert('Coming Soon', 'Notification settings will be available soon.')
                }
                isLast
              />
            </View>
          </View>

          {/* Feedback Section */}
          <View style={styles.settingsSection}>
            <ThemedText style={styles.sectionTitle}>Feedback</ThemedText>
            <View style={[styles.settingsCard, styles.cardShadow]}>
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#FCE7F3' }]}>
                    <ChatBubbleBottomCenterTextIcon size={20} color="#EC4899" />
                  </View>
                }
                title="Send Feedback"
                subtitle="Share your thoughts with us"
                onPress={() => router.push('/feedback')}
                isFirst
              />
              <SettingsItem
                icon={
                  <View style={[styles.iconWrapper, { backgroundColor: '#FEF3C7' }]}>
                    <StarIcon size={20} color="#F59E0B" />
                  </View>
                }
                title="Rate Us"
                subtitle="Rate us on the App Store"
                onPress={handleRateApp}
                isLast
              />
            </View>
          </View>

          {/* Log Out Button */}
          <View style={styles.logoutSection}>
            <Button
              title="Log Out"
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
    overflow: 'hidden',
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
