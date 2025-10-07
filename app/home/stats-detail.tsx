import { StyleSheet, View, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { mockDetailedStats } from '@/lib/utils/mockData';

export default function StatsDetailScreen() {
  const { colors } = useTheme();

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* This Week */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            This Week
          </ThemedText>
          <Card variant="elevated">
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Distance</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.thisWeek.distance} km
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Rides</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.thisWeek.rides}
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Avg Speed</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.thisWeek.avgSpeed} km/h
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Duration</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {formatDuration(mockDetailedStats.thisWeek.duration)}
              </ThemedText>
            </View>
          </Card>
        </View>

        {/* This Month */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            This Month
          </ThemedText>
          <Card variant="elevated">
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Distance</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.thisMonth.distance} km
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Rides</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.thisMonth.rides}
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Avg Speed</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.thisMonth.avgSpeed} km/h
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Duration</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {formatDuration(mockDetailedStats.thisMonth.duration)}
              </ThemedText>
            </View>
          </Card>
        </View>

        {/* All Time */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            All Time
          </ThemedText>
          <Card variant="elevated">
            <View style={styles.statRow}>
              <ThemedText style={styles.statLabel}>Distance</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.allTime.distance} km
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Rides</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.allTime.rides}
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Avg Speed</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.allTime.avgSpeed} km/h
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>Duration</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {formatDuration(mockDetailedStats.allTime.duration)}
              </ThemedText>
            </View>
            <View style={[styles.statRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <ThemedText style={styles.statLabel}>CO2 Saved</ThemedText>
              <ThemedText type="defaultSemiBold" style={styles.statValue}>
                {mockDetailedStats.allTime.co2Saved} kg
              </ThemedText>
            </View>
          </Card>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  statLabel: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 16,
  },
});
