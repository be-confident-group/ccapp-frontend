import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui';
import { Spacing, BorderRadius } from '@/constants/theme';
import { mockBadges } from '@/lib/utils/mockData';

export default function BadgesScreen() {
  const { colors } = useTheme();

  const earnedBadges = mockBadges.filter((b) => b.earned);
  const lockedBadges = mockBadges.filter((b) => !b.earned);

  const handleBadgePress = (badgeId: string) => {
    router.push(`/home/badge-detail?id=${badgeId}`);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Earned Badges */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Earned ({earnedBadges.length})
          </ThemedText>
          <View style={styles.badgesGrid}>
            {earnedBadges.map((badge) => (
              <TouchableOpacity
                key={badge.id}
                style={styles.badgeWrapper}
                onPress={() => handleBadgePress(badge.id)}
                activeOpacity={0.7}
              >
                <Card variant="elevated">
                  <View style={styles.badgeContent}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                      <ThemedText style={styles.badgeIcon}>{badge.icon}</ThemedText>
                    </View>
                    <ThemedText type="defaultSemiBold" style={styles.badgeName} numberOfLines={2}>
                      {badge.name}
                    </ThemedText>
                    {badge.earnedDate && (
                      <ThemedText style={[styles.badgeDate, { color: colors.textMuted }]}>
                        {new Date(badge.earnedDate).toLocaleDateString()}
                      </ThemedText>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Locked Badges */}
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Locked ({lockedBadges.length})
          </ThemedText>
          <View style={styles.badgesGrid}>
            {lockedBadges.map((badge) => (
              <TouchableOpacity
                key={badge.id}
                style={styles.badgeWrapper}
                onPress={() => handleBadgePress(badge.id)}
                activeOpacity={0.7}
              >
                <Card variant="outlined">
                  <View style={styles.badgeContent}>
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: colors.surface, opacity: 0.5 },
                      ]}
                    >
                      <ThemedText style={styles.badgeIcon}>🔒</ThemedText>
                    </View>
                    <ThemedText
                      type="defaultSemiBold"
                      style={[styles.badgeName, { opacity: 0.6 }]}
                      numberOfLines={2}
                    >
                      {badge.name}
                    </ThemedText>
                    {badge.progress !== undefined && badge.target && (
                      <ThemedText style={[styles.badgeProgress, { color: colors.textMuted }]}>
                        {badge.progress}/{badge.target}
                      </ThemedText>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
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
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  badgeWrapper: {
    width: '48%',
  },
  badgeContent: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeIcon: {
    fontSize: 32,
  },
  badgeName: {
    fontSize: 14,
    textAlign: 'center',
    minHeight: 36,
  },
  badgeDate: {
    fontSize: 12,
  },
  badgeProgress: {
    fontSize: 12,
  },
});
