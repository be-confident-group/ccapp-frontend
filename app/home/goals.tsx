/**
 * ===========================================
 * GOALS PAGE - PLANNED FOR NEXT VERSION
 * ===========================================
 * This page is hidden from the main navigation but kept
 * functional for future release. The Goals section on the
 * home page is commented out to hide this feature from users.
 */

import { StyleSheet, View, ScrollView } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Card } from '@/components/ui';
import { Spacing, BorderRadius } from '@/constants/theme';
import { mockGoals } from '@/lib/utils/mockData';

export default function GoalsScreen() {
  const { colors } = useTheme();

  const activeGoals = mockGoals.filter((g) => g.active);

  const getGoalIcon = (type: string) => {
    switch (type) {
      case 'distance':
        return '📏';
      case 'rides':
        return '🚴';
      case 'co2':
        return '🌱';
      default:
        return '🎯';
    }
  };

  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return 'No deadline';
    const date = new Date(deadline);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `${diffDays} days left`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText type="subtitle">Active Goals</ThemedText>
          <ThemedText style={[styles.goalCount, { color: colors.textMuted }]}>
            {activeGoals.length} active
          </ThemedText>
        </View>

        {activeGoals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          const isComplete = goal.current >= goal.target;

          return (
            <Card key={goal.id} variant="elevated" style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View style={styles.goalTitleRow}>
                  <ThemedText style={styles.goalIcon}>{getGoalIcon(goal.type)}</ThemedText>
                  <View style={styles.goalTitleContainer}>
                    <ThemedText type="defaultSemiBold" style={styles.goalTitle}>
                      {goal.title}
                    </ThemedText>
                    {goal.deadline && (
                      <ThemedText style={[styles.deadline, { color: colors.textMuted }]}>
                        {formatDeadline(goal.deadline)}
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <ThemedText style={[styles.progressLabel, { color: colors.textMuted }]}>
                    Progress
                  </ThemedText>
                  <ThemedText type="defaultSemiBold">
                    {goal.current} / {goal.target} {goal.unit}
                  </ThemedText>
                </View>

                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: isComplete ? colors.success : colors.primary,
                        width: `${Math.min(progress, 100)}%`,
                      },
                    ]}
                  />
                </View>

                <ThemedText style={[styles.progressPercent, { color: colors.textMuted }]}>
                  {Math.round(progress)}% complete
                </ThemedText>
              </View>

              {isComplete && (
                <View style={[styles.completeBadge, { backgroundColor: colors.success }]}>
                  <ThemedText style={styles.completeText}>✓ Completed</ThemedText>
                </View>
              )}
            </Card>
          );
        })}

        {activeGoals.length === 0 && (
          <View style={styles.emptyState}>
            <ThemedText style={styles.emptyIcon}>🎯</ThemedText>
            <ThemedText type="subtitle" style={styles.emptyTitle}>
              No Active Goals
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.textMuted }]}>
              Create a goal to start tracking your progress
            </ThemedText>
          </View>
        )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  goalCount: {
    fontSize: 14,
  },
  goalCard: {
    marginBottom: Spacing.md,
  },
  goalHeader: {
    marginBottom: Spacing.md,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  goalIcon: {
    fontSize: 24,
  },
  goalTitleContainer: {
    flex: 1,
    gap: 4,
  },
  goalTitle: {
    fontSize: 16,
  },
  deadline: {
    fontSize: 14,
  },
  progressSection: {
    gap: Spacing.sm,
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
  progressPercent: {
    fontSize: 14,
    textAlign: 'center',
  },
  completeBadge: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  completeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
