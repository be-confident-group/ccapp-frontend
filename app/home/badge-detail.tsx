import { StyleSheet, View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui';
import { Spacing, BorderRadius } from '@/constants/theme';
import { mockBadges } from '@/lib/utils/mockData';
import { ChevronLeftIcon } from 'react-native-heroicons/outline';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BadgeDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const badge = mockBadges.find((b) => b.id === id);

  if (!badge) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.centered}>
          <ThemedText>Badge not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const isEarned = badge.earned;
  const hasProgress = badge.progress !== undefined && badge.target;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ThemedView style={styles.container}>
        {/* Header with Back Button */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeftIcon size={28} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Badge Display */}
          <Card variant="elevated">
            <View style={styles.badgeHeader}>
              <View style={[styles.iconContainer, { opacity: isEarned ? 1 : 0.4 }]}>
                <Image
                  source={require('@/assets/images/page-icons/trophy.png')}
                  style={styles.trophyIcon}
                />
              </View>

            <ThemedText type="title" style={styles.badgeName}>
              {badge.name}
            </ThemedText>

            <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
              {badge.description}
            </ThemedText>

            {isEarned && badge.earnedDate && (
              <View style={styles.earnedContainer}>
                <ThemedText style={[styles.earnedLabel, { color: colors.textMuted }]}>
                  Earned on
                </ThemedText>
                <ThemedText type="defaultSemiBold" style={styles.earnedDate}>
                  {new Date(badge.earnedDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </ThemedText>
              </View>
            )}

            {!isEarned && hasProgress && (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[styles.progressLabel, { color: colors.textMuted }]}>
                    Progress
                  </ThemedText>
                  <ThemedText type="defaultSemiBold">
                    {badge.progress}/{badge.target}
                  </ThemedText>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${((badge.progress || 0) / (badge.target || 1)) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <ThemedText style={[styles.progressRemaining, { color: colors.textMuted }]}>
                  {(badge.target || 0) - (badge.progress || 0)} more to unlock
                </ThemedText>
              </View>
            )}
          </View>
        </Card>

        {/* How to Earn (for locked badges) */}
        {!isEarned && (
          <View style={styles.section}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              How to Earn
            </ThemedText>
            <Card variant="outlined">
              <ThemedText style={[styles.howToText, { color: colors.textSecondary }]}>
                {badge.description}
              </ThemedText>
            </Card>
          </View>
        )}
        </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeHeader: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trophyIcon: {
    width: 120,
    height: 120,
    resizeMode: 'contain',
  },
  badgeName: {
    fontSize: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  earnedContainer: {
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.sm,
  },
  earnedLabel: {
    fontSize: 14,
  },
  earnedDate: {
    fontSize: 16,
  },
  progressContainer: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
  },
  progressBar: {
    height: 8,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BorderRadius.sm,
  },
  progressRemaining: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  howToText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
