import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StartRideFAB, StatCard } from '@/components/tracking';
import {
  FireIcon,
  TrophyIcon,
  BeakerIcon,
  Cog6ToothIcon,
  BellIcon,
  ChevronRightIcon,
} from 'react-native-heroicons/outline';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { mockBadges } from '@/lib/utils/mockData';

export default function HomeScreen() {
  const { colors } = useTheme();

  const earnedBadges = mockBadges.filter(b => b.earned).slice(0, 3);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <View style={[styles.headerContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.headerIcon}>
            <Cog6ToothIcon size={28} color={colors.icon} />
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.headerTitle}>
            Home
          </ThemedText>

          <TouchableOpacity style={styles.headerIcon}>
            <BellIcon size={28} color={colors.icon} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Grid */}
          <View style={styles.statsSection}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => router.push('/home/stats-detail')}
            >
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Your Stats
              </ThemedText>
              <ChevronRightIcon size={20} color={colors.icon} />
            </TouchableOpacity>
            <View style={styles.statsGrid}>
              <StatCard
                icon={<TrophyIcon size={24} color="#fff" />}
                label="Total Distance"
                value="125.5"
                unit="km"
                onPress={() => router.push('/home/stats-detail')}
              />
              <StatCard
                icon={<FireIcon size={24} color="#fff" />}
                label="Total Rides"
                value="42"
                onPress={() => router.push('/home/stats-detail')}
              />
              <StatCard
                icon={<BeakerIcon size={24} color="#fff" />}
                label="CO2 Saved"
                value="15.2"
                unit="kg"
                onPress={() => router.push('/home/stats-detail')}
              />
              <StatCard
                icon={<FireIcon size={24} color="#fff" />}
                label="Streak"
                value="7"
                unit="days"
                onPress={() => router.push('/home/stats-detail')}
              />
            </View>
          </View>

          {/* Recent Badges */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => router.push('/home/badges')}
            >
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Recent Badges
              </ThemedText>
              <ChevronRightIcon size={20} color={colors.icon} />
            </TouchableOpacity>
            <View style={styles.badgesRow}>
              {earnedBadges.map((badge) => (
                <TouchableOpacity
                  key={badge.id}
                  style={[styles.badgeItem, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/home/badge-detail?id=${badge.id}`)}
                >
                  <ThemedText style={styles.badgeEmoji}>{badge.icon}</ThemedText>
                  <ThemedText style={styles.badgeName} numberOfLines={1}>{badge.name}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Goals Progress */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => router.push('/home/goals')}
            >
              <ThemedText type="subtitle" style={styles.sectionTitle}>
                Goals
              </ThemedText>
              <ChevronRightIcon size={20} color={colors.icon} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.placeholder}
              onPress={() => router.push('/home/goals')}
            >
              <ThemedText style={styles.placeholderText}>
                🎯 Tap to view your goals
              </ThemedText>
            </TouchableOpacity>
          </View>

          {/* Bottom spacing for FAB */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Floating Start Ride Button */}
        <StartRideFAB />
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
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  statsSection: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    marginBottom: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  badgeItem: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  badgeEmoji: {
    fontSize: 32,
  },
  badgeName: {
    fontSize: 12,
    textAlign: 'center',
  },
  placeholder: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(128, 128, 128, 0.3)',
    minHeight: 120,
  },
  placeholderText: {
    opacity: 0.6,
    fontSize: 16,
  },
  bottomSpacer: {
    height: 80, // Space for the FAB button (reduced)
  },
});
